import { UserVoteFeedEvent } from '../API/UserAPI'

const postIdOf = (event: UserVoteFeedEvent) =>
  event.type === 'post' ? event.entityId : event.type === 'comment' ? event.postId : undefined

export const groupVoteFeedEvents = (events: UserVoteFeedEvent[]) =>
  events.reduce<UserVoteFeedEvent[][]>((runs, event) => {
    const run = runs[runs.length - 1]
    const postId = postIdOf(event)
    if (run && postId && postIdOf(run[0]) === postId) run.push(event)
    else runs.push([event])
    return runs
  }, [])
