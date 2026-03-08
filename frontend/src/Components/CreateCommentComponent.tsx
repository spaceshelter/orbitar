import React, { ReactNode, useEffect, useRef, useState } from 'react'

import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import ButtonGroup, { ButtonGroupSpacing } from '@ui/ButtonGroup'
import { encryptContentForUsers, EncryptedPayloadDraft, MAILBOX_PUBLIC_KEY_ALG } from '@utils/mailCrypto'
import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete'
import classNames from 'classnames'
import debouncePromise from 'debounce-promise'
import { observer } from 'mobx-react-lite'
import { createPortal } from 'react-dom'
import { useHotkeys } from 'react-hotkeys-hook'
import TextareaAutosize from 'react-textarea-autosize'
import { toast } from 'react-toastify'
import getCaretCoordinates from 'textarea-caret'
import { useDebouncedCallback } from 'use-debounce'

import { CommentInfo, PostLinkInfo } from '../Types/PostInfo'
import { UserGender } from '../Types/UserInfo'
import { renderEncryptedContentHtml } from '../Utils/encryptedContentParser'
import ContentComponent from './ContentComponent'
import MediaUploader, { CreateGalleryOption, MediaResult } from './MediaUploader'
import { PollCreationWizard, PollCreationWizardSubmitData } from './PollCreationWizard'
import SlowMode from './SlowMode'
import ThemeToggleComponent from './ThemeToggleComponent'

import { ReactComponent as CodeIcon } from '../Assets/code-slash.svg'
import { ReactComponent as ExpandIcon } from '../Assets/expand.svg'
import { ReactComponent as ImageIcon } from '../Assets/image.svg'
import { ReactComponent as IronyIcon } from '../Assets/irony.svg'
import { ReactComponent as LinkIcon } from '../Assets/link.svg'
import { ReactComponent as OptionsIcon } from '../Assets/options.svg'
import { ReactComponent as PollIcon } from '../Assets/poll.svg'
import { ReactComponent as QuoteIcon } from '../Assets/quote.svg'
import { ReactComponent as SendIcon } from '../Assets/send.svg'
import { ReactComponent as SpoilerIcon } from '../Assets/spoiler.svg'
import postComponentStyles from '../Components/PostComponent.module.scss'
import postStyles from '../Pages/CreatePostPage.module.css'
import commentStyles from './CommentComponent.module.scss'
import styles from './CreateCommentComponent.module.scss'

interface CreateCommentProps {
  open: boolean
  comment?: CommentInfo
  post?: PostLinkInfo
  text?: string
  storageKey?: string
  parentAuthorUserName?: string
  parentAuthorUserId?: number

  /**
   * Optional tab index for the textarea. When provided, formatting buttons
   * will use the next index in sequence.
   */
  textareaTabIndex?: number

  onAnswer: (
    text: string,
    post?: PostLinkInfo,
    comment?: CommentInfo,
    encryptedPayload?: EncryptedPayloadDraft,
  ) => Promise<CommentInfo | string | undefined>
}

// same as CreateCommentComponent, but with slow mode and other restrictions
export const CreateCommentComponentRestricted = observer((props: CreateCommentProps) => {
  const api = useAPI()
  const { userRestrictions } = useAppState()

  useEffect(() => {
    if (props.open) {
      api.user.refreshUserRestrictions()
    }
  }, [api, props.open])

  if (!props.open) {
    return null
  }

  if (userRestrictions?.restrictedToPostId && userRestrictions.restrictedToPostId !== props.post?.id) {
    return (
      <div className={styles.answer}>
        <RestrictedToPostIdMessage postId={userRestrictions.restrictedToPostId} />
      </div>
    )
  }

  if (userRestrictions?.commentSlowModeWaitSecRemain) {
    return (
      <div className={styles.answer}>
        <RestrictedSlowMode
          endTime={new Date(Date.now() + userRestrictions.commentSlowModeWaitSecRemain * 1000)}
          endCallback={() => api.user.refreshUserRestrictions()}
        />
      </div>
    )
  }

  return (
    <CreateCommentComponent
      {...props}
      onAnswer={(text, post, comment, encryptedPayload) => {
        return props.onAnswer(text, post, comment, encryptedPayload).finally(() => {
          api.user.refreshUserRestrictions()
        })
      }}
    />
  )
})

