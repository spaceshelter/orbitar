import { RefObject, useCallback, useEffect, useRef } from 'react'

import { useAppState } from '../../AppState/AppState'
import { CommentInfo } from '../../Types/PostInfo'
import { computeReadProgress } from '../../Utils/readProgress'

// Progress is flushed this long after the last comment scrolled into view, so that one swipe
// through a dozen comments costs one request instead of a dozen.
const FLUSH_DELAY = 1000

/**
 * Marks comments as read as they are scrolled into view, instead of when the post is opened.
 *
 * Opening a post used to spend its whole unread state, so `?new` only ever worked once: the very
 * visit that showed the new comments also cleared them, and a misclick before reading them lost
 * them for good. Now whatever the reader did not reach stays new.
 *
 * @param allComments   every loaded comment, used to compute the prefix (in `?new` mode the
 *                      rendered subset alone cannot tell where the prefix currently ends)
 * @param renderedComments  the comments actually in the DOM, used to (re)attach the observer
 */
export function useReadProgress(
  postId: number,
  allComments: CommentInfo[] | undefined,
  renderedComments: CommentInfo[] | undefined,
  containerRef: RefObject<HTMLElement>,
) {
  const { api } = useAppState()
  const allCommentsRef = useRef(allComments)
  const seenRef = useRef(new Set<number>())
  // prefix last handed to the backend; -1 so that the first flush always goes through, which is
  // what clears the post's notifications
  const sentRef = useRef(-1)
  const timerRef = useRef<number>()

  useEffect(() => {
    seenRef.current = new Set<number>()
    sentRef.current = -1
  }, [postId])

  useEffect(() => {
    allCommentsRef.current = allComments
  }, [allComments])

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current)
    const comments = allCommentsRef.current
    if (!comments) {
      return
    }
    const { lastCommentId, readComments } = computeReadProgress(comments, seenRef.current)
    if (lastCommentId <= sentRef.current) {
      return
    }
    sentRef.current = lastCommentId
    api.post.read(postId, readComments, lastCommentId || undefined).then()
  }, [api, postId])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !renderedComments) {
      return
    }
    // a comment hidden behind the topbar is not on screen yet
    const topbarHeight = document.getElementById('topbar')?.clientHeight || 0
    const observer = new IntersectionObserver(
      (entries) => {
        let advanced = false
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          observer.unobserve(entry.target)
          const commentId = parseInt((entry.target as HTMLElement).dataset.commentId || '', 10)
          if (commentId && !seenRef.current.has(commentId)) {
            seenRef.current.add(commentId)
            advanced = true
          }
        }
        if (advanced) {
          window.clearTimeout(timerRef.current)
          timerRef.current = window.setTimeout(flush, FLUSH_DELAY)
        }
      },
      { rootMargin: `-${topbarHeight}px 0px 0px 0px` },
    )
    // `div.comment`, not just `[data-comment-id]`: the parser puts that attribute on the expand
    // button of an inline comment link too, and such a link may well point into this very post
    container.querySelectorAll('div.comment[data-comment-id]').forEach((comment) => observer.observe(comment))
    return () => observer.disconnect()
  }, [renderedComments, containerRef, flush])

  // report what the backend already knows as soon as the post loads - the bookmark does not move,
  // but the post's notifications are cleared, as they were before
  useEffect(() => {
    flush()
  }, [allComments, flush])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flush()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
      // leaving the post: save whatever the debounce still holds
      flush()
    }
  }, [flush])
}
