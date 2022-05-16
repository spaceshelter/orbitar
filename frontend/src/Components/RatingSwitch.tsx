import styles from './RatingSwitch.module.scss';
import React, {ForwardedRef, useEffect, useRef, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import { toast } from 'react-toastify';
import {ReactComponent as MinusIcon} from '../Assets/rating_minus.svg';
import {ReactComponent as PlusIcon} from '../Assets/rating_plus.svg';
import {pluralize} from '../Utils/utils';
import Username from './Username';


type RatingSwitchProps = {
    rating: {
        vote?: number;
        value: number;
    };
    type: 'post' | 'comment' | 'user';
    id: number;
    double?: boolean;
    onVote?: (value: number, vote?: number) => void;
};

type VoteType = { vote: number, username: string };

export default function RatingSwitch(props: RatingSwitchProps) {
    const api = useAPI();
    const [state, setState] = useState({rating: props.rating.value, vote: props.rating.vote});
    const [showPopup, setShowPopup] = useState(false);
    const ratingRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const [votes, setVotes] = useState<VoteType[]>();

    useEffect(() => {
        setState({rating: props.rating.value, vote: props.rating.vote});
    }, [props]);

    useEffect(() => {
        if (!ratingRef.current || !popupRef.current) {
            return;
        }
        const [popupEl, ratingEl] = [popupRef.current, ratingRef.current];
        if (!showPopup) {
            return;
        }

        if (!votes) {
            api.voteAPI.list(props.type, props.id)
                .then(result => {
                    setVotes(result.votes);
                })
                .catch(() => {
                    toast.error('Не удалось загрузить голоса!');
                    setShowPopup(false);
                });
        }

        const rect = ratingEl.getBoundingClientRect();
        const x = rect.x;
        const y = rect.y + document.documentElement.scrollTop || 0;
        const [w, h] = [ratingEl.clientWidth, ratingEl.clientHeight];
        const [pw, ph] = [popupEl.clientWidth, popupEl.clientHeight];

        let ny = y + h + 8;
        if (ny + ph > document.documentElement.scrollHeight) {
            ny = y - 8 - ph;
        }
        let nx = x;
        if (nx + 8 + pw > document.documentElement.scrollWidth) {
            if (x+w+8>pw) {
                nx = x + w - pw;
            } else {
                nx = 8;
            }
        }

        popupEl.style.left = (nx) + 'px';
        popupEl.style.top = (ny) + 'px';

        const clickHandler = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            setShowPopup(false);
            setVotes(undefined);
            return false;
        };
        document.addEventListener('mousedown', clickHandler);
        return () => {
            document.removeEventListener('mousedown', clickHandler);
        };

    }, [showPopup, ratingRef, popupRef, votes, state.vote, props.id, props.type]);

    const handleVote = (vote: number) => {
        const prevState = { ...state };
        if (state.vote === vote) {
            vote = 0;
        }

        const newRating = state.rating - (state.vote || 0) + vote;

        setState({ vote: vote, rating: newRating});
        if (props.onVote) {
            props.onVote(newRating, vote);
        }

        api.voteAPI.vote(props.type, props.id, vote)
            .then(result => {
                setState({
                    rating: result.rating,
                    vote: result.vote
                });

                if (props.onVote) {
                    props.onVote(result.rating, result.vote);
                }
            })
            .catch(() => {
                setState(prevState);
                toast.warn('Голос не учтён 🤬', { position: 'bottom-right' });
            });
    };

    const handleVoteList = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowPopup(!showPopup);
    };

    const valueStyles = [styles.value];
    const plusStyles = [];
    const minusStyles = [];
    const plus2Styles = [];
    const minus2Styles = [];
    if (state.vote && state.vote < 0) {
        valueStyles.push(styles.minus);
        minusStyles.push(styles.minus);
        plusStyles.push(styles.dis);
        plus2Styles.push(styles.dis);
        if (state.vote < -1) {
            minus2Styles.push(styles.minus);
        }
    }
    else if (state.vote && state.vote > 0) {
        valueStyles.push(styles.plus);
        plusStyles.push(styles.plus);
        minusStyles.push(styles.dis);
        minus2Styles.push(styles.dis);
        if (state.vote > 1) {
            plus2Styles.push(styles.plus);
        }
    }

    return (
        <>
            <div ref={ratingRef} className={styles.rating}>
                {props.double && <button className={minus2Styles.join(' ')} onClick={() => handleVote(-2)}><MinusIcon /></button>}
                <button className={minusStyles.join(' ')} onClick={() => handleVote(-1)}><MinusIcon /></button>
                <div onClick={handleVoteList} className={valueStyles.join(' ')}>{state.rating}</div>
                <button className={plusStyles.join(' ')} onClick={() => handleVote(1)}><PlusIcon /></button>
                {props.double && <button className={plus2Styles.join(' ')} onClick={() => handleVote(2)}><PlusIcon /></button>}
            </div>
            {showPopup && <RatingList ref={popupRef} vote={state.vote || 0} rating={state.rating} votes={votes}></RatingList>}
        </>
    );
}

