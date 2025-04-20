import { BatchedCache } from '@utils/BatchedCache'

import PollAPI from './PollAPI'
import { PollEntity } from './types/Poll'

export default class PollAPIHelper {
  private api: PollAPI
  private batchedCache: BatchedCache<number, PollEntity>

  constructor(api: PollAPI) {
    this.api = api
    this.batchedCache = new BatchedCache({
      debounceTime: 200,
      batchSize: 128,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      fetchFunction: async (pollIds) => {
        const response = await this.api.getPollsBatch({ ids: pollIds })
        const result = new Map<number, PollEntity>()
        for (const poll of response.polls) {
          result.set(poll.id, poll)
        }
        return result
      },
    })
  }

  async getPollCached(pollId: number): Promise<PollEntity> {
    return this.batchedCache.get(pollId)
  }

  invalidatePoll(pollId: number) {
    this.batchedCache.delete(pollId)
  }
}
