import { Router } from "express";
import multer from "multer";
import path from "path";
import { getOrCreateSession } from "../db/sessionStore.js";
import { validateSqlFile } from "../sql/allowlistParser.js";
import { loadCsvIntoDb } from "../sql/csvLoader.js";
import { getSchemaSummary } from "../sql/introspect.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const router = Router();

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Attach a .sql or .csv file as 'file'." });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const text = req.file.buffer.toString("utf-8");
  const db = getOrCreateSession(req.sessionId);

  try {
    if (ext === ".sql") {
      const validation = validateSqlFile(text);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const runAll = db.transaction((statements) => {
        for (const statement of statements) {
          db.exec(statement);
        }
      });
      runAll(validation.statements);
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
  res.json({ fileName: req.file.originalname, fileType: ext.slice(1), tables });
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
