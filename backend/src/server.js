import "dotenv/config";
import express from "express";
import cors from "cors";
import { sessionMiddleware } from "./middleware/session.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import healthRouter from "./routes/health.js";
import sessionRouter from "./routes/session.js";
import uploadRouter from "./routes/upload.js";
import profileRouter from "./routes/profile.js";
import cleanRouter from "./routes/clean.js";
import exportRouter from "./routes/export.js";

const app = express();
const PORT = process.env.PORT || 4000;
const ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: ORIGIN, exposedHeaders: ["x-datasweep-session", "content-disposition"] }));
app.use(express.json());
app.use(sessionMiddleware);
app.use("/api", generalLimiter);

app.use("/api", healthRouter);
app.use("/api", sessionRouter);
app.use("/api", uploadRouter);
app.use("/api", profileRouter);
app.use("/api", cleanRouter);
app.use("/api", exportRouter);

// Centralized error handler -- keeps stack traces out of responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const server = app.listen(PORT, () => {
  console.log(`Datasweep backend listening on http://localhost:${PORT}`);
  console.log(`Accepting requests from ${ORIGIN}`);
});

// Defense-in-depth against hung/slow connections (doesn't help against
// expensive synchronous work already in flight -- that's what the row/
// statement caps in csvLoader.js and upload.js are for).
server.setTimeout(30_000);
