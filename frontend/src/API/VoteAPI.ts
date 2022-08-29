import APIBase from './APIBase';

type VoteType = 'post' | 'comment' | 'user';

type VoteSetRequest = {
    type: VoteType;
    id: number;
    vote: number;
};
type VoteSetResponse = {
    type: VoteType;
    id: number;
    rating: number;
    vote?: number;
};
type VoteListRequest = {
    type: VoteType;
    id: number;
};

export type VoteListItemEntity = {
    vote: number;
    username: string;
};

type VoteListResponse = {
    type: VoteType;
    id: number;
    rating: number;
    votes: VoteListItemEntity[];
};

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

    async list(type: 'post' | 'comment' | 'user', id: number): Promise<VoteListResponse> {
        return await this.api.request<VoteListRequest, VoteListResponse>('/vote/list', {
            id: id,
            type: type
        });
    }
}
