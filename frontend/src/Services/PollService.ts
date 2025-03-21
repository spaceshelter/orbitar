import APIBase from '../API/APIBase'
import { PollAPI } from '../API/PollAPI'
import { Poll, PollBackendResponse, PollVoteRequest, PollVoteResponse } from '../Types/Poll'
import { BatchedCache } from '../Utils'

class PollService {
  private static instance: PollService
  private pollCache: BatchedCache<string, Poll>
  private pollApi: PollAPI

  private transformPollResponse(poll: PollBackendResponse): Poll {
    return {
      id: String(poll.poll_id),
      poll_id: String(poll.poll_id),
      question: poll.question,
      options: poll.options,
      totalVotes: poll.total_votes || 0,
      settings: {
        allowMultipleVotes: poll.settings.allow_multiple_choice,
        resultVisibility: poll.settings.result_visibility,
        allowVoteRescinding: poll.settings.allow_vote_rescinding,
        voteAccess: poll.settings.vote_access,
        expiresAt: poll.expires_at,
      },
      userVoted: poll.user_vote ? String(poll.user_vote[0]) : undefined,
    }
  }

  private constructor() {
    const api = new APIBase()
    this.pollApi = new PollAPI(api)

    this.pollCache = new BatchedCache<string, Poll>({
      batchSize: 10,
      cacheTime: 5 * 60 * 1000,
      fetchFunction: async (ids: string[]) => {
        try {
          const response = await this.pollApi.getPollsBatch({ ids: ids.map(Number) })
          return new Map(response.polls.map((poll) => [String(poll.poll_id), this.transformPollResponse(poll)]))
        } catch (error) {
          console.error('Error fetching polls batch:', error)
          throw error
        }
      },
    })
  }

  public static getInstance(): PollService {
    if (!PollService.instance) {
      PollService.instance = new PollService()
    }
    return PollService.instance
  }

  public async getPoll(id: string): Promise<Poll> {
    try {
      return await this.pollCache.get(id)
    } catch (error) {
      console.error(`Error getting poll ${id}:`, error)
      throw error
    }
  }

  public async getPolls(ids: string[]): Promise<Poll[]> {
    return Promise.all(ids.map((id) => this.getPoll(id)))
  }

  public async vote(request: PollVoteRequest): Promise<PollVoteResponse> {
    try {
      const result = await this.pollApi.vote(request)

      // update cache
      if (result.poll) {
        const poll = this.transformPollResponse(result.poll)
        this.pollCache.set(String(request.poll_id), poll)
      }

      result.success = true
      return result
    } catch (error) {
      console.error('Error voting:', error)
      throw error
    }
  }

  public async rescindVote(pollId: number): Promise<PollVoteResponse> {
    const result = await this.pollApi.rescindVote({ poll_id: pollId })

    if (result.poll) {
      this.pollCache.delete(String(pollId))
    }

    result.success = true
    return result
  }
}

export default PollService.getInstance()
