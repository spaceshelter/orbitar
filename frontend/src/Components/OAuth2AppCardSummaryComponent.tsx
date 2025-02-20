import React from 'react'

import classNames from 'classnames'
import { FaLink } from 'react-icons/fa'

import { OAuth2ClientEntity } from '../Types/OAuth2'
import OAuth2ClientLogoComponent from './OAuth2ClientLogoComponent'
import Username from './Username'

import styles from './OAuth2AppCardModalComponent.module.scss'

interface OAuth2AppCardSummaryProps {
  client: OAuth2ClientEntity
  onOpenFullView: () => void
}

export function OAuth2AppCardSummaryComponent(props: OAuth2AppCardSummaryProps) {
  const { client, onOpenFullView } = props

  return (
    <div
      className={classNames(styles.appCard, styles.inCatalog, styles.embedded)}
      onClick={onOpenFullView}
      role='button'
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onOpenFullView()
        }
      }}
    >
      <div className={styles.logoContainer}>
        <OAuth2ClientLogoComponent url={client.logoUrl} canManage={false} />
      </div>
      <div className={styles.nameContainer}>
        <h3 className={styles.name}>
          {client.name}
          <span>
            от&nbsp;
            <Username className={styles.author} user={client.author} onClick={(e) => e.stopPropagation()} />
          </span>
        </h3>
      </div>
      <div className={styles.installationsCountContainer}>
        <FaLink size={14} />
        {client.installationsCount || 0}
      </div>
    </div>
  )
}
