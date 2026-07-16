import Papa from "papaparse";

/**
 * Infers a SQLite column type from a column's sample values.
 * INTEGER if every non-empty value is a whole number, REAL if every
 * non-empty value is numeric, otherwise TEXT. Falls back to TEXT for
 * all-empty columns.
 */
function inferColumnType(values) {
  const nonEmpty = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (nonEmpty.length === 0) return "TEXT";

  const allIntegers = nonEmpty.every((v) => /^-?\d+$/.test(String(v).trim()));
  if (allIntegers) return "INTEGER";

  const allNumeric = nonEmpty.every((v) => /^-?\d*\.?\d+(e-?\d+)?$/i.test(String(v).trim()));
  if (allNumeric) return "REAL";

  return "TEXT";
}

function sanitizeIdentifier(name, fallback) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^(\d)/, "_$1");
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Parses CSV text and loads it into a single table on the given db.
 * Returns a schema summary: { name, rowCount, columns: [{name, type}] }.
 * Table/column names are derived from the file/header but sanitized to
 * safe SQL identifiers.
 */
export function loadCsvIntoDb(db, csvText, tableNameHint) {
  const parsed = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw Object.assign(new Error(`CSV parse error: ${first.message} (row ${first.row ?? "?"})`), {
      status: 400,
    });
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    throw Object.assign(new Error("CSV file has no data rows."), { status: 400 });
  }

  const rawColumns = parsed.meta.fields || Object.keys(rows[0]);
  const usedNames = new Set();
  const columns = rawColumns.map((raw, i) => {
    let name = sanitizeIdentifier(raw, `column_${i + 1}`);
    let suffix = 1;
    while (usedNames.has(name)) {
      name = `${name}_${suffix++}`;
    }
    usedNames.add(name);

    const values = rows.map((r) => r[raw]);
    const type = inferColumnType(values);
    return { name, rawName: raw, type };
  });

  const tableName = sanitizeIdentifier(tableNameHint, "uploaded_data");

  const createSql = `CREATE TABLE "${tableName}" (${columns
    .map((c) => `"${c.name}" ${c.type}`)
    .join(", ")})`;
  db.exec(createSql);

  const insertSql = `INSERT INTO "${tableName}" (${columns
    .map((c) => `"${c.name}"`)
    .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
  const insertStmt = db.prepare(insertSql);

  const insertMany = db.transaction((allRows) => {
    for (const row of allRows) {
      const values = columns.map((c) => {
        const v = row[c.rawName];
        return v === "" || v === undefined ? null : v;
      });
      insertStmt.run(...values);
    }
  });
  insertMany(rows);

  const rowCount = db.prepare(`SELECT COUNT(*) AS n FROM "${tableName}"`).get().n;

  return {
    name: tableName,
    rowCount,
    columns: columns.map((c) => ({ name: c.name, type: c.type })),
  };
}
