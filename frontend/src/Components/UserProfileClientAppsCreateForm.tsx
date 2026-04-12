import React, { useState } from 'react'

import classNames from 'classnames'
import { SubmitHandler, useForm } from 'react-hook-form'
import isURL from 'validator/lib/isURL'

import { useAPI } from '../AppState/AppState'
import { OAuth2ClientEntity } from '../Types/OAuth2'

import mediaFormStyles from './MediaUploader.module.scss'
import styles from './UserProfileClientApps.module.scss'

type AppSubmitFormValues = {
  name: string
  description: string
  redirectUris: string
  grants: string
  logoUrl?: string
  initialAuthorizationUrl: string
  clientType: 'public' | 'confidential'
}

type UserProfileClientAppsCreateFormProps = {
  onClientRegisterSuccess?: (newClient?: OAuth2ClientEntity) => void
  editingClient?: OAuth2ClientEntity
  onClientEditSuccess?: (newClient: OAuth2ClientEntity) => void
}

export default function UserProfileClientAppsCreateForm(props: UserProfileClientAppsCreateFormProps) {
  const api = useAPI()
  const { editingClient, onClientRegisterSuccess, onClientEditSuccess } = props

  const onSubmit: SubmitHandler<AppSubmitFormValues> = (data) => {
    setSubmitting(true)
    const { name, description, redirectUris, logoUrl, initialAuthorizationUrl, clientType } = data

    if (editingClient) {
      // Client type cannot be changed after creation
      api.oauth2Api
        .editClient(editingClient.clientId, description, redirectUris, initialAuthorizationUrl)
        .then((newClient) => {
          if (onClientEditSuccess) {
            onClientEditSuccess(newClient)
          }
        })
        .catch((err) => {
          setSubmitError(err.message)
        })
        .finally(() => {
          setSubmitting(false)
        })
      return
    }

    api.oauth2Api
      .registerClient(name, description, redirectUris, logoUrl, initialAuthorizationUrl, clientType)
      .then((data) => {
        if (onClientRegisterSuccess) {
          onClientRegisterSuccess(data.client)
        }
      })
      .catch((err) => {
        setSubmitError(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AppSubmitFormValues>({
    mode: 'onChange',
  })

  const newAppformReady = () => {
    return isValid
  }

  const isValidRedirectUri = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      if (urlObj.hash && urlObj.hash !== '#') {
        return false
      }
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        const hostname = urlObj.hostname
        const isLocalhost =
          hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
        const allowHttp = isLocalhost || process.env.NODE_ENV === 'development'
        return isURL(url, {
          require_tld: !isLocalhost && process.env.NODE_ENV !== 'development',
          require_protocol: true,
          allow_fragments: false,
          protocols: ['https', ...(allowHttp ? ['http'] : [])],
        })
      }
      return Boolean(urlObj.protocol) && urlObj.protocol !== ':'
    } catch (err) {
      return false
    }
  }

  const validateUrls = (value: string) => {
    const urls = value.split(',').map((url) => url.trim())
    for (const url of urls) {
      if (!isValidRedirectUri(url)) {
        return 'Invalid URI format'
      }
    }
    return true
  }

  const validateOptionalUrl = (value: string) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      return true
    }
    return isValidRedirectUri(trimmed) || 'Введите валидный URL-адрес или оставьте поле пустым'
  }

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  return (
    <>
      <div
        className={classNames({
          [mediaFormStyles.container]: true,
          [styles.create]: true,
          [styles.active]: true,
        })}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <label>
            <b>Название приложения:</b>
            <input
              type='text'
              {...(!editingClient
                ? register('name', {
                    required: 'Без названия никак',
                    pattern: {
                      value: /^[a-zа-яё_\d .-]{2,32}$/i,
                      message: 'Только буквы, цифры, пробел, и некоторые символы, от 2 до 32 символов',
                    },
                  })
                : {})}
              disabled={Boolean(editingClient)}
              defaultValue={editingClient ? editingClient.name : ''}
            />
            {errors.name && <p className={styles.error}>{errors.name.message}</p>}
          </label>

          <label>
            <b>Описание:</b>
            <textarea
              maxLength={255}
              placeholder={'Описание даст пользователям понять, зачем нужно ваше приложение.'}
              {...register('description', {
                maxLength: {
                  value: 255,
                  message: 'Описание не должно быть длиннее 255 символов',
                },
              })}
              defaultValue={editingClient ? editingClient.description : ''}
            ></textarea>
            {errors.description && <p className={styles.error}>{errors.description.message}</p>}
          </label>

          <label>
            <b>Тип клиента:</b>
            <select
              {...(!editingClient
                ? register('clientType', {
                    required: 'Выберите тип клиента',
                  })
                : {})}
              disabled={Boolean(editingClient)}
              defaultValue={editingClient ? editingClient.clientType : 'confidential'}
            >
              <option value='confidential'>Confidential (серверное приложение с client_secret)</option>
              <option value='public'>Public (мобильное/десктопное приложение с PKCE)</option>
            </select>
            <p>
              <span className={classNames('i', 'i-info')}></span> Confidential клиенты используют client_secret для
              аутентификации (веб-приложения, серверные приложения). Public клиенты используют PKCE и не имеют
              client_secret (мобильные и десктопные приложения).
            </p>
            {errors.clientType && <p className={styles.error}>{errors.clientType.message}</p>}
          </label>

          <label>
            <b>Разрешённые URL для редиректов (через запятую):</b>
            <input
              type='text'
              {...register('redirectUris', { validate: validateUrls })}
              defaultValue={editingClient ? editingClient.redirectUris : ''}
              placeholder='https://example.com/callback, myapp://callback'
            />
            <p>
              <span className={classNames('i', 'i-info')}></span> Поддерживаются HTTPS URLs и custom protocol URIs
              (например, myapp://callback для мобильных приложений). В development режиме также разрешены HTTP URLs.
            </p>
            {errors.redirectUris && <p className={styles.error}>{errors.redirectUris.message}</p>}
          </label>

          <label id={styles.startUrlContainer}>
            <b>URL подключения приложения:</b>
            <input
              type='text'
              {...register('initialAuthorizationUrl', {
                validate: validateOptionalUrl,
              })}
              defaultValue={editingClient ? editingClient.initialAuthorizationUrl : ''}
            />
            <p>
              <span className={classNames('i', 'i-info')}></span> Опционально. Если этот URL указан, мы покажем
              пользователям кнопку "Подключить", нажав на которую они будут перенаправлены на этот URL, откуда вы
              сможете либо сразу перенаправить пользователя обратно к нам для авторизации вашего приложения либо
              показать инструкцию вашего приложения
            </p>
            {errors.initialAuthorizationUrl && <p className={styles.error}>{errors.initialAuthorizationUrl.message}</p>}
          </label>
          <input type='hidden' value={'authorization_code, refresh_token'} {...register('grants')} />
          <div className={styles.submitContainer}>
            <input type='submit' value='Отправить' disabled={submitting || !newAppformReady()} />
            {submitError && <p className={styles.error}>{submitError}</p>}
          </div>
        </form>
      </div>
    </>
  )
}
