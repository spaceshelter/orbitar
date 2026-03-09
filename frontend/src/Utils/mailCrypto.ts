import { scrypt } from 'scrypt-js'
import nacl from 'tweetnacl'

export const MAILBOX_PUBLIC_KEY_ALG = 'x25519-scrypt-v1'
export const ENCRYPTED_PAYLOAD_VERSION = 1
export const ENCRYPTED_PAYLOAD_PARSER_PROFILE = 'lite-v1'

const MAILBOX_SALT = 'f8psK3rQ58K#J#j95@UXFt94RTyH!q9R'
const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_DK_LEN = 32
const HKDF_INFO = new TextEncoder().encode('orbitar-encrypted-content-v1')
const EMPTY_SALT = new Uint8Array([])

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type MailboxKeyPair = {
  publicKey: string
  publicKeyAlg: string
  publicKeyBytes: Uint8Array
  secretKey: Uint8Array
}

export type EncryptedPayloadWrapDraft = {
  userId: number
  role: 'sender' | 'recipient'
  publicKey: string
  publicKeyAlg: string
  ephemeralPublicKey: string
  iv: string
  encryptedKey: string
}

export type EncryptedPayloadDraft = {
  v: number
  parserProfile: string
  ciphertext: string
  iv: string
  wraps: EncryptedPayloadWrapDraft[]
}

export type EncryptedPayloadWrap = Omit<EncryptedPayloadWrapDraft, 'userId'>

export type EncryptedPayloadEntity = {
  id: number
  v: number
  parserProfile: string
  canDecrypt: boolean
  payload?: {
    ciphertext: string
    iv: string
    wrap: EncryptedPayloadWrap
  }
}

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

export async function encryptContentForUsers(
  source: string,
  recipients: Array<Pick<EncryptedPayloadWrapDraft, 'userId' | 'role' | 'publicKey' | 'publicKeyAlg'>>,
): Promise<EncryptedPayloadDraft> {
  const contentKey = crypto.getRandomValues(new Uint8Array(32))
  const contentIv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await encryptWithAesGcm(contentKey, contentIv, encoder.encode(source))

  const wraps = await Promise.all(
    recipients.map(async (recipient) => {
      if (!isValidMailboxPublicKey(recipient.publicKey, recipient.publicKeyAlg)) {
        throw new Error('Некорректный публичный ключ получателя.')
      }

      const ephemeralKeyPair = nacl.box.keyPair()
      const wrapIv = crypto.getRandomValues(new Uint8Array(12))
      const sharedSecret = nacl.scalarMult(ephemeralKeyPair.secretKey, base64UrlToBytes(recipient.publicKey))
      const wrapKey = await deriveSharedAesKey(sharedSecret)
      const encryptedKey = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: wrapIv }, wrapKey, contentKey)

      return {
        userId: recipient.userId,
        role: recipient.role,
        publicKey: recipient.publicKey,
        publicKeyAlg: recipient.publicKeyAlg,
        ephemeralPublicKey: bytesToBase64Url(ephemeralKeyPair.publicKey),
        iv: bytesToBase64Url(wrapIv),
        encryptedKey: bytesToBase64Url(new Uint8Array(encryptedKey)),
      }
    }),
  )

  return {
    v: ENCRYPTED_PAYLOAD_VERSION,
    parserProfile: ENCRYPTED_PAYLOAD_PARSER_PROFILE,
    ciphertext: bytesToBase64Url(ciphertext),
    iv: bytesToBase64Url(contentIv),
    wraps,
  }
}

export async function decryptEncryptedPayload(
  payload: EncryptedPayloadEntity,
  keyPair: MailboxKeyPair,
): Promise<string> {
  if (!payload.payload) {
    throw new Error('Недостаточно данных для расшифровки.')
  }

  const { wrap } = payload.payload
  if (!mailboxKeyMatches(keyPair, wrap.publicKey, wrap.publicKeyAlg)) {
    throw new Error('Пароль не подходит.')
  }

  try {
    const sharedSecret = nacl.scalarMult(keyPair.secretKey, base64UrlToBytes(wrap.ephemeralPublicKey))
    const wrapKey = await deriveSharedAesKey(sharedSecret)
    const contentKey = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(wrap.iv) },
      wrapKey,
      base64UrlToBytes(wrap.encryptedKey),
    )

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(payload.payload.iv) },
      await importAesKey(new Uint8Array(contentKey), ['decrypt']),
      base64UrlToBytes(payload.payload.ciphertext),
    )

    return decoder.decode(decrypted)
  } catch (error) {
    throw new Error('Не удалось расшифровать содержимое.')
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

async function deriveSharedAesKey(sharedSecret: Uint8Array) {
  const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: EMPTY_SALT,
      info: HKDF_INFO,
    },
    hkdfKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importAesKey(keyBytes: Uint8Array, usages: KeyUsage[]) {
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, usages)
}

async function encryptWithAesGcm(keyBytes: Uint8Array, iv: Uint8Array, data: Uint8Array) {
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await importAesKey(keyBytes, ['encrypt']),
    data,
  )
  return new Uint8Array(encrypted)
}
