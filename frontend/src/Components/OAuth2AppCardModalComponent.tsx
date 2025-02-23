import React, { MouseEventHandler, useEffect, useState } from 'react'

import classNames from 'classnames'
import { confirmAlert } from 'react-confirm-alert'
import { FaEdit, FaKey, FaLink, FaTrash } from 'react-icons/fa'
import { toast } from 'react-toastify'

import { useAPI, useAppState } from '../AppState/AppState'
import { OAuth2ClientEntity } from '../Types/OAuth2'
import { pluralize } from '../Utils/utils'
import CopyableEmbedCodeComponent from './CopyableEmbedCodeComponent'
import ExpandSection from './ExpandSectionComponent'
import { OAuth2AppCardSummaryComponent } from './OAuth2AppCardSummaryComponent'
import OAuth2ClientLogoComponent from './OAuth2ClientLogoComponent'
import OAuth2ScopesComponent from './OAuth2ScopesComponent'
import Overlay from './Overlay'
import Username from './Username'
import UserProfileClientAppsCreateForm from './UserProfileClientAppsCreateForm'

import buttonStyles from './Buttons.module.scss'
import styles from './OAuth2AppCardModalComponent.module.scss'
import createFormStyles from './UserProfileClientApps.module.scss'

interface OAuthEmbeddedAppComponentProps {
  clientId: string
}

/**
 * This component is specifically designed to be embedded in the ContentComponent (comment, post, etc).
 * It fetches the client data by the client ID and displays a short card.
 */
export function OAuthEmbeddedAppComponent(props: OAuthEmbeddedAppComponentProps) {
  const api = useAPI()
  const appState = useAppState()
  const [client, setClient] = React.useState<OAuth2ClientEntity | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [openFullView, setOpenFullView] = React.useState(false)

  useEffect(() => {
    if (client && openFullView) {
      appState.setModal(
        <OAuth2AppCardModalComponent
          client={client}
          disallowEditing={true}
          onClose={() => {
            appState.setModal(undefined)
            setOpenFullView(false)
          }}
          onClientUpdate={setClient}
        />,
      )
    }
  }, [client, openFullView])

  const handleFullView = () => {
    setOpenFullView(true)
  }

  React.useEffect(() => {
    api.oauth2Api
      .getClientCached(props.clientId)
      .then((client) => {
        setClient(client)
      })
      .catch(() => {
        setError('Произошла ужасная ошибка!')
      })
  }, [props.clientId])

  if (error) {
    return <div className={styles.embeddedAppCard}>{error}</div>
  }
  if (!client) {
    return <div>Загрузка...</div>
  } else {
    return (
      <>
        <OAuth2AppCardSummaryComponent client={client} onOpenFullView={handleFullView} />
      </>
    )
  }
}

interface OAuth2AppCardModalProps {
  client: OAuth2ClientEntity
  onClientSecretUpdate?: (clientId: string, newSecret: string) => void
  onClientDelete?: (clientId: string) => void
  onClientUpdate?: (client: OAuth2ClientEntity) => void
  onClose: () => void

  disallowEditing?: boolean
  hideShareButton?: boolean
  // If true, the modal will be rendered inline without an overlay
  // and without fixed positioning
  forceInline?: boolean

  children?: React.ReactNode
}

