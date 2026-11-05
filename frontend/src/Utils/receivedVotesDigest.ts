import moment from 'moment'

import { UserVoteFeedEvent } from '../API/UserAPI'

export type VotePeriod = 'week' | '2weeks' | 'month' | 'year' | 'all'
export type VoteSign = 'all' | 'minus'

// Votes sharing a key: a section, a discussion (keyed by its post) or a subject.
export type VoteGroup<K = string> = { key: K; events: UserVoteFeedEvent[] }

export type DigestSection = VoteGroup & {
  label: string
  cards: VoteGroup<number>[]
  tail: VoteGroup<number>[]
  karma: UserVoteFeedEvent[]
}

// A discussion earns its own card from this many votes in a section, or from a
// single minus: minuses are rare and their authors must always stay named.
const CARD_MIN_VOTES = 3

const PERIOD_DAYS = { week: 7, '2weeks': 14, month: 30, year: 365 }
const PERIODS: VotePeriod[] = ['week', '2weeks', 'month', 'year', 'all']
// Minus-only windows stop at a month, as the API enforces.
const MINUS_ONLY_PERIODS = PERIODS.slice(0, 3)

// Whole local days ending today: «за 2 недели» always holds 14 days.
export const getPeriodSince = (period: VotePeriod, now: Date) =>
  period === 'all'
    ? undefined
    : moment(now)
        .startOf('day')
        .subtract(PERIOD_DAYS[period] - 1, 'days')
        .toDate()

export const getPeriodOptions = (sign: VoteSign) => (sign === 'minus' ? MINUS_ONLY_PERIODS : PERIODS)

export const limitPeriod = (period: VotePeriod, sign: VoteSign) => {
  const options = getPeriodOptions(sign)
  return options.includes(period) ? period : options[options.length - 1]
}

export const getWiderPeriod = (period: VotePeriod, sign: VoteSign): VotePeriod | undefined => {
  const options = getPeriodOptions(sign)
  return options.includes(period) ? options[options.indexOf(period) + 1] : undefined
}

export const sumPlus = (events: UserVoteFeedEvent[]) => events.reduce((sum, event) => sum + Math.max(event.vote, 0), 0)
export const sumMinus = (events: UserVoteFeedEvent[]) => events.reduce((sum, event) => sum + Math.min(event.vote, 0), 0)
export const countPeople = (events: UserVoteFeedEvent[]) => new Set(events.map((event) => event.voterId)).size

export const orderVoters = (events: UserVoteFeedEvent[]) => [
  ...events.filter((event) => event.vote < 0),
  ...events.filter((event) => event.vote > 0),
]

const groupBy = <K>(events: UserVoteFeedEvent[], keyOf: (event: UserVoteFeedEvent) => K): VoteGroup<K>[] => {
  const groups = new Map<K, UserVoteFeedEvent[]>()
  events.forEach((event) => {
    const key = keyOf(event)
    const group = groups.get(key)
    if (group) group.push(event)
    else groups.set(key, [event])
  })
  return Array.from(groups, ([key, events]) => ({ key, events }))
}

const byWeight = (a: VoteGroup<unknown>, b: VoteGroup<unknown>) =>
  b.events.length - a.events.length || b.events[0].votedAt.getTime() - a.events[0].votedAt.getTime()

export const subjectsOf = (events: UserVoteFeedEvent[]) =>
  groupBy(events, (event) => `${event.type}:${event.entityId}`).sort(byWeight)

const buildSection = (key: string, label: string, events: UserVoteFeedEvent[]): DigestSection => {
  const discussions = groupBy(
    events.filter((event) => event.type !== 'user'),
    (event) => (event.type === 'post' ? event.entityId : (event.postId as number)),
  )
  const isCard = ({ events }: VoteGroup<number>) =>
    events.length >= CARD_MIN_VOTES || events.some((event) => event.vote < 0)
  return {
    key,
    label,
    events,
    cards: discussions.filter(isCard).sort(byWeight),
    tail: discussions.filter((discussion) => !isCard(discussion)),
    karma: events.filter((event) => event.type === 'user'),
  }
}

// Relies on the ru locale DateComponent sets app-wide: «7 сентября», but «сентябрь 2026».
const formatDays = (start: moment.Moment, end: moment.Moment) =>
  start.isSame(end, 'day')
    ? end.format('D MMMM')
    : start.isSame(end, 'month')
      ? `${start.date()}–${end.format('D MMMM')}`
      : `${start.format('D MMMM')} – ${end.format('D MMMM')}`

// Calendar sections of newest-first votes; `since` and `now` only trim the labels.
export const buildReceivedDigest = (
  events: UserVoteFeedEvent[],
  { granularity, since, now }: { granularity: 'week' | 'month'; since?: Date; now: Date },
) =>
  groupBy(events, (event) => moment(event.votedAt).format(granularity === 'week' ? 'GGGG-WW' : 'YYYY-MM')).map(
    ({ key, events }) => {
      const first = moment(events[0].votedAt)
      if (granularity === 'month') return buildSection(key, first.format('MMMM YYYY'), events)
      const weekStart = first.startOf('isoWeek')
      const start = since && weekStart.isBefore(since) ? moment(since).startOf('day') : weekStart
      const end = moment.min(moment(now).startOf('day'), weekStart.clone().add(6, 'days'))
      return buildSection(key, formatDays(start, end), events)
    },
  )
