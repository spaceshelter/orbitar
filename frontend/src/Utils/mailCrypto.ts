import { scrypt } from 'scrypt-js'
import nacl from 'tweetnacl'

export const MAILBOX_KEY_ALG = 'x25519-scrypt-v1'
export const MAIL_VERSION = 2
export const MAIL_PAYLOAD_ALG = 'X25519-HKDF-SHA256-A256GCM'

const MAILBOX_SALT_PREFIX = 'orbitar-mailbox-v2'
const MAIL_HKDF_INFO = 'orbitar-shifrovki-v2'
const SCRYPT_PARAMS = {
  N: 32768,
  r: 8,
  p: 1,
  dkLen: 32,
}

export type MailboxKeyPair = {
  publicKey: string
  secretKey: Uint8Array
}

type MailEnvelope = {
  alg: string
  epk: string
  iv: string
  ct: string
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

let cachedMailboxKeyPair: { userId: number; keyPair: MailboxKeyPair } | null = null

function getCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto API is not available')
  }

  return globalThis.crypto
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const result = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i)
  }

  return result
}

async function deriveAesKey(sharedSecret: Uint8Array, usage: KeyUsage[]) {
  const cryptoApi = getCrypto()
  const keyMaterial = await cryptoApi.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])

  return await cryptoApi.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: textEncoder.encode(MAIL_HKDF_INFO),
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    usage,
  )
}

async function deriveMailboxSecretKey(password: string, userId: number) {
  return Uint8Array.from(
    await scrypt(
      textEncoder.encode(password),
      textEncoder.encode(`${MAILBOX_SALT_PREFIX}:${userId}`),
      SCRYPT_PARAMS.N,
      SCRYPT_PARAMS.r,
      SCRYPT_PARAMS.p,
      SCRYPT_PARAMS.dkLen,
    ),
  )
}

function parsePublicKey(publicKey: string) {
  const decoded = decodeBase64Url(publicKey)
  if (decoded.length !== nacl.box.publicKeyLength) {
    throw new Error('Invalid mailbox public key')
  }

  return decoded
}

function parseEnvelope(payload: string): MailEnvelope {
  const envelope = JSON.parse(payload) as Partial<MailEnvelope>
  if (
    envelope.alg !== MAIL_PAYLOAD_ALG ||
    !envelope.epk ||
    !envelope.iv ||
    !envelope.ct ||
    typeof envelope.epk !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ct !== 'string'
  ) {
    throw new Error('Invalid mail payload')
  }

  return envelope as MailEnvelope
}

async function decryptEnvelopeWithKeyPair(payload: string, keyPair: MailboxKeyPair) {
  const envelope = parseEnvelope(payload)
  const ephemeralPublicKey = decodeBase64Url(envelope.epk)
  const iv = decodeBase64Url(envelope.iv)
  const ciphertext = decodeBase64Url(envelope.ct)

  if (ephemeralPublicKey.length !== nacl.box.publicKeyLength || iv.length !== 12) {
    throw new Error('Invalid mail payload')
  }

  const sharedSecret = nacl.scalarMult(keyPair.secretKey, ephemeralPublicKey)
  const aesKey = await deriveAesKey(sharedSecret, ['decrypt'])
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    ciphertext,
  )

  return textDecoder.decode(new Uint8Array(plaintext))
}

export function clearCachedMailboxKeyPair(userId?: number) {
  if (!cachedMailboxKeyPair) {
    return
  }

  if (!userId || cachedMailboxKeyPair.userId === userId) {
    cachedMailboxKeyPair = null
  }
}

export function getCachedMailboxKeyPair(userId: number): MailboxKeyPair | undefined {
  return cachedMailboxKeyPair?.userId === userId ? cachedMailboxKeyPair.keyPair : undefined
}

export function cacheMailboxKeyPair(userId: number, keyPair: MailboxKeyPair): MailboxKeyPair {
  cachedMailboxKeyPair = {
    userId,
    keyPair,
  }

  return keyPair
}

export async function deriveMailboxKeyPair(password: string, userId: number): Promise<MailboxKeyPair> {
  const secretKey = await deriveMailboxSecretKey(password, userId)
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey)
  return {
    publicKey: encodeBase64Url(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  }
}

export async function getOrDeriveMailboxKeyPair(password: string, userId: number): Promise<MailboxKeyPair> {
  return getCachedMailboxKeyPair(userId) || cacheMailboxKeyPair(userId, await deriveMailboxKeyPair(password, userId))
}

export async function encryptMailEnvelope(plaintext: string, recipientPublicKey: string) {
  const recipientKey = parsePublicKey(recipientPublicKey)
  const ephemeralKeyPair = nacl.box.keyPair()
  const sharedSecret = nacl.scalarMult(ephemeralKeyPair.secretKey, recipientKey)
  const aesKey = await deriveAesKey(sharedSecret, ['encrypt'])
  const iv = getCrypto().getRandomValues(new Uint8Array(12))
  const ciphertext = await getCrypto().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    textEncoder.encode(plaintext),
  )

  const envelope: MailEnvelope = {
    alg: MAIL_PAYLOAD_ALG,
    epk: encodeBase64Url(ephemeralKeyPair.publicKey),
    iv: encodeBase64Url(iv),
    ct: encodeBase64Url(new Uint8Array(ciphertext)),
  }

  return JSON.stringify(envelope)
}

export async function decryptMailEnvelope(payload: string, password: string, userId: number) {
  const cachedKeyPair = getCachedMailboxKeyPair(userId)
  if (cachedKeyPair) {
    try {
      return await decryptEnvelopeWithKeyPair(payload, cachedKeyPair)
    } catch (error) {
      // fall through and derive from password again in case the cached key is stale
    }
  }

  const keyPair = await deriveMailboxKeyPair(password, userId)
  const decoded = await decryptEnvelopeWithKeyPair(payload, keyPair)
  cacheMailboxKeyPair(userId, keyPair)

  return decoded
}

export async function decryptMailEnvelopeWithCachedKey(payload: string, userId: number) {
  const cachedKeyPair = getCachedMailboxKeyPair(userId)
  if (!cachedKeyPair) {
    return undefined
  }

  return await decryptEnvelopeWithKeyPair(payload, cachedKeyPair)
}
