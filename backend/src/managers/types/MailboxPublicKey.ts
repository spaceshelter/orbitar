export const MAILBOX_PUBLIC_KEY_ALG = 'x25519-scrypt-v1'

export type MailboxPublicKey = {
  publicKey: string
  publicKeyAlg: string
}

const MAILBOX_PUBLIC_KEY_RE = /^[A-Za-z0-9_-]{43}$/

export function isValidMailboxPublicKey(publicKey: string, publicKeyAlg: string) {
  return publicKeyAlg === MAILBOX_PUBLIC_KEY_ALG && MAILBOX_PUBLIC_KEY_RE.test(publicKey)
}
