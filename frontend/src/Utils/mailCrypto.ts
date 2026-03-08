import { scrypt } from 'scrypt-js'
import nacl from 'tweetnacl'

export const MAILBOX_PUBLIC_KEY_ALG = 'x25519-scrypt-v1'

const MAILBOX_SALT = 'f8psK3rQ58K#J#j95@UXFt94RTyH!q9R'
const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_DK_LEN = 32

export type MailboxKeyPair = {
  publicKey: string
  publicKeyAlg: string
  publicKeyBytes: Uint8Array
  secretKey: Uint8Array
}

const encoder = new TextEncoder()

export async function deriveMailboxKeyPair(password: string): Promise<MailboxKeyPair> {
  const derivedKey = await scrypt(
    encoder.encode(password),
    encoder.encode(MAILBOX_SALT),
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    SCRYPT_DK_LEN,
  )

  const secretKey = Uint8Array.from(derivedKey)
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey)

  return {
    publicKey: bytesToBase64Url(keyPair.publicKey),
    publicKeyAlg: MAILBOX_PUBLIC_KEY_ALG,
    publicKeyBytes: keyPair.publicKey,
    secretKey: keyPair.secretKey,
  }
}

export function isValidMailboxPublicKey(publicKey: string, publicKeyAlg: string) {
  return publicKeyAlg === MAILBOX_PUBLIC_KEY_ALG && /^[A-Za-z0-9_-]{43}$/.test(publicKey)
}

export function mailboxKeyMatches(keyPair: MailboxKeyPair, publicKey: string, publicKeyAlg: string) {
  return keyPair.publicKeyAlg === publicKeyAlg && keyPair.publicKey === publicKey
}

export function bytesToBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '==='.slice((normalized.length + 3) % 4)
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}
