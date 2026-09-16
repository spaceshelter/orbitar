import { UserVoteFeedEvent } from '../API/UserAPI'

export type VotePeriod = 'week' | '2weeks' | 'month' | 'year' | 'all'

export type DigestVoter = { voterId: number; vote: number }

export type DigestSubject = {
  key: string
  type: 'post' | 'comment'
  entityId: number
  sum: number
  latestAt: Date
  events: UserVoteFeedEvent[]
  voters: DigestVoter[]
}

export type DigestCard = {
  key: string
  postId: number
  plus: number
  minus: number
  people: number
  latestAt: Date
  subjects: DigestSubject[]
}

export type DigestTailItem = { postId: number; plus: number; minus: number; count: number; events: UserVoteFeedEvent[] }

export type DigestKarma = { plus: number; minus: number; voters: DigestVoter[]; events: UserVoteFeedEvent[] }

export type DigestSection = {
  key: string
  label: string
  plus: number
  minus: number
  people: number
  topVoter?: { voterId: number; count: number }
  cards: DigestCard[]
  karma?: DigestKarma
  tail: DigestTailItem[]
}

type DigestOptions = {
  granularity: 'week' | 'month'
  // Window bounds only trim the section labels; events are expected to be in range.
  since?: Date
  now: Date
}

// A discussion earns its own card from this many votes in a section, or from a
// single minus: minuses are rare and their authors must always stay named.
const CARD_MIN_VOTES = 3

const PERIOD_DAYS: Record<Exclude<VotePeriod, 'all'>, number> = { week: 7, '2weeks': 14, month: 30, year: 365 }

const WIDER_PERIOD: Record<VotePeriod, VotePeriod | undefined> = {
  week: '2weeks',
  '2weeks': 'month',
  month: 'year',
  year: 'all',
  all: undefined,
}

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
]

const MONTHS_NOMINATIVE = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
]

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

const startOfWeek = (date: Date) => {
  const day = startOfDay(date)
  return addDays(day, -((day.getDay() + 6) % 7))
}

const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

// Periods are whole local days ending today, so «за 2 недели» always holds 14 days
// regardless of the weekday it is opened on.
export const getPeriodSince = (period: VotePeriod, now: Date): Date | undefined => {
  if (period === 'all') {
    return undefined
  }
  return addDays(startOfDay(now), -(PERIOD_DAYS[period] - 1))
}

export const getWiderPeriod = (period: VotePeriod): VotePeriod | undefined => WIDER_PERIOD[period]

