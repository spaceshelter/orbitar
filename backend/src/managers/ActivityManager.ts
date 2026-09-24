import { RedisClientType } from 'redis'
import { Logger } from 'winston'

import { ActivityEntry } from '../api/types/entities/ActivityEntity'

const ACTIVITY_FEED_KEY = 'activity_feed'
const ACTIVITY_FEED_SEQ_KEY = 'activity_feed:seq'
const ACTIVITY_FEED_POLL_ENDED_KEY = 'activity_feed:poll_ended'

const ACTIVITY_FEED_MAX_SIZE = 10000
const ACTIVITY_FEED_PAGE_SIZE = 100

type ActivityPushInput = Omit<ActivityEntry, 'id' | 'timestamp'>

export default class ActivityManager {
  private redis: RedisClientType
  private logger: Logger

  /**
   * Promise-chain queue to serialize push operations.
   * Prevents INCR/LPUSH race condition where concurrent pushes
   * could interleave, resulting in out-of-order IDs in the list.
   */
  private pushQueue: Promise<void> = Promise.resolve()

  /**
   * Poll expiration timers, keyed by pollId.
   * Used to schedule poll:ended events.
   */
  private pollTimers: Map<number, NodeJS.Timeout> = new Map()

  constructor(redis: RedisClientType, logger: Logger) {
    this.redis = redis
    this.logger = logger
  }

  /**
   * Push an activity entry to the feed.
   * Serialized via promise-chain queue to guarantee ID ordering.
   * Failures are logged but never rethrown — primary actions proceed regardless.
   */
  async push(entry: ActivityPushInput): Promise<void> {
    this.pushQueue = this.pushQueue.then(() => this._doPush(entry)).catch(() => {})
    return this.pushQueue
  }

  private async _doPush(entry: ActivityPushInput): Promise<void> {
    try {
      const id = await this.redis.incr(ACTIVITY_FEED_SEQ_KEY)
      const activityEntry: ActivityEntry = {
        ...entry,
        id,
        timestamp: new Date().toISOString(),
      }
      await this.redis.lPush(ACTIVITY_FEED_KEY, JSON.stringify(activityEntry))
      await this.redis.lTrim(ACTIVITY_FEED_KEY, 0, ACTIVITY_FEED_MAX_SIZE - 1)
    } catch (err) {
      this.logger.error('Failed to push activity entry', { error: err, entry })
    }
  }

  /**
   * Get a page of activity entries.
   *
   * Since IDs are monotonic and contiguous (guaranteed by serialized push),
   * we can compute the offset directly when after_id is provided:
   *   offset = newestId - afterId
   *
   * Falls back to scanning if the optimization fails (e.g., gaps from trimming).
   */
  async getPage(
    afterId?: number,
    limit?: number,
  ): Promise<{
    entries: ActivityEntry[]
    oldestId: number | null
    newestId: number | null
    limit: number
  }> {
    const pageLimit = Math.min(Math.max(limit || ACTIVITY_FEED_PAGE_SIZE, 1), ACTIVITY_FEED_PAGE_SIZE)

    const listLen = await this.redis.lLen(ACTIVITY_FEED_KEY)
    if (listLen === 0) {
      return { entries: [], oldestId: null, newestId: null, limit: pageLimit }
    }

    // Get boundary IDs for gap detection
    const [newestRaw, oldestRaw] = await Promise.all([
      this.redis.lIndex(ACTIVITY_FEED_KEY, 0),
      this.redis.lIndex(ACTIVITY_FEED_KEY, -1),
    ])

    const newestId = newestRaw ? (JSON.parse(newestRaw) as ActivityEntry).id : null
    const oldestId = oldestRaw ? (JSON.parse(oldestRaw) as ActivityEntry).id : null

    if (newestId === null || oldestId === null) {
      return { entries: [], oldestId: null, newestId: null, limit: pageLimit }
    }

    let entries: ActivityEntry[]

    if (afterId === undefined || afterId === null) {
      // No cursor — return the newest entries
      const raw = await this.redis.lRange(ACTIVITY_FEED_KEY, 0, pageLimit - 1)
      entries = raw.map((r) => JSON.parse(r) as ActivityEntry)
    } else {
      // Optimized offset computation: since IDs are contiguous, offset = newestId - afterId
      const offset = newestId - afterId
      if (offset <= 0) {
        // afterId is at or beyond the newest — nothing to return
        return { entries: [], oldestId, newestId, limit: pageLimit }
      }

      // Entries older than afterId start at index `offset` from the left
      const raw = await this.redis.lRange(ACTIVITY_FEED_KEY, offset, offset + pageLimit - 1)
      entries = raw.map((r) => JSON.parse(r) as ActivityEntry)

      // Verify the optimization: if the first entry's ID is not what we expect,
      // fall back to scanning (handles gaps from trimming)
      if (entries.length > 0 && entries[0].id >= afterId) {
        // Optimization failed — scan for the correct position
        entries = await this._scanAfter(afterId, pageLimit)
      }
    }

    return { entries, oldestId, newestId, limit: pageLimit }
  }