export function OAuth2AppCardModalComponent(props: OAuth2AppCardModalProps) {
  const api = useAPI()
  const { userInfo } = useAppState()
  const userId = userInfo?.id
  const { client, onClientSecretUpdate } = props
  const [editing, setEditing] = useState(false)
  const embedCode = `<app>${client.clientId}</app>`
  const shouldShowManagementControls = client.author.id === userId && !props.disallowEditing

  const confirmAction = (title: string, message: string, action: () => void) => {
    confirmAlert({
      title,
      message,
      buttons: [
        { label: 'Yes', onClick: action },
        { label: 'Cancel', className: 'cancel' },
      ],
      overlayClassName: 'orbitar-confirm-overlay',
    })
  }

  const handleClientEdit: MouseEventHandler = (e) => {
    e.preventDefault()
    setEditing(true)
  }

  const handleClientSecretUpdate: MouseEventHandler = (e) => {
    e.preventDefault()
    confirmAction(
      'Астанавитесь!',
      `Вы точно хотите сгенерировать новый секрет (client_secret) приложения? Это действие необратимо. 
                Новые авторизации, исользующие старый секрет, не будут работать.
                Но токены, выданные ранее, работать продолжат.`,
      () => {
        api.oauth2Api
          .regenerateClientSecret(client.clientId)
          .then((data) => {
            onClientSecretUpdate?.(client.clientId, data.newSecret)
          })
          .catch(() => {
            toast.error('Failed to regenerate client secret')
          })
      },
    )
  }

  const handleNewLogo = (url: string) => {
    api.oauth2Api
      .updateClientLogo(client.clientId, url)
      .then(() => {
        api.oauth2Api.clearClientCache()
        props.onClientUpdate?.({ ...client, logoUrl: url })
      })
      .catch(() => {
        toast.error('Не удалось обновить логотип')
      })
  }

  const handleInstallClick = () => {
    if (client.initialAuthorizationUrl) {
      const authWindow = window.open(client.initialAuthorizationUrl, '_blank')
      if (authWindow) {
        const handleFocus = () => {
          api.oauth2Api.clearClientCache()
          api.oauth2Api.getClientCached(client.clientId).then((updatedClient) => {
            props.onClientUpdate?.(updatedClient)
          })
        }
        window.addEventListener('focus', handleFocus, { once: true })
      }
    }
  }

  const handleClientDelete: MouseEventHandler = (e) => {
    e.preventDefault()
    const message = 'Вы уверены, что хотите удалить приложение? Это необратимое действие.'
    confirmAction('Астанавитесь!', message, () =>
      api.oauth2Api
        .deleteClient(client.clientId)
        .then(() => {
          props.onClientDelete?.(client.clientId)
          props.onClose()
        })
        .catch(() => {
          toast.error('Не удалось удалить приложение')
        }),
    )
  }

  const handleUnInstallClick = () => {
    const message = `Вы уверены, что хотите отключить приложение (отозвать его авторизацию)?
             Это действие отзовет весь доступ, ранее данный вами приложению.
            В принципе, это не страшно, можно подключить его потом снова.`
    confirmAction('Астанавитесь!', message, () =>
      api.oauth2Api
        .unauthorizeClient(client.clientId)
        .then((updatedClient) => {
          api.oauth2Api.clearClientCache()
          props.onClientUpdate?.(updatedClient)
        })
        .catch(() => {
          toast.error('Не удалось отключить приложение')
        }),
    )
  }

  if (editing) {
    return (
      <>
        <Overlay onClick={() => setEditing(false)} />
        <div className={createFormStyles.appsContainer}>
          <div className={createFormStyles.forDevContainer}>
            <div className={createFormStyles.createAppContainer}>
              <UserProfileClientAppsCreateForm
                editingClient={client}
                onClientEditSuccess={(newClient) => {
                  api.oauth2Api.clearClientCache()
                  props.onClientUpdate?.(newClient)
                  setEditing(false)
                }}
              />
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {!props.forceInline && <Overlay onClick={props.onClose} />}
      <div
        className={classNames(createFormStyles.createAppContainer, styles.appCard, styles.appModal, {
          [styles.fixed]: !props.forceInline,
        })}
      >
        <div className={styles.logoContainer}>
          <OAuth2ClientLogoComponent
            url={client.logoUrl}
            canManage={shouldShowManagementControls}
            onNewLogo={handleNewLogo}
          />
        </div>
        <div className={styles.nameContainer}>
          <h3 className={styles.name}>
            {client.name}
            <span>
              от&nbsp;
              <Username onClick={props.onClose} className={styles.author} user={client.author} />
            </span>
          </h3>
        </div>
        <div className={styles.installationsCountContainer}>
          <FaLink size={14} />
          {pluralize(client.installationsCount || 0, ['пользователь', 'пользователя', 'пользователей'])}
        </div>

        {shouldShowManagementControls && (
          <div className={classNames(styles.buttonsContainer, styles.ownerButtons)}>
            <button onClick={handleClientEdit} className={buttonStyles.linkButton}>
              <FaEdit />
              редактировать
            </button>
            <button onClick={handleClientSecretUpdate} className={buttonStyles.linkButton}>
              <FaKey />
              сбросить секрет
            </button>
            {!client.installationsCount && (
              <button onClick={handleClientDelete} className={classNames(buttonStyles.linkButton, buttonStyles.danger)}>
                <FaTrash />
                удалить
              </button>
            )}
          </div>
        )}

        <div className={styles.descriptionContainer}>
          <p className={styles.description}>{client.description}</p>
        </div>

        {!props.hideShareButton && (
          <ExpandSection title='Код для встраивания'>
            <CopyableEmbedCodeComponent text={embedCode} />
          </ExpandSection>
        )}

        {client.scopes && (
          <ExpandSection title='Текушие разрешения'>
            <OAuth2ScopesComponent appRequests={client.scopes} />
          </ExpandSection>
        )}

        {!props.children && (
          <div className={styles.buttonsContainer}>
            {client.initialAuthorizationUrl && (
              <button
                onClick={handleInstallClick}
                className={classNames(buttonStyles.settingsButton, buttonStyles.positiveButton, buttonStyles.bigger)}
              >
                Подключить {client.scopes ? 'еще раз' : ''}
              </button>
            )}
            {client.scopes && (
              <button
                onClick={handleUnInstallClick}
                className={classNames(buttonStyles.settingsButton, buttonStyles.danger, buttonStyles.bigger)}
              >
                Отключить
              </button>
            )}
          </div>
        )}

        {/* Inject your authorization or other custom UI here */}
        <div>{props.children}</div>
      </div>
    </>
  )
}
