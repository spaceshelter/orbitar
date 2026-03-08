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

  async createMail(
    fromUserId: number,
    toUserId: number | undefined,
    toPublicKey: string | undefined,
    v: number,
    toPayload: string,
    fromPayload?: string,
  ) {
    if (toUserId) {
      const recipient = await this.userManager.getById(toUserId)
      if (!recipient) {
        throw new Error('Recipient not found')
      }

      return await this.mailRepository.createMail(fromUserId, recipient.id, v, toPayload, fromPayload)
    }

    if (!toPublicKey) {
      throw new Error('Public key is required for public mail')
    }

    return await this.mailRepository.createMail(fromUserId, null, v, toPayload, fromPayload)
  }

  async getMailsByIds(ids: number[], currentUserId: number): Promise<MailInfo[]> {
    const mails = await this.mailRepository.getMailsByIds([...new Set(ids)])
    return mails.map((mail) => this.mapMail(mail, currentUserId))
  }

  private mapMail(mail: MailBatchRaw, currentUserId: number): MailInfo {
    if (!mail.to_user_id) {
      const senderPayload = mail.from_user_id === currentUserId ? mail.from_payload : undefined
      const payload = senderPayload || mail.to_payload

      return {
        id: mail.mail_id,
        v: mail.v,
        fromUserId: mail.from_user_id,
        fromUsername: mail.from_username,
        canDecrypt: !!payload,
        role: senderPayload ? 'from' : 'public',
        payload: payload || undefined,
      }
    }

    const amRecipient = mail.to_user_id === currentUserId
    const amSender = mail.from_user_id === currentUserId
    const role = (amRecipient && 'to') || (amSender && 'from') || null
    const payload = role === 'to' ? mail.to_payload : role === 'from' ? mail.from_payload : undefined

    if (!role) {
      return {
        id: mail.mail_id,
        v: mail.v,
        canDecrypt: false,
        role: null,
      }
    }

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
