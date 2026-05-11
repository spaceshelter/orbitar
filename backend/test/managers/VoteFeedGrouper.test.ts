import { VoteFeedReference } from '../../src/db/repositories/VoteRepository'
import { groupVoteFeedReferences } from '../../src/managers/VoteFeedGrouper'

const at = (minute: number) => new Date(`2026-05-11T10:${String(minute).padStart(2, '0')}:00.000Z`)

const vote = (overrides: Partial<VoteFeedReference>): VoteFeedReference => ({
  type: 'post',
  entityId: 1,
  postId: 1,
  voterId: 10,
  targetUserId: 20,
  vote: 1,
  votedAt: at(0),
  ...overrides,
})

describe('groupVoteFeedReferences', () => {
  test('groups received votes by the same entity on a tie', () => {
    const groups = groupVoteFeedReferences(
      [
        vote({ entityId: 100, voterId: 10, votedAt: at(3) }),
        vote({ entityId: 100, voterId: 10, votedAt: at(2) }),
        vote({ entityId: 101, voterId: 11, votedAt: at(1) }),
      ],
      'received',
    )

    expect(groups).toMatchObject([
      { kind: 'entity', entityType: 'post', entityId: 100, events: [{ entityId: 100 }, { entityId: 100 }] },
      { kind: 'single', events: [{ entityId: 101 }] },
    ])
  })

  test('groups received votes by voter when that run is longer', () => {
    const groups = groupVoteFeedReferences(
      [
        vote({ type: 'post', entityId: 100, postId: 100, voterId: 10, votedAt: at(4) }),
        vote({ type: 'comment', entityId: 200, postId: 100, voterId: 10, votedAt: at(3) }),
        vote({ type: 'user', entityId: 300, postId: undefined, voterId: 10, votedAt: at(2) }),
        vote({ type: 'post', entityId: 101, postId: 101, voterId: 11, votedAt: at(1) }),
      ],
      'received',
    )

    expect(groups).toMatchObject([
      { kind: 'voter', voterId: 10, events: [{ entityId: 100 }, { entityId: 200 }, { entityId: 300 }] },
      { kind: 'single', events: [{ entityId: 101 }] },
    ])
  })

  test('groups own votes by target author on a tie', () => {
    const groups = groupVoteFeedReferences(
      [
        vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(2) }),
        vote({ type: 'comment', entityId: 200, postId: 100, targetUserId: 20, votedAt: at(1) }),
      ],
      'mine',
    )

    expect(groups).toMatchObject([
      { kind: 'target-author', targetUserId: 20, events: [{ entityId: 100 }, { entityId: 200 }] },
    ])
  })

  test('groups own votes by context post when target authors differ', () => {
    const groups = groupVoteFeedReferences(
      [
        vote({ type: 'post', entityId: 100, postId: 100, targetUserId: 20, votedAt: at(2) }),
        vote({ type: 'comment', entityId: 200, postId: 100, targetUserId: 21, votedAt: at(1) }),
      ],
      'mine',
    )

    expect(groups).toMatchObject([
      { kind: 'context-post', contextPostId: 100, events: [{ entityId: 100 }, { entityId: 200 }] },
    ])
  })
})
