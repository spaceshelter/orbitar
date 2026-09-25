import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import Button from '@ui/Button'
import classNames from 'classnames'

import { ReceivedMediaKind, UserVoteFeedEvent, UserVotesReceivedResult } from '../API/UserAPI'
import { DigestCard, DigestKarma, DigestSubject, DigestVoter, sumMinus, sumPlus } from '../Utils/receivedVotesDigest'
import { pluralize } from '../Utils/utils'
import InternalLinkExpandComponent from './InternalLinkExpandComponent'
import PostLink from './PostLink'

import styles from './ReceivedVotesDigest.module.scss'

const SUBJECTS_PER_CARD = 3
const NAMES_PER_SUBJECT = 3

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

// A post or comment without text is named by what it consists of; 'медиа' when
// that can't be told either (an embed of an unknown kind, say).
const MEDIA_LABELS: Record<ReceivedMediaKind, string> = {
  image: 'картинка',
  gif: 'гифка',
  video: 'видео',
  media: 'медиа',
}
const MEDIA_POST_TITLES: Record<ReceivedMediaKind, string> = {
  image: 'Пост с картинкой',
  gif: 'Пост с гифкой',
  video: 'Пост с видео',
  media: 'Пост с медиа',
}

// Users and subjects of the loaded pages, shared by every card of the digest.
export type DigestLookup = Pick<UserVotesReceivedResult, 'users' | 'subjects'>

export const formatVote = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0')

export const formatShortTime = (date: Date) =>
  `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}, ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`

const eventKey = (event: UserVoteFeedEvent) => `${event.type}:${event.entityId}:${event.voterId}`

// Minus voters are always named; plus voters fill the rest of the budget.
const visibleVoters = (voters: DigestVoter[]) => {
  const minus = voters.filter((voter) => voter.vote < 0)
  const plus = voters.filter((voter) => voter.vote >= 0)
  return [...minus, ...plus.slice(0, Math.max(0, NAMES_PER_SUBJECT - minus.length))]
}

// The post a discussion belongs to: its own label if it was voted on, otherwise
// the title carried by any of its comments. A name made up for a post without
// title and text is `generated`, so it is not dressed up as a quoted title.
export const discussionInfo = (lookup: DigestLookup, postId: number, events: UserVoteFeedEvent[]) => {
  const post = lookup.subjects.posts[postId]
  const comment = events
    .map((event) => (event.type === 'comment' ? lookup.subjects.comments[event.entityId] : undefined))
    .find((subject) => subject)
  const site = post?.site || comment?.site || 'main'
  const title = post?.label || comment?.postTitle
  if (title) {
    return { title, site, generated: false }
  }
  const media = post?.media || comment?.postMedia
  return { title: media ? MEDIA_POST_TITLES[media] : `пост #${postId}`, site, generated: true }
}

export function Sums({ plus, minus, size }: { plus: number; minus: number; size?: 'big' | 'small' }) {
  const sizeClass = size && styles[size]
  if (!plus && !minus) {
    return <span className={classNames(styles.value, styles.zero, sizeClass)}>0</span>
  }
  return (
    <>
      {plus > 0 && <span className={classNames(styles.value, styles.plus, sizeClass)}>{formatVote(plus)}</span>}
      {plus > 0 && minus < 0 && ' '}
      {minus < 0 && <span className={classNames(styles.value, styles.minus, sizeClass)}>{formatVote(minus)}</span>}
    </>
  )
}

export function VoterName({ lookup, voterId }: { lookup: DigestLookup; voterId: number }) {
  const user = lookup.users[voterId]
  if (!user) {
    return <span>пользователь</span>
  }
  return (
    <Link className={styles.voter} to={`/u/${user.username}`}>
      {user.username}
    </Link>
  )
}

