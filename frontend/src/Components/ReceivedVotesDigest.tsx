import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Button from '@ui/Button'
import classNames from 'classnames'

import { ReceivedVotesFilters, useReceivedVotes } from '../API/use/useReceivedVotes'
import {
  buildReceivedDigest,
  DigestSection,
  getPeriodOptions,
  getWiderPeriod,
  limitPeriod,
  VotePeriod,
  VoteSign,
} from '../Utils/receivedVotesDigest'
import { pluralize } from '../Utils/utils'
import FilterDropdown from './FilterDropdown'
import PostLink from './PostLink'
import ReceivedVotesCard, {
  DigestLookup,
  discussionInfo,
  ReceivedKarmaCard,
  Sums,
  VoterName,
} from './ReceivedVotesCard'

import feedStyles from '../Pages/FeedPage.module.scss'
import styles from './ReceivedVotesDigest.module.scss'

const DEFAULT_PERIOD: VotePeriod = '2weeks'

type TypeFilter = ReceivedVotesFilters['type']
type MenuName = 'what' | 'period'

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'Всё' },
  { value: 'comment', label: 'Комментарии' },
  { value: 'post', label: 'Посты' },
  { value: 'user', label: 'Карма' },
]

const SIGN_OPTIONS: Array<{ value: VoteSign; label: string }> = [
  { value: 'all', label: 'Плюсы и минусы' },
  { value: 'minus', label: 'Только минусы' },
]

const PERIOD_LABELS: Record<VotePeriod, string> = {
  week: 'За неделю',
  '2weeks': 'За 2 недели',
  month: 'За месяц',
  year: 'За год',
  all: 'За всё время',
}

const WHAT_LABELS: Record<VoteSign, Record<TypeFilter, string>> = {
  all: { all: 'Все оценки', comment: 'Комментарии', post: 'Посты', user: 'Карма' },
  minus: { all: 'Только минусы', comment: 'Минусы за комментарии', post: 'Минусы за посты', user: 'Минусы в карму' },
}

const readFilters = (params: URLSearchParams): ReceivedVotesFilters => {
  const what = params.get('what')
  const period = params.get('period')
  const sign: VoteSign = params.get('sign') === 'minus' ? 'minus' : 'all'
  return {
    type: what === 'comment' || what === 'post' || what === 'user' ? what : 'all',
    sign,
    period: limitPeriod(
      period === 'week' || period === 'month' || period === 'year' || period === 'all' ? period : DEFAULT_PERIOD,
      sign,
    ),
  }
}

// Placeholder shaped like a section while its first votes load.
function DigestSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden='true'>
      <div className={styles.skeletonHeader}>
        <span className={styles.skeletonLine} style={{ width: 110 }} />
        <span className={styles.skeletonLine} style={{ width: 70 }} />
      </div>
      {[0, 1].map((card) => (
        <div className={styles.skeletonCard} key={card}>
          <span className={styles.skeletonLine} style={{ width: card ? '38%' : '52%' }} />
          <span className={styles.skeletonLine} style={{ width: card ? '71%' : '64%' }} />
          <span className={styles.skeletonLine} style={{ width: card ? '44%' : '58%' }} />
        </div>
      ))}
    </div>
  )
}

