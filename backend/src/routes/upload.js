import { Router } from "express";
import multer from "multer";
import path from "path";
import { getOrCreateSession } from "../db/sessionStore.js";
import { classifySqlFile } from "../sql/allowlistParser.js";
import { loadCsvIntoDb, MAX_ROWS } from "../sql/csvLoader.js";
import { getSchemaSummary } from "../sql/introspect.js";
import { snapshotTable } from "../sql/cleaner.js";
import { uploadLimiter } from "../middleware/rateLimit.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const router = Router();

router.post("/upload", uploadLimiter, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Attach a .sql or .csv file as 'file'." });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const text = req.file.buffer.toString("utf-8");
  const db = getOrCreateSession(req.sessionId);

  let loadSummary = null;

  try {
    if (ext === ".sql") {
      const { allowed, skipped, totalStatements } = classifySqlFile(text);

      if (totalStatements === 0) {
        return res.status(400).json({ error: "No SQL statements found in file." });
      }
      if (totalStatements > MAX_ROWS) {
        return res.status(413).json({
          error: `File has ${totalStatements.toLocaleString()} statements, which is over the ${MAX_ROWS.toLocaleString()}-statement demo limit.`,
        });
      }
      if (allowed.length === 0) {
        return res.status(400).json({
          error: `This file doesn't contain any CREATE TABLE or INSERT statements to load. Found ${skipped.length} other statement${skipped.length === 1 ? "" : "s"} (e.g. DROP, CREATE VIEW, CREATE PROCEDURE), which were skipped.`,
        });
      }

      // Execute statement-by-statement rather than one all-or-nothing
      // transaction: a single incompatible statement (rare but real, e.g.
      // a genuinely unrecoverable syntax quirk) shouldn't cost you every
      // other table that loaded fine.
      const failed = [];
      let executedCount = 0;
      for (const statement of allowed) {
        try {
          db.exec(statement);
          executedCount++;
        } catch (err) {
          failed.push({ preview: statement.slice(0, 80).replace(/\s+/g, " "), error: err.message });
        }
      }

      loadSummary = {
        totalStatements,
        executedCount,
        skippedCount: skipped.length,
        skippedExamples: skipped.slice(0, 5),
        failedCount: failed.length,
        failedExamples: failed.slice(0, 5),
      };
    } else if (ext === ".csv") {
      const tableNameHint = path.basename(req.file.originalname, ext);
      loadCsvIntoDb(db, text, tableNameHint);
    } else {
      return res.status(400).json({ error: `Unsupported file type "${ext}". Upload a .sql or .csv file.` });
    }
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  const tables = getSchemaSummary(db);
  if (tables.length === 0) {
    return res.status(400).json({
      error: "Nothing loaded successfully. None of the statements in this file could be executed.",
      ...loadSummary,
    });
  }

  for (const table of tables) {
    snapshotTable(db, table.name);
  }
  res.json({ fileName: req.file.originalname, fileType: ext.slice(1), tables, loadSummary });
});

// Multer error handling (e.g. file too large) doesn't reach the route handler above.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `File too large. Max size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.` });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

export default router;
