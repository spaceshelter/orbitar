import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'

import { PostCommentIndexEntry } from '../API/PostAPI'
import { useAppState } from '../AppState/AppState'
import CommentComponent from '../Components/CommentComponent'
import { CreateCommentComponentRestricted } from '../Components/CreateCommentComponent'
import PostComponent from '../Components/PostComponent'
import Username from '../Components/Username'
import { CommentInfo, PostInfo, PostLinkInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import {
  COMMENT_PAGE_SIZE,
  getCommentBatch,
  getCommentPath,
  getTargetPathState,
  getVisibleCommentIds,
  groupThreadedComments,
} from '../Utils/threadedComments'
import { scrollUnderTopbar } from '../Utils/utils'

import styles from './PostPage.module.css'

export default function ThreadedPostPage() {
  const params = useParams<{ postId: string }>()
  const postId = params.postId ? parseInt(params.postId, 10) : 0
  const [search] = useSearchParams()
  const unreadOnly = search.has('new')
  const location = useLocation()
  const { site, userInfo, api } = useAppState()
  const [post, setPost] = useState<PostInfo>()
  const [anonymousUser, setAnonymousUser] = useState<UserInfo>()
  const [index, setIndex] = useState<PostCommentIndexEntry[]>()
  const [loaded, setLoaded] = useState<Record<number, CommentInfo>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [pageStarts, setPageStarts] = useState<Record<number, number>>({})
  const [addedIds, setAddedIds] = useState<number[]>([])
  const [error, setError] = useState<string>()
  const [batchError, setBatchError] = useState<string>()
  const pending = useRef<Set<number>>(new Set())
  const generation = useRef(0)
  const focused = useRef<string>()
  const openedTarget = useRef<string>()

  const reload = useCallback(() => {
    const currentGeneration = ++generation.current
    pending.current.clear()
    setPost(undefined)
    setIndex(undefined)
    setLoaded({})
    setExpanded({})
    setPageStarts({})
    setAddedIds([])
    setError(undefined)
    setBatchError(undefined)
    focused.current = undefined
    openedTarget.current = undefined
    api.post
      .getThreaded(postId)
      .then((result) => {
        if (generation.current !== currentGeneration) return
        setPost(result.post)
        setAnonymousUser(result.anonymousUser)
        setIndex(result.commentIndex)
        api.post.read(postId, result.post.comments, result.lastCommentId).catch(console.error)
      })
      .catch((err) => {
        if (generation.current !== currentGeneration) return
        setError(err.message || 'Не удалось загрузить пост')
      })
  }, [api.post, postId])

  useEffect(() => {
    reload()
    const invalidatePending = () => {
      generation.current++
    }
    return invalidatePending
  }, [reload])

  useEffect(() => {
    document.title = post ? `${post.title || `Пост #${postId}`} / ${post.author.username}` : `Пост #${postId}`
  }, [post, postId])

  const indexById = useMemo(() => new Map((index || []).map((entry) => [entry.id, entry])), [index])
  const targetId = useMemo(() => {
    const hashId = Number(location.hash.slice(1))
    if (location.hash && indexById.has(hashId)) return hashId
    return unreadOnly ? index?.find((entry) => entry.isNew)?.id : undefined
  }, [index, indexById, location.hash, unreadOnly])

  const childrenByParent = useMemo(
    () => groupThreadedComments(index || [], unreadOnly, targetId, addedIds),
    [index, unreadOnly, targetId, addedIds],
  )

  useEffect(() => {
    if (!targetId) return
    const key = `${postId}:${unreadOnly}:${location.hash}:${targetId}`
    if (openedTarget.current === key) return
    openedTarget.current = key
    const state = getTargetPathState(targetId, index || [], childrenByParent)
    setPageStarts((previous) => ({ ...previous, ...state.pages }))
    setExpanded((previous) => ({ ...previous, ...state.expanded }))
  }, [targetId, index, childrenByParent, postId, unreadOnly, location.hash])

  const visibleIds = useMemo(
    () => getVisibleCommentIds(childrenByParent, pageStarts, expanded),
    [childrenByParent, expanded, pageStarts],
  )
  const targetLoaded = !!(targetId && loaded[targetId])
  const targetVisible = !!(targetId && visibleIds.includes(targetId))

  useEffect(() => {
    if (!index || !visibleIds.length || batchError) return
    const priority = targetId ? getCommentPath(targetId, index) : []
    const ids = getCommentBatch(visibleIds, new Set(Object.keys(loaded).map(Number)), pending.current, priority)
    if (!ids.length) return
    ids.forEach((id) => pending.current.add(id))
    const currentGeneration = generation.current
    api.post
      .getComments(postId, ids)
      .then((comments) => {
        if (generation.current !== currentGeneration) return
        if (comments.length !== ids.length) {
          setBatchError('Не все комментарии удалось загрузить')
          return
        }
        setLoaded((previous) => {
          const next = { ...previous }
          comments.forEach((comment) => {
            next[comment.id] = { ...comment, isNew: indexById.get(comment.id)?.isNew }
          })
          return next
        })
        setBatchError(undefined)
      })
      .catch((err) => {
        if (generation.current === currentGeneration) setBatchError(err.message || 'Не удалось загрузить комментарии')
      })
      .finally(() => {
        if (generation.current !== currentGeneration) return
        ids.forEach((id) => pending.current.delete(id))
      })
  }, [api.post, index, indexById, loaded, postId, visibleIds, batchError, targetId])

  useEffect(() => {
    if (!targetId || !targetLoaded || !targetVisible) return
    const key = `${postId}:${targetId}:${location.hash}:${unreadOnly}`
    const element = document.querySelector<HTMLDivElement>(`[data-comment-id="${targetId}"] .commentBody`)
    if (!element) return
    element.classList.add(styles.highlight)
    if (focused.current !== key) {
      focused.current = key
      scrollUnderTopbar(element)
    }
    return () => element.classList.remove(styles.highlight)
  }, [targetLoaded, targetVisible, location.hash, postId, targetId, unreadOnly])

  const changePage = (parent: number, start: number) => {
    setPageStarts((previous) => ({ ...previous, [parent]: start }))
  }

  const pageButtons = (parent: number) => {
    const count = (childrenByParent[parent] || []).length
    const start = pageStarts[parent] || 0
    if (count <= COMMENT_PAGE_SIZE) return null
    return (
      <div className={styles.threadPages}>
        {start > 0 && (
          <Button
            variant='minimal'
            size='small'
            onClick={() => changePage(parent, Math.max(0, start - COMMENT_PAGE_SIZE))}
          >
            ← Ранее
          </Button>
        )}
        <span>
          {start + 1}–{Math.min(start + COMMENT_PAGE_SIZE, count)} из {count}
        </span>
        {start + COMMENT_PAGE_SIZE < count && (
          <Button variant='minimal' size='small' onClick={() => changePage(parent, start + COMMENT_PAGE_SIZE)}>
            Далее →
          </Button>
        )}
      </div>
    )
  }

  const handleAnswer = async (text: string, _post?: PostLinkInfo, parent?: CommentInfo) => {
    const { comment } = await api.post.comment(text, postId, parent?.id)
    const parentId = parent?.id || 0
    setIndex((previous) => [...(previous || []), { id: comment.id, ...(parent ? { parentComment: parent.id } : {}) }])
    setAddedIds((previous) => [...previous, comment.id])
    setLoaded((previous) => ({ ...previous, [comment.id]: comment }))
    if (parent) setExpanded((previous) => ({ ...previous, [parent.id]: true }))
    const siblings = (childrenByParent[parentId] || []).length
    if (parent) changePage(parentId, Math.floor(siblings / COMMENT_PAGE_SIZE) * COMMENT_PAGE_SIZE)
    setPost((previous) => previous && { ...previous, comments: previous.comments + 1 })
    api.post.read(postId, (post?.comments || 0) + 1, comment.id).catch(console.error)
    setTimeout(
      () => document.querySelector(`[data-comment-id="${comment.id}"]`)?.scrollIntoView({ block: 'nearest' }),
      100,
    )
    return parent
  }

  const handleEdit = async (text: string, comment: CommentInfo) => {
    const { comment: updated } = await api.post.editComment(text, comment.id)
    setLoaded((previous) => ({ ...previous, [comment.id]: { ...updated, isNew: previous[comment.id]?.isNew } }))
    return updated
  }

  const renderComment = (id: number, depth: number, parent?: CommentInfo, idx?: number): React.ReactNode => {
    const comment = loaded[id]
    if (!comment)
      return (
        <div key={id} className={styles.loading}>
          Загрузка комментария...
        </div>
      )
    const children = childrenByParent[id] || []
    const isExpanded = !!expanded[id]
    return (
      <CommentComponent
        key={id}
        comment={comment}
        parent={parent}
        idx={idx}
        depth={depth}
        maxTreeDepth={12}
        currentUsername={userInfo?.username}
        unreadOnly={unreadOnly}
        onAnswer={handleAnswer}
        onEdit={handleEdit}
        threaded
        threadToggle={
          children.length ? (
            <Button
              variant='minimal'
              size='small'
              className={styles.threadToggle}
              aria-expanded={isExpanded}
              onClick={() => setExpanded((previous) => ({ ...previous, [id]: !previous[id] }))}
            >
              {isExpanded ? '− Свернуть' : `+ Ответы (${children.length})`}
            </Button>
          ) : undefined
        }
        threadedChildren={
          isExpanded ? (
            <>
              {children
                .slice(pageStarts[id] || 0, (pageStarts[id] || 0) + COMMENT_PAGE_SIZE)
                .map((childId, childIndex) => renderComment(childId, depth + 1, comment, childIndex))}
              {pageButtons(id)}
            </>
          ) : undefined
        }
      />
    )
  }

  const baseRoute = site === 'main' ? '/' : `/s/${site}/`
  if (error || (!post && !index)) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {error || 'Загрузка...'}
          {error && <Button onClick={reload}>Повторить</Button>}
        </div>
      </div>
    )
  }
  if (!post) return null

  const rootIds = childrenByParent[0] || []
  return (
    <div className={styles.container}>
      <div className={styles.feed}>
        <PostComponent
          key={post.id}
          post={post}
          onChange={(_, partial) => setPost((previous) => previous && { ...previous, ...partial })}
          onEdit={async (_, text, title) => {
            const updated = await api.post.editPost(postId, title || '', text)
            setPost(updated.post)
            return updated.post
          }}
        />
        {anonymousUser && (
          <div className={styles.anon}>
            <span className='i i-anon'></span> Внимание, анонимность!
            <br />
            Комментарии в этом посте публикуются лица <Username user={anonymousUser} />.
          </div>
        )}
        <div className={styles.postButtons}>
          <Link to={`${baseRoute}p${post.id}`} className={unreadOnly ? '' : 'bold'}>
            все комментарии
          </Link>{' '}
          •{' '}
          <Link to={`${baseRoute}p${post.id}?new`} className={unreadOnly ? 'bold' : ''}>
            только новые
          </Link>
        </div>
        <div className={styles.comments + (unreadOnly ? ' unreadOnly' : '')}>
          {batchError && (
            <div className={styles.error}>
              {batchError} <Button onClick={() => setBatchError(undefined)}>Повторить</Button>
            </div>
          )}
          {rootIds.map((id, idx) => loaded[id] && renderComment(id, 0, undefined, idx))}
          {rootIds.some((id) => !loaded[id]) && (
            <div className={styles.loading}>
              Загрузка комментариев: {rootIds.filter((id) => loaded[id]).length} из {rootIds.length}
            </div>
          )}
        </div>
        <CreateCommentComponentRestricted
          parentAuthorUserName={post.author.username}
          open={true}
          post={post}
          onAnswer={handleAnswer}
          storageKey={`c:${post.id}`}
        />
      </div>
    </div>
  )
}
