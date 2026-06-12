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
  const base = {
    vote: spec.vote ?? 1,
    votedAt: spec.votedAt ?? at(0),
    voterId: spec.voterId ?? 10,
    targetUserId: spec.targetUserId ?? 20,
  }
  if (spec.type === 'post') {
    return { ...base, type: 'post', post: { id: spec.entityId } as never }
  }
  if (spec.type === 'comment') {
    return {
      ...base,
      type: 'comment',
      comment: { id: spec.entityId, postLink: { id: spec.postId ?? 0 } } as never,
    }
  }
  return { ...base, type: 'user', user: { id: spec.entityId } as never }
}

describe('groupVoteFeedEvents', () => {
  test('groups received votes by the same entity on a tie', () => {
    const groups = groupVoteFeedEvents(
      [
        vote({ type: 'post', entityId: 100, voterId: 10, votedAt: at(3) }),
        vote({ type: 'post', entityId: 100, voterId: 11, votedAt: at(2) }),
        vote({ type: 'post', entityId: 101, voterId: 11, votedAt: at(1) }),
      ],
      'received',
    )

    expect(groups).toMatchObject([
      { kind: 'entity', entityType: 'post', entityId: 100, events: [{}, {}] },
      { kind: 'single', events: [{}] },
    ])
  })

  test('groups received votes by voter when that run is longer', () => {
    const groups = groupVoteFeedEvents(
      [
        vote({ type: 'post', entityId: 100, postId: 100, voterId: 10, votedAt: at(4) }),
        vote({ type: 'comment', entityId: 200, postId: 100, voterId: 10, votedAt: at(3) }),
        vote({ type: 'user', entityId: 300, voterId: 10, votedAt: at(2) }),
        vote({ type: 'post', entityId: 101, postId: 101, voterId: 11, votedAt: at(1) }),
      ],
      'received',
    )

    expect(groups).toMatchObject([
      { kind: 'voter', voterId: 10, events: [{}, {}, {}] },
      { kind: 'single', events: [{}] },
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
