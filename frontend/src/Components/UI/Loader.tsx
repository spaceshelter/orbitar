import React from 'react'

import classNames from 'classnames'

import styles from './Loader.module.scss'

type LoaderProps = {
  size?: number
  className?: string
}

export const Loader: React.FC<LoaderProps> = ({ size = 20, className = '' }) => {
  return (
    <div className={classNames(styles.loaderContainer, className)} style={{ width: size, height: size }}>
      {[...Array(3)].map((_, index) => (
        <LoaderCircle key={index} />
      ))}
    </div>
  )
}

export const LoaderCircle: React.FC = () => {
  return (
    <div className={styles.circle}>
      <div className={styles.inner}></div>
    </div>
  )
}
