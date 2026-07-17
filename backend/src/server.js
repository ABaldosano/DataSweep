import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./middleware/session.js";
import healthRouter from "./routes/health.js";
import sessionRouter from "./routes/session.js";
import uploadRouter from "./routes/upload.js";
import profileRouter from "./routes/profile.js";
import cleanRouter from "./routes/clean.js";

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: ORIGIN, exposedHeaders: ["x-datasweep-session"] }));
app.use(express.json());
app.use(sessionMiddleware);

app.use("/api", healthRouter);
app.use("/api", sessionRouter);
app.use("/api", uploadRouter);
app.use("/api", profileRouter);
app.use("/api", cleanRouter);

// Centralized error handler -- keeps stack traces out of responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Datasweep backend listening on http://localhost:${PORT}`);
  console.log(`Accepting requests from ${ORIGIN}`);
});
