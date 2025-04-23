import React, { useEffect, useState } from 'react'

import Button from '@ui/Button'
import classNames from 'classnames'
import { toast } from 'react-toastify'

import { useAPI, useAppState } from '../AppState/AppState'
import { OAuth2ClientEntity } from '../Types/OAuth2'
import CopyableEmbedCodeComponent from './CopyableEmbedCodeComponent'
import Overlay from './Overlay'
import UserProfileClientAppsCreateForm from './UserProfileClientAppsCreateForm'
import UserProfileClientAppsList from './UserProfileClientAppsList'

import mediaFormStyles from './MediaUploader.module.scss'
import styles from './UserProfileClientApps.module.scss'

type SecretState = {
  type: 'regenerated' | 'new'
  clientId: string
  secret: string
}

export default function UserProfileClientsApps() {
  const api = useAPI()
  const myUserId = useAppState().userInfo?.id
  const [clients, setClients] = useState<OAuth2ClientEntity[]>([])

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generatedSecret, setGeneratedSecret] = useState<SecretState | undefined>(undefined)

  useEffect(() => {
    setLoading(true)
    if (!myUserId) {
      return
    }
    api.oauth2Api
      .listClients()
      .then((data) => {
        setClients(data.clients)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Не удалось загрузить список приложений')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const handleClientSecretUpdate = (clientId: string, newSecret: string) => {
    setGeneratedSecret({ type: 'regenerated', clientId, secret: newSecret })
  }

  const handleUpdatedClient = (updatedClient?: OAuth2ClientEntity) => {
    if (updatedClient) {
      setClients(clients.map((client) => (client.clientId === updatedClient.clientId ? updatedClient : client)))
    }
  }

  const handleClientDelete = (deletedClientId: string) => {
    setClients(clients.filter((client) => client.clientId !== deletedClientId))
  }

  const handleCreatedClient = (newClient?: OAuth2ClientEntity) => {
    if (newClient) {
      setCreating(false)
      setGeneratedSecret({ type: 'new', clientId: newClient.clientId, secret: newClient.clientSecretOriginal || '' })
      setClients([...clients, newClient])
    }
  }

  const ownAppsList = clients.filter((client) => client.author.id === myUserId)
  const installedAppsList = clients.filter((client) => client.author.id !== myUserId)

  return (
    <div className={styles.appsContainer}>
      {generatedSecret && (
        <div className={styles.clientSecretCopyContainer}>
          <Overlay
            onClick={() => {
              setGeneratedSecret(undefined)
            }}
            zIndex={10000}
          />
          <div
            className={classNames([mediaFormStyles.container, styles.clientSecretCopyContainer])}
            style={{ zIndex: 10001 }}
          >
            <h3>{generatedSecret.type === 'new' ? 'Приложение зарегистрировано!' : 'Секрет обновлен!'}</h3>
            <div>
              <h4>ID вашего приложения (client_id)</h4>
              <CopyableEmbedCodeComponent text={generatedSecret.clientId} />
            </div>
            <div>
              <h4>Секретный код приложения (client_secret)</h4>
              <CopyableEmbedCodeComponent text={generatedSecret.secret} />

              <span className={styles.codeInfo}>
                Скопируйте ID приложения (client_id) и секретный код и сохраните эти данные в надёжном месте.
                <br />
                Мы храним секретные коды в зашифрованном виде и не можем их восстановить.
                <br />
                <br />
                {generatedSecret.type !== 'new' && (
                  <>
                    Правда, вы сможете перегенерировать его в любое время, но тогда вам также придётся обновить код в
                    своём приложении.
                  </>
                )}
              </span>
              <span className={styles.clientSecret}>{}</span>
            </div>
          </div>
        </div>
      )}
      {loading && <span>Loading...</span>}

      {installedAppsList.length > 0 && (
        <>
          <h4>Подключенные приложения</h4>
          <UserProfileClientAppsList
            onClientSecretUpdate={handleClientSecretUpdate}
            onClientUpdate={handleUpdatedClient}
            onClientDelete={handleClientDelete}
            list={installedAppsList}
          />
        </>
      )}

      {ownAppsList.length > 0 && (
        <div className={styles.ownAppsContainer}>
          <h4>Ваши приложения</h4>
          <UserProfileClientAppsList
            onClientSecretUpdate={handleClientSecretUpdate}
            onClientUpdate={handleUpdatedClient}
            onClientDelete={handleClientDelete}
            list={ownAppsList}
          />
        </div>
      )}

      {!installedAppsList.length && !ownAppsList.length && !loading && <span>Тут пока пусто</span>}

      <div className={styles.forDevContainer}>
        <h4>Для разработчиков</h4>
        <Button
          variant='link'
          disabled={creating}
          onClick={() => {
            setCreating(true)
          }}
        >
          Зарегистрировать своё приложение
        </Button>
        {creating && (
          <>
            <Overlay
              onClick={() => {
                setCreating(false)
              }}
            />
            <div className={styles.createAppContainer}>
              <UserProfileClientAppsCreateForm
                onClientEditSuccess={(newClient) => {
                  setCreating(false)
                  handleUpdatedClient(newClient)
                }}
                onClientRegisterSuccess={handleCreatedClient}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
