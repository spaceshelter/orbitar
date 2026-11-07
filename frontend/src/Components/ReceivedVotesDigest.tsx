import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'
import Select from '@ui/Select'
import classNames from 'classnames'
import moment from 'moment'
import { flushSync } from 'react-dom'

import { useVoteFeedPages } from '../API/use/useVoteFeedPages'
import { getVoteEventKey, ReceivedVoteType, UserVoteFeedEvent, UserVotesReceivedResult } from '../API/UserAPI'
import { useAPI } from '../AppState/AppState'
import {
  buildReceivedDigest,
  countPeople,
  getPeriodOptions,
  getPeriodSince,
  getWiderPeriod,
  limitPeriod,
  orderVoters,
  subjectsOf,
  sumMinus,
  sumPlus,
  VoteGroup,
  VotePeriod,
  VoteSign,
} from '../Utils/receivedVotesDigest'
import { pluralize } from '../Utils/utils'
import InternalLinkExpandComponent from './InternalLinkExpandComponent'
import PostLink from './PostLink'

import feedStyles from '../Pages/FeedPage.module.scss'
import styles from './ReceivedVotesDigest.module.scss'
import votesStyles from './UserProfileVotes.module.scss'

const PAGE_SIZE = 200
// Periods up to a month load this many pages on their own; longer periods and later pages load on demand.
const AUTO_FOLLOW_PAGES = 5
const DEFAULT_PERIOD: VotePeriod = '2weeks'
const SUBJECTS_PER_CARD = 3
const NAMES_PER_SUBJECT = 3

type TypeFilter = 'all' | ReceivedVoteType
type Lookup = Pick<UserVotesReceivedResult, 'users' | 'subjects'>

const TYPES: TypeFilter[] = ['all', 'comment', 'post', 'user']

const PERIOD_LABELS: Record<VotePeriod, string> = {
  week: 'За неделю',
  '2weeks': 'За 2 недели',
  month: 'За месяц',
  year: 'За год',
  all: 'За всё время',
}

const WHAT_OPTIONS = [
  { sign: 'all', label: 'Плюсы и минусы', names: ['Все оценки', 'Комментарии', 'Посты', 'Карма'] },
  {
    sign: 'minus',
    label: 'Только минусы',
    names: ['Все минусы', 'Минусы за комментарии', 'Минусы за посты', 'Минусы в карму'],
  },
].map(({ sign, label, names }) => ({
  label,
  options: TYPES.map((type, index) => ({ value: `${sign}:${type}`, label: names[index] })),
}))

const readFilters = (params: URLSearchParams) => {
  const sign: VoteSign = params.get('sign') === 'minus' ? 'minus' : 'all'
  const type = TYPES.find((value) => value === params.get('what')) || 'all'
  const period = getPeriodOptions('all').find((value) => value === params.get('period')) || DEFAULT_PERIOD
  return { type, sign, period: limitPeriod(period, sign) }
}

const formatVote = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0')

const formatTime = (date: Date) => moment(date).format('D MMM, HH:mm')

// A name made up for a post without a label, or for a missing post, is `generated` and not quoted.
const discussionInfo = (lookup: Lookup, postId: number) => {
  const post = lookup.subjects.posts[postId]
  return post?.label
    ? { title: post.label, site: post.site, generated: false }
    : { title: post ? 'Пост с медиа' : `пост #${postId}`, site: post?.site || 'main', generated: true }
}

const Vote = ({ value, size, className }: { value: number; size?: 'big' | 'small'; className?: string }) => (
  <span
    className={classNames(
      styles.value,
      value > 0 ? styles.plus : value < 0 ? styles.minus : styles.zero,
      size && styles[size],
      className,
    )}
  >
    {formatVote(value)}
  </span>
)

function Sums({ events, size }: { events: UserVoteFeedEvent[]; size?: 'big' | 'small' }) {
  const [plus, minus] = [sumPlus(events), sumMinus(events)]
  if (!plus && !minus) return <Vote value={0} size={size} />
  return (
    <>
      {plus > 0 && <Vote value={plus} size={size} />}
      {plus > 0 && minus < 0 && ' '}
      {minus < 0 && <Vote value={minus} size={size} />}
    </>
  )
}

function VoterName({ lookup, voterId }: { lookup: Lookup; voterId: number }) {
  const username = lookup.users[voterId]?.username
  return username ? <Link to={`/u/${username}`}>{username}</Link> : <span>пользователь</span>
}