const Item = (item: { entity: string }) => {
  return <div>{`${item.entity}`}</div>
}

const allowedKeys = [
  'ctrl+enter',
  'meta+enter',
  'ctrl+b',
  'meta+b',
  'ctrl+i',
  'meta+i',
  'ctrl+u',
  'meta+u',
  'ctrl+k',
  'meta+k',
  'ctrl+shift+x',
  'meta+shift+x',
]

export default function CreateCommentComponent(props: CreateCommentProps) {
  const answerRef = useRef<HTMLTextAreaElement>()
  const textareaTabIndex = props.textareaTabIndex
  const toolbarTabIndex = props.textareaTabIndex !== undefined ? props.textareaTabIndex + 1 : undefined
  const actionPreviewTabIndex = props.textareaTabIndex !== undefined ? props.textareaTabIndex + 2 : undefined
  const actionSendTabIndex = props.textareaTabIndex !== undefined ? props.textareaTabIndex + 3 : undefined
  const [answerText, setAnswerText] = useState<string>(
    props.text || (props.storageKey && localStorage.getItem('crCmp:' + props.storageKey)) || '',
  )
  const [isPosting, setPosting] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [mediaUploaderOpen, setMediaUploaderOpen] = useState(false)
  const [mediaUploaderData, setMediaUploaderData] = useState<File | undefined>()
  const [mediaUploaderInGallery, setMediaUploaderInGallery] = useState(false)

  /**
   * Detects if cursor is inside or at the border of a <gallery> tag.
   * Returns insert position at the end of the gallery (before </gallery>), or null if not in gallery.
   */
  const getGalleryInsertPosition = (text: string, cursorPos: number): number | null => {
    const galleryRegex = /<gallery[^>]*>([\s\S]*?)<\/gallery>/gi
    let match

    while ((match = galleryRegex.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      const contentStart = start + match[0].indexOf('>') + 1
      const contentEnd = end - '</gallery>'.length

      // Cursor inside gallery content or right after </gallery>
      // Always insert at the end of gallery content (before </gallery>)
      if ((cursorPos >= contentStart && cursorPos <= contentEnd) || cursorPos === end) {
        return contentEnd
      }
    }

    return null
  }

  const openMediaUploader = (file?: File) => {
    const answer = answerRef.current
    const inGallery = isEncrypted
      ? false
      : answer
        ? getGalleryInsertPosition(answer.value, answer.selectionStart) !== null
        : false
    setMediaUploaderInGallery(inGallery)
    setMediaUploaderData(file)
    setMediaUploaderOpen(true)
  }
  const [pollWizardOpen, setPollWizardOpen] = useState(false)
  const containerRef = useHotkeys<HTMLDivElement>(allowedKeys.join(','), (e) => handleHotKey(e), {
    enableOnFormTags: ['TEXTAREA'],
    preventDefault: true,
  })
  const controlsRef = useRef<HTMLDivElement>(null)

  const api = useAPI()
  const appState = useAppState()
  const [isEncrypted, setIsEncrypted] = useState(false)
  const [encryptionKeys, setEncryptionKeys] = useState<
    | {
        sender: { userId: number; username: string; publicKey: string; publicKeyAlg: string }
        recipient: { userId: number; username: string; publicKey: string; publicKeyAlg: string }
      }
    | undefined
  >(undefined)

  const pronoun =
    props?.comment?.author?.gender === UserGender.he
      ? 'ему'
      : props?.comment?.author?.gender === UserGender.she
        ? 'ей'
        : ''
  const placeholderText = `${props.comment ? `Ваш ответ ${pronoun}` : ''}${isEncrypted ? ' (будет зашифрован)' : ''}`
  const disabledButtons = isPosting || previewing !== null
  const currentUser = appState.userInfo
  const currentUsername = currentUser?.username
  const encryptionTarget =
    props.comment && props.comment.author.id !== currentUser?.id
      ? {
          userId: props.comment.author.id,
          username: props.comment.author.username,
        }
      : props.parentAuthorUserId && props.parentAuthorUserName && props.parentAuthorUserId !== currentUser?.id
        ? {
            userId: props.parentAuthorUserId,
            username: props.parentAuthorUserName,
          }
        : undefined

  const setStorageValueDebounced = useDebouncedCallback((value) => {
    if (props.storageKey) {
      if (value) {
        localStorage.setItem('crCmp:' + props.storageKey, value)
      } else {
        localStorage.removeItem('crCmp:' + props.storageKey)
      }
    }
  })

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setStorageValueDebounced(e.target.value)
    setAnswerText(e.target.value)
  }

  const resolveEncryptionKeys = async () => {
    if (!currentUser || !currentUsername || !encryptionTarget) {
      throw new Error('Не удалось определить адресата шифрования.')
    }

    const [senderKey, recipientKey] = await Promise.all([
      api.postAPI.getPublicKeyByUsername(currentUsername),
      api.postAPI.getPublicKeyByUsername(encryptionTarget.username),
    ])

    if (!senderKey.publicKey || senderKey.publicKeyAlg !== MAILBOX_PUBLIC_KEY_ALG) {
      throw new Error('Сначала создайте собственный шифрованный почтовый ящик в настройках профиля.')
    }

    if (!recipientKey.publicKey || recipientKey.publicKeyAlg !== MAILBOX_PUBLIC_KEY_ALG) {
      throw new Error(`У @${encryptionTarget.username} нет совместимого почтового ящика.`)
    }

    return {
      sender: {
        userId: currentUser.id,
        username: currentUsername,
        publicKey: senderKey.publicKey,
        publicKeyAlg: senderKey.publicKeyAlg,
      },
      recipient: {
        userId: encryptionTarget.userId,
        username: encryptionTarget.username,
        publicKey: recipientKey.publicKey,
        publicKeyAlg: recipientKey.publicKeyAlg,
      },
    }
  }

  const toggleEncrypted = async () => {
    if (isEncrypted) {
      setIsEncrypted(false)
      setEncryptionKeys(undefined)
      return
    }

    try {
      setPosting(true)
      setEncryptionKeys(await resolveEncryptionKeys())
      setIsEncrypted(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось включить шифрование.')
    } finally {
      setPosting(false)
    }
  }

  const handleHotKey = (e: KeyboardEvent) => {
    const key = e.code
    if ((e.ctrlKey || e.metaKey) && key === 'KeyB') applyTag('b')
    if ((e.ctrlKey || e.metaKey) && key === 'KeyI') applyTag('i')
    if ((e.ctrlKey || e.metaKey) && key === 'KeyU') applyTag('u')
    if ((e.ctrlKey || e.metaKey) && key === 'KeyK') applyTag('a')
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'KeyX') applyTag('strike')
    if ((e.ctrlKey || e.metaKey) && key === 'Enter') handleAnswer()
  }

  const replaceText = (text: string, cursor: number) => {
    const answer = answerRef.current
    if (!answer) {
      return
    }
    answer.focus()
    const start = answer.selectionStart
    const end = answer.selectionEnd

    const text1 = answer.value.substring(0, start)
    const text2 = answer.value.substring(end)

    const newValue = text1 + text + text2
    answer.value = newValue

    setStorageValueDebounced(newValue)
    setAnswerText(newValue)

    setTimeout(() => {
      if (!answer) {
        return
      }
      answer.selectionStart = start + cursor
      answer.selectionEnd = answer.selectionStart
    })
  }

  const applyTag = (tag: string, attrs?: { [name: string]: string }) => {
    if (isPosting) {
      return
    }
    const answer = answerRef.current
    if (!answer) {
      return
    }
    answer.focus()

    const start = answer.selectionStart
    const end = answer.selectionEnd

    const oldValue = end > start ? answer.value.substring(start, end) : ''
    let newValue = oldValue
    let newPos = 0

    switch (tag) {
      case 'img': {
        if (/^https?:/.test(oldValue)) {
          // noinspection HtmlRequiredAltAttribute
          newValue = `<img src="${oldValue}" alt=""/>`
          newPos = newValue.length
        } else {
          openMediaUploader()
          return
        }

        break
      }
      case 'a': {
        let defaultValue = ''
        let textValue = oldValue
        if (/^https?:/.test(oldValue)) {
          defaultValue = oldValue
          textValue = ''
        }
        const url = window.prompt('Ссылка:', defaultValue)
        if (!url) {
          return
        }
        newValue = `<a href="${url}">`
        if (textValue) {
          newValue += `${textValue}</a>`
          newPos = newValue.length
        } else {
          newPos = newValue.length
          newValue += '</a>'
        }
        break
      }
      default: {
        const textAttrs = !attrs ? '' : Object.keys(attrs).reduce((_, name) => `${_} ${name}="${attrs[name]}"`, '')
        newValue = `<${tag}${textAttrs}>${oldValue}</${tag}>`
        newPos = oldValue ? newValue.length : newValue.length - `</${tag}>`.length
      }
    }

    replaceText(newValue, newPos)
  }

  useEffect(() => {
    if ((props.text || props.comment) && props.open && answerRef.current) {
      answerRef.current.focus()
      answerRef.current.selectionStart = answerRef.current.value.length
    }
  }, [props.open, props.comment])

  useEffect(() => {
    if (!encryptionTarget) {
      setIsEncrypted(false)
      setEncryptionKeys(undefined)
    }
  }, [encryptionTarget?.userId])

  useEffect(() => {
    if (!answerRef.current || !containerRef.current) {
      return
    }
    const { top, left } = getCaretCoordinates(answerRef.current, answerRef.current.selectionEnd)
    const suggestResults = containerRef.current?.querySelector('.textarea-suggest__results ') as HTMLDivElement
    if (!suggestResults) {
      return
    }
    suggestResults.style.setProperty('top', top.toString() + 'px')
    suggestResults.style.setProperty('left', left.toString() + 'px')
  })

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile()
      if (file) {
        openMediaUploader(file)
        e.preventDefault()
        return
      }
    }
  }

  const handlePreview = async () => {
    if (isPosting) {
      return
    }
    if (previewing !== null) {
      setPreviewing(null)
      return
    }
    setPosting(true)
    try {
      if (isEncrypted) {
        setPreviewing(renderEncryptedContentHtml(answerText))
      } else {
        const response = await api.postAPI.preview(answerText)
        setPreviewing(response.content)
      }
    } catch (e) {
      console.error(e)
      setPreviewing(null)
    } finally {
      setPosting(false)
    }
  }

  const previewIgnoredTagNames = ['A', 'SUMMARY', 'VIDEO']
  const handleClosePreview = async (e: React.MouseEvent) => {
    const el = e.target as HTMLElement
    if (
      isPosting ||
      previewIgnoredTagNames.includes(el.tagName) ||
      el.getAttribute('role') === 'button' ||
      el.classList.contains('image-scalable') ||
      el.closest('.gallery')
    ) {
      return
    }
    setPreviewing(null)
  }

  const handleAnswer = async () => {
    setPosting(true)
    try {
      const resolvedEncryptionKeys = isEncrypted ? encryptionKeys || (await resolveEncryptionKeys()) : undefined
      const encryptedPayload =
        isEncrypted &&
        resolvedEncryptionKeys &&
        (await encryptContentForUsers(answerText, [
          {
            ...resolvedEncryptionKeys.sender,
            role: 'sender',
          },
          {
            ...resolvedEncryptionKeys.recipient,
            role: 'recipient',
          },
        ]))

      await props.onAnswer(isEncrypted ? '' : answerText, props.post, props.comment, encryptedPayload || undefined)

      setStorageValueDebounced('')
      setStorageValueDebounced.flush()
      setAnswerText('')
      setIsEncrypted(false)
      setEncryptionKeys(undefined)
    } catch (error) {
      console.log('onAnswer ERR', error)
      toast.error(error instanceof Error ? error.message : 'Не удалось отправить сообщение.')
    } finally {
      setPreviewing(null)
      setPosting(false)
    }
  }

  const handleMediaUpload = (result: MediaResult[], gallery?: CreateGalleryOption | undefined) => {
    setMediaUploaderData(undefined)
    setMediaUploaderOpen(false)

    const answer = answerRef.current
    if (!answer) return

    const cursorPos = answer.selectionStart
    const currentText = answer.value
    const galleryInsertPos = getGalleryInsertPosition(currentText, cursorPos)

    let mediaText = result
      .map((data) => {
        if (data.type === 'image') {
          return `<img src="${data.url}" alt=""/>`
        } else if (data.type === 'video') {
          return `<video src="${data.url}"/>`
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')

    // If inside/at-border of gallery, insert directly without wrapping
    if (galleryInsertPos !== null) {
      // Insert at the gallery position (may differ from cursor if cursor was after </gallery>)
      const text1 = currentText.substring(0, galleryInsertPos)
      const text2 = currentText.substring(galleryInsertPos)

      // Add newline before if there's content before insert point
      const needsNewlineBefore = galleryInsertPos > 0 && !/\n$/.test(text1)
      // Add newline after if there's content after insert point
      const needsNewlineAfter = text2.length > 0 && !/^\n/.test(text2)

      if (needsNewlineBefore) mediaText = '\n' + mediaText
      if (needsNewlineAfter) mediaText = mediaText + '\n'

      const newValue = text1 + mediaText + text2
      answer.value = newValue
      setAnswerText(newValue)
      setStorageValueDebounced(newValue)

      const newCursorPos = galleryInsertPos + mediaText.length - (needsNewlineAfter ? 1 : 0)
      setTimeout(() => {
        answer.focus()
        answer.selectionStart = newCursorPos
        answer.selectionEnd = newCursorPos
      })
    } else {
      // Not inside gallery - wrap if checkbox is checked
      if (gallery?.create && !isEncrypted) {
        mediaText = `<gallery>\n${mediaText}\n</gallery>`
      }
      replaceText(mediaText, mediaText.length)
    }
  }

  const handleMediaUploadCancel = () => {
    setMediaUploaderData(undefined)
    setMediaUploaderOpen(false)
  }

  const debounceSuggestError = useDebouncedCallback(
    (error: string) => {
      toast(error, { type: 'error' })
    },
    5000,
    { leading: true, trailing: false, maxWait: 10000 },
  )

  const onDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    // open media uploader on drag enter
    // check that media files are dragged
    if (
      e.dataTransfer.items.length > 0 &&
      e.dataTransfer.items[0].kind === 'file' &&
      (e.dataTransfer.items[0].type.startsWith('image/') || e.dataTransfer.items[0].type.startsWith('video/'))
    ) {
      openMediaUploader()
    }
  }

  const fetchUsernameSuggestions = async (startsWith: string) => {
    try {
      const result = await api.userAPI.getUsernameSuggestions(startsWith)
      return result.usernames
    } catch (e) {
      debounceSuggestError(e instanceof Error ? e.message : 'Не удалось загрузить подсказки.')
      return []
    }
  }

  const handlePollCreate = async (pollData: PollCreationWizardSubmitData) => {
    try {
      const result = await api.pollAPI.createPoll({
        question: pollData.question,
        options: pollData.options.map((opt) => opt.text),
        settings: {
          allowMultipleChoice: pollData.settings.isMultipleChoice,
          resultVisibility: pollData.settings.resultVisibility,
          allowVoteRescinding: pollData.settings.allowVoteRescinding,
          voteAccess: pollData.settings.voteAccess,
        },
        expires: pollData.settings.expirationDate || undefined,
      })
      const pollTag = `<poll>${result.id}</poll>`
      replaceText(pollTag, pollTag.length)
      setPollWizardOpen(false)
    } catch (error: unknown) {
      console.error('Failed to create poll:', error)
      if (error instanceof Error) {
        toast.error(`Не удалось создать опрос: ${error.message}`)
      } else {
        toast.error('Не удалось создать опрос')
      }
    }
  }

  if (!props.open) {
    return <></>
  }

  const fetchUsernameSuggestionsDebounced = debouncePromise(fetchUsernameSuggestions, 50)
  const suggestTrigger = {
    '@': {
      dataProvider: async (startsWith: string) => {
        if (!answerRef.current) {
          return []
        }
        return fetchUsernameSuggestionsDebounced(startsWith)
      },
      component: Item,
      output: (item: string) => '@' + item,
    },
  }

  return (
    <div className={styles.answer}>
      <div className={classNames(styles.controls, postComponentStyles.options)} ref={controlsRef}>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('b')}
            title='Болд'
            className={classNames(styles.bold, styles.editorButton)}
            tabIndex={toolbarTabIndex}
          >
            B
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('i')}
            title='Италик'
            className={classNames(styles.italic, styles.editorButton)}
            tabIndex={toolbarTabIndex}
          >
            I
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('u')}
            title='Подчеркнуть'
            className={classNames(styles.underline, styles.editorButton)}
            tabIndex={toolbarTabIndex}
          >
            U
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('strike')}
            title='Перечеркнуть'
            className={classNames(styles.strike, styles.editorButton)}
            tabIndex={toolbarTabIndex}
          >
            S
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons || isEncrypted}
            onClick={() => applyTag('irony')}
            title='Ирония'
            tabIndex={toolbarTabIndex}
          >
            <IronyIcon />
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('blockquote')}
            title='Цитировать'
            tabIndex={toolbarTabIndex}
          >
            <QuoteIcon />
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('img')}
            title='Вставить картинку/видео'
            tabIndex={toolbarTabIndex}
          >
            <ImageIcon />
          </Button>
        </div>
        <div className={styles.control}>
          <Button
            variant='minimal'
            disabled={disabledButtons}
            onClick={() => applyTag('a')}
            title='Вставить ссылку'
            tabIndex={toolbarTabIndex}
          >
            <LinkIcon />
          </Button>
        </div>
        <SpilloverWrapper threshold={350} parentRef={controlsRef}>
          <div className={styles.control}>
            <Button
              variant='minimal'
              disabled={disabledButtons || isEncrypted}
              onClick={() => applyTag('expand', { title: '' })}
              title='Свернуть/Развернуть'
              tabIndex={toolbarTabIndex}
            >
              <ExpandIcon />
            </Button>
          </div>
          <div className={styles.control}>
            <Button
              variant='minimal'
              disabled={disabledButtons}
              onClick={() => applyTag('pre')}
              title='Форматированный текст'
              className={styles.pre}
              tabIndex={toolbarTabIndex}
            >
              <CodeIcon />
            </Button>
          </div>
          <div className={styles.control}>
            <Button
              variant='minimal'
              disabled={disabledButtons || isEncrypted}
              onClick={() => applyTag('spoiler')}
              title='Спойлер'
              tabIndex={toolbarTabIndex}
            >
              <SpoilerIcon />
            </Button>
          </div>
          <div className={styles.control}>
            <Button
              variant='minimal'
              disabled={disabledButtons || isEncrypted}
              onClick={() => setPollWizardOpen(true)}
              title='Создать опрос'
              tabIndex={toolbarTabIndex}
            >
              <PollIcon />
            </Button>
          </div>
        </SpilloverWrapper>
      </div>
      {previewing === null ? (
        <div className={styles.editor} ref={containerRef}>
          <ReactTextareaAutocomplete<string>
            tabIndex={textareaTabIndex}
            placeholder={placeholderText}
            innerRef={(el: HTMLTextAreaElement) => {
              answerRef.current = el
            }}
            dropdownClassName={styles.textareaSuggestContainer}
            loadingComponent={() => <></>}
            minChar={1}
            disabled={isPosting}
            onChange={handleAnswerChange}
            onPaste={handlePaste}
            onDragEnter={onDragEnter}
            value={answerText}
            // @ts-expect-error -- types of react-textarea-autosize and react-textarea-autocomplete are incompatible with their latest versions
            textAreaComponent={TextareaAutosize}
            maxRows={25}
            movePopupAsYouType={true}
            trigger={suggestTrigger}
          />
        </div>
      ) : (
        <div
          className={classNames(commentStyles.content, styles.preview, postStyles.preview)}
          onClick={handleClosePreview}
        >
          <ContentComponent content={previewing} />
        </div>
      )}
      <div className={styles.final}>
        <ButtonGroup spacing={ButtonGroupSpacing.MEDIUM} className={styles.commentButtonGroup}>
          <div className={styles.buttonThemeToggle}>
            {previewing && <ThemeToggleComponent buttonLabel='Превью с другой темой' resetOnOnmount={true} />}
          </div>
          {encryptionTarget && (
            <Button
              variant='minimal'
              active={isEncrypted}
              disabled={isPosting}
              onClick={() => toggleEncrypted().catch()}
            >
              <span className='i i-mail-secure' />
            </Button>
          )}
          <Button
            variant='minimal'
            disabled={isPosting || !answerText}
            onClick={handlePreview}
            className={styles.buttonPreview}
            tabIndex={isPosting || !answerText ? -1 : actionPreviewTabIndex}
          >
            {previewing === null ? 'Превью' : 'Редактор'}
          </Button>
          <Button
            variant='minimal'
            disabled={isPosting || !answerText}
            onClick={handleAnswer}
            className={styles.buttonSend}
            tabIndex={isPosting || !answerText ? -1 : actionSendTabIndex}
          >
            <SendIcon />
          </Button>
        </ButtonGroup>
        {mediaUploaderOpen && (
          <MediaUploader
            onSuccess={handleMediaUpload}
            onCancel={handleMediaUploadCancel}
            mediaData={mediaUploaderData}
            initialGalleryCreate={mediaUploaderInGallery}
          />
        )}
        {pollWizardOpen &&
          createPortal(
            <PollCreationWizard
              isOpen={pollWizardOpen}
              onClose={() => setPollWizardOpen(false)}
              onSubmit={handlePollCreate}
            />,
            document.body,
          )}
      </div>
    </div>
  )
}

