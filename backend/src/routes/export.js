import { Router } from "express";
import { getOrCreateSession } from "../db/sessionStore.js";
import { getSchemaSummary } from "../sql/introspect.js";
import { exportAsCsv, exportAsSql, buildCleaningReport } from "../sql/exporter.js";

const router = Router();

function findTable(db, tableName) {
  const table = getSchemaSummary(db).find((t) => t.name === tableName);
  if (!table) {
    const err = new Error(`Table "${tableName}" not found in this session.`);
    err.status = 404;
    throw err;
  }
  return table;
}

router.get("/export/:table/csv", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    const csv = exportAsCsv(db, table.name, table.columns);

    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${table.name}_cleaned.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get("/export/:table/sql", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    const sql = exportAsSql(db, table.name, table.columns);

    res.set("Content-Type", "application/sql; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${table.name}_cleaned.sql"`);
    res.send(sql);
  } catch (err) {
    next(err);
  }
});

router.get("/export/:table/report", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    res.json(buildCleaningReport(db, table.name, table.columns));
  } catch (err) {
    next(err);
  }
});

export default router;
