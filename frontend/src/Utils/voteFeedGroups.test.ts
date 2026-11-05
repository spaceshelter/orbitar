import { UserVoteFeedEvent } from '../API/UserAPI'
import { groupVoteFeedEvents } from './voteFeedGroups'

const vote = (type: UserVoteFeedEvent['type'], entityId: number, postId?: number, targetUserId = 20) => ({
  type,
  entityId,
  postId,
  vote: 1,
  votedAt: new Date('2026-05-11T10:00:00.000Z'),
  voterId: 10,
  targetUserId,
})

const runLengths = (events: UserVoteFeedEvent[]) => groupVoteFeedEvents(events).map((run) => run.length)

describe('groupVoteFeedEvents', () => {
  test('leaves votes on one author in different discussions apart', () => {
    expect(runLengths([vote('post', 100, 100), vote('comment', 200, 101), vote('user', 20)])).toEqual([1, 1, 1])
  })

  test('joins consecutive votes in one discussion whoever their authors are', () => {
    const events = [vote('post', 100, 100), vote('comment', 200, 100, 21), vote('comment', 201, 100)]
    expect(groupVoteFeedEvents(events)).toEqual([events])
  })

  test('never joins votes on users', () => {
    expect(runLengths([vote('user', 300), vote('user', 301)])).toEqual([1, 1])
  })
})
