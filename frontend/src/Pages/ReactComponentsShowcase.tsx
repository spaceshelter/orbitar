import React, { useState } from 'react'

import { Loader } from '@ui/Loader'
import { FaSkull } from 'react-icons/fa'

import Button, { ButtonSize, ButtonType } from '../Components/UI/Button'
import ButtonGroup, { ButtonGroupSpacing } from '../Components/UI/ButtonGroup'

import styles from './ReactComponentsShowcase.module.scss'
import { ReactComponent as BookmarkIcon } from '@assets/bookmark.svg'
import { ReactComponent as EditIcon } from '@assets/edit.svg'
import { ReactComponent as SendIcon } from '@assets/send.svg'

const ReactComponentsShowcase: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [buttonVariant, setButtonVariant] = useState<ButtonType>('primary')
  const [buttonSize, setButtonSize] = useState<ButtonSize>('normal')

  // Helper function to handle rendering the right button based on variant
  const renderButton = (label: string) => {
    if (buttonVariant === 'link') {
      return <Button variant='link'>{label}</Button>
    } else {
      return (
        <Button variant={buttonVariant as Exclude<ButtonType, 'link'>} size={buttonSize}>
          {label}
        </Button>
      )
    }
  }

  const handleLoading = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  const buttonVariants: ButtonType[] = [
    'minimal',
    'solid',
    'primary',
    'danger',
    'ghost',
    'link',
    'solidAccent',
    'primaryAccent',
    'dangerAccent',
    'ghostAccent',
  ]

  const buttonSizes: ButtonSize[] = ['small', 'normal', 'big']

  return (
    <div className={styles.container}>
      <h1>React Components Showcase</h1>
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
        <ButtonGroup>
          <Loader />
        </ButtonGroup>
      </section>
      <section className={styles.section}>
        <h2>Variants</h2>
        <ButtonGroup>
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
        </ButtonGroup>
      </section>

      <section className={styles.section}>
        <h2>Disabled</h2>
        <ButtonGroup>
          <Button variant={'minimal'} disabled>
            minimal
          </Button>
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
        </ButtonGroup>
      </section>

      <section className={styles.section}>
        <h2>Sizes</h2>
        <ButtonGroup>
          <Button size='small'>small</Button>
          <Button size='normal'>normal</Button>
          <Button size='big'>big</Button>
        </ButtonGroup>
      </section>

      <section className={styles.section}>
        <h2>Loading</h2>
        <ButtonGroup>
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
        </ButtonGroup>
      </section>

      <section className={styles.section}>
        <h2>Icons</h2>
        <ButtonGroup>
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
        </ButtonGroup>
      </section>

      <section className={styles.section}>
        <h2>Mixed</h2>
        <ButtonGroup>
          <Button size='small' variant='minimal'>
            <EditIcon /> Редактировать
          </Button>
          <Button size='small' variant='danger'>
            <FaSkull /> Удалить
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
            <FaSkull /> Удалить навсегда
          </Button>
          <Button variant='ghostAccent'>
            <BookmarkIcon /> Отменить
          </Button>
          <Button variant='ghost'>
            <EditIcon /> Подробнее
          </Button>
        </ButtonGroup>
      </section>

      <section className={styles.section}>
        <h2>Button Group Spacing</h2>

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <h3>Button Variant</h3>
            <ButtonGroup>
              {buttonVariants.map((variant) => (
                <Button
                  key={variant}
                  variant={variant}
                  active={buttonVariant === variant}
                  onClick={() => setButtonVariant(variant)}
                >
                  {variant}
                </Button>
              ))}
            </ButtonGroup>
          </div>

          <div className={styles.controlGroup}>
            <h3>Button Size</h3>
            <ButtonGroup>
              {buttonSizes.map((size) => (
                <Button
                  key={size}
                  variant='solid'
                  size={size}
                  active={buttonSize === size}
                  onClick={() => setButtonSize(size)}
                >
                  {size}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        </div>

        <div className={styles.spacingDisplay}>
          <div>
            <h3>Compact</h3>
            <ButtonGroup spacing={ButtonGroupSpacing.COMPACT}>
              {renderButton('First')}
              {renderButton('Second')}
              {renderButton('Third')}
            </ButtonGroup>
          </div>

          <div>
            <h3>Default</h3>
            <ButtonGroup spacing={ButtonGroupSpacing.DEFAULT}>
              {renderButton('First')}
              {renderButton('Second')}
              {renderButton('Third')}
            </ButtonGroup>
          </div>

          <div>
            <h3>Spacious</h3>
            <ButtonGroup spacing={ButtonGroupSpacing.SPACIOUS}>
              {renderButton('First')}
              {renderButton('Second')}
              {renderButton('Third')}
            </ButtonGroup>
          </div>
        </div>
      </section>
    </div>
  )
}

export default ReactComponentsShowcase
