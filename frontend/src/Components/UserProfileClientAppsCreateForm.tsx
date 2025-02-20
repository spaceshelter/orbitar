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
    const { name, description, redirectUris, logoUrl, initialAuthorizationUrl } = data

    if (editingClient) {
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
      .registerClient(name, description, redirectUris, logoUrl, initialAuthorizationUrl)
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

  const validateUrls = (value: string) => {
    const urls = value.split(',').map((url) => url.trim())
    return (
      urls.every((url) =>
        isURL(url, {
          require_tld: process.env.NODE_ENV !== 'development',
          require_protocol: true,
          allow_fragments:
            false /*RFC 6749 Section 3.1.2: The redirection endpoint URI MUST NOT include a fragment component.*/,
          protocols: ['https', ...(process.env.NODE_ENV === 'development' ? ['https', 'http'] : [])],
        }),
      ) || 'Введите URL-адреса, разделенные запятыми'
    )
  }

  const validateOptionalUrl = (value: string) => {
    return (
      value.trim() === '' ||
      isURL(value, {
        require_tld: process.env.NODE_ENV !== 'development',
        require_protocol: true,
        protocols: ['https', ...(process.env.NODE_ENV === 'development' ? ['http', 'https'] : [])],
      }) ||
      'Введите валидный URL-адрес или оставьте поле пустым'
    )
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
            <b>Разрешённые URL для редиректов (через запятую):</b>
            <input
              type='text'
              {...register('redirectUris', { validate: validateUrls })}
              defaultValue={editingClient ? editingClient.redirectUris : ''}
            />
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
