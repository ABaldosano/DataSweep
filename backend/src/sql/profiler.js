import { getSchemaSummary } from "./introspect.js";
import { isNumericType } from "./types.js";

/**
 * Computes profile stats for a single column: null count/%, distinct-value
 * count, min/max/avg for numeric types, and a handful of sample values.
 * Works identically regardless of what the data is about -- it only ever
 * looks at types and value distributions, never column semantics.
 */
function profileColumn(db, tableName, column, totalRows) {
  const agg = db
    .prepare(
      `SELECT COUNT("${column.name}") AS nonNull, COUNT(DISTINCT "${column.name}") AS uniqueCount FROM "${tableName}"`
    )
    .get();

  const nullCount = totalRows - agg.nonNull;
  const isNumeric = isNumericType(column.type);

  let min = null;
  let max = null;
  let avg = null;

  if (isNumeric && agg.nonNull > 0) {
    const range = db
      .prepare(`SELECT MIN("${column.name}") AS min, MAX("${column.name}") AS max, AVG("${column.name}") AS avg FROM "${tableName}"`)
      .get();
    min = range.min;
    max = range.max;
    avg = range.avg === null ? null : +range.avg.toFixed(2);
  }

  const samples = db
    .prepare(`SELECT DISTINCT "${column.name}" AS v FROM "${tableName}" WHERE "${column.name}" IS NOT NULL LIMIT 5`)
    .all()
    .map((r) => r.v);

  return {
    name: column.name,
    type: column.type,
    nullCount,
    nullPct: totalRows > 0 ? +((nullCount / totalRows) * 100).toFixed(1) : 0,
    uniqueCount: agg.uniqueCount,
    min,
    max,
    avg,
    sampleValues: samples,
  };
}

export function profileTable(db, tableName, columns, rowCount) {
  return {
    name: tableName,
    rowCount,
    columns: columns.map((col) => profileColumn(db, tableName, col, rowCount)),
  };
}

/** Profiles every table currently in the session's database. */
export function profileAllTables(db) {
  const tables = getSchemaSummary(db);
  return tables.map((t) => profileTable(db, t.name, t.columns, t.rowCount));
}
