interface Controllable<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

interface BatchedCacheOptions<K, V> {
  /** Maximum number of keys to collect before sending a batch request */
  batchSize: number
  /** Time in milliseconds that cached values remain valid */
  cacheTTL: number
  /** Time in milliseconds to wait before sending a batch request */
  debounceTime?: number
  /** Function to fetch data for multiple keys in a single request */
  fetchFunction: (keys: K[]) => Promise<Record<string, V | null> | Map<K, V>>
}

/**
 * BatchedCache provides efficient data retrieval by batching multiple requests into a single API call.
 */
export class BatchedCache<K extends string, V> {
  private cache = new Map<K, { data: V; expiresAt: number }>()
  private queue = new Set<K>()
  private pendingResolvers = new Map<K, Controllable<V>>()
  private timer: NodeJS.Timeout | null = null
  private options: BatchedCacheOptions<K, V>

  constructor(options: BatchedCacheOptions<K, V>) {
    this.options = options
  }

  /**
   * Gets a value for the specified key
   */
  public async get(key: K): Promise<V> {
    // If the data is in cache and not expired, return it immediately
    const now = Date.now()
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > now) {
      return Promise.resolve(cached.data)
    }

    const pending = this.pendingResolvers.get(key)
    if (pending) {
      return pending.promise
    }

    // Put this request into pending resolvers
    let resolve!: (value: V | PromiseLike<V>) => void
    let reject!: (reason?: unknown) => void
    const prom = new Promise<V>((res, rej) => {
      resolve = res
      reject = rej
    })

    this.pendingResolvers.set(key, { promise: prom, resolve, reject })

    // Add key to batch queue
    this.queue.add(key)

    // Start or reset the debounce timer
    if (this.timer) {
      clearTimeout(this.timer)
    }

    if (this.queue.size >= this.options.batchSize) {
      this.flushQueue()
      return prom
    }

    this.timer = setTimeout(() => {
      this.flushQueue()
    }, this.options.debounceTime || 0)

    return prom
  }

  /**
   * Manually sets a value in the cache
   */
  public set(key: K, value: V): void {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + this.options.cacheTTL,
    })
  }

  /**
   * Removes a value from the cache
   */
  public delete(key: K): void {
    this.cache.delete(key)
  }

  /**
   * Clears the entire cache
   */
  public clearCache(): void {
    this.cache.clear()
  }

  /**
   * Processes all queued keys
   */
  private async flushQueue(): Promise<void> {
    // Make a local copy of the queue so we can clear it
    const keys = Array.from(this.queue)
    this.queue.clear()
    this.timer = null

    if (keys.length === 0) {
      return
    }

    try {
      // Send a single batch request
      const results = await this.options.fetchFunction(keys)
      const now = Date.now()

      // Update cache & resolve each request
      for (const key of keys) {
        // Handle both Map and Record return types
        const value = results instanceof Map ? results.get(key) : results[key] || null
        if (value) {
          this.cache.set(key, {
            data: value,
            expiresAt: now + this.options.cacheTTL,
          })
        }

        const resolver = this.pendingResolvers.get(key)
        if (resolver) {
          if (value) {
            resolver.resolve(value)
          } else {
            resolver.reject(new Error(`No data found for key: ${key}`))
          }
          this.pendingResolvers.delete(key)
        }
      }
    } catch (err) {
      // If something blows up, we should reject all pending resolvers
      for (const key of keys) {
        const resolver = this.pendingResolvers.get(key)
        if (resolver) {
          resolver.reject(err)
          this.pendingResolvers.delete(key)
        }
      }
      console.error('Error in batch request:', err)
    }
  }
}
