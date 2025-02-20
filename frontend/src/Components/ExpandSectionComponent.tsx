import React, { useState } from 'react'

import classNames from 'classnames'

import styles from './ExpandSectionComponent.module.scss'

interface ExpandSectionProps {
  title: React.ReactNode
  children: React.ReactNode
  initiallyExpanded?: boolean
}

export default function ExpandSection({ title, children, initiallyExpanded = false }: ExpandSectionProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded)

  return (
    <div className={styles.expandSection}>
      <button
        className={classNames(styles.expandHeader, { [styles.expanded]: expanded })}
        onClick={() => setExpanded(!expanded)}
      >
        {title}
      </button>
      {expanded && <div className={styles.expandContent}>{children}</div>}
    </div>
  )
}
