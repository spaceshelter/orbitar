import React, { useEffect, useState } from 'react'

import Drawer from 'react-modern-drawer'

import 'react-modern-drawer/dist/index.css'

import { ResultVisibility, VoteAccess } from '@api/types/Poll'
import useNoScroll from '@api/use/useNoScroll'
import DateComponent from '@components/DateComponent'
import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import { Field } from '@ui/Field'
import Radio from '@ui/Radio'
import { autorun } from 'mobx'
import moment from 'moment'
import { toast } from 'react-toastify'

import styles from './PollCreationWizard.module.scss'

interface PollOption {
  id: string
  text: string
}

interface PollSettings {
  expirationDate: Date | null
  isMultipleChoice: boolean
  allowVoteRescinding: boolean
  voteAccess: VoteAccess
  resultVisibility: ResultVisibility
}

interface PollDraft {
  question: string
  options: PollOption[]
  settings: PollSettings
}

export interface PollCreationWizardSubmitData {
  question: string
  options: PollOption[]
  settings: PollSettings
}

interface PollCreationWizardProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PollCreationWizardSubmitData) => Promise<void>
}

const STORAGE_KEY = 'poll_draft'
const tomorrow = () => moment().add(1, 'day').startOf('day').toDate()

export const PollCreationWizard: React.FC<PollCreationWizardProps> = ({ isOpen, onClose, onSubmit }) => {
  useNoScroll()
  const [question, setQuestion] = useState('')
  const [nextId, setNextId] = useState(2)
  const [options, setOptions] = useState<PollOption[]>([
    { id: '0', text: '' },
    { id: '1', text: '' },
  ])
  const [settings, setSettings] = useState<PollSettings>({
    expirationDate: null,
    isMultipleChoice: false,
    allowVoteRescinding: true,
    voteAccess: VoteAccess.EVERYBODY,
    resultVisibility: ResultVisibility.ALWAYS,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const appState = useAppState()
  const api = useAPI()

  // Check user restrictions on mount
  useEffect(() => {
    return autorun(() => {
      if (appState.userRestrictions) {
        if (appState.userRestrictions.restrictedToPostId !== false) {
          toast.error('Вы не можете создавать опросы')
          onClose()
        }
      } else {
        api.user.refreshUserRestrictions()
      }
    })
  }, [appState, appState, options])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load draft from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedDraft = localStorage.getItem(STORAGE_KEY)
      if (savedDraft) {
        try {
          const draft: PollDraft = JSON.parse(savedDraft)
          setQuestion(draft.question)
          setOptions(draft.options)
          setSettings(draft.settings)
          const maxId = Math.max(...draft.options.map((opt) => parseInt(opt.id)))
          setNextId(maxId + 1)
        } catch (error) {
          console.error('Failed to load poll draft:', error)
        }
      }
    }
  }, [isOpen])

  // Save draft to localStorage
  useEffect(() => {
    const draft: PollDraft = { question, options, settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  }, [question, options, settings])

  const handleAddOption = () => {
    if (options.length >= 32) {
      return
    }

    setOptions([...options, { id: String(nextId), text: '' }])
    setNextId(nextId + 1)
  }

  const handleRemoveOption = (id: string) => {
    if (options.length > 2) {
      setOptions(options.filter((opt) => opt.id !== id))
    }
  }

  const handleOptionChange = (id: string, text: string) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, text } : opt)))
  }

  const handleSettingChange = (key: keyof PollSettings, value: string | number | boolean | Date | null) => {
    const newSettings = { ...settings, [key]: value }

    if (key === 'resultVisibility') {
      switch (value) {
        case ResultVisibility.ALWAYS:
          break
        case ResultVisibility.AFTER_VOTE:
          newSettings.allowVoteRescinding = false
          break
        case ResultVisibility.AFTER_VOTE_END:
          if (!newSettings.expirationDate) {
            newSettings.expirationDate = tomorrow()
          }
          break
      }
    }

    // date is in the past
    if (newSettings.expirationDate && newSettings.expirationDate < new Date()) {
      newSettings.expirationDate = tomorrow()
    }

    setSettings(newSettings)
  }

  const handleSubmit = async () => {
    if (!question.trim()) {
      toast.error('Пожалуйста, введите вопрос')
      return
    }

    if (options.some((opt) => !opt.text.trim())) {
      toast.error('Пожалуйста, заполните все варианты ответа')
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({ question, options, settings })
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to create poll:', error)
      toast.error('Не удалось создать опрос')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  const renderOptions = () => {
    return options.map((option) => (
      <div key={option.id} className={styles.optionRow}>
        <Field
          value={option.text}
          onChange={(e) => handleOptionChange(option.id, e.target.value)}
          placeholder='Вариант ответа'
          required
          maxLength={64}
        />
        {options.length > 2 && (
          <Button variant='link' onClick={() => handleRemoveOption(option.id)}>
            ×
          </Button>
        )}
      </div>
    ))
  }

  return (
    <Drawer
      open={isOpen}
      onClose={handleClose}
      direction='right'
      size={isMobile ? '100%' : 480}
      className={styles.drawer}
      enableOverlay
      overlayOpacity={0.5}
      duration={300}
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className={styles.drawerContent}>
        <div className={styles.header}>
          <h2>Создание опроса</h2>
          {isMobile && (
            <Button variant='link' onClick={handleClose} style={{ marginLeft: 'auto' }}>
              ✕
            </Button>
          )}
        </div>

        <div className={styles.form}>
          <div className={styles.questionSection}>
            <Field
              variant='textarea'
              label='Вопрос'
              id='question'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='Введите ваш вопрос'
              required
              rows={isMobile ? 3 : 4}
            />
          </div>

          <div className={styles.optionsSection}>
            <label>Варианты ответа</label>
            {renderOptions()}

            {options.length < 32 && (
              <Button variant='link' onClick={handleAddOption} className={styles.addOption}>
                + Добавить вариант
              </Button>
            )}
          </div>

          <div className={styles.settingsSection}>
            <label>Настройки</label>
            <div className={styles.settingRow}>
              <label htmlFor='multipleChoice'>Множественный выбор</label>
              <Checkbox
                type='checkbox'
                id='multipleChoice'
                checked={settings.isMultipleChoice}
                onChange={(e) => handleSettingChange('isMultipleChoice', e.target.checked)}
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='allowRescind'>Разрешить отмену голоса</label>
              <Checkbox
                type='checkbox'
                id='allowRescind'
                checked={settings.allowVoteRescinding}
                onChange={(e) => handleSettingChange('allowVoteRescinding', e.target.checked)}
                disabled={settings.resultVisibility === ResultVisibility.AFTER_VOTE}
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='voteAccess'>Голосовать смогут только полноправные</label>
              <Checkbox
                id='voteAccess'
                checked={settings.voteAccess === VoteAccess.USERS_WITH_FULL_RIGHTS}
                onChange={(e) =>
                  handleSettingChange(
                    'voteAccess',
                    e.target.checked ? VoteAccess.USERS_WITH_FULL_RIGHTS : VoteAccess.EVERYBODY,
                  )
                }
              />
            </div>

            {/* Expiration checkbox */}
            <div className={styles.expirationContainer}>
              <div className={styles.expirationCheckboxRow}>
                <label htmlFor='hasExpiration'>Опрос заканчивается</label>
                <Checkbox
                  id='hasExpiration'
                  checked={settings.expirationDate !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      handleSettingChange('expirationDate', tomorrow())
                    } else {
                      handleSettingChange('expirationDate', null)
                    }
                  }}
                  disabled={settings.resultVisibility === ResultVisibility.AFTER_VOTE_END}
                />
              </div>

              {/* Date picker */}
              {settings.expirationDate !== null && (
                <PollExpiration
                  date={settings.expirationDate}
                  onChange={(date) => {
                    handleSettingChange('expirationDate', date)
                  }}
                  validator={(date) => date > new Date()}
                />
              )}
            </div>

            {/* Result visibility as radio buttons */}
            <div className={`${styles.settingRow} ${styles.radioGroup}`}>
              <label>Видимость результатов</label>
              <div className={styles.radioOptions}>
                <Radio
                  id='resultVisibility_always'
                  label='Всегда'
                  name='resultVisibility'
                  checked={settings.resultVisibility === ResultVisibility.ALWAYS}
                  onChange={() => handleSettingChange('resultVisibility', ResultVisibility.ALWAYS)}
                />

                <Radio
                  id='resultVisibility_afterVote'
                  label='После ответа'
                  name='resultVisibility'
                  checked={settings.resultVisibility === ResultVisibility.AFTER_VOTE}
                  onChange={() => handleSettingChange('resultVisibility', ResultVisibility.AFTER_VOTE)}
                  disabled={settings.allowVoteRescinding}
                />

                <Radio
                  id='resultVisibility_afterEnd'
                  label='После завершения опроса'
                  name='resultVisibility'
                  checked={settings.resultVisibility === ResultVisibility.AFTER_VOTE_END}
                  onChange={() => {
                    handleSettingChange('resultVisibility', ResultVisibility.AFTER_VOTE_END)
                  }}
                  disabled={settings.expirationDate === null}
                />
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant='ghost' onClick={handleClose} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button variant='positive' onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Создание...' : 'Создать опрос'}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

const PollExpiration: React.FC<{
  date: Date
  onChange: (date: Date) => void
  disabled?: boolean
  validator?: (date: Date) => boolean
}> = ({ date, onChange, disabled = false, validator }) => {
  const DateButton: React.FC<{
    delta: number
    unit: 'hours' | 'days' | 'months'
  }> = ({ delta, unit }) => {
    const nxtDate = moment(date).add(delta, unit).toDate()
    return (
      <Button
        variant='ghost'
        className={styles.dateButton}
        onClick={() => {
          onChange(nxtDate)
        }}
        disabled={disabled || (validator && !validator(nxtDate))}
      >
        {delta < 0 && '◂'}
        {unit.charAt(0) === 'm' ? 'м' : unit.charAt(0) === 'd' ? 'д' : 'ч'}
        {delta > 0 && '▸'}
      </Button>
    )
  }

  return (
    <div className={styles.datePickerContainer}>
      <div className={styles.dateControls}>
        <div className={styles.buttonsGroup}>
          <DateButton unit='months' delta={-1} />
          <DateButton unit='days' delta={-1} />
          <DateButton unit='hours' delta={-1} />
        </div>
        <div className={styles.dateDisplay}>
          <DateComponent date={date} />
        </div>
        <div className={styles.buttonsGroup}>
          <DateButton unit='hours' delta={1} />
          <DateButton unit='days' delta={1} />
          <DateButton unit='months' delta={1} />
        </div>
      </div>
    </div>
  )
}
