import React, { useState } from 'react'

import { Loader } from '@ui/Loader'

import Button from '../Components/UI/Button'

import { ReactComponent as BookmarkIcon } from '../Assets/bookmark.svg'
import { ReactComponent as EditIcon } from '../Assets/edit.svg'
import { ReactComponent as SendIcon } from '../Assets/send.svg'
import styles from './ButtonShowcase.module.scss'

const ButtonShowcase: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const handleLoading = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  return (
    <div className={styles.container}>
      <h1>Button Showcase</h1>
      <section className={styles.section}>
        <h2>Loader</h2>
        <div className={styles.buttonGroup}>
          <Loader />
        </div>
      </section>
      <section className={styles.section}>
        <h2>Variants</h2>
        <div className={styles.buttonGroup}>
          <Button variant='minimal'>minimal</Button>
          <Button variant='solid'>solid</Button>
          <Button variant='primary'>primary</Button>
          <Button variant='danger'>danger</Button>
          <Button variant='ghost'>ghost</Button>
          <Button variant='link'>link</Button>
          <Button variant='solidAccent'>solidAccent</Button>
          <Button variant='primaryAccent'>primaryAccent</Button>
          <Button variant='dangerAccent'>dangerAccent</Button>
          <Button variant='ghostAccent'>ghostAccent</Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Disabled</h2>
        <div className={styles.buttonGroup}>
          <Button disabled>solid</Button>
          <Button variant='primary' disabled>
            primary
          </Button>
          <Button variant='danger' disabled>
            danger
          </Button>
          <Button variant='ghost' disabled>
            ghost
          </Button>
          <Button variant='link' disabled>
            link
          </Button>
          <Button variant='solidAccent' disabled>
            solidAccent
          </Button>
          <Button variant='primaryAccent' disabled>
            primaryAccent
          </Button>
          <Button variant='dangerAccent' disabled>
            dangerAccent
          </Button>
          <Button variant='ghostAccent' disabled>
            ghostAccent
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Sizes</h2>
        <div className={styles.buttonGroup}>
          <Button size='small'>small</Button>
          <Button size='normal'>normal</Button>
          <Button size='big'>big</Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Loading</h2>
        <div className={styles.buttonGroup}>
          <Button variant='primary' onClick={handleLoading} loading={loading}>
            Click to load
          </Button>
          <Button loading>solid</Button>
          <Button variant='primary' loading disabled>
            primary
          </Button>
          <Button variant='danger' loading>
            danger
          </Button>
          <Button variant='ghost' loading>
            ghost
          </Button>
          <Button variant='link' loading>
            link
          </Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Icons</h2>
        <div className={styles.buttonGroup}>
          <Button variant='minimal'>
            <EditIcon />
          </Button>
          <Button>
            <EditIcon />
          </Button>
          <Button>
            <SendIcon /> send
          </Button>
          <Button>
            bookmark <BookmarkIcon />
          </Button>
          <Button variant='link'>link</Button>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Mixed</h2>
        <div className={styles.buttonGroup}>
          <Button size='small'>small</Button>
          <Button size='small' variant='dangerAccent'>
            <SendIcon />
          </Button>
          <Button size='small' variant='ghost'>
            <SendIcon />
          </Button>
          <Button size='small'>
            <SendIcon />
          </Button>
          <Button>
            <SendIcon /> send
          </Button>
          <Button variant='primary'>
            <SendIcon /> send <SendIcon />
          </Button>
          <Button variant='primaryAccent'>
            <EditIcon /> edit
          </Button>
          <Button variant='solidAccent'>
            <BookmarkIcon /> bookmark
          </Button>
        </div>
      </section>
    </div>
  )
}

export default ButtonShowcase
