import React, { ReactNode, useEffect, useRef, useState } from 'react'

import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import ButtonGroup, { ButtonGroupSpacing } from '@ui/ButtonGroup'
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
import ContentComponent from './ContentComponent'
import MediaUploader from './MediaUploader'
import { PollCreationWizard, PollCreationWizardSubmitData } from './PollCreationWizard'
import { SecretMailEncoderForm } from './SecretMailbox'
import SlowMode from './SlowMode'
import ThemeToggleComponent from './ThemeToggleComponent'

import { ReactComponent as CodeIcon } from '../Assets/code-slash.svg'
import { ReactComponent as ExpandIcon } from '../Assets/expand.svg'
import { ReactComponent as Gallerycon } from '../Assets/gallery.svg'
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

  /**
   * Optional tab index for the textarea. When provided, formatting buttons
   * will use the next index in sequence.
   */
  textareaTabIndex?: number

  onAnswer: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | string | undefined>
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
      onAnswer={(text, post, comment) => {
        return props.onAnswer(text, post, comment).finally(() => {
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
  const [pollWizardOpen, setPollWizardOpen] = useState(false)
  const containerRef = useHotkeys<HTMLDivElement>(allowedKeys.join(','), (e) => handleHotKey(e), {
    enableOnFormTags: ['TEXTAREA'],
    preventDefault: true,
  })
  const controlsRef = useRef<HTMLDivElement>(null)

  const [parentPublicKey, setParentPublicKey] = useState<
    | {
        publicKey: string
        username: string
      }
    | undefined
  >(undefined)
  const [mailForm, setFormOpen] = useState(false)

  const api = useAPI()

  const pronoun =
    props?.comment?.author?.gender === UserGender.he
      ? 'ему'
      : props?.comment?.author?.gender === UserGender.she
        ? 'ей'
        : ''
  const placeholderText = props.comment ? `Ваш ответ ${pronoun}` : ''
  const disabledButtons = isPosting || previewing !== null || mailForm

  const state = useAppState()
  const username = state.userInfo?.username

  // retrieve parent public key
  useEffect(() => {
    const parentUserName = props.parentAuthorUserName || props.comment?.author?.username

    if (!parentUserName || parentUserName === username) {
      return
    }
    api.postAPI.getPublicKeyByUsername(parentUserName).then((res) => {
      if (res.publicKey) {
        setParentPublicKey({
          publicKey: res.publicKey,
          username: parentUserName,
        })
      }
    })
  }, [props.parentAuthorUserName, props.comment])

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
          setMediaUploaderOpen(true)
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
    setMediaUploaderData(undefined)
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile()
      if (file) {
        setMediaUploaderData(file)
        setMediaUploaderOpen(true)
        e.preventDefault()
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
      const response = await api.postAPI.preview(answerText)
      setPreviewing(response.content)
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
      el.classList.contains('image-scalable')
    ) {
      return
    }
    setPreviewing(null)
  }

  const handleAnswer = () => {
    setPosting(true)
    props
      .onAnswer(answerText, props.post, props.comment)
      .then(() => {
        setStorageValueDebounced('')
        setStorageValueDebounced.flush()
        setAnswerText('')
      })
      .catch((error) => {
        console.log('onAnswer ERR', error)
      })
      .finally(() => {
        setPreviewing(null)
        setPosting(false)
      })
  }

  const handleMediaUpload = (uri: string, type: 'video' | 'image') => {
    setMediaUploaderData(undefined)
    setMediaUploaderOpen(false)
    if (type === 'image') {
      // noinspection HtmlRequiredAltAttribute
      const text = `<img src="${uri}" alt=""/>`
      replaceText(text, text.length)
    } else {
      const text = `<video src="${uri}"/>`
      replaceText(text, text.length)
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
      setMediaUploaderOpen(true)
    }
  }

  const fetchUsernameSuggestions = async (startsWith: string) => {
    try {
      const result = await api.userAPI.getUsernameSuggestions(startsWith)
      return result.usernames
    } catch (e) {
      debounceSuggestError((e as any).message)
      return []
    }
  }

  const handleMailClose = (result?: string) => {
    setFormOpen(false)
    if (result) {
      replaceText(result, result.length)
    }
  }

  const handlePollCreate = async (pollData: PollCreationWizardSubmitData) => {
    try {
      const result = await api.pollAPI.createPoll({
        question: pollData.question,
        options: pollData.options.map((opt: any) => opt.text),
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
            disabled={disabledButtons}
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
            onClick={() =>
              applyTag('gallery', {
                'auto-play-interval': '0',
                'show-arrows': 'true',
                'show-indicators': 'true',
                'show-thumbnails': 'true',
              })
            }
            title='Галерея изображений'
            tabIndex={toolbarTabIndex}
          >
            <Gallerycon />
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
              disabled={disabledButtons}
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
              disabled={disabledButtons}
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
              disabled={disabledButtons}
              onClick={() => setPollWizardOpen(true)}
              title='Создать опрос'
              tabIndex={toolbarTabIndex}
            >
              <PollIcon />
            </Button>
          </div>
          {/*{parentPublicKey &&*/}
          {/*<div className={styles.control}>*/}
          {/*    <Button variant='minimal' disabled={disabledButtons} onClick={() => setFormOpen(true)} title="Шифрованное послание"><MailIcon /></Button></div>*/}
          {/*}*/}
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
          />
        )}
        {mailForm && parentPublicKey && (
          <SecretMailEncoderForm
            openKey={parentPublicKey.publicKey}
            forUsername={parentPublicKey.username}
            mailboxTitle={`Шифровка`}
            onClose={handleMailClose}
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
