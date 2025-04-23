import rateLimit, { Options } from 'express-rate-limit'

export class RateLimitManager {
  private static isTestEnv = process.env.NODE_ENV === 'test'

  /**
   * Creates a rate limiter for routes.
   * If `NODE_ENV=test`, simply skips the limiter.
   *
   * @param options Rate limit options
   * @returns Express middleware
   */
  public static createLimiter(options: Partial<Options>) {
    if (RateLimitManager.isTestEnv) {
      const noLimitOptions: Partial<Options> = {
        windowMs: 365 * 24 * 60 * 60 * 1000, // 1 year
        max: Infinity, // Unlimited requests
      }
      return rateLimit(noLimitOptions)
    }
    return rateLimit(options)
  }
}
