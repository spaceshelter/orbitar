import {useAPI} from '../AppState/AppState';
import React, {useEffect, useState} from 'react';
import Username from './Username';
import {Karma} from './Karma';
import {UserKarmaResponse} from '../API/UserAPI';
import ratingSwitchStyles from './RatingSwitch.module.scss';
import styles from './UserProfileKarma.module.scss';
import {Link} from 'react-router-dom';

type UserProfileKarmaProps = {
    username: string;
};

export const UserProfileKarma = (props: UserProfileKarmaProps) => {
    const api = useAPI();
    const [karmaResult, setKarmaResult] = useState<UserKarmaResponse | undefined>();

    useEffect(() => {
        api.userAPI.userKarma(props.username)
            .then(result => {
                console.log('Karma response', result);
                setKarmaResult(result);
            })
            .catch(err => {
                console.error('Karma response error', err);
            });
    }, [api.userAPI]);


    const sumPostRating = !karmaResult ? 0 :
        Object.keys(karmaResult.postRatingBySubsite)
            .reduce((acc, key) => acc + karmaResult.postRatingBySubsite[key], 0);

    const sumCommentRating = !karmaResult ? 0 :
        Object.keys(karmaResult.commentRatingBySubsite)
            .reduce((acc, key) => acc + karmaResult.commentRatingBySubsite[key], 0);

    const activeKarmaVotesSum = !karmaResult ? 0 :
        Object.keys(karmaResult.activeKarmaVotes)
            .reduce((acc, key) => acc + karmaResult.activeKarmaVotes[key], 0);

    const activeKarmaVotesCount = !karmaResult ? 0 : Object.keys(karmaResult.activeKarmaVotes).length;

    const positiveKarmaVotes = karmaResult &&
        Object.keys(karmaResult.activeKarmaVotes).filter(key => karmaResult.activeKarmaVotes[key] > 0);

    const negativeKarmaVotes = karmaResult &&
        Object.keys(karmaResult.activeKarmaVotes).filter(key => karmaResult.activeKarmaVotes[key] < 0);

    return (
        !karmaResult ?
            <div>Загрузка...</div>
            : <>
                <div className={styles.container}>
                    <Karma commentsSumRating={sumCommentRating} postsSumRating={sumPostRating}
                           profileVotesCount={activeKarmaVotesCount} profileVotesSum={activeKarmaVotesSum}/>

                    <div>
                        <h3>Голоса активных пользователей:</h3>
                        <div className={ratingSwitchStyles.listDown}>
                            <div className={ratingSwitchStyles.listScrollContainer}>
                                {!!negativeKarmaVotes?.length && <div className={ratingSwitchStyles.listMinus}>
                                    {negativeKarmaVotes.map((key) => {
                                        const vote = karmaResult.activeKarmaVotes[key];
                                        return <div key={key}>
                                            <Username className={styles.username} user={{username: key}}/>{vote}
                                        </div>;
                                    })}
                                </div>}
                                {!!positiveKarmaVotes?.length && <div className={ratingSwitchStyles.listPlus}>
                                    {positiveKarmaVotes.map((key) => {
                                            const vote = karmaResult.activeKarmaVotes[key];
                                            return <div key={key}>
                                                <Username className={styles.username} user={{username: key}}/>+{vote}
                                            </div>;
                                        }
                                    )}
                                </div>}
                            </div>
                        </div>
                    </div>
                </div>
                <div className={styles.container}>
                    <div>
                        <h3>Рейтинг постов:</h3>
                        {Object.keys(karmaResult.postRatingBySubsite).map((key) => {
                            const rating = karmaResult.postRatingBySubsite[key];
                            return <div key={key}><Link
                                to={key === 'main' ? '/' : `/s/${key}`}>{key}</Link>: {rating}
                            </div>;
                        })}
                    </div>
                    <div>
                        <h3>Рейтинг комментариев:</h3>
                        {Object.keys(karmaResult.commentRatingBySubsite).map((key) => {
                            const rating = karmaResult.commentRatingBySubsite[key];
                            return <div key={key}><Link
                                to={key === 'main' ? '/' : `/s/${key}`}>{key}</Link>: {rating}
                            </div>;
                        })}
                    </div>
                </div>
            </>
    );
};