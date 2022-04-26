import APIBase from './APIBase';


type VoteResponse = {
    rating: number;
    vote?: number;
}

export default class VoteAPI {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async vote(type: 'post' | 'comment' | 'user', id: number, vote: number): Promise<VoteResponse> {
        let response = await this.api.request('/vote/set', {
            id: id,
            type: type,
            vote: vote
        }) as VoteResponse;

        return response;
    }


}
