import React, {useEffect, useState} from 'react';
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
            Найдено: {total.value} {total.value > 250 && <>(показано: 250)</>}
        </div>

        {results.map((resultItem: SearchResultEntity) => {
            const author = {username: resultItem.author, id: 0, gender: UserGender.fluid};
            const content = resultItem.highlight_source?.join('&nbsp;&nbsp;&nbsp;…&nbsp;&nbsp;&nbsp;');
            const date = resultItem.created_at;

            return resultItem.doc_type === 'post' ?
                <PostComponent key={`p${resultItem.post_id}`}
                               post={{
                                   id: resultItem.post_id,
                                   title: resultItem.highlight_title?.join('&nbsp;&nbsp;&nbsp;…&nbsp;&nbsp;&nbsp;'),
                                   author,
                                   content,
                                   site: resultItem.site,
                                   created: date,
                                   rating: 0,
                                   comments: 0,
                                   newComments: 0,
                               }}
                               showSite={true} autoCut={true} dangerousHtmlTitle={true} hideRating={true}/> :
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

    const {register, handleSubmit, formState: {errors}, setFocus} = useForm<SearchForm>({
        mode: 'onSubmit'
    });

    useEffect(() => {
        if (defaultSearch) {
            doSearch(defaultSearch);
        }
        setFocus('term');
    }, []);

    document.title = (searchParams.get('term') ? ('Поиск: ' + searchParams.get('term')) : 'Поиск');

    const onSubmit: SubmitHandler<SearchForm> = async data => {
        doSearch(data.term);
    };

    return (
        <div className={styles.search}>
            {isSearching && <div className={feedStyles.loading}></div>}

            <div className={feedStyles.container}>
                <div className={feedStyles.feed}>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <input type="text" {...register('term', {
                            required: ''
                        })} defaultValue={defaultSearch}/>
                        <input type="submit" disabled={isSearching} value="Искать"/>
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
