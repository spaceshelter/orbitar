import React, { useState } from 'react'

import Button from '@ui/Button'
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
      <Button
        variant='ghost'
        className={classNames(styles.expandHeader, { [styles.expanded]: expanded })}
        onClick={() => setExpanded(!expanded)}
      >
        {title}
      </Button>
      {expanded && <div className={styles.expandContent}>{children}</div>}
    </div>
  )
}
