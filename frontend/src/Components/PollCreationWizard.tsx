import React, { useEffect, useState } from 'react'

import Drawer from 'react-modern-drawer'

import 'react-modern-drawer/dist/index.css'

import useNoScroll from '@api/use/useNoScroll'
import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import { Field } from '@ui/Field'
import Select from '@ui/Select'
import { autorun } from 'mobx'
import { toast } from 'react-toastify'

import styles from './PollCreationWizard.module.scss'

interface PollOption {
  id: string
  text: string
}

interface PollSettings {
  expirationDays: number | null
  isMultipleChoice: boolean
  allowVoteRescinding: boolean
  voteAccess: 'everybody' | 'users_with_full_rights'
  resultVisibility: 'always' | 'after_vote' | 'after_end'
}

interface PollDraft {
  question: string
  options: PollOption[]
  settings: PollSettings
}

interface PollCreationWizardProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { question: string; options: PollOption[]; settings: PollSettings }) => Promise<void>
}

const STORAGE_KEY = 'poll_draft'

export const PollCreationWizard: React.FC<PollCreationWizardProps> = ({ isOpen, onClose, onSubmit }) => {
  useNoScroll()
  const [question, setQuestion] = useState('')
  const [nextId, setNextId] = useState(2)
  const [options, setOptions] = useState<PollOption[]>([
    { id: '0', text: '' },
    { id: '1', text: '' },
  ])
  const [settings, setSettings] = useState<PollSettings>({
    expirationDays: null,
    isMultipleChoice: false,
    allowVoteRescinding: true,
    voteAccess: 'everybody',
    resultVisibility: 'always',
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

  const handleSettingChange = (key: keyof PollSettings, value: string | number | boolean | null) => {
    setSettings({ ...settings, [key]: value })
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
              <label htmlFor='expiration'>Срок действия (дни)</label>
              <Field
                type='number'
                id='expiration'
                min='1'
                value={settings.expirationDays || ''}
                onChange={(e) =>
                  handleSettingChange('expirationDays', e.target.value ? parseInt(e.target.value) : null)
                }
                placeholder='Без ограничений'
              />
            </div>

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
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='voteAccess'>Доступ к голосованию</label>
              <Select
                id='voteAccess'
                value={settings.voteAccess}
                onChange={(value) => handleSettingChange('voteAccess', value)}
                options={[
                  { value: 'everybody', label: 'Все пользователи' },
                  { value: 'users_with_full_rights', label: 'Только с полными правами' },
                ]}
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='resultVisibility'>Видимость результатов</label>
              <Select
                id='resultVisibility'
                value={settings.resultVisibility}
                onChange={(value) => handleSettingChange('resultVisibility', value)}
                options={[
                  { value: 'always', label: 'Всегда' },
                  { value: 'after_vote', label: 'После ответа' },
                  { value: 'after_vote_end', label: 'После окончания опроса' },
                ]}
              />
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
