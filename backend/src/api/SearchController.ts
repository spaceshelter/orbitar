import {Router} from 'express';
import {Logger} from 'winston';
import {validate, APIRequest, APIResponse} from './ApiMiddleware';
import Joi from 'joi';
import UserManager from '../managers/UserManager';
import SearchManager from '../managers/SearchManager';

export enum SearchScope {
    Post = 'post',
    Comment = 'comment'
}

export enum SearchSortingDirection {
    Asc = 'asc',
    Desc = 'desc'
}

export type SearchRequest = {
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
    highlight_title: string;
    highlight_source: string;
    author: string;
    site_name: string;
    site: string;
    created_at: string;
    doc_type: SearchScope;
    post_id: number;
    comment_id: number;
    comment_post_id: number;
    parent_comment_author: string;
};

export enum SearchSorting {
    Relevance = 'relevance',
    CreatedAt = 'created_at'
}

export type TotalInfo = {
    value: number;
    relation: 'eq' | 'gte';
};

export type SearchResponse = {
    results: SearchResultEntity[];
    total: TotalInfo;
    sorting: SearchSorting;
    sortingDirection: SearchSortingDirection;
};

export default class SearchController {
    public router = Router();
    private logger: Logger;
    private userManager: UserManager;
    private searchManager: SearchManager;

    constructor(userManager: UserManager, searchManager: SearchManager, logger: Logger) {
        this.logger = logger;
        this.userManager = userManager;
        this.searchManager = searchManager;

        const searchSchema = Joi.object<SearchRequest>({
            term: Joi.string().required(),
            scope: Joi.string().valid(SearchScope.Post, SearchScope.Comment),
            author: Joi.string(),
            response_to: Joi.string(),
            site: Joi.string(),
            created_at_from: Joi.number(),
            created_at_to: Joi.number(),
            rating_from: Joi.number(),
            rating_to: Joi.number(),
            search_by_date: Joi.boolean(),
            search_direction: Joi.string().valid(SearchSortingDirection.Asc, SearchSortingDirection.Desc)
        });

        this.router.post('/search', validate(searchSchema), (req, res) => this.search(req, res));
    }

    async search(request: APIRequest<SearchRequest>, response: APIResponse<SearchResponse> ) {
        if (!request.session.data.userId) {
            return response.authRequired();
        }

        const userId = request.session.data.userId;
        await this.userManager.logVisit(userId);

        const {
            term,
            scope,
            author,
            response_to,
            site,
            created_at_from,
            created_at_to,
            rating_from,
            rating_to,
            search_by_date,
            search_direction
        } = request.body;
        try {
            const result = await this.searchManager.search(
                term,
                scope,
                author,
                response_to,
                site,
                created_at_from,
                created_at_to,
                rating_from,
                rating_to,
                search_by_date,
                search_direction
            );
            response.success(result);
        }
        catch (err) {
            this.logger.error('Search request failed', { error: err, user_id: userId });
            return response.error('error', 'Unknown error', 500);
        }
    }
}