const RestrictedToPostIdMessage = (props: { postId: number | true }) => {
  return props.postId === true ? (
    <div className={styles.restrictedToPostIdMessage}>
      Возможность комментировать в чужих постах заблокирована из-за низкой кармы.
      <a href={'/create'}>Создать свой пост.</a>
    </div>
  ) : (
    <div className={styles.restrictedToPostIdMessage}>
      Возможность комментировать заблокирована из-за низкой кармы. Можно комментировать только в{' '}
      <a href={`/p${props.postId}`}>этом посте</a>.
    </div>
  )
}

const RestrictedSlowMode = (props: { endTime: Date; endCallback: () => void }) => {
  return (
    <SlowMode endTime={props.endTime} endCallback={props.endCallback}>
      <div className={styles.restrictedSlowMode}>
        Возможность комментировать ограничена из-за низкой кармы. До конца ожидания осталось:
      </div>
    </SlowMode>
  )
}

/**
 * SpilloverWrapper is a React component that wraps its children and provides a responsive UI feature.
 * It displays its children directly if the parent width is less than a given threshold.
 * Otherwise, it provides a button to toggle the display of its children.
 *
 * @param {ReactNode} props.children - The children to be wrapped by this component.
 * @param {React.RefObject<HTMLDivElement>} props.parentRef - A reference to the parent element.
 * @param {number} props.threshold - The threshold width in pixels.
 */
const SpilloverWrapper = (props: {
  children: ReactNode
  parentRef: React.RefObject<HTMLDivElement>
  threshold: number
}) => {
  const [showOptions, setShowOptions] = useState(false)
  const [parentWidth, setParentWidth] = useState(0)

  const handleResize = () => {
    if (props.parentRef.current) {
      setParentWidth(props.parentRef.current.offsetWidth)
    }
  }

  useEffect(() => {
    handleResize() // initial sizing
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!showOptions) {
      return
    }
    const handleClick = (e: MouseEvent) => {
      setShowOptions(false)
    }
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [showOptions])

  const toggleOptions = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowOptions(!showOptions)
    return false
  }

  return parentWidth > props.threshold ? (
    <>{props.children}</>
  ) : (
    <div className={styles.control + ' ' + postComponentStyles.options}>
      <Button variant='minimal' onClick={toggleOptions} active={showOptions} className={postComponentStyles.options}>
        <OptionsIcon />
      </Button>
      {showOptions && <div className={postComponentStyles.optionsList}>{props.children}</div>}
    </div>
  )
}