function DigestTail({ lookup, section, partial }: { lookup: DigestLookup; section: DigestSection; partial: boolean }) {
  if (!section.tail.length) {
    return null
  }
  const plus = section.tail.reduce((sum, item) => sum + item.plus, 0)
  const minus = section.tail.reduce((sum, item) => sum + item.minus, 0)
  return (
    <div className={styles.tail}>
      <span className={styles.tailHead}>
        {partial ? 'Пока по' : 'По'} 1–2 оценки в{' '}
        {pluralize(section.tail.length, ['обсуждении', 'обсуждениях', 'обсуждениях'])}{' '}
        <Sums plus={plus} minus={minus} size='small' />:
      </span>{' '}
      {section.tail.map((item, index) => {
        const { title, site, generated } = discussionInfo(lookup, item.postId, item.events)
        // The sum and the separator stay glued to the title so a line never
        // starts with «·»; long titles wrap inside their own item.
        return (
          <React.Fragment key={item.postId}>
            <span className={styles.tailItem}>
              <PostLink
                className={classNames(styles.tailLink, generated && styles.generatedTitle)}
                post={{ id: item.postId, site }}
              >
                {generated ? title : `«${title}»`}
              </PostLink>
              {' '}
              <Sums plus={item.plus} minus={item.minus} size='small' />
              {index < section.tail.length - 1 && ' ·'}
            </span>{' '}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default function ReceivedVotesDigest() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = readFilters(searchParams)
  const { type, sign, period } = filters
  const { feed, periodWindow, loading, loadingMore, error, loadMore, retry } = useReceivedVotes(filters)
  const [openMenu, setOpenMenu] = useState<MenuName>()

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

  const writeFilters = (next: ReceivedVotesFilters) => {
    const params: Record<string, string> = { tab: 'received' }
    const nextPeriod = limitPeriod(next.period, next.sign)
    if (next.type !== 'all') {
      params.what = next.type
    }
    if (next.sign !== 'all') {
      params.sign = next.sign
    }
    if (nextPeriod !== DEFAULT_PERIOD) {
      params.period = nextPeriod
    }
    setOpenMenu(undefined)
    setSearchParams(params)
  }

  const menuToggle = (name: MenuName) => (open: boolean) =>
    setOpenMenu((current) => (open ? name : current === name ? undefined : current))

  const events = feed?.events || []
  const filtered = type !== 'all' || sign !== 'all'
  const wider = getWiderPeriod(period, sign)
  // Pages arrive newest first, so only the oldest loaded section can be missing
  // votes: while more are coming it is held back, afterwards it is marked.
  const incomplete = !!feed?.hasMore
  const sections = loading && incomplete ? digest.slice(0, -1) : digest
  const partialKey = !loading && incomplete ? digest[digest.length - 1]?.key : undefined

  return (
    <div className={feedStyles.container}>
      <div className={styles.filters}>
        <FilterDropdown
          label={WHAT_LABELS[sign][type]}
          menuLabel='Какие оценки показывать'
          open={openMenu === 'what'}
          onOpenChange={menuToggle('what')}
          groups={[
            {
              key: 'type',
              heading: 'Что',
              items: TYPE_OPTIONS.map((option) => ({
                key: option.value,
                label: option.label,
                checked: type === option.value,
                onSelect: () => writeFilters({ ...filters, type: option.value }),
              })),
            },
            {
              key: 'sign',
              heading: 'Какие',
              items: SIGN_OPTIONS.map((option) => ({
                key: option.value,
                label: option.label,
                checked: sign === option.value,
                onSelect: () => writeFilters({ ...filters, sign: option.value }),
              })),
            },
          ]}
        />
        <FilterDropdown
          label={PERIOD_LABELS[period]}
          menuLabel='Период'
          open={openMenu === 'period'}
          onOpenChange={menuToggle('period')}
          note={sign === 'minus' ? 'Минусы — не дальше месяца' : undefined}
          groups={[
            {
              key: 'period',
              items: getPeriodOptions(sign).map((option) => ({
                key: option,
                label: PERIOD_LABELS[option],
                checked: period === option,
                onSelect: () => writeFilters({ ...filters, period: option }),
              })),
            },
          ]}
        />
      </div>

      <span className={styles.srOnly} role='status' aria-live='polite'>
        {loading
          ? 'Загружаются оценки'
          : error
            ? ''
            : `Показано ${pluralize(events.length, ['оценка', 'оценки', 'оценок'])}${incomplete ? ', есть ещё' : ''}`}
      </span>

      <div className={feedStyles.feed} aria-busy={loading || loadingMore}>
        {loading && !feed && <div className={feedStyles.loading}></div>}
        {error && !feed && (
          <div className={styles.empty}>
            <div className={styles.errorText} role='alert'>
              {error}
            </div>
            <Button variant='ghost' className={styles.widenButton} onClick={retry}>
              Повторить
            </Button>
          </div>
        )}
        {!loading && !error && feed && events.length === 0 && (
          <div className={styles.empty}>
            <div>
              {period === 'all'
                ? `${filtered ? 'Таких оценок' : 'Оценок'} пока нет.`
                : `${PERIOD_LABELS[period]} ${filtered ? 'таких оценок' : 'оценок'} не было.`}
            </div>
            {wider && (
              <Button
                variant='ghost'
                className={styles.widenButton}
                onClick={() => writeFilters({ ...filters, period: wider })}
              >
                {`Показать ${PERIOD_LABELS[wider].toLowerCase()}`}
              </Button>
            )}
          </div>
        )}
        {feed &&
          sections.map((section) => (
            <section className={styles.section} key={section.key}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{section.label}</h3>
                <div className={styles.sectionSum}>
                  <Sums plus={section.plus} minus={section.minus} />
                  <span className={styles.meta}>· {section.people} чел.</span>
                </div>
              </div>
              {section.key === partialKey && (
                <div className={styles.sectionNote}>Загружена только часть оценок за эти дни.</div>
              )}
              {section.topVoter && (
                <div className={styles.sectionNote}>
                  чаще всех: <VoterName lookup={feed} voterId={section.topVoter.voterId} />{' '}
                  <span className={styles.meta}>
                    ({pluralize(section.topVoter.count, ['оценка', 'оценки', 'оценок'])})
                  </span>
                </div>
              )}
              {section.cards.map((card) => (
                <ReceivedVotesCard key={card.key} lookup={feed} card={card} />
              ))}
              {section.karma && <ReceivedKarmaCard lookup={feed} karma={section.karma} />}
              <DigestTail lookup={feed} section={section} partial={section.key === partialKey} />
            </section>
          ))}
        {loading && <DigestSkeleton />}
        {!loading && feed && events.length > 0 && (
          <div className={styles.footer}>
            {error ? (
              <>
                <div className={styles.errorText} role='alert'>
                  {error}
                </div>
                <Button variant='ghost' className={styles.widenButton} onClick={retry}>
                  Повторить
                </Button>
              </>
            ) : incomplete && feed.nextCursor ? (
              <Button variant='ghost' className={styles.widenButton} onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Загружается...' : 'Показать ещё'}
              </Button>
            ) : (
              wider && (
                <Button
                  variant='ghost'
                  className={styles.widenButton}
                  onClick={() => writeFilters({ ...filters, period: wider })}
                >
                  {`Показать ${PERIOD_LABELS[wider].toLowerCase()}`}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
