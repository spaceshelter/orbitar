import React, { useMemo, useState } from 'react'

import { TranslateType } from '@api/PostAPI'
import { useInterpreter } from '@api/use/useInterpreter'
import { useAPI, useAppState } from '@state/AppState'
import Button from '@ui/Button'
import classNames from 'classnames'
import OutsideClickHandler from 'react-outside-click-handler'
import { toast } from 'react-toastify'

import Conf from '../Conf'
import { CommentInfo, PostInfo, PostLinkInfo } from '../Types/PostInfo'
import { getEncryptedPayloadSource } from '../Utils/encryptedPayloadSource'
import { EncryptedPayloadDraft } from '../Utils/mailCrypto'
import { AltTranslateButton, AnnotateButton, TranslateButton, UnwatchButton, WatchButton } from './ContentButtons'
import ContentComponent from './ContentComponent'
import CreateCommentComponent from './CreateCommentComponent'
import EncryptedContentComponent from './EncryptedContentComponent'
import { HistoryComponent } from './HistoryComponent'
import PostLink from './PostLink'
import RatingSwitch from './RatingSwitch'
import { SignatureComponent } from './SignatureComponent'
import { getPreferredLang, getShowInlineTranslateButton } from './UserProfileSettings'

import { ReactComponent as CommentsIcon } from '../Assets/comments.svg'
import { ReactComponent as EditIcon } from '../Assets/edit.svg'
import { ReactComponent as OptionsIcon } from '../Assets/options.svg'
import styles from './PostComponent.module.scss'

interface PostComponentProps {
  post: PostInfo
  showSite?: boolean
  buttons?: React.ReactNode
  onChange?: (id: number, post: Partial<PostInfo>) => void
  autoCut?: number
  onEdit?: (
    post: PostInfo,
    text: string,
    title?: string,
    encryptedPayload?: EncryptedPayloadDraft,
  ) => Promise<PostInfo | undefined>
  dangerousHtmlTitle?: boolean
  hideRating?: boolean
}

