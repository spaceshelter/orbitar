import MailRepository from '../db/repositories/MailRepository'
import { MailBatchRaw } from '../db/types/MailRaw'
import { MailInfo } from './types/MailInfo'
import UserManager from './UserManager'

export default class MailManager {
  private mailRepository: MailRepository
  private userManager: UserManager

  constructor(mailRepository: MailRepository, userManager: UserManager) {
    this.mailRepository = mailRepository
    this.userManager = userManager
  }

  async createMail(fromUserId: number, toUserId: number, v: number, toPayload: string, fromPayload?: string) {
    const recipient = await this.userManager.getById(toUserId)
    if (!recipient) {
      throw new Error('Recipient not found')
    }

    return await this.mailRepository.createMail(fromUserId, toUserId, v, toPayload, fromPayload)
  }

  async getMailsByIds(ids: number[], currentUserId: number): Promise<MailInfo[]> {
    const mails = await this.mailRepository.getMailsByIds([...new Set(ids)])
    return mails.map((mail) => this.mapMail(mail, currentUserId))
  }

  async syncPostBindings(mailIds: number[], fromUserId: number, postId: number) {
    await this.mailRepository.syncPostBindings([...new Set(mailIds)], fromUserId, postId)
  }

  async syncCommentBindings(mailIds: number[], fromUserId: number, postId: number, commentId: number) {
    await this.mailRepository.syncCommentBindings([...new Set(mailIds)], fromUserId, postId, commentId)
  }

  private mapMail(mail: MailBatchRaw, currentUserId: number): MailInfo {
    const amRecipient = mail.to_user_id === currentUserId
    const amSender = mail.from_user_id === currentUserId
    const role = (amRecipient && 'to') || (amSender && 'from') || null
    const payload = role === 'to' ? mail.to_payload : role === 'from' ? mail.from_payload : undefined

    return {
      id: mail.mail_id,
      v: mail.v,
      fromUserId: mail.from_user_id,
      toUserId: mail.to_user_id,
      fromUsername: mail.from_username,
      toUsername: mail.to_username,
      canDecrypt: !!role && !!payload,
      role,
      payload: payload || undefined,
    }
  }
}
