import React, { useEffect, useState } from 'react'

import classNames from 'classnames'
import DiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import { toast } from 'react-toastify'

import { useAPI, useAppState } from '../AppState/AppState'
import { useTheme } from '../Theme/ThemeProvider'
import { HistoryInfo } from '../Types/HistoryInfo'
import ContentComponent from './ContentComponent'
import DateComponent from './DateComponent'
import EncryptedContentComponent from './EncryptedContentComponent'

import { ReactComponent as CloseIcon } from '../Assets/close.svg'
import styles from './HistoryComponent.module.scss'

interface HistoryComponentProps {
  history: {
    id: number
    type: 'post' | 'comment'
  }
  onClose?: () => void
  initial?: {
    title?: string
    content: string
    encryptedPayloadId?: number
    date: Date
  }
}

export const HistoryComponent = (props: HistoryComponentProps) => {
  const api = useAPI()
  const currentUsername = useAppState().userInfo?.username
  const [selectedId, setSelectedId] = useState(0)
  const [showDiff, setShowDiff] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<HistoryInfo[]>(
    props.initial
      ? [
          {
            id: 0,
            content: props.initial.content,
            encryptedPayloadId: props.initial.encryptedPayloadId,
            title: props.initial.title,
            date: props.initial.date,
            changed: 0,
            editor: 0,
          },
        ]
      : [],
  )

  const { history, onClose } = props

  const select = (id: number) => {
    const entry = historyEntries.find((h) => h.id === id)
    if (!entry) {
      return
    }

    setSelectedId(id)
  }

  useEffect(() => {
    api.post
      .history(history.id, history.type)
      .then((result) => {
        setHistoryEntries(result)
        if (result.length > 0) {
          const last = result[0]
          setSelectedId(last.id)
        }
      })
      .catch((err) => {
        console.error('History error', err)
        toast.error('Не удалось загрузить историю')
        onClose?.()
      })
  }, [api, history, onClose])

  const selectedIndex = historyEntries.findIndex((h) => h.id === selectedId)
  const selectedEntry = selectedIndex >= 0 ? historyEntries[selectedIndex] : undefined
  const prevEntry =
    selectedIndex >= 0 && selectedIndex < historyEntries.length - 1 ? historyEntries[selectedIndex + 1] : undefined
  const canShowDiff = !!prevEntry && !selectedEntry?.encryptedPayloadId && !prevEntry.encryptedPayloadId

  const { theme } = useTheme()

  useEffect(() => {
    if (showDiff && !canShowDiff) {
      setShowDiff(false)
    }
  }, [canShowDiff, showDiff])

  return (
    <div className={styles.history}>
      <div className='content'>
        {selectedEntry?.title && <div className='title'>{selectedEntry.title}</div>}
        {showDiff && prevEntry && selectedEntry ? (
          <DiffViewer
            oldValue={prevEntry.content}
            newValue={selectedEntry.content}
            splitView={false}
            hideLineNumbers={true}
            useDarkTheme={theme === 'dark'}
            compareMethod={DiffMethod.WORDS}
            codeFoldMessageRenderer={(n) => <pre>{`Развернуть ${n} строк ...`}</pre>}
          />
        ) : selectedEntry?.encryptedPayloadId ? (
          <EncryptedContentComponent encryptedPayloadId={selectedEntry.encryptedPayloadId} kind={props.history.type} />
        ) : (
          <ContentComponent currentUsername={currentUsername} content={selectedEntry?.content || ''} />
        )}
      </div>
      <div className='sideNav'>
        <div className='top'>
          <span>История</span>
          {canShowDiff && (
            <div className={classNames('diffToggle', showDiff ? 'active' : '')} onClick={() => setShowDiff(!showDiff)}>
              &plusmn;
            </div>
          )}
          <div className='close' onClick={props.onClose}>
            <CloseIcon />
          </div>
        </div>

        {historyEntries.map((entry, idx) => {
          return (
            <div
              key={entry.id}
              className={classNames('item', selectedId === entry.id ? 'selected' : '')}
              onClick={() => select(entry.id)}
            >
              {idx === 0 && <div className='version'>Текущая версия</div>}
              {idx === historyEntries.length - 1 && <div className='version'>Исходная версия</div>}
              <div className='date'>
                <DateComponent date={entry.date} />
              </div>
              {/*<div className='info'> изменено 1% </div>*/}
            </div>
          )
        })}
      </div>
    </div>
  )
}
