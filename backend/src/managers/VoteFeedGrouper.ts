import { VoteFeedDirection, VoteFeedEntityType, VoteFeedReference } from '../db/repositories/VoteRepository'

export type VoteFeedGroupKind = 'entity' | 'voter' | 'target-author' | 'context-post' | 'single'

export type VoteFeedReferenceGroup = {
  kind: VoteFeedGroupKind
  latestAt: Date
  events: VoteFeedReference[]
  entityType?: VoteFeedEntityType
  entityId?: number
  voterId?: number
  targetUserId?: number
  contextPostId?: number
}

type Candidate = {
  kind: VoteFeedGroupKind
  length: number
}

const runLength = (events: VoteFeedReference[], start: number, sameGroup: (event: VoteFeedReference) => boolean) => {
  let length = 0
  for (let i = start; i < events.length; i++) {
    if (!sameGroup(events[i])) {
      break
    }
    length++
  }
  return length
}

const contextPostRunLength = (events: VoteFeedReference[], start: number) => {
  const postId = events[start].postId
  if (!postId) {
    return 1
  }
  return runLength(events, start, (event) => event.postId === postId)
}

const getCandidates = (events: VoteFeedReference[], start: number, direction: VoteFeedDirection): Candidate[] => {
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

const pickGroup = (
  events: VoteFeedReference[],
  start: number,
  direction: VoteFeedDirection,
): VoteFeedReferenceGroup => {
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
        contextPostId: event.postId,
      }
    default:
      return base
  }
}

export const groupVoteFeedReferences = (
  events: VoteFeedReference[],
  direction: VoteFeedDirection,
): VoteFeedReferenceGroup[] => {
  const groups: VoteFeedReferenceGroup[] = []
  let index = 0

  while (index < events.length) {
    const group = pickGroup(events, index, direction)
    groups.push(group)
    index += group.events.length
  }

  return groups
}
