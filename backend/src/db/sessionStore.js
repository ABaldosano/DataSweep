import Database from "better-sqlite3";

/**
 * Every uploaded file gets its own throwaway SQLite database, held only in
 * memory, keyed by session id. Nothing is ever written to a shared or
 * persistent database, and nothing survives past the idle timeout. This is
 * what makes it safe to let an anonymous visitor's file reach a real SQL
 * engine at all -- there's no shared state for a bad file to damage.
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const MAX_SESSIONS = 200; // ceiling on concurrent in-memory sandboxes

const sessions = new Map(); // sessionId -> { db, lastUsed, timer }

function scheduleEviction(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;

  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => destroySession(sessionId), IDLE_TIMEOUT_MS);
  entry.timer.unref?.();
}

function evictLeastRecentlyUsed() {
  let oldestId = null;
  let oldestTime = Infinity;

  for (const [id, entry] of sessions) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestId = id;
    }
  }

  if (oldestId) destroySession(oldestId);
}

export function getOrCreateSession(sessionId) {
  let entry = sessions.get(sessionId);

  if (!entry) {
    if (sessions.size >= MAX_SESSIONS) evictLeastRecentlyUsed();
    const db = new Database(":memory:");
    // better-sqlite3 defaults foreign_keys ON (unlike vanilla SQLite). A
    // bulk data-loading tool shouldn't fail on forward references or
    // self-referencing rows inserted in file order -- the same reason
    // real restore tools (pg_restore, mysqldump imports) disable FK
    // checks during load.
    db.pragma("foreign_keys = OFF");
    entry = { db, lastUsed: Date.now(), timer: null };
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
