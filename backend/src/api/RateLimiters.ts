import rateLimit from 'express-rate-limit'

/**
 * Common config for all per-user rate limiters.
 */
export const commonRateLimitConfig = {
  skipSuccessfulRequests: false,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.session.data?.userId),
}

/**
 * 120/min — shared rate limiter for read endpoints.
 * A single instance shared across all controllers so the budget is global per user.
 */
export const sharedReadRateLimiter = rateLimit({
  max: 120,
  windowMs: 60 * 1000,
  ...commonRateLimitConfig,
})

/**
 * 15/min — extra budget for feed requests carrying a non-empty filter.
 * A rarely-matching filter walks the user's whole vote history probing TEXT
 * per row (bounded at FILTER_MAX_EXECUTION_TIME_MS), so filtered requests get
 * their own conservative budget on top of the shared read limiter:
 * 15/min x 0.5s caps one user at ~7.5 DB-seconds per minute instead of 240.
 * Unfiltered pages skip this limiter entirely.
 */
export const heavyFilterRateLimiter = rateLimit({
  max: 15,
  windowMs: 60 * 1000,
  ...commonRateLimitConfig,
  skip: (req) => !String(req.body?.filter ?? '').trim(),
})
