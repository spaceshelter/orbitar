import { EncryptedPayloadDraftEntity, EncryptedPayloadEntity } from '../api/types/entities/EncryptedPayloadEntity'
import { DBConnection } from '../db/DB'
import EncryptedPayloadRepository from '../db/repositories/EncryptedPayloadRepository'

export default class EncryptedPayloadManager {
  private encryptedPayloadRepository: EncryptedPayloadRepository

  constructor(encryptedPayloadRepository: EncryptedPayloadRepository) {
    this.encryptedPayloadRepository = encryptedPayloadRepository
  }

  createEncryptedPayload(conn: DBConnection, payload: EncryptedPayloadDraftEntity | undefined) {
    return this.encryptedPayloadRepository.createEncryptedPayload(conn, payload)
  }

  async getEncryptedPayloadsByIds(ids: number[], userId: number): Promise<EncryptedPayloadEntity[]> {
    const rows = await this.encryptedPayloadRepository.getEncryptedPayloadsByIds(ids, userId)

    return rows.map((row) => ({
      id: row.encrypted_payload_id,
      v: row.v,
      parserProfile: row.parser_profile,
      canDecrypt: !!row.key_user_id,
      payload: row.key_user_id
        ? {
            ciphertext: row.ciphertext,
            iv: row.iv,
            wrap: {
              role: (row.key_role || 'recipient') as 'sender' | 'recipient',
              publicKey: row.key_public_key || '',
              publicKeyAlg: row.key_public_key_alg || '',
              ephemeralPublicKey: row.key_ephemeral_public_key || '',
              iv: row.key_iv || '',
              encryptedKey: row.key_encrypted_key || '',
            },
          }
        : undefined,
    }))
  }
}
