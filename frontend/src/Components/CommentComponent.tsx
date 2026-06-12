import React, { useMemo, useState } from 'react'

import { TranslateType } from '@api/PostAPI'
import { useInterpreter } from '@api/use/useInterpreter'
import { useAPI } from '@state/AppState'
import OutsideClickHandler from 'react-outside-click-handler'
import { toast } from 'react-toastify'

import Conf from '../Conf'
import { CommentInfo, PostLinkInfo } from '../Types/PostInfo'
import { AltTranslateButton, AnnotateButton, TranslateButton } from './ContentButtons'
import ContentComponent, { LARGE_AUTO_CUT } from './ContentComponent'
import { CreateCommentComponentRestricted } from './CreateCommentComponent'
import { HistoryComponent } from './HistoryComponent'
import RatingSwitch from './RatingSwitch'
import { SignatureComponent } from './SignatureComponent'
import { getPreferredLang, getShowInlineTranslateButton } from './UserProfileSettings'

import { ReactComponent as OptionsIcon } from '../Assets/options.svg'
import styles from './CommentComponent.module.scss'
import postStyles from './PostComponent.module.scss'

interface CommentProps {
  comment: CommentInfo
  showSite?: boolean
  parent?: CommentInfo
  onAnswer?: (text: string, post?: PostLinkInfo, comment?: CommentInfo) => Promise<CommentInfo | undefined>
  onEdit?: (text: string, comment: CommentInfo) => Promise<CommentInfo | undefined>
  depth?: number
  maxTreeDepth?: number
  idx?: number
  unreadOnly?: boolean
  hideRating?: boolean
  votingDisabled?: boolean
  votingDisabledTitle?: string
  currentUsername?: string
  onVote?: (id: number, comment: Partial<CommentInfo>, postApiCall?: boolean) => void
}

