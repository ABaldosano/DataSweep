/**
 * SQLite is loose about declared type names (e.g. "CREATE TABLE ... AS
 * SELECT" can turn "INTEGER" into "INT"), so anything that needs to know
 * "is this column numeric" should check type affinity, not do an exact
 * string match. Follows SQLite's own affinity rules:
 * https://www.sqlite.org/datatype3.html
 */

export function isIntegerType(type) {
  return (type || "").toUpperCase().includes("INT");
}

export function isRealType(type) {
  const t = (type || "").toUpperCase();
  return t.includes("REAL") || t.includes("FLOA") || t.includes("DOUB");
}

export function isNumericType(type) {
  const t = (type || "").toUpperCase();
  return isIntegerType(t) || isRealType(t) || t.includes("NUMERIC") || t.includes("DECIMAL");
}
