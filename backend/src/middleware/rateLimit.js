import rateLimit from "express-rate-limit";

// Broad safety net across all API routes.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again in a few minutes." },
});

// Uploads are the expensive path (synchronous parsing + DB writes), so they
// get a tighter, separate limit on top of the general one.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads from this address. Try again in a few minutes." },
});
