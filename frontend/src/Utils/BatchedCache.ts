interface BatchedCacheOptions<K, V> {
  batchSize: number
  cacheTime: number
  fetchFunction: (keys: K[]) => Promise<Map<K, V>>
}

interface CacheEntry<V> {
  value: V
  timestamp: number
}

interface PendingRequest<V> {
  resolve: (value: V) => void
  reject: (error: any) => void
}

export class BatchedCache<K, V> {
  private cache: Map<K, CacheEntry<V>> = new Map()
  private pendingBatch: Map<K, Promise<V>> = new Map()
  private pendingRequests: Map<K, PendingRequest<V>> = new Map()
  private batchTimeout: NodeJS.Timeout | null = null
  private options: BatchedCacheOptions<K, V>

  constructor(options: BatchedCacheOptions<K, V>) {
    this.options = options
  }

  public async get(key: K): Promise<V> {
    // Проверяем кэш
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.options.cacheTime) {
      return cached.value
    }

    // Проверяем, есть ли уже ожидающий запрос для этого ключа
    const pending = this.pendingBatch.get(key)
    if (pending) {
      return pending
    }

    // Создаем новый промис для этого ключа
    const promise = new Promise<V>((resolve, reject) => {
      this.pendingRequests.set(key, { resolve, reject })
      this.addToBatch(key)
    })

    this.pendingBatch.set(key, promise)
    return promise
  }

  public set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  private addToBatch(key: K): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    this.batchTimeout = setTimeout(async () => {
      const batch = Array.from(this.pendingBatch.keys())
      this.pendingBatch.clear()
      this.batchTimeout = null

      try {
        const results = await this.options.fetchFunction(batch)

        // Обрабатываем результаты для каждого ключа
        batch.forEach((key) => {
          const request = this.pendingRequests.get(key)
          if (!request) return

          const value = results.get(key)
          if (value) {
            this.set(key, value)
            request.resolve(value)
          } else {
            request.reject(new Error(`No result returned for key: ${String(key)}`))
          }

          this.pendingRequests.delete(key)
        })
      } catch (error) {
        // В случае ошибки отклоняем все ожидающие запросы
        batch.forEach((key) => {
          const request = this.pendingRequests.get(key)
          if (request) {
            request.reject(error)
            this.pendingRequests.delete(key)
          }
        })
      }
    }, 0)
  }
}
