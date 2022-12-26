import { Logger } from 'winston';
import { SearchResponse, SearchScope, SearchSorting, SearchSortingDirection } from '../api/SearchController';
import { Client } from '@elastic/elasticsearch';
import UserManager from './UserManager';
import SiteManager from './SiteManager';

export default class SearchManager {
    private logger: Logger;
    private client: Client;
    private userManager: UserManager;
    private siteManager: SiteManager;

    constructor(userManager: UserManager, siteManager: SiteManager, logger: Logger) {
        this.logger = logger;
        this.siteManager = siteManager;
        this.userManager = userManager;
        const host = process.env.SEARCH_HOST || 'elasticsearch';
        const port = parseInt(process.env.SEARCH_PORT, 10) || 'elasticsearch';
        this.client = new Client({ node: `http://${host}:${port}` });
    }

    buildQuery(
      term: string,
      scope?: SearchScope,
      autorId?: number,
      responseToId?: number,
      siteId?: number,
      createdAtFrom?: number,
      createdAtTo?: number,
      ratingFrom?: number,
      ratingTo?: number,
      sortByDate?: boolean,
      sortDirection?: SearchSortingDirection
    ) {
        const mustTerms = [
            {
                multi_match: {
                    query: term,
                    type: "phrase",
                    fields: [
                        'title^2',
                        'source'
                    ]
                }
            }
        ];

        const filters = [];

        if (scope) {
            filters.push({
                'term': {
                    'doc_type': scope === SearchScope.Post ? 0 : 1
                }
            });
        }

        if (autorId) {
            filters.push({
                'term': {
                    'author_id': autorId
                }
            });
        }

        if (responseToId) {
            filters.push({
                'term': {
                    'parent_comment_author_id': responseToId
                }
            });
        }

        if (siteId) {
            filters.push({
                'term': {
                    'site_id': siteId
                }
            });
        }

        if (createdAtFrom || createdAtTo) {
            const range = {};
            if (createdAtFrom) {
                range['gte'] = createdAtFrom;
            }
            if (createdAtTo) {
                range['lte'] = createdAtTo;
            }
            filters.push({
                range: {
                    created_at: range
                }
            });
        }

        if (ratingFrom || ratingTo) {
            const range = {};
            if (ratingFrom) {
                range['gte'] = ratingFrom;
            }
            if (ratingTo) {
                range['lte'] = ratingTo;
            }
            filters.push({
                range: {
                    rating: range
                }
            });
        }

        const sort = [];
        if (sortByDate) {
            const direction = sortDirection ? sortDirection : SearchSortingDirection.Desc;
            sort.push({
                created_at: {'order': direction, 'format': 'epoch_millis'}
            });
        }
        sort.push({'_score': {'order': 'desc'}});

        const query = {
            index: 'orbitar',
            body: {
                query: {
                    bool: {
                        must: mustTerms,
                        filter: filters
                    }

                },
                highlight: {
                    pre_tags: ['<b><i>'],
                    post_tags: ['</i></b>'],
                    fields: {
                        title: {},
                        source: {}
                    },
                    number_of_fragments: 10,
                    fragment_size: 300
                },
                size: 250,
                from: 0,
                sort: sort
            }
        };
        if (mustTerms.length) {
            query.body.query.bool.must.push();
        }
        return query;
    }

    async search(
      term: string,
      scope?: SearchScope,
      author?: string,
      responseTo?: string,
      site?: string,
      createdAtFrom?: number,
      createdAtTo?: number,
      ratingFrom?: number,
      ratingTo?: number,
      searchByDate?: boolean,
      searchDirection?: SearchSortingDirection
    ): Promise<SearchResponse> {
        try {
            const results = [];
            let authorId = null, responseToId = null, siteId = null;
            if (author) {
                const authorItem = await this.userManager.getByUsername(author);
                authorId = authorItem?.id;
            }
            if (responseTo) {
                const responseToItem = await this.userManager.getByUsername(responseTo);
                responseToId = responseToItem?.id;
            }
            if (site) {
                const siteItem = await this.siteManager.getSiteByName(site);
                siteId = siteItem?.id;
            }

            const query = this.buildQuery(
                term,
                scope,
                authorId,
                responseToId,
                siteId,
                createdAtFrom,
                createdAtTo,
                ratingFrom,
                ratingTo,
                searchByDate,
                searchDirection
            );
            const response = await this.client.search(query);

            for (let i = 0; i < response.body.hits.hits.length; i++) {
                const hit = response.body.hits.hits[i];
                const author = await this.userManager.getById(hit._source.author_id);
                const site =  await this.siteManager.getSiteById(hit._source.site_id);

                let parentCommentAuthor;
                if (hit._source.parent_comment_author_id) {
                    parentCommentAuthor = await this.userManager.getById(hit._source.parent_comment_author_id);
                }
                results.push({
                    highlight_title: hit.highlight.title,
                    highlight_source: hit.highlight.source,
                    author: author?.username,
                    post_title: hit._source.title,
                    site_name: site?.name,
                    site: site?.site,
                    created_at: new Date(hit._source.created_at).toISOString(),
                    doc_type: hit._source.doc_type === 0 ? SearchScope.Post : SearchScope.Comment,
                    post_id: hit._source.post_id,
                    comment_id: hit._source.comment_id,
                    comment_post_id: hit._source.comment_post_id,
                    parent_comment_author: parentCommentAuthor?.username,
                    rating: hit._source.rating
                });
            }
            return {
                results,
                total: response.body.hits.total,
                sorting: SearchSorting.Relevance,
                sortingDirection: SearchSortingDirection.Desc
            };
        } catch (e) {
            this.logger.error(e.message);
            return;
        }
    }
}
