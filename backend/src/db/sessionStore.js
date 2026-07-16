import Database from "better-sqlite3";

/**
 * Every uploaded file gets its own throwaway SQLite database, held only in
 * memory, keyed by session id. Nothing is ever written to a shared or
 * persistent database, and nothing survives past the idle timeout. This is
 * what makes it safe to let an anonymous visitor's file reach a real SQL
 * engine at all -- there's no shared state for a bad file to damage.
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

const sessions = new Map(); // sessionId -> { db, lastUsed, timer }

function scheduleEviction(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => destroySession(sessionId), IDLE_TIMEOUT_MS);
  entry.timer.unref?.();
}

export function getOrCreateSession(sessionId) {
  let entry = sessions.get(sessionId);

  if (!entry) {
    entry = { db: new Database(":memory:"), lastUsed: Date.now(), timer: null };
    sessions.set(sessionId, entry);
  }

  entry.lastUsed = Date.now();
  scheduleEviction(sessionId);
  return entry.db;
}

export function destroySession(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return false;

  if (entry.timer) clearTimeout(entry.timer);
  entry.db.close();
  sessions.delete(sessionId);
  return true;
}

export function activeSessionCount() {
  return sessions.size;
}
