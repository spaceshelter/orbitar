import classNames from 'classnames';
import mediaFormStyles from './MediaUploader.module.scss';
import styles from './UserProfileClientApps.module.scss';
import React, { useState } from 'react';
import { useAPI } from '../AppState/AppState';
import { SubmitHandler, useForm } from 'react-hook-form';
import isURL from 'validator/lib/isURL';

import { OAuth2ClientEntity } from '../Types/OAuth2';

type AppSubmitFormValues = {
  name: string;
  description: string;
  redirectUrls: string;
  grants: string;
  logoUrl?: string;
  initialAuthorizationUrl: string;
  isPublic: boolean;
};

type UserProfileClientAppsCreateFormProps = {
  onClientRegisterSuccess: (newClient?: OAuth2ClientEntity) => void;
};

export default function UserProfileClientAppsCreateForm(props: UserProfileClientAppsCreateFormProps) {
  const api = useAPI();

  const onSubmit: SubmitHandler<AppSubmitFormValues> = data => {
    setSubmitting(true);
    const { name, description, redirectUrls, logoUrl, initialAuthorizationUrl, isPublic } = data;

    api.oauth2Api.registerClient(name, description, redirectUrls, logoUrl, initialAuthorizationUrl, isPublic).then((data) => {
      props.onClientRegisterSuccess(data.client);
    }).catch((err) => {
      setSubmitError(err.message);
    }).finally(() => {
      setSubmitting(false);
    });
  };

  const { register, handleSubmit, formState: { errors, isValid } } = useForm<AppSubmitFormValues>({
    mode: 'onChange'
  });

  const newAppformReady = () => {
    return isValid;
  };

  const validateUrls = (value: string) => {
    const urls = value.split(',').map(url => url.trim());
    return urls.every((url) => isURL(url, {
      ...(process.env.NODE_ENV === 'development' && { host_whitelist: ['localhost'] }),
      require_protocol: true,
      protocols: ['https', ...(process.env.NODE_ENV === 'development' ? ['http'] : [])]
    })) || 'Введите URL-адреса, разделенные запятыми';
  };

  const validateOptionalUrl = (value: string) => {
    return value.trim() === '' || isURL(value, {
      ...(process.env.NODE_ENV === 'development' && { host_whitelist: ['localhost'] }),
      require_protocol: true,
      protocols: ['https', ...(process.env.NODE_ENV === 'development' ? ['http'] : [])]
    }) || 'Введите валидный URL-адрес или оставьте поле пустым';
  };

  const [submitting,setSubmitting ] = useState(false);
  const [submitError, setSubmitError] = useState('');

  return (
    <React.Fragment>
      <div className={classNames({
        [mediaFormStyles.container]: true,
        [styles.create]: true,
        [styles.active]: true
      })}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <label><b>Название приложения:</b>
            <input type="text" placeholder={'Пример: ТГ-бот для нотификаций'}
                   {...register('name', {
                     required: 'Без названия никак',
                     pattern: {
                       value: /^[a-zа-яё\d -]{2,32}$/i,
                       message: 'Только буквы, цифры, дефис и пробел, от 2 до 32 символов'
                     }
                   })}
            />
            {errors.name && <p className={styles.error}>{errors.name.message}</p>}
          </label>

          <label><b>Описание:</b>
            <textarea maxLength={255} placeholder={'Пример:\nТГ-бот, который может присылать уведомления о новых нотификациях. Бот также может присылать вам уведомления о новых постах'}
                      {...register('description', {
                        required: 'Описание даст пользователям понять, зачем нужно ваше приложение.',
                        maxLength: {
                          value: 255,
                          message: 'Описание не должно быть длиннее 255 символов'
                        },
                        minLength: {
                          value: 32,
                          message: 'Описание должно быть не менее 32 символов'
                        }
                      })}></textarea>
            {errors.description && <p className={styles.error}>{errors.description.message}</p>}
          </label>

          <label><b>Разрешённые URL для редиректов (через запятую):</b>
            <input type="text" placeholder={'Пример: https://mybot.com/*, https://mybotbackup.com/*'}
                   {...register('redirectUrls', { validate: validateUrls })}
            />
            {errors.redirectUrls && <p className={styles.error}>{errors.redirectUrls.message}</p>}
          </label>

          <label><b>URL установки приложения:</b>
            <p><span className={classNames('i', 'i-info')}></span> Опционально. Если этот URL указан, мы покажем пользователям кнопку "Установить", нажав на которую они будут перенаправлены на этот URL, откуда вы сможете либо сразу перенаправить пользователя обратно к нам для авторизации вашего приложения либо показать инструкцию вашего приложения</p>
            <input type="text" placeholder={'Пример: https://mybot.com/start/orbitar'}
                   {...register('initialAuthorizationUrl', {
                     validate: validateOptionalUrl
                   })} />
            {errors.initialAuthorizationUrl && <p className={styles.error}>{errors.initialAuthorizationUrl.message}</p>}
          </label>

          <label><b>Типы грантов (через запятую):</b>
            <p><span className={classNames('i', 'i-info')}></span> Пока поддерживаются только <em>authorization_code</em> и <em>refresh_token</em></p>
            <input type="text" value={'authorization_code, refresh_token'} disabled={true} />
          </label>

          <label className={styles.publishApp}>
            <input type="checkbox" {...register('isPublic')} /><p>Eсли отмечено, другие пользователи увидят приложение и смогут его установить.</p>
          </label>

          <div className={styles.submitContainer}>
            <input type="submit" value="Отправить" disabled={submitting || !newAppformReady()} />
            {submitError && <p className={styles.error}>{submitError}</p>}
          </div>
        </form>
      </div>
    </React.Fragment>
  );
}