export default function CommentComponent(props: CommentProps) {
  const [answerOpen, setAnswerOpen] = useState(false)
  const [editingText, setEditingText] = useState<false | string>(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  const api = useAPI()
  const {
    currentMode,
    inProgress,
    contentRef,
    altContent,
    translate,
    annotate,
    altTranslate,
    calcShowAnnotate,
    calcShowAltTranslate,
  } = useInterpreter(props.comment.content, props.comment.id, TranslateType.COMMENT)

  const handleAnswerSwitch = (e: React.MouseEvent) => {
    e.preventDefault()
    setAnswerOpen(!answerOpen)
  }

  const toggleOptions = () => {
    setShowOptions(!showOptions)
  }

  const handleAnswer = async (text: string, post?: PostLinkInfo, comment?: CommentInfo) => {
    if (!post) {
      return undefined
    }
    const res = await props.onAnswer?.(text, post, comment)
    setAnswerOpen(false)
    return res
  }

  const handleEditComplete = async (text: string) => {
    try {
      const res = await props.onEdit?.(text, props.comment)
      setEditingText(false)
      return res
    } catch (err: any) {
      console.log('Could not edit comment', err)
      toast.error(err.message || 'Не удалось отредактировать комментарий')
      throw err
    }
  }

  const { comment: votedComment, onVote } = props
  const handleVote = useMemo(() => {
    return (value: number, vote?: number, postApiCall?: boolean) => {
      votedComment.rating = value
      votedComment.vote = vote
      onVote?.(
        votedComment.id,
        {
          rating: value,
          vote,
        },
        postApiCall,
      )
    }
  }, [votedComment, onVote])

  const handleEdit = async () => {
    try {
      const comment = await api.postAPI.getComment(props.comment.id, 'source')
      setEditingText(comment.comment.content)
    } catch (e) {
      console.log('Get comment error:', e)
      toast.error('Не удалось включить редактирование')
    }
  }

  const toggleHistory = () => {
    setShowHistory(!showHistory)
  }

  const { author, created, site, postLink, editFlag } = props.comment
  const content = altContent || props.comment.content

  const depth = props.depth || 0
  const maxDepth = props.maxTreeDepth || 0
  const isFlat = depth > maxDepth

  const showTranslateButtonInline = useMemo(() => {
    return getShowInlineTranslateButton() && props.comment.language !== getPreferredLang()
  }, [props.comment])

  return (
    <div
      className={`comment ${styles.comment} ${props.comment.isNew ? ' isNew' : ''} ${isFlat ? ' isFlat' : ''}`}
      data-comment-id={props.comment.id}
    >
      <div className='commentBody' ref={contentRef}>
        <SignatureComponent
          showSite={props.showSite}
          site={site}
          author={author}
          onHistoryClick={toggleHistory}
          parentCommentId={props.idx && props.parent?.id}
          parentCommentAuthor={props.parent?.author?.username}
          postLink={postLink}
          commentId={props.comment.id}
          postLinkIsNew={props.unreadOnly}
          date={created}
          editFlag={editFlag}
        />
        {editingText === false ? (
          showHistory ? (
            <HistoryComponent
              initial={{ content, date: created }}
              history={{ id: props.comment.id, type: 'comment' }}
              onClose={toggleHistory}
            />
          ) : (
            <div className={styles.content}>
              <ContentComponent
                className={styles.commentContent}
                content={content}
                currentUsername={props.currentUsername}
                lowRating={props.comment.rating <= Conf.COMMENT_LOW_RATING_THRESHOLD || props.comment.vote === -1}
                autoCut={
                  !altContent &&
                  (props.comment.rating <= Conf.COMMENT_LOW_RATING_THRESHOLD || props.comment.vote === -1)
                    ? LARGE_AUTO_CUT
                    : undefined
                }
              />
            </div>
          )
        ) : (
          <CreateCommentComponentRestricted
            post={props.comment.postLink}
            comment={props.comment}
            open={true}
            text={editingText}
            onAnswer={handleEditComplete}
          />
        )}

        <div className={styles.controls}>
          {!props.hideRating && (
            <div className={styles.control}>
              <RatingSwitch
                type='comment'
                id={props.comment.id}
                rating={{ vote: props.comment.vote, value: props.comment.rating }}
                onVote={handleVote}
                votingDisabled={props.votingDisabled}
                votingDisabledTitle={props.votingDisabledTitle}
              />
            </div>
          )}
          {props.comment.canEdit && props.onEdit && (
            <div className={styles.control}>
              {/*comment component is rendered 4+k times, let's keep it extremely lightweight*/}
              {/* eslint-disable-next-line react/forbid-elements */}
              <button onClick={handleEdit} className='i i-edit' />
            </div>
          )}

          <div className={styles.control + ' ' + postStyles.options}>
            {(showTranslateButtonInline || currentMode === 'translate') && (
              <div className={styles.control}>
                <TranslateButton
                  iconOnly={true}
                  isActive={currentMode === 'translate'}
                  inProgress={inProgress}
                  onClick={translate}
                />
              </div>
            )}
            {currentMode === 'altTranslate' && (
              <div className={styles.control}>
                <AltTranslateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={altTranslate} />
              </div>
            )}
            {currentMode === 'annotate' && (
              <div className={styles.control}>
                <AnnotateButton iconOnly={true} isActive={true} inProgress={inProgress} onClick={annotate} />
              </div>
            )}
            {/*comment component is rendered 4+k times, let's keep it extremely lightweight*/}
            {/* eslint-disable-next-line react/forbid-elements */}
            <button onClick={toggleOptions} className={styles.options + ' ' + (showOptions ? styles.active : '')}>
              <OptionsIcon />
            </button>
            {showOptions && (
              <OutsideClickHandler onOutsideClick={() => setShowOptions(false)}>
                <div className={postStyles.optionsList}>
                  <TranslateButton
                    inProgress={inProgress}
                    onClick={() => {
                      setShowOptions(false)
                      translate()
                    }}
                    isActive={currentMode === 'translate'}
                  />
                  {calcShowAltTranslate() && (
                    <AltTranslateButton
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
                      inProgress={inProgress}
                      onClick={() => {
                        setShowOptions(false)
                        annotate()
                      }}
                      isActive={currentMode === 'annotate'}
                    />
                  )}
                </div>
              </OutsideClickHandler>
            )}
          </div>
          {props.onAnswer && (
            <div className={styles.control}>
              {/*comment component is rendered 4+k times, let's keep it extremely lightweight*/}
              {/* eslint-disable-next-line react/forbid-elements */}
              <button onClick={handleAnswerSwitch}>{!answerOpen ? 'Ответить' : 'Не отвечать'}</button>
            </div>
          )}
        </div>
      </div>
      {props.comment.answers || answerOpen ? (
        <div className={styles.answers + (isFlat ? ' isFlat' : '')}>
          {props.onAnswer && (
            <CreateCommentComponentRestricted
              open={answerOpen}
              post={props.comment.postLink}
              comment={props.comment}
              onAnswer={handleAnswer}
              storageKey={`cp:${props.comment.id}`}
            />
          )}
          {props.comment.answers && props.onAnswer ? (
            props.comment.answers.map((comment, idx) => (
              <CommentComponent
                maxTreeDepth={maxDepth}
                depth={depth + 1}
                parent={props.comment}
                key={comment.id}
                comment={comment}
                onAnswer={props.onAnswer}
                onEdit={props.onEdit}
                unreadOnly={props.unreadOnly}
                idx={idx}
                currentUsername={props.currentUsername}
              />
            ))
          ) : (
            <></>
          )}
        </div>
      ) : (
        <></>
      )}
    </div>
  )
}
