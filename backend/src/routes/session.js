import { Router } from "express";
import { getOrCreateSession } from "../db/sessionStore.js";
import { getSchemaSummary } from "../sql/introspect.js";

const router = Router();

// Round-trips a trivial query through this request's sandboxed database.
// Kept around as a lightweight connectivity check independent of any upload.
router.get("/session/ping", (req, res) => {
  const db = getOrCreateSession(req.sessionId);
  const row = db.prepare("SELECT 1 + 1 AS result").get();

  res.json({
    sessionId: req.sessionId,
    dbCheck: row.result === 2 ? "ok" : "unexpected",
  });
});

router.get("/schema", (req, res) => {
  const db = getOrCreateSession(req.sessionId);
  res.json({ tables: getSchemaSummary(db) });
});

export default router;