// First names of a row, «и ещё N» opening the full timeline of its votes below.
function Voters({
  lookup,
  voters,
  events,
}: {
  lookup: DigestLookup
  voters: DigestVoter[]
  events: UserVoteFeedEvent[]
}) {
  const [open, setOpen] = useState(false)
  const mixed = voters.some((voter) => voter.vote < 0) && voters.some((voter) => voter.vote > 0)
  const shown = visibleVoters(voters)
  const rest = voters.length - shown.length
  return (
    <>
      <div className={styles.voters}>
        {shown.map((voter, index) => (
          <React.Fragment key={voter.voterId}>
            {index > 0 && ', '}
            <VoterName lookup={lookup} voterId={voter.voterId} />
            {mixed && voter.vote < 0 && (
              <>
                {' '}
                <span className={classNames(styles.value, styles.minus, styles.small)}>{formatVote(voter.vote)}</span>
              </>
            )}
          </React.Fragment>
        ))}
        {rest > 0 && (
          <>
            {' '}
            <Button
              variant='minimal'
              className={styles.moreVoters}
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              {`и ещё ${rest}`}
            </Button>
          </>
        )}
      </div>
      {open && (
        <ul className={styles.chronology}>
          {events.map((event) => (
            <li key={eventKey(event)}>
              <span className={classNames(styles.value, event.vote < 0 ? styles.minus : styles.plus, styles.small)}>
                {formatVote(event.vote)}
              </span>{' '}
              <VoterName lookup={lookup} voterId={event.voterId} />{' '}
              <time className={styles.time}>{formatShortTime(event.votedAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function SubjectRow({ lookup, subject, site }: { lookup: DigestLookup; subject: DigestSubject; site: string }) {
  const [expanded, setExpanded] = useState(false)
  const comment = subject.type === 'comment' ? lookup.subjects.comments[subject.entityId] : undefined
  const postId = comment ? comment.postId : subject.entityId
  const toggle = () => setExpanded((current) => !current)

  // Same click semantics as internal links inside content: a plain click expands
  // the post or comment in place, ctrl/cmd-click still opens it as a link.
  const expandOnClick = (event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      return
    }
    event.preventDefault()
    toggle()
  }

  const link = (className: string, text: string) => (
    <PostLink className={className} post={{ id: postId, site }} commentId={comment?.id} onClick={expandOnClick}>
      {text}
    </PostLink>
  )

  return (
    <div className={styles.subject}>
      <span
        className={classNames(
          styles.value,
          styles.subjectValue,
          subject.sum < 0 ? styles.minus : subject.sum > 0 ? styles.plus : styles.zero,
        )}
      >
        {formatVote(subject.sum)}
      </span>
      <span
        role='button'
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? 'Свернуть' : 'Развернуть'}
        className={classNames('i i-expand', styles.expandArrow, expanded && styles.expandArrowOpen)}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggle()
          }
        }}
      />
      <div className={styles.subjectMain}>
        {subject.type === 'post' ? (
          link(styles.subjectKind, 'сам пост')
        ) : comment?.excerpt ? (
          link(styles.quote, `«${comment.excerpt}»`)
        ) : (
          // Without text to quote, what the comment holds and when it was written
          // tell the rows of a picture thread apart.
          <>
            {link(styles.subjectKind, MEDIA_LABELS[comment?.media || 'media'])}
            {comment && <span className={styles.subjectTime}> · {formatShortTime(comment.created)}</span>}
          </>
        )}
        <Voters lookup={lookup} voters={subject.voters} events={subject.events} />
        {expanded && (
          <div className={styles.expandedContent}>
            <InternalLinkExpandComponent postId={postId} commentId={comment?.id} onClose={toggle} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReceivedVotesCard({ lookup, card }: { lookup: DigestLookup; card: DigestCard }) {
  const [expanded, setExpanded] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const collapsing = useRef(false)
  const events = card.subjects.flatMap((subject) => subject.events)
  const { title, site, generated } = discussionInfo(lookup, card.postId, events)
  const hidden = card.subjects.slice(SUBJECTS_PER_CARD)
  const hiddenEvents = hidden.flatMap((subject) => subject.events)
  const hiddenComments = hidden.filter((subject) => subject.type === 'comment').length
  const hiddenLabel = [
    hidden.length > hiddenComments ? 'пост' : '',
    hiddenComments ? pluralize(hiddenComments, ['комментарий', 'комментария', 'комментариев']) : '',
  ]
    .filter(Boolean)
    .join(' и ')

  // Collapsing a long card from its bottom would leave the reader far below it.
  useEffect(() => {
    if (!expanded && collapsing.current) {
      collapsing.current = false
      articleRef.current?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [expanded])

  return (
    <article className={styles.card} ref={articleRef}>
      <header className={styles.cardHeader}>
        <div className={styles.cardTitleWrap}>
          <PostLink
            className={classNames(styles.cardTitle, generated && styles.generatedTitle)}
            post={{ id: card.postId, site }}
          >
            {title}
          </PostLink>
          {site !== 'main' && <span className={styles.site}>{site}</span>}
        </div>
        <div className={styles.cardSum}>
          <Sums plus={card.plus} minus={card.minus} size='big' />
        </div>
        <div className={styles.cardMeta}>
          {card.people} чел. · {formatShortTime(card.latestAt)}
        </div>
      </header>
      {(expanded ? card.subjects : card.subjects.slice(0, SUBJECTS_PER_CARD)).map((subject) => (
        <SubjectRow key={subject.key} lookup={lookup} subject={subject} site={site} />
      ))}
      {hidden.length > 0 && (
        <Button
          variant='minimal'
          className={styles.expandCard}
          aria-expanded={expanded}
          onClick={() => {
            collapsing.current = expanded
            setExpanded(!expanded)
          }}
        >
          {expanded ? (
            'свернуть'
          ) : (
            <>
              ещё {hiddenLabel} · <Sums plus={sumPlus(hiddenEvents)} minus={sumMinus(hiddenEvents)} size='small' />
            </>
          )}
        </Button>
      )}
    </article>
  )
}

export function ReceivedKarmaCard({ lookup, karma }: { lookup: DigestLookup; karma: DigestKarma }) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardTitlePlain}>Карма профиля</span>
        <div className={styles.cardSum}>
          <Sums plus={karma.plus} minus={karma.minus} size='big' />
        </div>
      </header>
      <div className={classNames(styles.subject, styles.karmaRow)}>
        <div className={styles.subjectMain}>
          <Voters lookup={lookup} voters={karma.voters} events={karma.events} />
        </div>
      </div>
    </article>
  )
}
