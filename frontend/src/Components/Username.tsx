import React from 'react'
import { Link } from 'react-router-dom'

import classNames from 'classnames'

import styles from './Username.module.scss'

interface UsernameProps extends React.ComponentPropsWithRef<'a'> {
  user: {
    username: string
  }
  inactive?: boolean
}

export default function Username(props: UsernameProps) {
  return (
    <Link
      to={'/u/' + props.user.username}
      className={classNames('i i-user', styles.username, props.inactive && styles.inactive, props.className)}
    >
      {props.user.username}
    </Link>
  )
}
