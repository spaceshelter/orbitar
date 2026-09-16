import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'
import classNames from 'classnames'

import { APIError } from '../API/APIBase'
import { ReceivedVotesQuery, ReceivedVoteType, UserVoteFeedEvent, UserVotesReceivedResult } from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import {
  buildReceivedDigest,
  DigestCard,
  DigestSection,
  DigestSubject,
  DigestVoter,
  getPeriodSince,
  getWiderPeriod,
  VotePeriod,
} from '../Utils/receivedVotesDigest'
import { pluralize } from '../Utils/utils'
import InternalLinkExpandComponent from './InternalLinkExpandComponent'
import PostLink from './PostLink'

import feedStyles from '../Pages/FeedPage.module.scss'
import styles from './ReceivedVotesDigest.module.scss'

const PAGE_SIZE = 200
// Bounded windows are loaded to the end automatically so section sums are exact;
// past this many pages, and for year/all-time, further pages load on demand.
const AUTO_FOLLOW_PAGES = 5
const SUBJECTS_PER_CARD = 3
const NAMES_PER_SUBJECT = 3
const DEFAULT_PERIOD: VotePeriod = '2weeks'

type TypeFilter = 'all' | ReceivedVoteType
type SignFilter = 'all' | 'minus'
type MenuName = 'what' | 'period'
type Filters = { type: TypeFilter; sign: SignFilter; period: VotePeriod }

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'Всё' },
  { value: 'comment', label: 'Комментарии' },
  { value: 'post', label: 'Посты' },
  { value: 'user', label: 'Карма' },
]

const SIGN_OPTIONS: Array<{ value: SignFilter; label: string }> = [
  { value: 'all', label: 'Плюсы и минусы' },
  { value: 'minus', label: 'Только минусы' },
]

const PERIOD_OPTIONS: Array<{ value: VotePeriod; label: string }> = [
  { value: 'week', label: 'За неделю' },
  { value: '2weeks', label: 'За 2 недели' },
  { value: 'month', label: 'За месяц' },
  { value: 'year', label: 'За год' },
  { value: 'all', label: 'За всё время' },
]

const WHAT_LABELS: Record<SignFilter, Record<TypeFilter, string>> = {
  all: { all: 'Все оценки', comment: 'Комментарии', post: 'Посты', user: 'Карма' },
  minus: { all: 'Только минусы', comment: 'Минусы за комментарии', post: 'Минусы за посты', user: 'Минусы в карму' },
}

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const readFilters = (params: URLSearchParams): Filters => {
  const what = params.get('what')
  const period = params.get('period')
  return {
    type: what === 'comment' || what === 'post' || what === 'user' ? what : 'all',
    sign: params.get('sign') === 'minus' ? 'minus' : 'all',
    period: period === 'week' || period === 'month' || period === 'year' || period === 'all' ? period : DEFAULT_PERIOD,
  }
}

const periodLabel = (period: VotePeriod) =>
  PERIOD_OPTIONS.find((option) => option.value === period)?.label || PERIOD_OPTIONS[1].label

const formatVote = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0')

const formatShortTime = (date: Date) =>
  `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}, ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`

const eventKey = (event: UserVoteFeedEvent) => `${event.type}:${event.entityId}:${event.voterId}`

const mergePages = (current: UserVotesReceivedResult, next: UserVotesReceivedResult): UserVotesReceivedResult => {
  const known = new Set(current.events.map(eventKey))
  return {
    direction: 'received',
    events: [...current.events, ...next.events.filter((event) => !known.has(eventKey(event)))],
    users: { ...current.users, ...next.users },
    subjects: {
      posts: { ...current.subjects.posts, ...next.subjects.posts },
      comments: { ...current.subjects.comments, ...next.subjects.comments },
    },
    hasMore: next.hasMore,
    nextCursor: next.nextCursor,
  }
}

const toggleKey = (set: Set<string>, key: string) => {
  const next = new Set(set)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}

// Minus voters are always named; plus voters fill the rest of the budget.
const visibleVoters = (voters: DigestVoter[]) => {
  const minus = voters.filter((voter) => voter.vote < 0)
  const plus = voters.filter((voter) => voter.vote >= 0)
  return [...minus, ...plus.slice(0, Math.max(0, NAMES_PER_SUBJECT - minus.length))]
}

