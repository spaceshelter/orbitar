import React, { useState } from 'react'

import Drawer from 'react-modern-drawer'

import 'react-modern-drawer/dist/index.css'

import useNoScroll from '@api/use/useNoScroll'
import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import { Field } from '@ui/Field'
import Select from '@ui/Select'
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
  votingAccess: 'all' | 'full_rights'
  resultVisibility: 'always' | 'after_vote' | 'after_end'
}

interface PollCreationWizardProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { question: string; options: PollOption[]; settings: PollSettings }) => Promise<void>
}

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
    votingAccess: 'all',
    resultVisibility: 'always',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddOption = () => {
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
          variant='textarea'
          value={option.text}
          onChange={(e) => handleOptionChange(option.id, e.target.value)}
          placeholder='Вариант ответа'
          required
        />
        {options.length > 2 && (
          <Button variant='link' size='bigger' onClick={() => handleRemoveOption(option.id)}>
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
      size={480}
      className={styles.drawer}
      enableOverlay
      overlayOpacity={0.5}
      duration={300}
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className={styles.drawerContent}>
        <div className={styles.header}>
          <h2>Создание опроса</h2>
        </div>

        <div className={styles.form}>
          <div className={styles.questionSection}>
            <Field
              label='Вопрос'
              id='question'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder='Введите ваш вопрос'
              required
            />
          </div>

          <div className={styles.optionsSection}>
            <label>Варианты ответа</label>
            {renderOptions()}
            <Button variant='link' onClick={handleAddOption} className={styles.addOption}>
              + Добавить вариант
            </Button>
          </div>

          <div className={styles.settingsSection}>
            <label>Настройки</label>
            {/* TODO: Check styles */}
            <div className={styles.settingRow}>
              <label htmlFor='expiration'>Срок действия (дни)</label>
              <Field
                type='number'
                id='expiration'
                min='1'
                value={settings.expirationDays || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    expirationDays: e.target.value ? parseInt(e.target.value) : null,
                  })
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
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    isMultipleChoice: e.target.checked,
                  })
                }
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='allowRescind'>Разрешить отмену голоса</label>
              <Checkbox
                type='checkbox'
                id='allowRescind'
                checked={settings.allowVoteRescinding}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allowVoteRescinding: e.target.checked,
                  })
                }
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='votingAccess'>Доступ к голосованию</label>
              <Select
                id='votingAccess'
                value={settings.votingAccess}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    votingAccess: value as 'all' | 'full_rights',
                  })
                }
                options={[
                  { value: 'all', label: 'Все пользователи' },
                  { value: 'full_rights', label: 'Только с полными правами' },
                ]}
              />
            </div>

            <div className={styles.settingRow}>
              <label htmlFor='resultVisibility'>Видимость результатов</label>
              <Select
                id='resultVisibility'
                value={settings.resultVisibility}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    resultVisibility: value as 'always' | 'after_vote' | 'after_end',
                  })
                }
                options={[
                  { value: 'always', label: 'Всегда' },
                  { value: 'after_vote', label: 'После голосования' },
                  { value: 'after_end', label: 'После окончания' },
                ]}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <Button variant='link' onClick={onClose} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button variant='link' onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Создание...' : 'Создать опрос'}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
