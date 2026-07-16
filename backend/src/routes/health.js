import { Router } from "express";
import { activeSessionCount } from "../db/sessionStore.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "datasweep-backend",
    activeSessions: activeSessionCount(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