function Sums({ plus, minus, size }: { plus: number; minus: number; size?: 'big' | 'small' }) {
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

export default function ReceivedVotesDigest() {
  const api = useAPI()
  const { userInfo } = useAppState()
  const sessionUserId = userInfo?.id
  const [searchParams, setSearchParams] = useSearchParams()
  const { type, sign, period } = readFilters(searchParams)

  const [feed, setFeed] = useState<UserVotesReceivedResult>()
  const [periodWindow, setPeriodWindow] = useState<{ since?: Date; now: Date }>({ now: new Date() })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [openMenu, setOpenMenu] = useState<MenuName>()
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => new Set())
  const [expandedVoters, setExpandedVoters] = useState<Set<string>>(() => new Set())
  const [expandedContent, setExpandedContent] = useState<Set<string>>(() => new Set())
  const filtersRef = useRef<HTMLDivElement>(null)
  const queryRef = useRef<ReceivedVotesQuery>({ perpage: PAGE_SIZE })
  const loadMoreAbortRef = useRef<AbortController>()

  useEffect(() => {
    const abortController = new AbortController()
    loadMoreAbortRef.current?.abort()
    const now = new Date()
    const since = getPeriodSince(period, now)
    const query: ReceivedVotesQuery = {
      type: type === 'all' ? undefined : type,
      sign: sign === 'minus' ? 'minus' : undefined,
      since,
      perpage: PAGE_SIZE,
    }
    const bounded = period !== 'year' && period !== 'all'
    queryRef.current = query
    setPeriodWindow({ since, now })
    setFeed(undefined)
    setLoading(true)
    setLoadingMore(false)
    setError(undefined)
    setExpandedCards(new Set())
    setExpandedVoters(new Set())
    setExpandedContent(new Set())

    const load = async () => {
      let result = await api.userAPI.receivedVotes(query, abortController.signal)
      for (let pages = 1; bounded && result.hasMore && result.nextCursor && pages < AUTO_FOLLOW_PAGES; pages++) {
        if (abortController.signal.aborted) {
          return
        }
        setFeed(result)
        const next = await api.userAPI.receivedVotes({ ...query, cursor: result.nextCursor }, abortController.signal)
        result = mergePages(result, next)
      }
      if (!abortController.signal.aborted) {
        setFeed(result)
        setLoading(false)
      }
    }

    load().catch((err) => {
      if (abortController.signal.aborted) {
        return
      }
      setError(
        err instanceof APIError && err.code === 'filter-timeout'
          ? 'Запрос оказался слишком тяжёлым — сузьте период.'
          : 'Не удалось загрузить оценки',
      )
      setLoading(false)
    })

    return () => {
      abortController.abort()
      loadMoreAbortRef.current?.abort()
    }
  }, [api.userAPI, sessionUserId, type, sign, period])

  useEffect(() => {
    if (!openMenu) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(undefined)
      }
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) {
        setOpenMenu(undefined)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [openMenu])

  const digest = useMemo<DigestSection[]>(
    () =>
      feed
        ? buildReceivedDigest(feed.events, {
            granularity: period === 'year' || period === 'all' ? 'month' : 'week',
            since: periodWindow.since,
            now: periodWindow.now,
          })
        : [],
    [feed, period, periodWindow],
  )

  const writeFilters = (next: Filters) => {
    const params: Record<string, string> = { tab: 'received' }
    if (next.type !== 'all') {
      params.what = next.type
    }
    if (next.sign !== 'all') {
      params.sign = next.sign
    }
    if (next.period !== DEFAULT_PERIOD) {
      params.period = next.period
    }
    setOpenMenu(undefined)
    setSearchParams(params)
  }

  const loadMore = () => {
    if (!feed?.nextCursor || loadingMore) {
      return
    }
    const abortController = new AbortController()
    loadMoreAbortRef.current?.abort()
    loadMoreAbortRef.current = abortController
    setLoadingMore(true)
    api.userAPI
      .receivedVotes({ ...queryRef.current, cursor: feed.nextCursor }, abortController.signal)
      .then((next) => {
        if (abortController.signal.aborted) {
          return
        }
        setFeed((current) => (current ? mergePages(current, next) : next))
        setLoadingMore(false)
      })
      .catch(() => {
        if (abortController.signal.aborted) {
          return
        }
        setError('Не удалось загрузить ещё оценки')
        setLoadingMore(false)
      })
  }

  const renderUser = (voterId: number) => {
    const user = feed?.users[voterId]
    if (!user) {
      return <span>пользователь</span>
    }
    return (
      <Link className={styles.voter} to={`/u/${user.username}`}>
        {user.username}
      </Link>
    )
  }

  const renderVoters = (key: string, voters: DigestVoter[]) => {
    const mixed = voters.some((voter) => voter.vote < 0) && voters.some((voter) => voter.vote > 0)
    const shown = visibleVoters(voters)
    const rest = voters.length - shown.length
    return (
      <div className={styles.voters}>
        {shown.map((voter, index) => (
          <React.Fragment key={voter.voterId}>
            {index > 0 && ', '}
            {renderUser(voter.voterId)}
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
              aria-expanded={expandedVoters.has(key)}
              onClick={() => setExpandedVoters((current) => toggleKey(current, key))}
            >
              {`и ещё ${rest}`}
            </Button>
          </>
        )}
      </div>
    )
  }

  const renderChronology = (key: string, events: UserVoteFeedEvent[]) =>
    expandedVoters.has(key) && (
      <ul className={styles.chronology}>
        {events.map((event) => (
          <li key={eventKey(event)}>
            <span className={classNames(styles.value, event.vote < 0 ? styles.minus : styles.plus, styles.small)}>
              {formatVote(event.vote)}
            </span>{' '}
            {renderUser(event.voterId)} <time className={styles.time}>{formatShortTime(event.votedAt)}</time>
          </li>
        ))}
      </ul>
    )

  const threadInfo = (postId: number, events: UserVoteFeedEvent[]) => {
    const post = feed?.subjects.posts[postId]
    const comment = events
      .map((event) => (event.type === 'comment' ? feed?.subjects.comments[event.entityId] : undefined))
      .find((subject) => subject)
    return {
      title: post?.label || comment?.postTitle || `пост #${postId}`,
      site: post?.site || comment?.site || 'main',
    }
  }

  // Same click semantics as internal links inside content: a plain click expands
  // the post or comment in place, ctrl/cmd-click still opens it as a link.
  const expandOnClick = (key: string) => (event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      return
    }
    event.preventDefault()
    setExpandedContent((current) => toggleKey(current, key))
  }

  const renderSubject = (section: DigestSection, subject: DigestSubject, site: string) => {
    const key = `${section.key}:${subject.key}`
    const comment = subject.type === 'comment' ? feed?.subjects.comments[subject.entityId] : undefined
    const postId = comment ? comment.postId : subject.entityId
    const expanded = expandedContent.has(key)
    const toggleContent = () => setExpandedContent((current) => toggleKey(current, key))
    return (
      <div className={styles.subject} key={key}>
        <span
          className={classNames(
            styles.value,
            styles.subjectValue,
            subject.sum < 0 ? styles.minus : subject.sum > 0 ? styles.plus : styles.zero,
          )}
        >
          {formatVote(subject.sum)}
        </span>
        <div className={styles.subjectMain}>
          <span
            role='button'
            tabIndex={0}
            aria-expanded={expanded}
            aria-label={expanded ? 'Свернуть' : 'Развернуть'}
            className={classNames('i i-expand', styles.expandArrow, expanded && styles.expandArrowOpen)}
            onClick={toggleContent}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggleContent()
              }
            }}
          />
          <PostLink
            className={subject.type === 'post' ? styles.subjectKind : styles.quote}
            post={{ id: postId, site }}
            commentId={comment?.id}
            onClick={expandOnClick(key)}
          >
            {subject.type === 'post' ? 'сам пост' : `«${comment?.excerpt || 'комментарий'}»`}
          </PostLink>
          {renderVoters(key, subject.voters)}
          {renderChronology(key, subject.events)}
          {expanded && (
            <div className={styles.expandedContent}>
              <InternalLinkExpandComponent postId={postId} commentId={comment?.id} onClose={toggleContent} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderCard = (section: DigestSection, card: DigestCard) => {
    const key = `${section.key}:${card.key}`
    const events = card.subjects.flatMap((subject) => subject.events)
    const { title, site } = threadInfo(card.postId, events)
    const expanded = expandedCards.has(key)
    const hidden = card.subjects.slice(SUBJECTS_PER_CARD)
    const hiddenComments = hidden.filter((subject) => subject.type === 'comment').length
    const hiddenLabel = [
      hidden.length > hiddenComments ? 'пост' : '',
      hiddenComments ? pluralize(hiddenComments, ['комментарий', 'комментария', 'комментариев']) : '',
    ]
      .filter(Boolean)
      .join(' и ')
    return (
      <article className={styles.card} key={key}>
        <header className={styles.cardHeader}>
          <div className={styles.cardTitleWrap}>
            <PostLink className={styles.cardTitle} post={{ id: card.postId, site }}>
              {title}
            </PostLink>
            {site !== 'main' && <span className={styles.site}>{site}</span>}
          </div>
          <div className={styles.cardSum}>
            <Sums plus={card.plus} minus={card.minus} size='big' />
            <span className={styles.meta}>
              {card.people} чел. · {formatShortTime(card.latestAt)}
            </span>
          </div>
        </header>
        {(expanded ? card.subjects : card.subjects.slice(0, SUBJECTS_PER_CARD)).map((subject) =>
          renderSubject(section, subject, site),
        )}
        {!expanded && hidden.length > 0 && (
          <Button
            variant='minimal'
            className={styles.expandCard}
            onClick={() => setExpandedCards((current) => toggleKey(current, key))}
          >
            <>
              ещё {hiddenLabel} ·{' '}
              <Sums
                plus={hidden.reduce((sum, subject) => sum + Math.max(subject.sum, 0), 0)}
                minus={hidden.reduce((sum, subject) => sum + Math.min(subject.sum, 0), 0)}
                size='small'
              />
            </>
          </Button>
        )}
      </article>
    )
  }

  const renderKarma = (section: DigestSection) => {
    if (!section.karma) {
      return null
    }
    const key = `${section.key}:karma`
    return (
      <article className={styles.card} key={key}>
        <header className={styles.cardHeader}>
          <span className={styles.cardTitlePlain}>Карма профиля</span>
          <div className={styles.cardSum}>
            <Sums plus={section.karma.plus} minus={section.karma.minus} size='big' />
          </div>
        </header>
        <div className={classNames(styles.subject, styles.karmaRow)}>
          <div className={styles.subjectMain}>
            {renderVoters(key, section.karma.voters)}
            {renderChronology(key, section.karma.events)}
          </div>
        </div>
      </article>
    )
  }

  const renderTail = (section: DigestSection) => {
    if (!section.tail.length) {
      return null
    }
    const plus = section.tail.reduce((sum, item) => sum + item.plus, 0)
    const minus = section.tail.reduce((sum, item) => sum + item.minus, 0)
    return (
      <div className={styles.tail}>
        <span className={styles.tailHead}>
          По 1–2 оценки в {pluralize(section.tail.length, ['обсуждении', 'обсуждениях', 'обсуждениях'])}{' '}
          <Sums plus={plus} minus={minus} size='small' />:
        </span>{' '}
        {section.tail.map((item, index) => {
          const { title, site } = threadInfo(item.postId, item.events)
          return (
            <React.Fragment key={item.postId}>
              {index > 0 && ' · '}
              <span className={styles.tailItem}>
                <PostLink className={styles.tailLink} post={{ id: item.postId, site }}>
                  «{title}»
                </PostLink>{' '}
                <Sums plus={item.plus} minus={item.minus} size='small' />
              </span>
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  const whatLabel = WHAT_LABELS[sign][type]
  const filtered = type !== 'all' || sign !== 'all'
  const wider = getWiderPeriod(period)
  const events = feed?.events || []

  return (
    <div className={feedStyles.container}>
      <div className={styles.filters} ref={filtersRef}>
        <div className={styles.dropdown}>
          <Button
            variant='ghost'
            className={styles.dropdownButton}
            aria-haspopup='menu'
            aria-expanded={openMenu === 'what'}
            onClick={() => setOpenMenu(openMenu === 'what' ? undefined : 'what')}
          >
            <>
              {whatLabel}
              <span className={styles.caret} aria-hidden='true'>
                ▾
              </span>
            </>
          </Button>
          {openMenu === 'what' && (
            <div className={styles.menu} role='menu' aria-label='Какие оценки показывать'>
              <div className={styles.menuHeading} role='presentation'>
                Что
              </div>
              {TYPE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant='minimal'
                  role='menuitemradio'
                  aria-checked={type === option.value}
                  className={classNames(styles.menuItem, type === option.value && styles.menuItemActive)}
                  onClick={() => writeFilters({ type: option.value, sign, period })}
                >
                  {option.label}
                </Button>
              ))}
              <div className={styles.menuSeparator} role='separator' />
              <div className={styles.menuHeading} role='presentation'>
                Какие
              </div>
              {SIGN_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant='minimal'
                  role='menuitemradio'
                  aria-checked={sign === option.value}
                  className={classNames(styles.menuItem, sign === option.value && styles.menuItemActive)}
                  onClick={() => writeFilters({ type, sign: option.value, period })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className={styles.dropdown}>
          <Button
            variant='ghost'
            className={styles.dropdownButton}
            aria-haspopup='menu'
            aria-expanded={openMenu === 'period'}
            onClick={() => setOpenMenu(openMenu === 'period' ? undefined : 'period')}
          >
            <>
              {periodLabel(period)}
              <span className={styles.caret} aria-hidden='true'>
                ▾
              </span>
            </>
          </Button>
          {openMenu === 'period' && (
            <div className={styles.menu} role='menu' aria-label='Период'>
              {PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant='minimal'
                  role='menuitemradio'
                  aria-checked={period === option.value}
                  className={classNames(styles.menuItem, period === option.value && styles.menuItemActive)}
                  onClick={() => writeFilters({ type, sign, period: option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <span className={styles.srOnly} role='status' aria-live='polite'>
        {loading
          ? 'Загружаются оценки'
          : error
            ? ''
            : `Показано ${pluralize(events.length, ['оценка', 'оценки', 'оценок'])}`}
      </span>

      <div className={feedStyles.feed} aria-busy={loading || loadingMore}>
        {loading && !feed && <div className={feedStyles.loading}></div>}
        {error && (
          <div className={feedStyles.error} role='alert'>
            {error}
          </div>
        )}
        {!loading && !error && feed && events.length === 0 && (
          <div className={styles.empty}>
            <div>
              {period === 'all'
                ? `${filtered ? 'Таких оценок' : 'Оценок'} пока нет.`
                : `${periodLabel(period)} ${filtered ? 'таких оценок' : 'оценок'} не было.`}
            </div>
            {wider && (
              <Button
                variant='ghost'
                className={styles.widenButton}
                onClick={() => writeFilters({ type, sign, period: wider })}
              >
                {`Показать ${periodLabel(wider).toLowerCase()}`}
              </Button>
            )}
          </div>
        )}
        {digest.map((section) => (
          <section className={styles.section} key={section.key}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{section.label}</h3>
              <div className={styles.sectionSum}>
                <Sums plus={section.plus} minus={section.minus} />
                <span className={styles.meta}>· {section.people} чел.</span>
              </div>
            </div>
            {section.topVoter && (
              <div className={styles.sectionNote}>
                чаще всех: {renderUser(section.topVoter.voterId)}{' '}
                <span className={styles.meta}>
                  ({pluralize(section.topVoter.count, ['оценка', 'оценки', 'оценок'])})
                </span>
              </div>
            )}
            {section.cards.map((card) => renderCard(section, card))}
            {renderKarma(section)}
            {renderTail(section)}
          </section>
        ))}
        {!loading && !error && feed && events.length > 0 && (
          <div className={styles.footer}>
            {feed.hasMore && feed.nextCursor ? (
              <Button variant='ghost' className={styles.widenButton} onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Загружается...' : 'Показать ещё'}
              </Button>
            ) : (
              wider && (
                <Button
                  variant='ghost'
                  className={styles.widenButton}
                  onClick={() => writeFilters({ type, sign, period: wider })}
                >
                  {`Показать ${periodLabel(wider).toLowerCase()}`}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
