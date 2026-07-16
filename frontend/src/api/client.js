const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const SESSION_HEADER = "x-datasweep-session";

let sessionId = null;

/**
 * Thin fetch wrapper: attaches the session id we've been issued (if any)
 * on every request, and captures whatever id the backend sends back. This
 * keeps a single tab pinned to one sandboxed database across requests
 * without needing cookies or auth.
 */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (sessionId) headers.set(SESSION_HEADER, sessionId);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  const returned = res.headers.get(SESSION_HEADER);
  if (returned) sessionId = returned;

  return res;
}

export function getSessionId() {
  return sessionId;
}