  /**
   * Fallback scan for getPage when optimized offset fails.
   */
  private async _scanAfter(afterId: number, limit: number): Promise<ActivityEntry[]> {
    const batchSize = 100
    let offset = 0
    const result: ActivityEntry[] = []

    while (result.length < limit) {
      const raw = await this.redis.lRange(ACTIVITY_FEED_KEY, offset, offset + batchSize - 1)
      if (raw.length === 0) break

      for (const r of raw) {
        const entry = JSON.parse(r) as ActivityEntry
        if (entry.id < afterId) {
          result.push(entry)
          if (result.length >= limit) break
        }
      }

      offset += batchSize
    }

    return result
  }

  // --- Poll expiration scheduling ---

  /**
   * Schedule a poll:ended event for a poll with an expiration time.
   * Deduplicates using a Redis set to handle server restarts.
   */
  schedulePollExpiration(pollId: number, expiresAt: Date, postId?: number, site?: string): void {
    const now = Date.now()
    const delay = expiresAt.getTime() - now

    if (delay <= 0) {
      // Already expired — emit immediately (with dedup check)
      this._emitPollEnded(pollId, postId, site).catch(() => {})
      return
    }

    // Clear existing timer if any
    const existing = this.pollTimers.get(pollId)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      this.pollTimers.delete(pollId)
      this._emitPollEnded(pollId, postId, site).catch(() => {})
    }, delay)

    // Prevent timer from keeping the process alive
    timer.unref()
    this.pollTimers.set(pollId, timer)
  }

  /**
   * Emit a poll:ended event with deduplication via Redis set.
   */
  private async _emitPollEnded(pollId: number, postId?: number, site?: string): Promise<void> {
    try {
      const alreadyProcessed = await this.redis.sIsMember(ACTIVITY_FEED_POLL_ENDED_KEY, String(pollId))
      if (alreadyProcessed) return

      await this.redis.sAdd(ACTIVITY_FEED_POLL_ENDED_KEY, String(pollId))
      await this.push({
        type: 'poll:ended',
        userId: null,
        username: null,
        postId: postId ?? null,
        pollId,
        site: site ?? null,
      })
    } catch (err) {
      this.logger.error('Failed to emit poll:ended', { error: err, pollId })
    }
  }

  /**
   * On server startup, schedule timers for all polls with future expiration.
   * Uses overlap to catch polls that expired during downtime.
   */
  async initPollExpirationTimers(
    getExpiringPolls: (since: Date) => Promise<
      Array<{
        pollId: number
        expiresAt: Date
        postId?: number
        site?: string
      }>
    >,
  ): Promise<void> {
    const overlapMs = 60 * 60 * 1000 // 1 hour overlap
    const since = new Date(Date.now() - overlapMs)

    try {
      const polls = await getExpiringPolls(since)
      for (const poll of polls) {
        this.schedulePollExpiration(poll.pollId, poll.expiresAt, poll.postId, poll.site)
      }
      this.logger.info(`Scheduled ${polls.length} poll expiration timer(s)`)
    } catch (err) {
      this.logger.error('Failed to initialize poll expiration timers', { error: err })
    }
  }
}
