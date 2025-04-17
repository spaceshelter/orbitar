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
        <h2>Description</h2>
        <div className={styles.description}>
          <p>This demo shows different button variants used in the application:</p>
          <ul>
            <li>
              <strong>minimal</strong> - minimal button used for main content like posts, comments, etc.
            </li>
            <li>
              <strong>solid</strong> - solid button used for settings
            </li>
            <li>
              <strong>primary</strong> - primary button used in polls
            </li>
            <li>
              <strong>danger</strong> - danger button
            </li>
            <li>
              <strong>ghost</strong> - ghost button
            </li>
            <li>
              <strong>link</strong> - link button
            </li>
            <li>
              <strong>solidAccent</strong> - solid button with accent color used in confirm dialogs
            </li>
            <li>
              <strong>primaryAccent</strong> - primary button with accent color used in confirm dialogs
            </li>
            <li>
              <strong>dangerAccent</strong> - danger button with accent color used in confirm dialogs
            </li>
            <li>
              <strong>ghostAccent</strong> - ghost button with accent color used in confirm dialogs
            </li>
          </ul>
          <p>Buttons also support different sizes (small, normal, big) and can contain icons.</p>
        </div>
      </section>
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
          <Button size='small' variant='minimal'>
            <EditIcon /> Редактировать
          </Button>
          <Button size='small' variant='danger'>
            <SendIcon /> Удалить
          </Button>
          <Button size='small' variant='ghost'>
            <BookmarkIcon /> Сохранить
          </Button>
          <Button variant='primary'>
            <SendIcon /> Отправить
          </Button>
          <Button variant='primaryAccent'>
            <EditIcon /> Подтвердить
          </Button>
          <Button variant='solidAccent'>
            <BookmarkIcon /> Сохранить изменения
          </Button>
          <Button variant='dangerAccent'>
            <SendIcon /> Удалить навсегда
          </Button>
          <Button variant='ghostAccent'>
            <BookmarkIcon /> Отменить
          </Button>
          <Button variant='ghost'>
            <EditIcon /> Подробнее
          </Button>
        </div>
      </section>
    </div>
  )
}

export default ButtonShowcase
