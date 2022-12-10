import APIBase from './APIBase';

export default class SearchApi {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async search(term: string): Promise<any> {
        return await this.api.request<any, any>('/search', {
            term
        });
    }
}
