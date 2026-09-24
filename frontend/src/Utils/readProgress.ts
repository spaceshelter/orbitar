import { CommentInfo } from '../Types/PostInfo'

export type ReadProgress = {
  /** Last comment of the continuous read prefix, 0 when nothing is read yet. */
  lastCommentId: number
  /** How many comments that prefix covers, including own comments above it. */
  readComments: number
}

function flatten(comments: CommentInfo[], into: CommentInfo[]): CommentInfo[] {
  for (const comment of comments) {
    into.push(comment)
    if (comment.answers) {
      flatten(comment.answers, into)
    }
  }
  return into
}

/**
 * Works out how far the read bookmark of a post may be advanced.
 *
 * The bookmark is a prefix - `last_read_comment_id` plus the number of comments at or below it -
 * so a comment only counts as read once every older comment counts as read as well. Reading out
 * of order advances nothing until the gap in front of it is filled, which is deliberate: the
 * prefix must never claim that an unreached comment has been read.
 *
 * A comment counts as read when it has been on screen (`seen`), or when the backend already
 * treats it as read - `isNew` is set only for comments above the bookmark that the reader did
 * not write themselves.
 */
export function computeReadProgress(comments: CommentInfo[], seen: Set<number>): ReadProgress {
  const all = flatten(comments, []).sort((a, b) => a.id - b.id)

  let lastCommentId = 0
  for (const comment of all) {
    if (comment.isNew && !seen.has(comment.id)) {
      break
    }
    lastCommentId = comment.id
  }

  // same set the backend counts: everything up to the prefix, plus own comments after it
  const readComments = all.filter((comment) => comment.id <= lastCommentId || !comment.isNew).length

  return { lastCommentId, readComments }
}