const formatDayRange = (start: Date, end: Date) => {
  if (start.getMonth() !== end.getMonth()) {
    return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} – ${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`
  }
  if (start.getDate() === end.getDate()) {
    return `${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`
  }
  return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`
}

const sumPlus = (events: UserVoteFeedEvent[]) => events.reduce((sum, event) => sum + Math.max(event.vote, 0), 0)
const sumMinus = (events: UserVoteFeedEvent[]) => events.reduce((sum, event) => sum + Math.min(event.vote, 0), 0)
const countPeople = (events: UserVoteFeedEvent[]) => new Set(events.map((event) => event.voterId)).size

// One entry per voter with their newest vote; minus voters first, the rest keep
// the newest-first order of the events.
const orderVoters = (events: UserVoteFeedEvent[]): DigestVoter[] => {
  const seen = new Set<number>()
  const voters: DigestVoter[] = []
  for (const event of events) {
    if (!seen.has(event.voterId)) {
      seen.add(event.voterId)
      voters.push({ voterId: event.voterId, vote: event.vote })
    }
  }
  return [...voters.filter((voter) => voter.vote < 0), ...voters.filter((voter) => voter.vote >= 0)]
}

const groupBy = <K>(events: UserVoteFeedEvent[], keyOf: (event: UserVoteFeedEvent) => K) => {
  const groups = new Map<K, UserVoteFeedEvent[]>()
  for (const event of events) {
    const key = keyOf(event)
    const group = groups.get(key)
    if (group) {
      group.push(event)
    } else {
      groups.set(key, [event])
    }
  }
  return groups
}

// The frontend compiles to ES5 without downlevelIteration, so Maps are walked via arrays.
const entriesOf = <K, V>(map: Map<K, V>): Array<[K, V]> => Array.from(map.entries())

const byWeightThenRecency = (a: DigestSubject, b: DigestSubject) =>
  b.events.length - a.events.length || b.latestAt.getTime() - a.latestAt.getTime()

const cardWeight = (card: DigestCard) => card.subjects.reduce((count, subject) => count + subject.events.length, 0)

const buildCard = (postId: number, events: UserVoteFeedEvent[]): DigestCard => {
  const subjects = entriesOf(groupBy(events, (event) => `${event.type}:${event.entityId}`)).map(
    ([key, subjectEvents]): DigestSubject => ({
      key,
      type: subjectEvents[0].type === 'post' ? 'post' : 'comment',
      entityId: subjectEvents[0].entityId,
      sum: subjectEvents.reduce((sum, event) => sum + event.vote, 0),
      latestAt: subjectEvents[0].votedAt,
      events: subjectEvents,
      voters: orderVoters(subjectEvents),
    }),
  )
  return {
    key: `post:${postId}`,
    postId,
    plus: sumPlus(events),
    minus: sumMinus(events),
    people: countPeople(events),
    latestAt: events[0].votedAt,
    subjects: subjects.sort(byWeightThenRecency),
  }
}

const buildSection = (key: string, label: string, events: UserVoteFeedEvent[]): DigestSection => {
  const karmaEvents = events.filter((event) => event.type === 'user')
  const threads = groupBy(
    events.filter((event) => event.type !== 'user'),
    (event) => (event.type === 'post' ? event.entityId : (event.postId as number)),
  )

  const cards: DigestCard[] = []
  const tail: DigestTailItem[] = []
  for (const [postId, threadEvents] of entriesOf(threads)) {
    if (threadEvents.length >= CARD_MIN_VOTES || threadEvents.some((event) => event.vote < 0)) {
      cards.push(buildCard(postId, threadEvents))
    } else {
      tail.push({
        postId,
        plus: sumPlus(threadEvents),
        minus: sumMinus(threadEvents),
        count: threadEvents.length,
        events: threadEvents,
      })
    }
  }
  cards.sort((a, b) => cardWeight(b) - cardWeight(a) || b.latestAt.getTime() - a.latestAt.getTime())

  let topVoter: DigestSection['topVoter']
  for (const [voterId, voterEvents] of entriesOf(groupBy(events, (event) => event.voterId))) {
    if (voterEvents.length >= 2 && (!topVoter || voterEvents.length > topVoter.count)) {
      topVoter = { voterId, count: voterEvents.length }
    }
  }

  return {
    key,
    label,
    plus: sumPlus(events),
    minus: sumMinus(events),
    people: countPeople(events),
    topVoter,
    cards,
    karma: karmaEvents.length
      ? {
          plus: sumPlus(karmaEvents),
          minus: sumMinus(karmaEvents),
          voters: orderVoters(karmaEvents),
          events: karmaEvents,
        }
      : undefined,
    tail,
  }
}

// Groups a newest-first page of received votes into calendar sections: each
// discussion (a post with the votes on it and on comments in it) becomes a card,
// small positive discussions collapse into the section's tail line.
export const buildReceivedDigest = (events: UserVoteFeedEvent[], options: DigestOptions): DigestSection[] => {
  const today = startOfDay(options.now)
  const buckets = groupBy(events, (event) =>
    options.granularity === 'week'
      ? dateKey(startOfWeek(event.votedAt))
      : `${event.votedAt.getFullYear()}-${event.votedAt.getMonth() + 1}`,
  )

  return entriesOf(buckets).map(([key, sectionEvents]) => {
    const sample = sectionEvents[0].votedAt
    if (options.granularity === 'month') {
      return buildSection(key, `${MONTHS_NOMINATIVE[sample.getMonth()]} ${sample.getFullYear()}`, sectionEvents)
    }
    const weekStart = startOfWeek(sample)
    const weekEnd = addDays(weekStart, 6)
    const start = options.since && options.since > weekStart ? startOfDay(options.since) : weekStart
    const end = today < weekEnd ? today : weekEnd
    return buildSection(key, formatDayRange(start, end), sectionEvents)
  })
}
