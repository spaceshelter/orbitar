import AuthAPI from '@api/AuthAPI'
import { PollAPI } from '@api/PollAPI'

import { Poll, PollBackendResponse, PollVoteRequest, PollVoteResponse } from '../Types/Poll'
import { BatchedCache } from '../Utils'

class PollService {
  private static instance: PollService
  private pollCache: BatchedCache<string, Poll>
  private pollApi: PollAPI
  private authApi: AuthAPI
  private transformPollResponse(poll: PollBackendResponse): Poll {
    return {
      id: String(poll.poll_id),
      question: poll.question,
      options: poll.options.map((option) => ({
        ...option,
        voters: option.voters || [],
      })),
      totalVotes: poll.total_votes || 0,
      settings: {
        allowMultipleVotes: poll.settings.allow_multiple_choice,
        resultVisibility: poll.settings.result_visibility,
        allowVoteRescinding: poll.settings.allow_vote_rescinding,
        voteAccess: poll.settings.vote_access,
        expiresAt: poll.expires_at,
      },
      userVoted: poll.user_vote ? poll.user_vote : [],
    }
  }

  private constructor(pollApi: PollAPI, authApi: AuthAPI) {
    this.pollApi = pollApi
    this.authApi = authApi

    this.pollCache = new BatchedCache<string, Poll>({
      debounceTime: 200,
      batchSize: 128,
      cacheTTL: 5 * 60 * 1000,
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

  public static getInstance(pollApi: PollAPI, authApi: AuthAPI): PollService {
    if (!PollService.instance) {
      PollService.instance = new PollService(pollApi, authApi)
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
    try {
      const result = await this.pollApi.rescindVote({ poll_id: pollId })

      if (result.poll) {
        this.pollCache.delete(String(pollId))
      }

      result.success = true
      return result
    } catch (error) {
      console.error('Error rescinding vote:', error)
      throw error
    }
  }
}

const getPollService = (pollApi: PollAPI, authApi: AuthAPI) => PollService.getInstance(pollApi, authApi)

export default getPollService