export default function PostComponent(props: PostComponentProps) {
  const api = useAPI()
  const appState = useAppState()
  const currentUsername = appState.userInfo?.username
  const [showOptions, setShowOptions] = useState(false)
  const [editingText, setEditingText] = useState<false | string>(false)
  const [editingTitle, setEditingTitle] = useState<string>(props.post.title || '')
  const [showHistory, setShowHistory] = useState(false)
  const {
    currentMode,
    altTitle,
    altContent,
    inProgress,
    contentRef,
    translate,
    annotate,
    altTranslate,
    calcShowAltTranslate,
    calcShowAnnotate,
  } = useInterpreter(props.post.content, props.post.id, TranslateType.POST)

  const handleVote = useMemo(() => {
    return (value: number, vote?: number) => {
      props.post.rating = value
      props.post.vote = vote

      if (props.onChange) {
        props.onChange(props.post.id, {
          rating: value,
          vote,
        })
      }
    }
  }, [props])

  const { id, created, site, author, vote, rating, watch } = props.post
  const title = altTitle || props.post.title
  const content = altContent || props.post.content
  const isEncrypted = !!props.post.encryptedPayloadId

  const toggleOptions = () => {
    setShowOptions(!showOptions)
  }
  const toggleWatch = () => {
    const oldState = !!props.post.watch
    const newState = !oldState
    props.post.watch = newState

    api.post
      .watch(id, newState)
      .then(({ watch }) => {
        if (props.onChange) {
          props.onChange(props.post.id, { watch })
        }
      })
      .catch(() => {
        props.post.watch = oldState
        toast.error('Непонятно, слежу или нет?')
      })

    setShowOptions(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleBookmark = () => {
    const oldState = !!props.post.bookmark
    const newState = !oldState
    props.post.bookmark = newState

    api.post
      .bookmark(id, newState)
      .then(({ bookmark }) => {
        if (props.onChange) {
          props.onChange(props.post.id, { bookmark })
        }
      })
      .catch(() => {
        props.post.bookmark = oldState
        toast.error('Кладмен мудак - закладка не найдена')
      })
  }

  const handleEditComplete = async (
    text: string,
    _post?: PostLinkInfo,
    _comment?: CommentInfo,
    encryptedPayload?: EncryptedPayloadDraft,
  ) => {
    try {
      await props.onEdit?.(props.post, text, editingTitle, encryptedPayload)
      setEditingText(false)
      // return res;
      return undefined
    } catch (err: unknown) {
      console.log('Could not edit post', err)
      toast.error(err instanceof Error ? err.message : 'Не удалось отредактировать пост')
      throw err
    }
  }

  const handleEdit = async () => {
    try {
      const post = await api.postAPI.get(props.post.id, 'source', true)

      if (post.post.encryptedPayloadId) {
        const payload = await api.encryptedPayload.getEncryptedPayloadCached(post.post.encryptedPayloadId)
        const source = await getEncryptedPayloadSource(appState, payload)

        if (source === undefined) {
          return
        }

        setEditingText(source)
        return
      }

      setEditingText(post.post.content)
    } catch (e) {
      console.log('Get comment error:', e)
      toast.error('Не удалось включить редактирование')
    }
  }

  const handleEditingTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value)
  }

  const toggleHistory = () => {
    setShowHistory(!showHistory)
  }

  const altMode = currentMode !== undefined || inProgress
  const autoCut = altMode ? undefined : props.autoCut
  const showTranslateButtonInline = useMemo(() => {
    return getShowInlineTranslateButton() && props.post.language !== getPreferredLang()
  }, [props.post])

  return (
    <div className={'postComponent ' + styles.post} ref={contentRef}>
      <div className={styles.header}>
        <SignatureComponent
          showSite={props.showSite}
          site={site}
          author={author}
          onHistoryClick={toggleHistory}
          postLink={props.post}
          date={created}
          editFlag={props.post.editFlag}
        />
        <div className={styles.contentContainer}>
          {editingText === false ? (
            showHistory ? (
              <HistoryComponent
                initial={{ title, content, date: created, encryptedPayloadId: props.post.encryptedPayloadId }}
                history={{ id: props.post.id, type: 'post' }}
                onClose={toggleHistory}
              />
            ) : (
              <>
                {title && (
                  <div className={styles.title}>
                    <PostLink post={props.post}>
                      {props.dangerousHtmlTitle ? <span dangerouslySetInnerHTML={{ __html: title }} /> : title}
                    </PostLink>
                  </div>
                )}
                <div className={styles.content}>
                  {props.post.encryptedPayloadId ? (
                    <EncryptedContentComponent
                      className={classNames(styles.content, styles.encryptedContent)}
                      encryptedPayloadId={props.post.encryptedPayloadId}
                      kind='post'
                      autoCut={autoCut}
                      lowRating={rating <= Conf.POST_LOW_RATING_THRESHOLD || props.post.vote === -1}
                    />
                  ) : (
                    <ContentComponent
                      className={styles.content}
                      {...{ autoCut, content, currentUsername }}
                      lowRating={rating <= Conf.POST_LOW_RATING_THRESHOLD || props.post.vote === -1}
                    />
                  )}
                </div>
              </>
            )
          ) : (
            <>
              <input
                className={styles.title}
                type='text'
                placeholder='Без названия'
                maxLength={64}
                value={editingTitle}
                onChange={handleEditingTitle}
              />
              <CreateCommentComponent
                open={true}
                text={editingText}
                initialEncrypted={!!props.post.encryptedPayloadId}
                onAnswer={handleEditComplete}
              />
            </>
          )}
        </div>
      </div>
      <div className={styles.controls}>
        {!props.hideRating && (
          <div className={styles.control}>
            <RatingSwitch type='post' id={id} rating={{ vote, value: rating }} onVote={handleVote} />
          </div>
        )}
        <div className={styles.control}>
          <CommentsCount post={props.post} />
        </div>
        {/* <div className={styles.control}><Button disabled={true} onClick={toggleBookmark} active={bookmark}><BookmarkIcon /><span className={styles.label}></span></Button></div> */}
        {props.post.canEdit && props.onEdit && (
          <div className={styles.control}>
            <Button variant='minimal' onClick={handleEdit}>
              <EditIcon />
            </Button>
          </div>
        )}
        <div className={styles.control + ' ' + styles.options}>
          {!isEncrypted && (showTranslateButtonInline || currentMode === 'translate') && (
            <div className={styles.control}>
              <TranslateButton
                iconOnly={true}
                isActive={currentMode === 'translate'}
                inProgress={inProgress}
                onClick={translate}
              />
            </div>
          )}
          {!isEncrypted && currentMode === 'altTranslate' && (
            <div className={styles.control}>
              <AltTranslateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={altTranslate} />
            </div>
          )}
          {!isEncrypted && currentMode === 'annotate' && (
            <div className={styles.control}>
              <AnnotateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={annotate} />
            </div>
          )}

          <Button variant='minimal' onClick={toggleOptions} active={showOptions}>
            <OptionsIcon />
          </Button>
          {showOptions && (
            <OutsideClickHandler onOutsideClick={() => setShowOptions(false)}>
              <div className={styles.optionsList}>
                {!showTranslateButtonInline && (
                  <TranslateButton
                    className={styles.control}
                    inProgress={inProgress}
                    onClick={() => {
                      setShowOptions(false)
                      translate()
                    }}
                    isActive={currentMode === 'translate'}
                  />
                )}
                {calcShowAltTranslate() && (
                  <AltTranslateButton
                    className={styles.control}
                    inProgress={inProgress}
                    onClick={() => {
                      setShowOptions(false)
                      altTranslate()
                    }}
                    isActive={currentMode === 'altTranslate'}
                  />
                )}
                {calcShowAnnotate() && (
                  <AnnotateButton
                    className={styles.control}
                    inProgress={inProgress}
                    onClick={() => {
                      setShowOptions(false)
                      annotate()
                    }}
                    isActive={currentMode === 'annotate'}
                  />
                )}
                {watch ? <UnwatchButton onClick={toggleWatch} /> : <WatchButton onClick={toggleWatch} />}
              </div>
            </OutsideClickHandler>
          )}
        </div>
      </div>
      {props.buttons}
    </div>
  )
}

function CommentsCount(props: { post: PostInfo }) {
  const { comments, newComments } = props.post

  if (!comments) {
    return (
      <PostLink post={props.post}>
        <CommentsIcon />
        <span className={[styles.label, styles.noComments].join(' ')}>Комментировать</span>
      </PostLink>
    )
  }

  if (!newComments) {
    return (
      <PostLink post={props.post}>
        <CommentsIcon />
        <span className={styles.label}>{comments}</span>
      </PostLink>
    )
  }

  if (newComments === comments) {
    return (
      <PostLink className={styles.active} post={props.post}>
        <CommentsIcon />
        <span className={styles.label}>{comments}</span>
      </PostLink>
    )
  }

  return (
    <>
      <PostLink className={styles.active} post={props.post} onlyNew={true}>
        <CommentsIcon />
        <span className={styles.label}>{newComments}</span>
      </PostLink>{' '}
      / <PostLink post={props.post}>{comments}</PostLink>
    </>
  )
}
