import { isNumericType } from "./types.js";

/**
 * All cleaning actions here are destructive by nature (delete/update rows),
 * so two things are non-negotiable across this whole module:
 *   1. every "do it" endpoint has a paired "preview" that changes nothing
 *   2. a snapshot of each table's original state is taken once, at upload
 *      time, so a session can always be reset back to what was uploaded
 */

const SNAPSHOT_SUFFIX = "__original";

function renamedCreateStatement(db, existingTableName, newTableName) {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(existingTableName);
  // Replace only the table-name token right after CREATE TABLE, leaving the
  // column definitions (and their exact declared types) untouched. Matches
  // a double-quoted identifier (may contain spaces, e.g. "Order Details"),
  // a bracket-quoted identifier (T-SQL style, e.g. [Region] -- SQLite
  // stores these verbatim rather than normalizing them), or a bare word.
  return row.sql.replace(/CREATE TABLE\s+("[^"]+"|\[[^\]]+\]|\w+)/i, `CREATE TABLE "${newTableName}"`);
}

export function snapshotTable(db, tableName) {
  const snapshotName = `${tableName}${SNAPSHOT_SUFFIX}`;
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(snapshotName);
  if (exists) return;

  db.exec(renamedCreateStatement(db, tableName, snapshotName));
  db.exec(`INSERT INTO "${snapshotName}" SELECT * FROM "${tableName}"`);
}

export function resetTable(db, tableName) {
  const snapshotName = `${tableName}${SNAPSHOT_SUFFIX}`;
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(snapshotName);

  if (!exists) {
    const err = new Error(`No original snapshot found for "${tableName}".`);
    err.status = 404;
    throw err;
  }

  db.exec(`DROP TABLE "${tableName}"`);
  db.exec(renamedCreateStatement(db, snapshotName, tableName));
  db.exec(`INSERT INTO "${tableName}" SELECT * FROM "${snapshotName}"`);
}

/** Tables ending in the snapshot suffix are internal -- never shown to the user. */
export function isSnapshotTable(tableName) {
  return tableName.endsWith(SNAPSHOT_SUFFIX);
}

// ---------- Duplicates (exact full-row match) ----------

function columnList(columns) {
  return columns.map((c) => `"${c.name}"`).join(", ");
}

export function previewDuplicates(db, tableName, columns) {
  const cols = columnList(columns);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;
  const distinct = db
    .prepare(`SELECT COUNT(*) AS n FROM (SELECT DISTINCT ${cols} FROM "${tableName}")`)
    .get().n;
  const affectedRowCount = total - distinct;

  const groups = db
    .prepare(
      `SELECT COUNT(*) AS groupSize, ${cols} FROM "${tableName}" GROUP BY ${cols} HAVING COUNT(*) > 1 ORDER BY groupSize DESC LIMIT 10`
    )
    .all();

  return { affectedRowCount, sampleGroups: groups };
}

export function removeDuplicates(db, tableName, columns) {
  const cols = columnList(columns);
  const before = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;

  db.exec(
    `DELETE FROM "${tableName}" WHERE rowid NOT IN (SELECT MIN(rowid) FROM "${tableName}" GROUP BY ${cols})`
  );

  const after = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;
  return { removedCount: before - after, newRowCount: after };
}

// ---------- Nulls ----------

function median(sortedValues) {
  const n = sortedValues.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

export function handleNulls(db, tableName, columnName, columnType, strategy, customValue) {
  const isNumeric = isNumericType(columnType);
  const before = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}" WHERE "${columnName}" IS NULL`).get().n;

  if (before === 0) return { affectedCount: 0 };

  if (strategy === "drop") {
    db.exec(`DELETE FROM "${tableName}" WHERE "${columnName}" IS NULL`);
    return { affectedCount: before };
  }

  if (strategy === "fill_value") {
    if (customValue === undefined || customValue === "") {
      const err = new Error("A fill value is required for the 'fill_value' strategy.");
      err.status = 400;
      throw err;
    }
    db.prepare(`UPDATE "${tableName}" SET "${columnName}" = ? WHERE "${columnName}" IS NULL`).run(customValue);
    return { affectedCount: before };
  }

  if (strategy === "fill_mode") {
    const modeRow = db
      .prepare(
        `SELECT "${columnName}" AS v, COUNT(*) AS c FROM "${tableName}" WHERE "${columnName}" IS NOT NULL GROUP BY "${columnName}" ORDER BY c DESC LIMIT 1`
      )
      .get();
    if (!modeRow) return { affectedCount: 0 };
    db.prepare(`UPDATE "${tableName}" SET "${columnName}" = ? WHERE "${columnName}" IS NULL`).run(modeRow.v);
    return { affectedCount: before };
  }

  if (strategy === "fill_mean" || strategy === "fill_median") {
    if (!isNumeric) {
      const err = new Error(`"${strategy}" only applies to numeric columns.`);
      err.status = 400;
      throw err;
    }

    if (strategy === "fill_mean") {
      const { avg } = db
        .prepare(`SELECT AVG("${columnName}") AS avg FROM "${tableName}" WHERE "${columnName}" IS NOT NULL`)
        .get();
      db.prepare(`UPDATE "${tableName}" SET "${columnName}" = ? WHERE "${columnName}" IS NULL`).run(avg);
    } else {
      const values = db
        .prepare(`SELECT "${columnName}" AS v FROM "${tableName}" WHERE "${columnName}" IS NOT NULL ORDER BY "${columnName}"`)
        .all()
        .map((r) => r.v);
      const med = median(values);
      db.prepare(`UPDATE "${tableName}" SET "${columnName}" = ? WHERE "${columnName}" IS NULL`).run(med);
    }
    return { affectedCount: before };
  }

  const err = new Error(`Unknown null-handling strategy "${strategy}".`);
  err.status = 400;
  throw err;
}

// ---------- Outliers (IQR method) ----------

function quantile(sortedValues, p) {
  const n = sortedValues.length;
  if (n === 0) return null;
  const index = (n - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function iqrBounds(db, tableName, columnName) {
  const values = db
    .prepare(`SELECT "${columnName}" AS v FROM "${tableName}" WHERE "${columnName}" IS NOT NULL ORDER BY "${columnName}"`)
    .all()
    .map((r) => r.v);

  if (values.length < 4) return null; // not enough data for a meaningful IQR

  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export function previewOutliers(db, tableName, columnName, columnType) {
  if (!isNumericType(columnType)) {
    const err = new Error("Outlier detection only applies to numeric columns.");
    err.status = 400;
    throw err;
  }

  const bounds = iqrBounds(db, tableName, columnName);
  if (!bounds) return { bounds: null, flaggedCount: 0, samples: [] };

  const flaggedCount = db
    .prepare(`SELECT COUNT(*) AS n FROM "${tableName}" WHERE "${columnName}" < ? OR "${columnName}" > ?`)
    .get(bounds.lower, bounds.upper).n;

  const samples = db
    .prepare(`SELECT "${columnName}" AS v FROM "${tableName}" WHERE "${columnName}" < ? OR "${columnName}" > ? LIMIT 5`)
    .all(bounds.lower, bounds.upper)
    .map((r) => r.v);

  return { bounds, flaggedCount, samples };
}

export function removeOutliers(db, tableName, columnName, columnType) {
  const bounds = iqrBounds(db, tableName, columnName);
  if (!bounds) return { removedCount: 0 };

  const before = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;
  db.prepare(`DELETE FROM "${tableName}" WHERE "${columnName}" < ? OR "${columnName}" > ?`).run(
    bounds.lower,
    bounds.upper
  );
  const after = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;

  return { removedCount: before - after, newRowCount: after };
}
