import APIBase from './APIBase';

type VoteType = 'post' | 'comment' | 'user';

type VoteSetRequest = {
    type: VoteType;
    id: number;
    vote: number;
}
type VoteSetResponse = {
    type: VoteType;
    id: number;
    rating: number;
    vote?: number;
}

export default class VoteAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async vote(type: 'post' | 'comment' | 'user', id: number, vote: number): Promise<VoteSetResponse> {
        return await this.api.request<VoteSetRequest, VoteSetResponse>('/vote/set', {
            id: id,
            type: type,
            vote: vote
        });
    }
}
