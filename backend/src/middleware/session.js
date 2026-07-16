import { randomUUID } from "crypto";

const HEADER = "x-datasweep-session";

/**
 * Every request gets a session id -- either the one the client already has
 * (sent back via the header) or a freshly minted one. This id is what keys
 * into the per-session sandboxed database (see db/sessionStore.js). Nothing
 * about a session is ever shared across ids.
 */
export function sessionMiddleware(req, res, next) {
  const existing = req.get(HEADER);
  const sessionId = existing && existing.length > 0 ? existing : randomUUID();

  req.sessionId = sessionId;
  res.set(HEADER, sessionId);
  next();
}
