import { UserVoteFeedEvent } from '../API/UserAPI'
import { groupVoteFeedEvents } from './voteFeedGroups'

const at = (minute: number) => new Date(`2026-05-11T10:${String(minute).padStart(2, '0')}:00.000Z`)

type EventSpec = {
  type: 'post' | 'comment' | 'user'
  entityId: number
  postId?: number
  voterId?: number
  targetUserId?: number
  vote?: number
  votedAt?: Date
}

const vote = (spec: EventSpec): UserVoteFeedEvent => {
  return {
    type: spec.type,
    entityId: spec.entityId,
    postId: spec.postId,
    vote: spec.vote ?? 1,
    votedAt: spec.votedAt ?? at(0),
    voterId: spec.voterId ?? 10,
    targetUserId: spec.targetUserId ?? 20,
  }
}

describe('groupVoteFeedEvents', () => {
  test('keeps «received» a flat chronological timeline in one group', () => {
    const events = [
      vote({ type: 'post', entityId: 100, voterId: 10, votedAt: at(3) }),
      vote({ type: 'post', entityId: 100, voterId: 11, votedAt: at(2) }),
      vote({ type: 'post', entityId: 101, voterId: 11, votedAt: at(1) }),
    ]

    expect(groupVoteFeedEvents(events, 'received')).toMatchObject([
      { kind: 'flat', latestAt: at(3), events: [{}, {}, {}] },
    ])
  })

  test('does not fragment an interleaved received subject into several groups', () => {
    // The regression shape from review: votes on other entities interleave with
    // one comment's votes; run-based grouping split it into four groups.
    const events = [
      vote({ type: 'comment', entityId: 42, voterId: 10, votedAt: at(5) }),
      vote({ type: 'post', entityId: 99, voterId: 11, votedAt: at(4) }),
      vote({ type: 'comment', entityId: 42, voterId: 12, votedAt: at(3) }),
      vote({ type: 'user', entityId: 8, voterId: 13, votedAt: at(2) }),
      vote({ type: 'comment', entityId: 42, voterId: 14, votedAt: at(1) }),
    ]

    const groups = groupVoteFeedEvents(events, 'received')

    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('flat')
    expect(groups[0].events.map((event) => [event.type, event.entityId])).toEqual([
      ['comment', 42],
      ['post', 99],
      ['comment', 42],
      ['user', 8],
      ['comment', 42],
    ])
  })

  test('groups own votes by target author on a tie', () => {
    const groups = groupVoteFeedEvents(
      [
        vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(2) }),
        vote({ type: 'comment', entityId: 200, postId: 100, targetUserId: 20, votedAt: at(1) }),
      ],
      'mine',
    )

    expect(groups).toMatchObject([{ kind: 'target-author', targetUserId: 20, events: [{}, {}] }])
  })

  test('groups own votes by context post when target authors differ', () => {
    const groups = groupVoteFeedEvents(
      [
        vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(2) }),
        vote({ type: 'comment', entityId: 200, postId: 100, targetUserId: 21, votedAt: at(1) }),
      ],
      'mine',
    )

    expect(groups).toMatchObject([{ kind: 'context-post', contextPostId: 100, events: [{}, {}] }])
  })

  test('user events without a post never join a context-post run', () => {
    const groups = groupVoteFeedEvents(
      [
        vote({ type: 'user', entityId: 300, targetUserId: 20, votedAt: at(3) }),
        vote({ type: 'user', entityId: 301, targetUserId: 21, votedAt: at(2) }),
      ],
      'mine',
    )

    expect(groups).toMatchObject([{ kind: 'single' }, { kind: 'single' }])
  })
})
