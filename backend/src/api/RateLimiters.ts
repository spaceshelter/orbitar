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
