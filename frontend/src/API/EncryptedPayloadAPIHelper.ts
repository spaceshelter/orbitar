import { BatchedCache } from '@utils/BatchedCache'
import { EncryptedPayloadEntity } from '@utils/mailCrypto'

import EncryptedPayloadAPI from './EncryptedPayloadAPI'

export default class EncryptedPayloadAPIHelper {
  private api: EncryptedPayloadAPI
  private batchedCache: BatchedCache<number, EncryptedPayloadEntity>

  constructor(api: EncryptedPayloadAPI) {
    this.api = api
    this.batchedCache = new BatchedCache({
      debounceTime: 200,
      batchSize: 128,
      cacheTTL: 5 * 60 * 1000,
      fetchFunction: async (ids) => {
        const response = await this.api.getPayloadsBatch({ ids })
        const result = new Map<number, EncryptedPayloadEntity>()
        for (const payload of response.payloads) {
          result.set(payload.id, payload)
        }
        return result
      },
    })
  }

  getEncryptedPayloadCached(encryptedPayloadId: number) {
    return this.batchedCache.get(encryptedPayloadId)
  }

  invalidateEncryptedPayload(encryptedPayloadId: number) {
    this.batchedCache.delete(encryptedPayloadId)
  }
}
