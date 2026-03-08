import { BatchedCache } from '@utils/BatchedCache'

import MailAPI from './MailAPI'
import { MailEntity } from './types/Mail'

export default class MailAPIHelper {
  private api: MailAPI
  private batchedCache: BatchedCache<number, MailEntity>

  constructor(api: MailAPI) {
    this.api = api
    this.batchedCache = new BatchedCache({
      debounceTime: 200,
      batchSize: 128,
      cacheTTL: 5 * 60 * 1000,
      fetchFunction: async (mailIds) => {
        const response = await this.api.getMailsBatch({ ids: mailIds })
        const result = new Map<number, MailEntity>()
        for (const mail of response.mails) {
          result.set(mail.id, mail)
        }
        return result
      },
    })
  }

  async getMailCached(mailId: number): Promise<MailEntity> {
    return this.batchedCache.get(mailId)
  }

  invalidateMail(mailId: number) {
    this.batchedCache.delete(mailId)
  }
}