function Voters({ lookup, events }: { lookup: Lookup; events: UserVoteFeedEvent[] }) {
  const [open, setOpen] = useState(false)
  const voters = orderVoters(events)
  const minus = voters.filter((voter) => voter.vote < 0).length
  // Minus voters are always named; plus voters fill the rest of the budget.
  const shown = voters.slice(0, Math.max(NAMES_PER_SUBJECT, minus))
  return (
    <>
      <div className={styles.voters}>
        {shown.map((voter, index) => (
          <React.Fragment key={voter.voterId}>
            {index > 0 && ', '}
            <VoterName lookup={lookup} voterId={voter.voterId} />
            {voter.vote < 0 && minus < voters.length && (
              <>
                {' '}
                <Vote value={voter.vote} size='small' />
              </>
            )}
          </React.Fragment>
        ))}
        {voters.length > shown.length && (
          <>
            {' '}
            <Button variant='minimal' className={styles.moreVoters} aria-expanded={open} onClick={() => setOpen(!open)}>
              {`и ещё ${voters.length - shown.length}`}
            </Button>
          </>
        )}
      </div>
      {open && (
        <ul className={styles.chronology}>
          {events.map((event) => (
            <li key={getVoteEventKey(event)}>
              <Vote value={event.vote} size='small' /> <VoterName lookup={lookup} voterId={event.voterId} />{' '}
              <time className={styles.time}>{formatTime(event.votedAt)}</time>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function SubjectRow({ lookup, subject, site }: { lookup: Lookup; subject: VoteGroup; site: string }) {
  const [expanded, setExpanded] = useState(false)
  const { type, entityId } = subject.events[0]
  const comment = type === 'comment' ? lookup.subjects.comments[entityId] : undefined
  const postId = comment ? comment.postId : entityId
  const toggle = () => setExpanded(!expanded)
  // Like internal links in content: a click expands in place, ctrl/cmd-click still opens.
  const link = (className: string, text: string) => (
    <PostLink
      className={className}
      post={{ id: postId, site }}
      commentId={comment?.id}
      onClick={(event: React.MouseEvent) => {
        if (event.ctrlKey || event.metaKey) return
        event.preventDefault()
        toggle()
      }}
    >
      {text}
    </PostLink>
  )
  return (
    <div className={styles.subject}>
      <Vote value={subject.events.reduce((sum, event) => sum + event.vote, 0)} className={styles.subjectValue} />
      <span
        role='button'
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? 'Свернуть' : 'Развернуть'}
        className={classNames('i i-expand', styles.expandArrow, expanded && styles.expandArrowOpen)}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle()
        }}
      />
      <div className={styles.subjectMain}>
        {type === 'post' && link(styles.subjectKind, 'сам пост')}
        {comment?.excerpt && link(styles.quote, `«${comment.excerpt}»`)}
        {/* Without text to quote, the time tells the rows of a picture thread apart. */}
        {type === 'comment' && !comment?.excerpt && (
          <>
            {link(styles.subjectKind, 'медиа')}
            {comment && <span className={styles.subjectTime}> · {formatTime(comment.created)}</span>}
          </>
        )}
        <Voters lookup={lookup} events={subject.events} />
        {expanded && (
          <div className={styles.expandedContent}>
            <InternalLinkExpandComponent postId={postId} commentId={comment?.id} onClose={toggle} />
          </div>
        )}
      </div>
    </div>
  )
}

function DiscussionCard({ lookup, discussion }: { lookup: Lookup; discussion: VoteGroup<number> }) {
  const [expanded, setExpanded] = useState(false)
  const articleRef = useRef<HTMLElement>(null)
  const { key: postId, events } = discussion
  const { title, site, generated } = discussionInfo(lookup, postId)
  const subjects = subjectsOf(events)
  const hidden = subjects.slice(SUBJECTS_PER_CARD)
  const hiddenComments = hidden.filter((subject) => subject.events[0].type === 'comment').length
  const hiddenLabel = [
    hidden.length > hiddenComments && 'пост',
    hiddenComments > 0 && pluralize(hiddenComments, ['комментарий', 'комментария', 'комментариев']),
  ]
    .filter(Boolean)
    .join(' и ')
  return (
    <article className={styles.card} ref={articleRef}>
      <header className={styles.cardHeader}>
        <div className={styles.cardTitleWrap}>
          <PostLink
            className={classNames(styles.cardTitle, generated && styles.generatedTitle)}
            post={{ id: postId, site }}
          >
            {title}
          </PostLink>
          {site !== 'main' && <span className={styles.site}>{site}</span>}
        </div>
        <div className={styles.cardSum}>
          <Sums events={events} size='big' />
        </div>
        <div className={styles.cardMeta}>
          {countPeople(events)} чел. · {formatTime(events[0].votedAt)}
        </div>
      </header>
      {(expanded ? subjects : subjects.slice(0, SUBJECTS_PER_CARD)).map((subject) => (
        <SubjectRow key={subject.key} lookup={lookup} subject={subject} site={site} />
      ))}
      {hidden.length > 0 && (
        <Button
          variant='minimal'
          className={styles.expandCard}
          aria-expanded={expanded}
          onClick={() => {
            // Collapsing a long card from its bottom would leave the reader far below it.
            flushSync(() => setExpanded(!expanded))
            if (expanded) articleRef.current?.scrollIntoView?.({ block: 'nearest' })
          }}
        >
          {expanded ? (
            'свернуть'
          ) : (
            <>
              ещё {hiddenLabel} · <Sums events={hidden.flatMap((subject) => subject.events)} size='small' />
            </>
          )}
        </Button>
      )}
    </article>
  )
}

function KarmaCard({ lookup, events }: { lookup: Lookup; events: UserVoteFeedEvent[] }) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardTitlePlain}>Карма профиля</span>
        <div className={styles.cardSum}>
          <Sums events={events} size='big' />
        </div>
      </header>
      <div className={classNames(styles.subject, styles.karmaRow)}>
        <Voters lookup={lookup} events={events} />
      </div>
    </article>
  )
}

function DigestTail({ lookup, tail, partial }: { lookup: Lookup; tail: VoteGroup<number>[]; partial: boolean }) {
  return (
    <div className={styles.tail}>
      <span className={styles.tailHead}>
        {partial ? 'Пока по' : 'По'} 1–2 оценки в {pluralize(tail.length, ['обсуждении', 'обсуждениях', 'обсуждениях'])}{' '}
        <Sums events={tail.flatMap((item) => item.events)} size='small' />:
      </span>{' '}
      {tail.map(({ key: postId, events }, index) => {
        const { title, site, generated } = discussionInfo(lookup, postId)
        // The sum and «·» share the title's item, so no line starts with them.
        return (
          <React.Fragment key={postId}>
            <span className={styles.tailItem}>
              <PostLink
                className={classNames(styles.tailLink, generated && styles.generatedTitle)}
                post={{ id: postId, site }}
              >
                {generated ? title : `«${title}»`}
              </PostLink>
              {' '}
              <Sums events={events} size='small' />
              {index < tail.length - 1 && ' ·'}
            </span>{' '}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const RetryError = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <>
    <div className={styles.errorText} role='alert'>
      {error}
    </div>
    <Button variant='ghost' className={styles.widenButton} onClick={onRetry}>
      Повторить
    </Button>
  </>
)

export default function ReceivedVotesDigest() {
  const api = useAPI()
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const { type, sign, period } = filters
  const long = period === 'year' || period === 'all'

  // The window ends when the filters are chosen; later pages and the section labels share it.
  const { now, query } = useMemo(() => {
    const now = new Date()
    const type = filters.type === 'all' ? undefined : filters.type
    return { now, query: { type, sign: sign === 'minus' ? sign : undefined, since: getPeriodSince(period, now) } }
  }, [filters.type, sign, period])
  const fetchPage = useCallback(
    (cursor: string | undefined, signal: AbortSignal) =>
      api.userAPI.receivedVotes({ ...query, cursor, perpage: PAGE_SIZE }, signal),
    [api.userAPI, query],
  )
  const { feed, loading, loadingMore, error, loadMoreError, loadMore, retry } = useVoteFeedPages(fetchPage, {
    tables: 'subjects',
    timeoutError: 'Запрос оказался слишком тяжёлым — сузьте период.',
    followPages: long ? 1 : AUTO_FOLLOW_PAGES,
  })
  const failure = error || loadMoreError
  const digest = useMemo(
    () =>
      feed ? buildReceivedDigest(feed.events, { granularity: long ? 'month' : 'week', since: query.since, now }) : [],
    [feed, long, query, now],
  )

  const writeFilters = (changes: Partial<typeof filters>) => {
    const next = { ...filters, ...changes }
    const nextPeriod = limitPeriod(next.period, next.sign)
    setSearchParams({
      tab: 'received',
      ...(next.type !== 'all' && { what: next.type }),
      ...(next.sign !== 'all' && { sign: next.sign }),
      ...(nextPeriod !== DEFAULT_PERIOD && { period: nextPeriod }),
    })
  }

  const periodOptions = getPeriodOptions(sign).map((value) => ({ value, label: PERIOD_LABELS[value] }))
  const events = feed?.events || []
  const filtered = type !== 'all' || sign !== 'all'
  const wider = getWiderPeriod(period, sign)
  const widenButton = wider && (
    <Button variant='ghost' className={styles.widenButton} onClick={() => writeFilters({ period: wider })}>
      {`Показать ${PERIOD_LABELS[wider].toLowerCase()}`}
    </Button>
  )
  // Pages arrive newest first, so only the oldest loaded section can be missing
  // votes: while more are coming it is held back, afterwards it is marked.
  const incomplete = !!feed?.hasMore
  const sections = loading && incomplete ? digest.slice(0, -1) : digest
  const partialKey = !loading && incomplete ? digest[digest.length - 1]?.key : undefined

  return (
    <div className={feedStyles.container}>
      <div className={styles.filters}>
        <Select
          className={styles.filterSelect}
          aria-label='Какие оценки показывать'
          value={`${sign}:${type}`}
          options={WHAT_OPTIONS}
          onChange={(value) => {
            const [nextSign, nextType] = value.split(':') as [VoteSign, TypeFilter]
            writeFilters({ sign: nextSign, type: nextType })
          }}
        />
        <Select
          className={styles.filterSelect}
          aria-label='Период'
          value={period}
          options={sign === 'minus' ? [{ label: 'Минусы — не дальше месяца', options: periodOptions }] : periodOptions}
          onChange={(value) => writeFilters({ period: value as VotePeriod })}
        />
      </div>

      <span className={votesStyles.srOnly} role='status' aria-live='polite'>
        {loading
          ? 'Загружаются оценки'
          : failure
            ? ''
            : `Показано ${pluralize(events.length, ['оценка', 'оценки', 'оценок'])}${incomplete ? ', есть ещё' : ''}`}
      </span>

      <div className={feedStyles.feed} aria-busy={loading || loadingMore}>
        {loading && !feed && <div className={feedStyles.loading}></div>}
        {failure && !feed && (
          <div className={styles.empty}>
            <RetryError error={failure} onRetry={retry} />
          </div>
        )}
        {!loading && !failure && feed && !events.length && (
          <div className={styles.empty}>
            <div>
              {period === 'all'
                ? `${filtered ? 'Таких оценок' : 'Оценок'} пока нет.`
                : `${PERIOD_LABELS[period]} ${filtered ? 'таких оценок' : 'оценок'} не было.`}
            </div>
            {widenButton}
          </div>
        )}
        {feed &&
          sections.map((section) => (
            <section className={styles.section} key={section.key}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{section.label}</h3>
                <div className={styles.sectionSum}>
                  <Sums events={section.events} />
                  <span className={styles.meta}>· {countPeople(section.events)} чел.</span>
                </div>
              </div>
              {section.key === partialKey && (
                <div className={styles.sectionNote}>Загружена только часть оценок за эти дни.</div>
              )}
              {section.cards.map((card) => (
                <DiscussionCard key={card.key} lookup={feed} discussion={card} />
              ))}
              {section.karma.length > 0 && <KarmaCard lookup={feed} events={section.karma} />}
              {section.tail.length > 0 && (
                <DigestTail lookup={feed} tail={section.tail} partial={section.key === partialKey} />
              )}
            </section>
          ))}
        {loading && (
          <div className={styles.skeleton} aria-hidden='true'>
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
        )}
        {!loading && events.length > 0 && (
          <div className={styles.footer}>
            {failure ? (
              <RetryError error={failure} onRetry={retry} />
            ) : incomplete && feed?.nextCursor ? (
              <Button variant='ghost' className={styles.widenButton} onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Загружается...' : 'Показать ещё'}
              </Button>
            ) : (
              widenButton
            )}
          </div>
        )}
      </div>
    </div>
  )
}
