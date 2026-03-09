import type { AppState } from '../AppState/AppState'
import { requestMailboxUnlock } from '../Components/SecretMailbox'
import { decryptEncryptedPayload, EncryptedPayloadEntity } from './mailCrypto'

export async function getEncryptedPayloadSource(
  appState: AppState,
  payload: EncryptedPayloadEntity,
): Promise<string | undefined> {
  if (!payload.canDecrypt || !payload.payload) {
    throw new Error('Недостаточно данных для расшифровки.')
  }

  if (!appState.cryptoSession.hasMailboxKey(payload.payload.wrap.publicKey, payload.payload.wrap.publicKeyAlg)) {
    const unlocked = await requestMailboxUnlock(
      appState,
      payload.payload.wrap.publicKey,
      payload.payload.wrap.publicKeyAlg,
    )

    if (!unlocked) {
      return undefined
    }
  }

  if (!appState.cryptoSession.mailboxKeyPair) {
    return undefined
  }

  return decryptEncryptedPayload(payload, appState.cryptoSession.mailboxKeyPair)
}
