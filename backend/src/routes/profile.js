import { Router } from "express";
import { getOrCreateSession } from "../db/sessionStore.js";
import { profileAllTables } from "../sql/profiler.js";

const router = Router();

router.get("/profile", (req, res) => {
  const db = getOrCreateSession(req.sessionId);
  res.json({ tables: profileAllTables(db) });
});

export default router;
