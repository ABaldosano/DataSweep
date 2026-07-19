import { previewDuplicates } from "./cleaner.js";

const SNAPSHOT_SUFFIX = "__original";

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportAsCsv(db, tableName, columns) {
  const header = columns.map((c) => csvEscape(c.name)).join(",");
  const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
  const lines = rows.map((row) => columns.map((c) => csvEscape(row[c.name])).join(","));
  return [header, ...lines].join("\r\n") + "\r\n";
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function exportAsSql(db, tableName, columns) {
  const createRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
  const colNames = columns.map((c) => `"${c.name}"`).join(", ");

  const inserts = rows.map((row) => {
    const values = columns.map((c) => sqlLiteral(row[c.name])).join(", ");
    return `INSERT INTO "${tableName}" (${colNames}) VALUES (${values});`;
  });

  return [`${createRow.sql};`, "", ...inserts].join("\n") + "\n";
}

function totalNullCount(db, tableName, columns) {
  if (columns.length === 0) return 0;
  const conditions = columns.map((c) => `("${c.name}" IS NULL)`).join(" + ");
  const row = db.prepare(`SELECT SUM(${conditions}) AS n FROM "${tableName}"`).get();
  return row.n || 0;
}

/**
 * Compares the current table against its original upload snapshot:
 * rows removed, nulls fixed, and duplicate rows resolved. Returns null
 * fields where there's no snapshot to compare against (shouldn't normally
 * happen since every upload snapshots immediately).
 */
export function buildCleaningReport(db, tableName, columns) {
  const snapshotName = `${tableName}${SNAPSHOT_SUFFIX}`;
  const hasSnapshot = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(snapshotName);

  const currentRowCount = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;
  const currentNullCount = totalNullCount(db, tableName, columns);
  const currentDuplicates = previewDuplicates(db, tableName, columns).affectedRowCount;

  if (!hasSnapshot) {
    return {
      originalRowCount: null,
      currentRowCount,
      rowsRemoved: null,
      originalNullCount: null,
      currentNullCount,
      nullsFixed: null,
      originalDuplicateRows: null,
      currentDuplicateRows: currentDuplicates,
    };
  }

  const originalRowCount = db.prepare(`SELECT COUNT(*) AS n FROM "${snapshotName}"`).get().n;
  const originalNullCount = totalNullCount(db, snapshotName, columns);
  const originalDuplicates = previewDuplicates(db, snapshotName, columns).affectedRowCount;

  return {
    originalRowCount,
    currentRowCount,
    rowsRemoved: originalRowCount - currentRowCount,
    originalNullCount,
    currentNullCount,
    nullsFixed: originalNullCount - currentNullCount,
    originalDuplicateRows: originalDuplicates,
    currentDuplicateRows: currentDuplicates,
  };
}
