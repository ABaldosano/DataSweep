import { Router } from "express";
import { getOrCreateSession } from "../db/sessionStore.js";

const router = Router();

// Round-trips a trivial query through this request's sandboxed database.
// Upload/parse/profile/clean endpoints build on this same session db in
// later steps -- this just proves the wiring works end to end.
router.get("/session/ping", (req, res) => {
  const db = getOrCreateSession(req.sessionId);
  const row = db.prepare("SELECT 1 + 1 AS result").get();

  res.json({
    sessionId: req.sessionId,
    dbCheck: row.result === 2 ? "ok" : "unexpected",
  });
});

export default router;
