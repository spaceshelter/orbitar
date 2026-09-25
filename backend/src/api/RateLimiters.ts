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
 * 15/min — extra budget for vote feed requests that may scan far back: a
 * non-empty text filter or a minus-only page. Both walk the voted_at index
 * and check each row (bounded at FILTER_MAX_EXECUTION_TIME_MS), so they get
 * their own conservative budget on top of the shared read limiter:
 * 15/min x 0.5s caps one user at ~7.5 DB-seconds per minute instead of 240.
 * Other pages skip this limiter entirely.
 */
export const heavyReadRateLimiter = rateLimit({
  max: 15,
  windowMs: 60 * 1000,
  ...commonRateLimitConfig,
  // Runs before Joi validation; `sign` only accepts the exact 'minus' there.
  skip: (req) => !String(req.body?.filter ?? '').trim() && req.body?.sign !== 'minus',
})
