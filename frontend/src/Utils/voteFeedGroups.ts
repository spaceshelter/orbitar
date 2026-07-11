import { UserVoteFeedEvent, UserVotesDirection } from '../API/UserAPI'

type VoteFeedGroupKind = 'entity' | 'voter' | 'target-author' | 'context-post' | 'single'

export type VoteFeedGroup = {
  kind: VoteFeedGroupKind
  latestAt: Date
  events: UserVoteFeedEvent[]
  entityType?: 'post' | 'comment' | 'user'
  entityId?: number
  voterId?: number
  targetUserId?: number
  contextPostId?: number
}

const getVoteFeedEventPostId = (event: UserVoteFeedEvent): number | undefined => {
  if (event.type === 'post') {
    return event.entityId
  }
  if (event.type === 'comment') {
    return event.postId
  }
  return undefined
}

type Candidate = {
  kind: VoteFeedGroupKind
  length: number
}

const runLength = (events: UserVoteFeedEvent[], start: number, sameGroup: (event: UserVoteFeedEvent) => boolean) => {
  let length = 0
  for (let i = start; i < events.length; i++) {
    if (!sameGroup(events[i])) {
      break
    }
    length++
  }
  return length
}

const contextPostRunLength = (events: UserVoteFeedEvent[], start: number) => {
  const postId = getVoteFeedEventPostId(events[start])
  if (!postId) {
    return 1
  }
  return runLength(events, start, (event) => getVoteFeedEventPostId(event) === postId)
}

const getCandidates = (events: UserVoteFeedEvent[], start: number, direction: UserVotesDirection): Candidate[] => {
  const event = events[start]

  if (direction === 'received') {
    return [
      {
        kind: 'entity',
        length: runLength(
          events,
          start,
          (candidate) => candidate.type === event.type && candidate.entityId === event.entityId,
        ),
      },
      {
        kind: 'voter',
        length: runLength(events, start, (candidate) => candidate.voterId === event.voterId),
      },
    ]
  }

  return [
    {
      kind: 'target-author',
      length: runLength(events, start, (candidate) => candidate.targetUserId === event.targetUserId),
    },
    {
      kind: 'context-post',
      length: contextPostRunLength(events, start),
    },
  ]
}

const pickGroup = (events: UserVoteFeedEvent[], start: number, direction: UserVotesDirection): VoteFeedGroup => {
  const event = events[start]
  const candidate = getCandidates(events, start, direction).reduce<Candidate>(
    (best, current) => {
      if (current.length <= 1) {
        return best
      }
      if (current.length > best.length) {
        return current
      }
      return best
    },
    { kind: 'single', length: 1 },
  )
  const groupEvents = events.slice(start, start + candidate.length)
  const base = {
    kind: candidate.kind,
    latestAt: event.votedAt,
    events: groupEvents,
  }

  switch (candidate.kind) {
    case 'entity':
      return {
        ...base,
        entityType: event.type,
        entityId: event.entityId,
      }
    case 'voter':
      return {
        ...base,
        voterId: event.voterId,
      }
    case 'target-author':
      return {
        ...base,
        targetUserId: event.targetUserId,
      }
    case 'context-post':
      return {
        ...base,
        contextPostId: getVoteFeedEventPostId(event),
      }
    default:
      return base
  }
}

export const groupVoteFeedEvents = (events: UserVoteFeedEvent[], direction: UserVotesDirection): VoteFeedGroup[] => {
  const groups: VoteFeedGroup[] = []
  let index = 0

  while (index < events.length) {
    const group = pickGroup(events, index, direction)
    groups.push(group)
    index += group.events.length
  }

  return groups
}
