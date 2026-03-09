export type EncryptedPayloadRaw = {
  encrypted_payload_id: number
  v: number
  parser_profile: string
  ciphertext: string
  iv: string
  created_at: Date
}

export type EncryptedPayloadKeyRaw = {
  encrypted_payload_key_id: number
  encrypted_payload_id: number
  user_id: number
  role: string
  public_key: string
  public_key_alg: string
  ephemeral_public_key: string
  iv: string
  encrypted_key: string
  created_at: Date
}

export type EncryptedPayloadWithUserKeyRaw = EncryptedPayloadRaw & {
  key_user_id?: number
  key_role?: string
  key_public_key?: string
  key_public_key_alg?: string
  key_ephemeral_public_key?: string
  key_iv?: string
  key_encrypted_key?: string
}
