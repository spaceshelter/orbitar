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
  // A run of votes on one author's posts and comments is neither folded nor capped,
  // so a «Материалы автора» header over it says nothing the rows do not.
  test('leaves votes on one author in different discussions ungrouped', () => {
    const groups = groupVoteFeedEvents([
      vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(3) }),
      vote({ type: 'comment', entityId: 200, postId: 101, targetUserId: 20, votedAt: at(2) }),
      vote({ type: 'user', entityId: 20, targetUserId: 20, votedAt: at(1) }),
    ])

    expect(groups).toMatchObject([{ kind: 'single' }, { kind: 'single' }, { kind: 'single' }])
  })

  test('groups own votes on one author in one discussion by the discussion', () => {
    const groups = groupVoteFeedEvents([
      vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(2) }),
      vote({ type: 'comment', entityId: 200, postId: 100, targetUserId: 20, votedAt: at(1) }),
    ])

    expect(groups).toMatchObject([{ kind: 'context-post', contextPostId: 100, events: [{}, {}] }])
  })

  test('groups own votes by context post when target authors differ', () => {
    const groups = groupVoteFeedEvents([
      vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(2) }),
      vote({ type: 'comment', entityId: 200, postId: 100, targetUserId: 21, votedAt: at(1) }),
    ])

    expect(groups).toMatchObject([{ kind: 'context-post', contextPostId: 100, events: [{}, {}] }])
  })

  test('user events without a post never join a context-post run', () => {
    const groups = groupVoteFeedEvents([
      vote({ type: 'user', entityId: 300, targetUserId: 20, votedAt: at(3) }),
      vote({ type: 'user', entityId: 301, targetUserId: 21, votedAt: at(2) }),
    ])

    expect(groups).toMatchObject([{ kind: 'single' }, { kind: 'single' }])
  })
})
