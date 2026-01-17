/**
 * Media hosting utilities for working with the configured media service.
 */

/** Cached media host domain extracted from environment config */
let cachedMediaHostDomain: string | null | undefined

/**
 * Extracts and caches the media hosting domain from environment config.
 * Returns null if not configured or invalid.
 */
export function getMediaHostDomain(): string | null {
  if (cachedMediaHostDomain !== undefined) return cachedMediaHostDomain

  const mediaHostingUrl = process.env.REACT_APP_MEDIA_HOSTING_URL
  if (!mediaHostingUrl) {
    cachedMediaHostDomain = null
    return null
  }

  try {
    cachedMediaHostDomain = new URL(mediaHostingUrl).hostname
    return cachedMediaHostDomain
  } catch {
    cachedMediaHostDomain = null
    return null
  }
}

/**
 * Checks if a URL belongs to the configured media hosting service.
 * Matches both the base domain and any subdomains.
 * Accepts either a string or a pre-parsed URL object to avoid double parsing.
 */
export function isMediaHostingUrl(url: string | URL): boolean {
  const mediaHostDomain = getMediaHostDomain()
  if (!mediaHostDomain) return false

  try {
    const urlHost = url instanceof URL ? url.hostname : new URL(url).hostname
    return urlHost === mediaHostDomain || urlHost.endsWith('.' + mediaHostDomain)
  } catch {
    return false
  }
}
