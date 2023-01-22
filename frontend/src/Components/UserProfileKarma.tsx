import {useAPI, useAppState} from '../AppState/AppState';
import React, {useEffect, useState} from 'react';
import Username from './Username';
import {Karma} from './Karma';
import {UserKarmaResponse} from '../API/UserAPI';
import { CircularProgressbar } from 'react-circular-progressbar';
import ratingSwitchStyles from './RatingSwitch.module.scss';
import styles from './UserProfileKarma.module.scss';
import {Link, useSearchParams} from 'react-router-dom';
import PostLink from './PostLink';
import moment from 'moment';
import {useRestrictions} from '../API/use/useRestrictions';
import {UserProfileResult} from '../API/UserAPIHelper';

type UserProfileKarmaProps = {
    username: string;
    profile?: UserProfileResult
};

const formatTimeSec = (sec: number) => {
    return moment.duration(sec, 'seconds').humanize(true);
};

export const UserProfileKarma = (props: UserProfileKarmaProps) => {
    const api = useAPI();
    const {userInfo} = useAppState();
    const [karmaResult, setKarmaResult] = useState<UserKarmaResponse | undefined>();
    const debug = useSearchParams()[0].get('debug') !== null;
    const restrictionsResult = useRestrictions(props.username);

    const isOwnProfile = props.username === userInfo?.username;

    useEffect(() => {
        debug && api.userAPI.userKarma(props.username)
            .then(result => {
                console.log('Karma response', result);
                setKarmaResult(result);
            })
            .catch(err => {
                console.error('Karma response error', err);
            });

    }, [api.userAPI, debug, props.username]);


    const sumPostRating = !karmaResult ? 0 :
        Object.keys(karmaResult.postRatingBySubsite)
            .reduce((acc, key) => acc + karmaResult.postRatingBySubsite[key], 0);

    const activeKarmaVotesSum = !karmaResult ? 0 :
        Object.keys(karmaResult.activeKarmaVotes)
            .reduce((acc, key) => acc + karmaResult.activeKarmaVotes[key], 0);

    const activeKarmaVotesCount = !karmaResult ? 0 : Object.keys(karmaResult.activeKarmaVotes).length;

    const positiveKarmaVotes = karmaResult &&
        Object.keys(karmaResult.activeKarmaVotes).filter(key => karmaResult.activeKarmaVotes[key] > 0);

    const negativeKarmaVotes = karmaResult &&
        Object.keys(karmaResult.activeKarmaVotes).filter(key => karmaResult.activeKarmaVotes[key] < 0);

    const postSubsites = karmaResult && Object.keys(karmaResult.postRatingBySubsite);
    const commentSubsites = karmaResult && Object.keys(karmaResult.commentRatingBySubsite);

    const restrictions = restrictionsResult && [
        !restrictionsResult.canInvite &&
        <><span className={'i i-can-not-invite'}></span>
            <div>
                Нет права приглашать других людей на орбитар.
                {restrictionsResult.effectiveKarma >= 0 && <>
                   <p>Для новичков это нормально, они получают это право после того, как начинают писать хорошие посты и комменты.</p>
                </>}
            </div>
        </>,

        restrictionsResult.commentSlowModeWaitSec > 0 &&
        <><span className={'i i-slow'}></span>Право комментировать ограничено одним комментарием в {formatTimeSec(restrictionsResult.commentSlowModeWaitSec)}.</>,

        restrictionsResult.postSlowModeWaitSec > 0 &&
        <><span className={'i i-no-posts'}></span>Право писать посты ограничено одним постом в {formatTimeSec(restrictionsResult.postSlowModeWaitSec)}.</>,

        !restrictionsResult.canEditOwnContent &&
        <><span className={'i i-no-edit'}></span>Нет права редактировать свои посты и комментарии.</>,

        !restrictionsResult.canVoteKarma &&
        <><span className={'i i-broken-heart'}></span>
            <div>Нет права ставить плюсы и минусы в карму.
                {restrictionsResult.effectiveKarma >= 0 && <>
                    <p>Это абсолютно нормально для новичков. Это право появляется после нескольких дней на сайте, если не молчать.</p>
                </>}
            </div>
        </>,

        !restrictionsResult.canVote &&
        <><span className={'i i-no-poop'}></span>Нет права ставить плюсы и минусы постам и комментариям. Голоса в карму другим людям отменены.</>,

        restrictionsResult.restrictedToPostId === true &&
        <><span className={'i i-dead'}></span>Права максимально ограничены, есть возможность создать свой последний пост.</>,

        Number.isFinite(restrictionsResult.restrictedToPostId) &&
        <>
            <span className={'i i-dead'}></span>
            <div>Права максимально ограничены, есть возможность писать только в своем
            <PostLink post={{
                id: restrictionsResult.restrictedToPostId as number,
                site: 'main'
            }}> последнем посте</PostLink>.
            </div>
        </>,
    ].filter(Boolean);

    const hasRestrictions = restrictions && restrictions.length !== 0;

    if (restrictions && restrictions.length === 0) {
        restrictions.push(<><span className={'i i-thumbs-up'}></span>
            <div>Ура! Права не ограничены!
            {!!props.profile?.trialApprovers && <>
                {props.profile.trialApprovers.find(u => u.vote > 0) && <p>Выдачу прав поддержали:
                    <ul className={styles.supporters}>
                        {props.profile.trialApprovers.map(user => user.vote > 0 &&
                            <li key={user.username}><Username user={user}/></li>)}
                    </ul>
                </p>}
                {props.profile.trialApprovers.find(u => u.vote < 0) && <p>Против были:
                    <ul className={styles.supporters}>
                        {props.profile.trialApprovers.map(user => user.vote < 0 &&
                            <li key={user.username}><Username user={user}/></li>)}
                    </ul>
                </p>}
            </>}
            </div></>);
    }

    if (restrictions && restrictionsResult.senatePenalty > 0) {
        // prepend
        restrictions.unshift(<><span className={'i i-irony'}></span>Наложен штраф сенатом. Но ведь у нас еще нет
            сената!</>);
    }

    const showTrialProgress = props.profile?.trialProgress !== undefined && (hasRestrictions || debug);

    return (
        <>
            {(isOwnProfile || showTrialProgress) && <div className={styles.info}>
                {showTrialProgress && props.profile?.trialProgress &&
                    <div className={styles.trialProgress}>
                        <CircularProgressbar value={props?.profile.trialProgress * 100}
                                             text={`${Math.round(props.profile?.trialProgress * 100)}%`}/>
                    </div>}
                <div>
                    {showTrialProgress && <p>← Прогресс к полным правам.</p>}
                    {isOwnProfile && <>
                        <p>Это все еще сырая версия саморегуляции, работающая по механизму,
                            <PostLink post={{id: 781, site: 'dev'}}> описанному тут</PostLink>.</p>
                        <p>Формула саморегуляции зависит от двух вещей — оценок другими людьми вас и вашего контента
                            (постов
                            и комментариев).
                            Если коротко, ведите себя по-человечески, производите хороший контент, и все будет
                            хорошо.</p>
                    </>}
                </div>
            </div>}

            {!restrictionsResult && <div>Загрузка...</div>}


            {!!restrictions?.length && <div>{restrictions.map((r, idx) =>
                <div key={idx} className={styles.restricted}>{r}</div>)}</div>}

            {karmaResult && <>
                <div>
                    <div>
                    <h3>Детали кармы:</h3>
                    <pre>
                        {JSON.stringify({
                            effectiveKarma: karmaResult.effectiveKarma,
                            userRating: karmaResult.effectiveKarmaUserRating,
                            contentRating: karmaResult.effectiveKarmaContentRating,
                            totalNormalizedContentRating: karmaResult.totalNormalizedContentRating,
                            contentVotersNum: karmaResult.contentVotersNum,
                        }, null, 2)}
                    </pre>
                    </div>
                    <div>
                    <h3>Прогресс прав:</h3>
                    <pre>
                        {JSON.stringify(karmaResult.trialProgress, null, 2)}
                    </pre>
                    </div>
                </div>

                <div className={styles.container}>
                    <Karma contentSumRating={karmaResult.totalNormalizedContentRating} postsSumRating={sumPostRating}
                           profileVotesCount={activeKarmaVotesCount} profileVotesSum={activeKarmaVotesSum}
                           senatePenalty={karmaResult.senatePenalty} />

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
                    <div className={styles.subsiteList}>
                        <h3>Рейтинг постов:</h3>
                        {!postSubsites?.length && <div>Нет постов</div>}
                        {postSubsites?.map((key) => {
                            const rating = karmaResult.postRatingBySubsite[key];
                            return <div key={key}><Link
                                to={key === 'main' ? '/' : `/s/${key}`}>{key}</Link>: {rating}
                            </div>;
                        })}
                    </div>
                    <div className={styles.subsiteList}>
                        <h3>Рейтинг комментариев:</h3>
                        {!commentSubsites?.length && <div>Нет комментариев</div>}
                        {commentSubsites?.map((key) => {
                            const rating = karmaResult.commentRatingBySubsite[key];
                            return <div key={key}><Link
                                to={key === 'main' ? '/' : `/s/${key}`}>{key}</Link>: {rating}
                            </div>;
                        })}
                    </div>
                </div>
            </>}
        </>
    );
};