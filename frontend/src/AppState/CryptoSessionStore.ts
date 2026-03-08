import { makeAutoObservable, runInAction } from 'mobx'

import { deriveMailboxKeyPair, mailboxKeyMatches, MailboxKeyPair } from '../Utils/mailCrypto'

export class CryptoSessionStore {
  mailboxKeyPair: MailboxKeyPair | undefined = undefined
  mailboxUserId: number | undefined = undefined
  mailboxUnlocking = false
  mailboxError: string | undefined = undefined

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get isMailboxUnlocked() {
    return !!this.mailboxKeyPair
  }

  hasMailboxKey(publicKey: string, publicKeyAlg: string) {
    return !!this.mailboxKeyPair && mailboxKeyMatches(this.mailboxKeyPair, publicKey, publicKeyAlg)
  }

  cacheMailboxKeyPair(userId: number, keyPair: MailboxKeyPair) {
    this.mailboxUserId = userId
    this.mailboxKeyPair = keyPair
    this.mailboxError = undefined
  }

  clear() {
    this.mailboxUserId = undefined
    this.mailboxKeyPair = undefined
    this.mailboxUnlocking = false
    this.mailboxError = undefined
  }

  syncCurrentUser(userId?: number) {
    if (!userId) {
      this.clear()
      return
    }

    if (this.mailboxUserId && this.mailboxUserId !== userId) {
      this.clear()
    }
  }

  async unlockMailbox(userId: number, password: string, publicKey: string, publicKeyAlg: string) {
    if (this.mailboxUserId === userId && this.hasMailboxKey(publicKey, publicKeyAlg)) {
      if (this.mailboxKeyPair) {
        return this.mailboxKeyPair
      }
    }

    this.mailboxUnlocking = true
    this.mailboxError = undefined

    try {
      const keyPair = await deriveMailboxKeyPair(password)

      if (!mailboxKeyMatches(keyPair, publicKey, publicKeyAlg)) {
        throw new Error('Пароль не подходит.')
      }

      runInAction(() => {
        this.cacheMailboxKeyPair(userId, keyPair)
        this.mailboxUnlocking = false
      })

      return keyPair
    } catch (error) {
      runInAction(() => {
        this.mailboxUnlocking = false
        this.mailboxError = error instanceof Error ? error.message : 'Не удалось разблокировать почтовый ящик.'
      })
      throw error
    }
  }
}
