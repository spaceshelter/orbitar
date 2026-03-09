import { EncryptedPayloadDraftEntity } from '../../api/types/entities/EncryptedPayloadEntity'
import DB, { DBConnection } from '../DB'
import { EncryptedPayloadWithUserKeyRaw } from '../types/EncryptedPayloadRaw'

export default class EncryptedPayloadRepository {
  private db: DB

  constructor(db: DB) {
    this.db = db
  }

  async createEncryptedPayload(
    conn: DBConnection,
    payload: EncryptedPayloadDraftEntity | undefined,
  ): Promise<number | undefined> {
    if (!payload) {
      return undefined
    }

    const encryptedPayloadId = await conn.insert('encrypted_payloads', {
      v: payload.v,
      parser_profile: payload.parserProfile,
      ciphertext: payload.ciphertext,
      iv: payload.iv,
    })

    for (const wrap of payload.wraps) {
      await conn.insert('encrypted_payload_keys', {
        encrypted_payload_id: encryptedPayloadId,
        user_id: wrap.userId,
        role: wrap.role,
        public_key: wrap.publicKey,
        public_key_alg: wrap.publicKeyAlg,
        ephemeral_public_key: wrap.ephemeralPublicKey,
        iv: wrap.iv,
        encrypted_key: wrap.encryptedKey,
      })
    }

    return encryptedPayloadId
  }

  async getEncryptedPayloadsByIds(ids: number[], userId: number): Promise<EncryptedPayloadWithUserKeyRaw[]> {
    if (!ids.length) {
      return []
    }

    return await this.db.fetchAll<EncryptedPayloadWithUserKeyRaw>(
      `
        SELECT
          p.*,
          k.user_id AS key_user_id,
          k.role AS key_role,
          k.public_key AS key_public_key,
          k.public_key_alg AS key_public_key_alg,
          k.ephemeral_public_key AS key_ephemeral_public_key,
          k.iv AS key_iv,
          k.encrypted_key AS key_encrypted_key
        FROM encrypted_payloads p
        LEFT JOIN encrypted_payload_keys k
          ON k.encrypted_payload_id = p.encrypted_payload_id
         AND k.user_id = :userId
        WHERE p.encrypted_payload_id IN (:ids)
      `,
      {
        ids,
        userId,
      },
    )
  }
}