type RatingListProps = {
    rating: number;
    vote: number;
    votes?: VoteType[];
};

const RatingList = React.forwardRef((props: RatingListProps, ref: ForwardedRef<HTMLDivElement>) => {
    const [voteList, setVoteList] = useState<{votes: VoteType[][], counters: {users: number, value: number}[]} | undefined>();

    useEffect(() => {
        if (!props.votes) {
            return;
        }

        const votes: VoteType[][] = [[], []];
        const counters: {users: number, value: number}[] = [{users: 0, value: 0}, {users: 0, value: 0}];

        for (const vote of props.votes) {
            if (vote.vote === 0) {
                continue;
            }
            const cnt = vote.vote > 0 ? 1 : 0;
            votes[cnt].push(vote);
            counters[cnt].users++;
            counters[cnt].value += vote.vote;
        }

        setVoteList({votes, counters});
    }, [props.rating, props.votes, props.vote]);

    const listStyles = [styles.listValue];
    if (props.vote > 0) {
        listStyles.push(styles.listValuePlus);
    }
    else if (props.vote < 0) {
        listStyles.push(styles.listValueMinus);
    }

    const popupMouseDownHandler = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    return (
        <div ref={ref} className={styles.list} onMouseDown={popupMouseDownHandler}>
            <div className={styles.listUp}>
                <div className={listStyles.join(' ')}>{props.rating}</div>
                <div className={styles.listDetails}>
                    {voteList ? <>
                        <div>{voteList.counters[1].users > 0 ? pluralize(voteList.counters[1].value, ['плюс', 'плюса', 'плюсов']) + ' от ' + pluralize(voteList.counters[1].users, ['юзера', 'юзеров', 'юзеров']) : 'нет плюсов'}</div>
                        <div>{voteList.counters[0].users > 0 ? pluralize(voteList.counters[0].value, ['минус', 'минуса', 'минусов']) + ' от ' + pluralize(voteList.counters[0].users, ['юзера', 'юзеров', 'юзеров']) : 'нет минусов'}</div>
                    </> : <div>...</div>}
                </div>
            </div>
            <div className={styles.listDown}>
                <div className={styles.listScrollContainer}>
                    {voteList ? <>
                        <div className={styles.listMinus}>
                            {voteList.votes[0].length > 0 ? voteList.votes[0].map((v) => <div key={v.username}><Username className={styles.username} user={ {username: v.username} } /> {v.vote}</div>) : 'пусто'}
                        </div>
                        <div className={styles.listPlus}>
                            {voteList.votes[1].length > 0 ? voteList.votes[1].map((v) => <div key={v.username}><Username className={styles.username} user={ {username: v.username} } /> +{v.vote}</div>) : 'пусто'}
                        </div>
                    </>
                    : <>...</>}
                </div>
            </div>
        </div>
    );
});
