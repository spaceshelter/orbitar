import useLocalStorage from 'use-local-storage'

/**
 * Valid feed routes for the main site home page.
 * These correspond to the feed tabs: подписки, всё, главная.
 */
export type FeedRoute = '/' | '/subscriptions' | '/posts' | '/all'

const STORAGE_KEY = 'feedPreference'
const LEGACY_STORAGE_KEY = 'homeButtonRoute'
const DEFAULT_FEED: FeedRoute = '/subscriptions'

/**
 * Migrate from the old homeButtonRoute localStorage key (used by HomeButton)
 * to the new feedPreference key. Runs once on first import.
 */
function migrateLegacyPreference(): void {
  if (typeof window === 'undefined') return

  const newValue = localStorage.getItem(STORAGE_KEY)
  if (newValue) return // already migrated or set

  const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacyValue) {
    // Legacy stored values like "/" or "/posts" or "/all"
    // Strip surrounding quotes if present (useLocalStorage wraps in JSON)
    const cleaned = legacyValue.replace(/^"|"$/g, '')
    if (isValidFeedRoute(cleaned)) {
      // Map "/" to "/subscriptions" since the old "/" meant subscriptions feed
      const mapped = cleaned === '/' ? '/subscriptions' : cleaned
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }
}

// Run migration on module load
migrateLegacyPreference()

/**
 * Shared hook for the user's preferred feed route.
 *
 * - FeedPage reads this to decide what feed to show on `/`
 * - FeedPage writes this when the user navigates to `/subscriptions`, `/posts`, or `/all`
 * - HomeButton always links to `/` (preference is transparent to it)
 *
 * Replaces the implicit coupling between HomeButton and FeedPage
 * that previously went through the `homeButtonRoute` localStorage key.
 */
export function useFeedPreference() {
  const [preference, setPreference] = useLocalStorage<FeedRoute>(STORAGE_KEY, DEFAULT_FEED)

  const feedRoute = isValidFeedRoute(preference) ? preference : DEFAULT_FEED

  return {
    /** The user's preferred feed route (always valid) */
    feedRoute,
    /** Update the preference (called when user explicitly navigates to a feed tab) */
    setFeedRoute: setPreference,
  } as const
}

function isValidFeedRoute(route: string | undefined | null): route is FeedRoute {
  return route === '/' || route === '/subscriptions' || route === '/posts' || route === '/all'
}
