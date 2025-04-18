import React from 'react'

import Button from '@ui/Button'

import APIBase from '../API/APIBase'
import { OAuth2ClientEntity } from '../Types/OAuth2'
import OAuth2ScopesComponent from './OAuth2ScopesComponent'

import styles from './OAuth2AppCardModalComponent.module.scss'

interface OAuth2AuthorizeComponentProps {
  client: OAuth2ClientEntity
  newlyRequestedScopes: string
  redirectUri?: string
  state?: string
  sessionId?: string
  onAuthorizeDeny?: () => void
}

export function OAuth2AuthorizeComponent(props: OAuth2AuthorizeComponentProps) {
  return (
    <div>
      {props.newlyRequestedScopes && props.onAuthorizeDeny && (
        <div className={styles.scopeContainer}>
          <h3>Запрашиваемый доступ:</h3>
          <OAuth2ScopesComponent appRequests={props.newlyRequestedScopes} />
          {/*<div className={styles.consentDisclaimer}>*/}
          {/*    Приложение не может читать шифровки.*/}
          {/*</div>*/}
          <form className={styles.buttonsContainer} method='POST' action={`${APIBase.endpoint}/oauth2/authorize`}>
            <input type='hidden' name='scope' value={props.newlyRequestedScopes} />
            <input type='hidden' name='state' value={props.state} />
            <input type='hidden' name='client_id' value={props.client.clientId} />
            <input type='hidden' name='redirect_uri' value={props.redirectUri} />
            <input type='hidden' name='X-Session-Id' value={props.sessionId} />
            <input type='hidden' name='response_type' value='code' />

            <div className={styles.buttonsContainer}>
              <Button variant='primary' size='big' type='submit'>
                Подключить
              </Button>
              <Button
                size='big'
                type='button'
                onClick={(e) => {
                  e.preventDefault()
                  props.onAuthorizeDeny?.()
                }}
              >
                Не, спасибо
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
