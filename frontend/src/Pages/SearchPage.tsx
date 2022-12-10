import React, {useEffect, useState} from 'react';
import styles from './SearchPage.module.scss';
import {useForm, SubmitHandler} from 'react-hook-form';
import {useAPI} from '../AppState/AppState';
import {useSearchParams} from 'react-router-dom';
import Username from '../Components/Username';
import DateComponent from '../Components/DateComponent';
import PostLink from '../Components/PostLink';

type SearchForm = {
    term: string;
};

type SearchResultEntity = {
    highlight_title: string;
    highlight_source: string;
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

type SearchResponse = {
    results: SearchResultEntity[];
    total: TotalInfo;
    sorting: 'relevance' | 'created_at';
    sortingDirection: 'asc' | 'desc';
};

function SearchResult(props: {
    result: SearchResponse
}) {
    const total = props.result.total;
    const results = props.result.results;
    let i = 0;
    return <div>
        <div className={styles.stats}>
            Найдено: {total.value}
        </div>
        <div>
            {results.map((resultItem: SearchResultEntity) => {
                i++;
                return <div className={styles.resultItem} key={i}>
                    {
                        resultItem.highlight_title && <h3 dangerouslySetInnerHTML={{__html: '…' + resultItem.highlight_title + '…'}}></h3>
                    }
                    {
                        resultItem.highlight_source && <p dangerouslySetInnerHTML={{__html: '…' +resultItem.highlight_source + '…'}}></p>
                    }
                    <div className={styles.meta}>
                        <Username user={{username: resultItem.author}}/>
                        <div className={styles.date}><DateComponent date={resultItem.created_at} /></div>
                        <div>
                            {resultItem.doc_type === 'post' &&
                                <PostLink target='_blank' post={{id: resultItem.post_id, site: resultItem.site}}>пост</PostLink>}
                            {resultItem.doc_type === 'comment' &&
                                <PostLink target='_blank' commentId={resultItem.comment_id} post={{id: resultItem.comment_post_id, site: resultItem.site}}>комментарий</PostLink>}
                        &nbsp;на {resultItem.site === 'main' ? 'главной' : resultItem.site}
                        </div>
                    </div>
                </div>;
            })}
        </div>
    </div>;
}

export default function SearchPage() {
    const api = useAPI();
    const [isSearching, setSearching] = useState(false);
    const [error, setError] = useState<string>();
    const [result, setResult] = useState<SearchResponse | null>();
    const [searchParams, setSearchParams] = useSearchParams();
    const defaultSearch = searchParams.get('term') as string;

    const doSearch = (term: string) => {
        if (!term) {
            return;
        }
        setSearching(true);
        setResult(null);
        setSearchParams({term});
        api.searchApi.search(term)
            .then((result) => {
                setResult(result);
            })
            .catch(_ => {
                setError('Произошла чудовищная ошибка, попробуйте позже.');
            }).finally(() => setSearching(false));
    };

    useEffect(() => {
        if (defaultSearch) {
            doSearch(defaultSearch);
        }
    }, []);

    document.title = 'Поиск';

    const { register, handleSubmit, formState: { errors } } = useForm<SearchForm>({
        mode: 'onSubmit'
    });

    const onSubmit: SubmitHandler<SearchForm> = async data => {
        doSearch(data.term);
    };

    return (
        <div className={styles.search}>
            <form onSubmit={handleSubmit(onSubmit)}>
                <input type="text" {...register('term', {
                    required: 'Чтобы что-нибудь найти, надо что-нибудь искать'
                })} defaultValue={defaultSearch} />
                <input type="submit" disabled={isSearching} value="Искать" />
                {errors.term && <p className={styles.error}>{errors.term.message}</p>}
                {error && <p className={styles.error}>{error}</p>}
            </form>
            <div className={styles.results}>
                {result && <SearchResult result={result} />}
            </div>
        </div>
    );
}
