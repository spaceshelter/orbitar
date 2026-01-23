import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'
import classNames from 'classnames'

import { usePost } from '../API/use/usePost'
import { useAppState } from '../AppState/AppState'
import CommentComponent from '../Components/CommentComponent'
import { CreateCommentComponentRestricted } from '../Components/CreateCommentComponent'
import PostComponent from '../Components/PostComponent'
import Username from '../Components/Username'
import { getEnableCommentNavigation } from '../Components/UserProfileSettings'
import { CommentInfo, PostInfo, PostLinkInfo } from '../Types/PostInfo'
import { scrollUnderTopbar } from '../Utils/utils'

import { ReactComponent as ChevronDown } from '../Assets/chevron-down.svg'
import { ReactComponent as ChevronUp } from '../Assets/chevron-up.svg'
import { ReactComponent as DoubleArrowDown } from '../Assets/double-arrow-down.svg'
import { ReactComponent as DoubleArrowUp } from '../Assets/double-arrow-up.svg'
import styles from './PostPage.module.css'

const TOP_BOTTOM_THRESHOLD = 1000

export default function PostPage() {
  const params = useParams<{ postId: string }>()
  const [search] = useSearchParams()
  const postId = params.postId ? parseInt(params.postId, 10) : 0
  const location = useLocation()
  const [scrolledToComment, setScrolledToComment] = useState<{ postId: number; commentId: number }>()
  const { site, userInfo } = useAppState()
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadOnly = search.get('new') !== null
  const { post, comments, anonymousUser, postComment, editComment, editPost, error, reload, updatePost } = usePost(
    site,
    postId,
    unreadOnly,
  )
  const [unreadElements, setUnreadElements] = useState<HTMLElement[]>([])
  const [currentUnreadIndex, setCurrentUnreadIndex] = useState<number>(-1)
  const [isNearTop, setIsNearTop] = useState<boolean>(true)
  const [isNearBottom, setIsNearBottom] = useState<boolean>(false)
  const isScrollingRef = useRef<boolean>(false)
  const enableCommentNavigation = getEnableCommentNavigation()

  useEffect(() => {
    let docTitle = `Пост #${postId}`
    if (post) {
      if (post.title) {
        docTitle = post.title
      }
      docTitle += ' / ' + post.author.username
    }
    document.title = docTitle
  }, [post, postId])

  // Collect unread comment elements when comments are loaded
  useEffect(() => {
    // Cleanup: remove active class from previous unread elements
    const cleanupActiveClass = () => {
      document.querySelectorAll('.isNew .commentBody').forEach((el) => {
        el.classList.remove('activeUnread')
      })
    }

    if (!comments) {
      cleanupActiveClass()
      setUnreadElements([])
      setCurrentUnreadIndex(-1)
      return
    }

    const elements: HTMLElement[] = Array.from(document.querySelectorAll('.isNew'))
    setUnreadElements(elements)

    // Initialize to first unread comment if available and not already scrolled
    if (elements.length > 0 && enableCommentNavigation) {
      cleanupActiveClass()

      if (scrolledToComment) {
        const index = elements.findIndex((el) => el.dataset.commentId === String(scrolledToComment.commentId))
        const actualIndex = index >= 0 ? index : 0
        setCurrentUnreadIndex(actualIndex)
        // Add active class to the found comment
        const element = elements[actualIndex]
        const commentBody = element.querySelector<HTMLDivElement>('.commentBody')
        if (commentBody) {
          commentBody.classList.add('activeUnread')
        }
      } else {
        setCurrentUnreadIndex(0)
        // Add active class to first unread comment
        const firstElement = elements[0]
        const commentBody = firstElement.querySelector<HTMLDivElement>('.commentBody')
        if (commentBody) {
          commentBody.classList.add('activeUnread')
        }
      }
    } else {
      cleanupActiveClass()
      setCurrentUnreadIndex(-1)
    }

    return cleanupActiveClass
  }, [comments, scrolledToComment, enableCommentNavigation])

  const handleCommentEdit = async (text: string, comment: CommentInfo) => {
    return await editComment(text, comment.id)
  }

  const handleAnswer = async (text: string, post?: PostLinkInfo, comment?: CommentInfo) => {
    if (!post) {
      return
    }

    const newComment = await postComment(text, comment?.id)
    setTimeout(() => {
      const el = document.querySelector(`div[data-comment-id="${newComment.id}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)
    return comment
  }

  useEffect(() => {
    if (!comments) {
      return
    }

    let scrollToComment: HTMLDivElement | null | undefined
    let commentId: number | undefined
    if (location.hash) {
      commentId = parseInt(location.hash.substring(1))
      scrollToComment = document.querySelector<HTMLDivElement>(`[data-comment-id="${commentId}"]`)
    } else if (unreadOnly) {
      // find first new comment
      scrollToComment = document.querySelector<HTMLDivElement>(`.isNew`)
      commentId = scrollToComment?.dataset.commentId ? parseInt(scrollToComment.dataset.commentId) : undefined
    }
    // do nothing if element is focused already
    if (
      !scrollToComment ||
      scrollToComment.className.indexOf(styles.focusing) >= 0 ||
      (scrolledToComment && scrolledToComment.postId === postId && scrolledToComment.commentId === commentId)
    ) {
      return
    }

    const commentBody = scrollToComment.querySelector<HTMLDivElement>('.commentBody')
    if (!commentBody) {
      return
    }
    const containerNode = containerRef.current
    // disable anchoring for all post&comments and anchor the comment
    containerNode?.classList.add(styles.focusing)
    scrollToComment.classList.add(styles.focused)
    commentBody.classList.add(styles.highlight)

    commentId && setScrolledToComment({ postId, commentId })

    // Update current unread index if scrolling to an unread comment
    if (enableCommentNavigation && scrollToComment.classList.contains('isNew')) {
      const allUnreadElements = Array.from(document.querySelectorAll<HTMLElement>('.isNew'))
      const index = allUnreadElements.findIndex((el) => el.dataset.commentId === scrollToComment?.dataset.commentId)
      if (index !== -1) {
        setCurrentUnreadIndex(index)
      }
    }

    scrollUnderTopbar(commentBody)

    return () => {
      commentBody.classList.remove(styles.highlight)
      containerNode?.classList.remove(styles.focusing)
      scrollToComment?.classList.remove(styles.focused)
    }
  }, [location.hash, comments, unreadOnly, postId])

  const handlePostEdit = async (post: PostInfo, text: string, title?: string): Promise<PostInfo | undefined> => {
    return await editPost(title || '', text)
  }

  // Navigation functions for unread comments (based on reference algorithm)
  const goToNextUnread = useCallback(() => {
    if (unreadElements.length === 0 || currentUnreadIndex < 0) return

    if (currentUnreadIndex >= 0 && currentUnreadIndex < unreadElements.length - 1) {
      // Remove active class from current element
      const currentElement = unreadElements[currentUnreadIndex]
      const currentCommentBody = currentElement.querySelector<HTMLDivElement>('.commentBody')
      if (currentCommentBody) {
        currentCommentBody.classList.remove('activeUnread')
      }

      // Move to next
      const nextIndex = currentUnreadIndex + 1
      const nextElement = unreadElements[nextIndex]
      const nextCommentBody = nextElement.querySelector<HTMLDivElement>('.commentBody')

      if (nextCommentBody) {
        // Add active class to next element
        nextCommentBody.classList.add('activeUnread')

        // Scroll to element
        nextCommentBody.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'start',
        })

        // Wait for scroll to complete before updating state
        // Use a timeout that's longer than the smooth scroll duration
        setTimeout(() => {
          setCurrentUnreadIndex(nextIndex)
          const commentId = nextElement.dataset.commentId
          if (commentId) {
            setScrolledToComment({ postId, commentId: parseInt(commentId, 10) })
          }
        }, 500)
      }
    }
  }, [unreadElements, currentUnreadIndex, postId])

  const goToPreviousUnread = useCallback(() => {
    if (unreadElements.length === 0 || currentUnreadIndex < 0) return

    if (currentUnreadIndex > 0) {
      // Remove active class from current element
      const currentElement = unreadElements[currentUnreadIndex]
      const currentCommentBody = currentElement.querySelector<HTMLDivElement>('.commentBody')
      if (currentCommentBody) {
        currentCommentBody.classList.remove('activeUnread')
      }

      // Move to previous
      const prevIndex = currentUnreadIndex - 1
      const prevElement = unreadElements[prevIndex]
      const prevCommentBody = prevElement.querySelector<HTMLDivElement>('.commentBody')

      if (prevCommentBody) {
        // Add active class to previous element
        prevCommentBody.classList.add('activeUnread')

        // Scroll to element
        prevCommentBody.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'start',
        })

        // Wait for scroll to complete before updating state
        // Use a timeout that's longer than the smooth scroll duration
        setTimeout(() => {
          setCurrentUnreadIndex(prevIndex)
          const commentId = prevElement.dataset.commentId
          if (commentId) {
            setScrolledToComment({ postId, commentId: parseInt(commentId, 10) })
          }
        }, 500)
      }
    }
  }, [unreadElements, currentUnreadIndex, postId])

  // Keyboard navigation for unread comments (J = next, K = previous)
  useEffect(() => {
    if (!enableCommentNavigation || unreadElements.length === 0) return

    const handleKeyUp = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement
      // Don't trigger if user is typing in a textarea or input
      if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
        return
      }

      if (e.code === 'KeyJ') {
        goToNextUnread()
      } else if (e.code === 'KeyK') {
        goToPreviousUnread()
      }
    }

    document.addEventListener('keyup', handleKeyUp)
    return () => document.removeEventListener('keyup', handleKeyUp)
  }, [goToNextUnread, goToPreviousUnread, unreadElements.length, enableCommentNavigation])

  // Track scroll position to disable buttons near top/bottom
  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) return

      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      setIsNearTop(scrollTop < TOP_BOTTOM_THRESHOLD)
      setIsNearBottom(scrollTop + clientHeight > scrollHeight - TOP_BOTTOM_THRESHOLD)
    }

    // Initial check
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to top/bottom functions
  const scrollToTop = () => {
    isScrollingRef.current = true
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // Wait after scroll completes
    const intervalId = setInterval(() => {
      // Force state update after scroll
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight

      if (scrollTop !== 0) return

      isScrollingRef.current = false
      clearInterval(intervalId)

      setIsNearTop(scrollTop < TOP_BOTTOM_THRESHOLD)
      setIsNearBottom(scrollTop + clientHeight > scrollHeight - TOP_BOTTOM_THRESHOLD)
    }, 100)
  }

  const scrollToBottom = () => {
    isScrollingRef.current = true
    const scrollHeight = document.documentElement.scrollHeight

    window.scrollTo({ top: scrollHeight, behavior: 'smooth' })

    // Wait after scroll completes
    const intervalId = setInterval(() => {
      // Force state update after scroll
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const clientHeight = window.innerHeight

      if (scrollTop + clientHeight !== scrollHeight) return

      isScrollingRef.current = false
      clearInterval(intervalId)

      setIsNearTop(scrollTop < TOP_BOTTOM_THRESHOLD)
      setIsNearBottom(scrollTop + clientHeight > scrollHeight - TOP_BOTTOM_THRESHOLD)
    }, 100)
  }

  const baseRoute = site === 'main' ? '/' : `/s/${site}/`

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.feed}>
        {post ? (
          <div>
            <PostComponent
              key={post.id}
              post={post}
              onChange={(_, partial) => updatePost(partial)}
              onEdit={handlePostEdit}
            />
            {anonymousUser && (
              <div className={styles.anon}>
                <span className={'i i-anon'}></span> Внимание, анонимность!
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
              {comments ? (
                comments.map((comment) => (
                  <CommentComponent
                    maxTreeDepth={12}
                    key={comment.id}
                    comment={comment}
                    onAnswer={handleAnswer}
                    unreadOnly={unreadOnly}
                    onEdit={handleCommentEdit}
                    currentUsername={userInfo?.username}
                  />
                ))
              ) : error ? (
                <div className={styles.error}>
                  {error}
                  <div>
                    <Button onClick={() => reload(unreadOnly)}>Повторить</Button>
                  </div>
                </div>
              ) : (
                <div className={styles.loading}>Загрузка...</div>
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
        ) : error ? (
          <div className={styles.error}>
            {error}
            <div>
              <Button onClick={() => reload(unreadOnly)}>Повторить</Button>
            </div>
          </div>
        ) : (
          <div className={styles.loading}>Загрузка...</div>
        )}
      </div>

      {/* Navigation buttons for unread comments */}
      {enableCommentNavigation && unreadElements.length > 0 && (
        <div className={styles.unreadNavContainer}>
          <Button
            onClick={goToPreviousUnread}
            className={classNames(styles.unreadNav, styles.unreadNavPrev)}
            aria-label='Предыдущий непрочитанный комментарий'
            disabled={currentUnreadIndex <= 0}
          >
            <ChevronUp />
          </Button>

          <Button
            onClick={goToNextUnread}
            className={classNames(styles.unreadNav, styles.unreadNavNext)}
            aria-label='Следующий непрочитанный комментарий'
            disabled={currentUnreadIndex >= unreadElements.length - 1}
          >
            <ChevronDown />
          </Button>
        </div>
      )}

      {/* Scroll to top/bottom buttons */}
      <div className={styles.scrollButtons}>
        <Button
          onClick={scrollToTop}
          className={classNames(styles.scrollButton, styles.scrollButtonTop)}
          aria-label='Прокрутить наверх'
          disabled={isNearTop}
        >
          <DoubleArrowUp />
        </Button>
        <Button
          onClick={scrollToBottom}
          className={classNames(styles.scrollButton, styles.scrollButtonBottom)}
          aria-label='Прокрутить вниз'
          disabled={isNearBottom}
        >
          <DoubleArrowDown />
        </Button>
      </div>
    </div>
  )
}
