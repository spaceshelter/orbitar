import React, {useEffect, useRef, useState} from 'react';
import styles from './SearchPage.module.scss';
import feedStyles from './FeedPage.module.scss';
import {useForm, SubmitHandler} from 'react-hook-form';
import {useAPI} from '../AppState/AppState';
import {useSearchParams} from 'react-router-dom';
import {SearchResponse, SearchResultEntity} from '../API/SearchApi';
import CommentComponent from '../Components/CommentComponent';
import PostComponent from '../Components/PostComponent';
import {UserGender} from '../Types/UserInfo';
import classNames from 'classnames';
import {useCache} from '../API/use/useCache';
import {LARGE_AUTO_CUT} from '../Components/ContentComponent';

type SearchForm = {
    term: string;
};

function SearchResult(props: {
    result: SearchResponse
}) {
    const total = props.result.total;
    const results = props.result.results;
    return <>
        <div className={styles.stats}>
            {!total.value ? 'Ничего не найдено' :
                <>{total.value.toLocaleString()} найдено {total.value > 250 && <>(250 показано)</>}</>}
        </div>

        {results.map((resultItem: SearchResultEntity) => {
            const author = {username: resultItem.author, id: 0, gender: UserGender.fluid};
            const content = resultItem.highlight_source?.join('&nbsp;&nbsp;&nbsp;…&nbsp;&nbsp;&nbsp;');
            const date = resultItem.created_at;

            return resultItem.doc_type === 'post' ?
                <PostComponent key={`p${resultItem.post_id}`}
                               post={{
                                   id: resultItem.post_id,
                                   title: resultItem.highlight_title?.join('&nbsp;&nbsp;&nbsp;…&nbsp;&nbsp;&nbsp;') || resultItem.post_title,
                                   author,
                                   content,
                                   site: resultItem.site,
                                   created: date,
                                   rating: 0,
                                   comments: 0,
                                   newComments: 0,
                               }}
                               showSite={true} autoCut={LARGE_AUTO_CUT} dangerousHtmlTitle={true} hideRating={true}/> :
                <CommentComponent key={resultItem.comment_id}
                                  comment={{
                                      id: resultItem.comment_id,
                                      author,
                                      content,
                                      created: date,
                                      rating: 0,
                                      parentComment: 0,
                                      postLink: {
                                          id: resultItem.comment_post_id,
                                          site: resultItem.site,
                                      }
                                  }}
                                  showSite={true} hideRating={true}/>;

        })}
    </>;
}

export default function SearchPage() {
    const api = useAPI();
    const [isSearching, setSearching] = useState(false);
    const [error, setError] = useState<string>();
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTermFromUrl = searchParams.get('term') as string;
    const [cachedResult, setCachedResult] = useCache<SearchResponse | undefined>('search', [searchTermFromUrl]);
    const [result, setResult] = useState<SearchResponse | undefined>(cachedResult);

    const searchTerm = useRef(searchTermFromUrl);
    const {register, handleSubmit, formState: {errors}, setFocus} = useForm<SearchForm>({
        mode: 'onSubmit'
    });

    useEffect(() => {
        if (!searchTermFromUrl) {
            setFocus('term');
            return;
        }
        if (searchTerm.current === searchTermFromUrl) {
            return;
        }
        searchTerm.current = searchTermFromUrl;
        setSearching(true);
        api.searchApi.search(searchTermFromUrl)
            .then((result) => {
                setResult(result);
                setCachedResult(result);
            })
            .catch(_ => {
                setResult(undefined);
                setCachedResult(undefined);
                setError('Произошла чудовищная ошибка, попробуйте позже.');
            }).finally(() => setSearching(false));
    }, [api.searchApi, searchTermFromUrl, setCachedResult, setFocus]);

    document.title = (searchTermFromUrl ? ('Поиск: ' + searchTermFromUrl) : 'Поиск');

    const onSubmit: SubmitHandler<SearchForm> = async data => {
        if (!data.term) {
            return;
        }
        setSearchParams({term: data.term});
    };

    return (
        <div className={classNames(styles.search, {[styles.empty]: !searchTermFromUrl })}>
            {isSearching && <div className={feedStyles.loading}></div>}

            <div className={feedStyles.container}>
                <div className={feedStyles.feed}>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <span className={classNames('i i-search', styles.icon)}></span>
                        <input type="search" placeholder="Да это же поиск!" {...register('term')} defaultValue={searchTermFromUrl} />
                    </form>
                    {errors.term && <p className={styles.error}>{errors.term.message}</p>}
                    {error && <p className={styles.error}>{error}</p>}
                    <div className={classNames(styles.results, 'searchResults')}>
                        {result && <SearchResult result={result}/>}
                    </div>
                </div>
            </div>
        </div>
    );
}
