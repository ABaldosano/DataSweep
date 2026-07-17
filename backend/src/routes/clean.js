import { Router } from "express";
import { getOrCreateSession } from "../db/sessionStore.js";
import { getSchemaSummary } from "../sql/introspect.js";
import {
  previewDuplicates,
  removeDuplicates,
  handleNulls,
  previewOutliers,
  removeOutliers,
  resetTable,
} from "../sql/cleaner.js";

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

function findColumn(table, columnName) {
  const column = table.columns.find((c) => c.name === columnName);
  if (!column) {
    const err = new Error(`Column "${columnName}" not found on table "${table.name}".`);
    err.status = 404;
    throw err;
  }
  return column;
}

// ---- Duplicates ----

router.get("/clean/:table/duplicates", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    res.json(previewDuplicates(db, table.name, table.columns));
  } catch (err) {
    next(err);
  }
});

router.post("/clean/:table/duplicates/remove", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    res.json(removeDuplicates(db, table.name, table.columns));
  } catch (err) {
    next(err);
  }
});

// ---- Nulls ----

router.post("/clean/:table/nulls", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    const { column, strategy, value } = req.body;
    const col = findColumn(table, column);
    res.json(handleNulls(db, table.name, col.name, col.type, strategy, value));
  } catch (err) {
    next(err);
  }
});

// ---- Outliers ----

router.get("/clean/:table/outliers", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    const col = findColumn(table, req.query.column);
    res.json(previewOutliers(db, table.name, col.name, col.type));
  } catch (err) {
    next(err);
  }
});

router.post("/clean/:table/outliers/remove", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    const col = findColumn(table, req.body.column);
    res.json(removeOutliers(db, table.name, col.name, col.type));
  } catch (err) {
    next(err);
  }
});

// ---- Reset ----

router.post("/clean/:table/reset", (req, res, next) => {
  try {
    const db = getOrCreateSession(req.sessionId);
    const table = findTable(db, req.params.table);
    resetTable(db, table.name);
    res.json({ reset: true });
  } catch (err) {
    next(err);
  }
});

export default router;
