import { UserVoteFeedEvent } from '../API/UserAPI'

type VoteFeedGroupKind = 'context-post' | 'single'

// A run of votes in one discussion. Runs on one author are not grouped: they are
// neither folded nor capped, so a header over them would only repeat the rows.
export type VoteFeedGroup = {
  kind: VoteFeedGroupKind
  latestAt: Date
  events: UserVoteFeedEvent[]
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

const pickGroup = (events: UserVoteFeedEvent[], start: number): VoteFeedGroup => {
  const event = events[start]
  const length = contextPostRunLength(events, start)
  const base = {
    latestAt: event.votedAt,
    events: events.slice(start, start + length),
  }

  return length > 1
    ? { ...base, kind: 'context-post', contextPostId: getVoteFeedEventPostId(event) }
    : { ...base, kind: 'single' }
}

export const groupVoteFeedEvents = (events: UserVoteFeedEvent[]): VoteFeedGroup[] => {
  if (!events.length) {
    return []
  }

  const groups: VoteFeedGroup[] = []
  let index = 0

  while (index < events.length) {
    const group = pickGroup(events, index)
    groups.push(group)
    index += group.events.length
  }

  return groups
}
