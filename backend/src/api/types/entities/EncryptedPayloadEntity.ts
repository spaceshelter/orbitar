export type EncryptedPayloadWrapDraftEntity = {
  userId: number
  role: 'sender' | 'recipient'
  publicKey: string
  publicKeyAlg: string
  ephemeralPublicKey: string
  iv: string
  encryptedKey: string
}

export type EncryptedPayloadDraftEntity = {
  v: number
  parserProfile: string
  ciphertext: string
  iv: string
  wraps: EncryptedPayloadWrapDraftEntity[]
}

export type EncryptedPayloadWrapEntity = {
  role: 'sender' | 'recipient'
  publicKey: string
  publicKeyAlg: string
  ephemeralPublicKey: string
  iv: string
  encryptedKey: string
}

export type EncryptedPayloadEntity = {
  id: number
  v: number
  parserProfile: string
  canDecrypt: boolean
  payload?: {
    ciphertext: string
    iv: string
    wrap: EncryptedPayloadWrapEntity
  }
}
