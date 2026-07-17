import { isSnapshotTable } from "./cleaner.js";

/**
 * Reads back the current schema of a session's database -- used after
 * loading a .sql or .csv upload, and reusable later for the profiling step.
 */
export function getSchemaSummary(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .filter(({ name }) => !isSnapshotTable(name));

  return tables.map(({ name }) => {
    const columns = db.prepare(`PRAGMA table_info("${name}")`).all().map((col) => ({
      name: col.name,
      type: col.type || "TEXT",
      nullable: col.notnull === 0,
    }));
    const rowCount = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n;

    return { name, rowCount, columns };
  });
}
