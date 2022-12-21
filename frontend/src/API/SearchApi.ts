import APIBase from './APIBase';

export enum SearchScope {
    Post = 'post',
    Comment = 'comment'
}

export enum SearchSortingDirection {
    Asc = 'asc',
    Desc = 'desc'
}

type SearchRequest = {
    term: string;
    scope?: SearchScope;
    author?: string;
    response_to?: string;
    site?: string;
    created_at_from?: number;
    created_at_to?: number;
    rating_from?: number;
    rating_to?: number;
    search_by_date?: boolean;
    search_direction?: SearchSortingDirection.Asc | SearchSortingDirection.Desc;
};

export type SearchResultEntity = {
    highlight_title: string[];
    highlight_source: string[];
    post_title?: string;
    author: string;
    site_name: string;
    site: string;
    created_at: Date;
    doc_type: 'post' | 'comment';
    post_id: number;
    comment_id: number;
    comment_post_id: number;
    parent_comment_author: string;
};

type TotalInfo = {
    value: number;
    relation: 'eq' | 'gte';
};

export type SearchResponse = {
    results: SearchResultEntity[];
    total: TotalInfo;
    sorting: 'relevance' | 'created_at';
    sortingDirection: 'asc' | 'desc';
};

export default class SearchApi {
    private api: APIBase;

    constructor(api: APIBase) {
        this.api = api;
    }

    async search(term: string): Promise<SearchResponse> {
        return await this.api.request<SearchRequest, SearchResponse>('/search', {
            term
        });
    }
}
