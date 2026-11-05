import { UserVoteFeedEvent } from '../API/UserAPI'
import {
  buildReceivedDigest,
  countPeople,
  DigestSection,
  getPeriodOptions,
  getPeriodSince,
  getWiderPeriod,
  limitPeriod,
  orderVoters,
  subjectsOf,
  sumMinus,
  sumPlus,
} from './receivedVotesDigest'

// Labels use the moment locale that DateComponent sets up for the app.
import '../Components/DateComponent'

const at = (month: number, day: number, hour = 12, year = 2026) => new Date(year, month - 1, day, hour, 0)

const vote = (
  type: UserVoteFeedEvent['type'],
  entityId: number,
  voterId: number,
  value: number,
  votedAt: Date,
  postId?: number,
): UserVoteFeedEvent => ({
  type,
  entityId,
  postId: type === 'post' ? entityId : postId,
  voterId,
  targetUserId: 99,
  vote: value,
  votedAt,
})

const sums = (events: UserVoteFeedEvent[]) => [sumPlus(events), sumMinus(events), countPeople(events)]

const rows = (events: UserVoteFeedEvent[]) => subjectsOf(events).map(({ key, events }) => `${key}:${events.length}`)

const summarize = (sections: DigestSection[]) =>
  sections.map((section) => ({
    label: section.label,
    sums: sums(section.events),
    cards: section.cards.map((card) => ({ postId: card.key, sums: sums(card.events), rows: rows(card.events) })),
    karma: section.karma.map((event) => event.voterId),
    tail: section.tail.map((item) => [item.key, ...sums(item.events)]),
  }))

describe('getPeriodSince', () => {
  const now = at(9, 16, 15)

  test.each([
    ['week', at(9, 10, 0)],
    ['2weeks', at(9, 3, 0)],
    ['month', at(8, 18, 0)],
    ['year', at(9, 17, 0, 2025)],
  ] as const)('%s starts at local midnight and covers whole days up to today', (period, expected) => {
    expect(getPeriodSince(period, now)).toEqual(expected)
  })

  test('all time has no lower bound', () => {
    expect(getPeriodSince('all', now)).toBeUndefined()
  })
})

describe('getWiderPeriod', () => {
  test.each([
    ['week', '2weeks'],
    ['2weeks', 'month'],
    ['month', 'year'],
    ['year', 'all'],
    ['all', undefined],
  ] as const)('%s widens to %s', (period, wider) => {
    expect(getWiderPeriod(period, 'all')).toBe(wider)
  })

  test.each([
    ['week', '2weeks'],
    ['2weeks', 'month'],
    ['month', undefined],
  ] as const)('minus-only %s widens to %s at most up to a month', (period, wider) => {
    expect(getWiderPeriod(period, 'minus')).toBe(wider)
  })
})

describe('minus-only periods', () => {
  test('offer a week, two weeks and a month; all votes offer every period', () => {
    expect(getPeriodOptions('minus')).toEqual(['week', '2weeks', 'month'])
    expect(getPeriodOptions('all')).toEqual(['week', '2weeks', 'month', 'year', 'all'])
  })

  test.each([
    ['year', 'minus', 'month'],
    ['all', 'minus', 'month'],
    ['2weeks', 'minus', '2weeks'],
    ['year', 'all', 'year'],
  ] as const)('limit %s for %s votes to %s', (period, sign, limited) => {
    expect(limitPeriod(period, sign)).toBe(limited)
  })
})

describe('buildReceivedDigest', () => {
  const now = at(9, 16, 15)
  const since = at(9, 3, 0)

  test('groups a two-week window into week sections of discussion cards, karma and a tail', () => {
    const events = [
      vote('comment', 501, 1, 1, at(9, 16, 10), 50),
      vote('comment', 501, 2, 1, at(9, 15, 10), 50),
      vote('post', 50, 3, 1, at(9, 15, 9)),
      vote('comment', 502, 1, 1, at(9, 14, 18), 50),
      vote('comment', 601, 4, -1, at(9, 14, 12), 60),
      vote('user', 99, 5, 2, at(9, 14, 11)),
      vote('comment', 701, 6, 1, at(9, 13, 20), 70),
      vote('comment', 702, 6, 1, at(9, 12, 20), 70),
      vote('comment', 801, 1, 1, at(9, 5, 10), 80),
    ]

    expect(summarize(buildReceivedDigest(events, { granularity: 'week', since, now }))).toEqual([
      {
        label: '14–16 сентября',
        sums: [6, -1, 5],
        cards: [
          { postId: 50, sums: [4, 0, 3], rows: ['comment:501:2', 'post:50:1', 'comment:502:1'] },
          { postId: 60, sums: [0, -1, 1], rows: ['comment:601:1'] },
        ],
        karma: [5],
        tail: [],
      },
      { label: '7–13 сентября', sums: [2, 0, 1], cards: [], karma: [], tail: [[70, 2, 0, 1]] },
      { label: '3–6 сентября', sums: [1, 0, 1], cards: [], karma: [], tail: [[80, 1, 0, 1]] },
    ])
  })

  test('keeps votes on one comment in one row when votes on other subjects interleave', () => {
    const events = [
      vote('comment', 42, 10, 1, at(9, 16, 14), 50),
      vote('post', 99, 11, 1, at(9, 16, 13)),
      vote('comment', 42, 12, 1, at(9, 16, 12), 50),
      vote('user', 99, 13, 1, at(9, 16, 11)),
      vote('comment', 42, 14, 1, at(9, 16, 10), 50),
    ]

    const [section] = buildReceivedDigest(events, { granularity: 'week', since, now })

    expect(section.cards.map((card) => rows(card.events))).toEqual([['comment:42:3']])
    expect(section.tail.map((item) => item.key)).toEqual([99])
  })

  test('lists minus voters first, then the rest from newest to oldest', () => {
    const events = [
      vote('comment', 501, 7, 1, at(9, 16, 10), 50),
      vote('comment', 501, 8, -1, at(9, 15, 10), 50),
      vote('comment', 501, 9, 1, at(9, 14, 10), 50),
    ]

    expect(orderVoters(events).map((event) => event.voterId)).toEqual([8, 7, 9])
  })

  test('labels month sections with the year and a week spanning two months with both', () => {
    const monthly = buildReceivedDigest(
      [
        vote('comment', 1, 1, 1, at(8, 20), 10),
        vote('comment', 2, 1, 1, at(7, 3), 10),
        vote('comment', 3, 1, 1, at(12, 30, 12, 2025), 10),
      ],
      { granularity: 'month', now },
    )
    expect(monthly.map((section) => section.label)).toEqual(['август 2026', 'июль 2026', 'декабрь 2025'])

    const weekly = buildReceivedDigest([vote('comment', 1, 1, 1, at(9, 2), 10)], {
      granularity: 'week',
      since: at(8, 18, 0),
      now,
    })
    expect(weekly.map((section) => section.label)).toEqual(['31 августа – 6 сентября'])
  })
})
