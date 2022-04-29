import styles from './RatingSwitch.module.css';
import React, {useEffect, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import { toast } from 'react-toastify';


interface RatingSwitchProps {
    rating: {
        vote?: number;
        value: number;
    };
    type: 'post' | 'comment' | 'user';
    id: number;
    double?: boolean;
}

export default function RatingSwitch(props: RatingSwitchProps) {
    const api = useAPI();
    const [state, setState] = useState({rating: props.rating.value, vote: props.rating.vote});

    useEffect(() => {
        setState({rating: props.rating.value, vote: props.rating.vote})
    }, [props]);

    const handleVote = (vote: number) => {
        const prevState = { ...state };
        if (state.vote === vote) {
            vote = 0;
        }

        setState({ vote: vote, rating: state.rating - (state.vote || 0) + vote });
        api.voteAPI.vote(props.type, props.id, vote)
            .then(result => {
                setState({
                    rating: result.rating,
                    vote: result.vote
                })
            })
            .catch(error => {
                setState(prevState);
                toast.warn('Голос не учтён 🤬', { position: 'bottom-right' });
            });
    };

    const handleVoteList = () => {

    };

    return (
        <div className={styles.container}>
            <div className={styles.rating}>
                {props.double && <button className={state.vote && state.vote < -1 ? styles.votedMinus : undefined} onClick={() => handleVote(-2)}>－</button>}
                <button className={state.vote && state.vote < 0 ? styles.votedMinus : undefined} onClick={() => handleVote(-1)}>－</button>
                <div className={styles.value} onClick={handleVoteList}>{state.rating}</div>
                <button className={state.vote && state.vote > 0 ? styles.votedPlus : undefined} onClick={() => handleVote(1)}>＋</button>
                {props.double && <button className={state.vote && state.vote > 1 ? styles.votedPlus : undefined} onClick={() => handleVote(2)}>＋</button>}
            </div>
        </div>
    )
}

function RatingList(props: RatingSwitchProps) {
    return (
        <div className={styles.list}>
            <span className={styles.arrow}>^</span>
            <div className={styles.container}>
                <div className={styles.listHeader}> Рейтинг: {props.rating}</div>
                <div className={styles.listColumns}>
                    <button className={styles.listLeft}>&lt;</button>
                    <div className={styles.listColumnPlus}>
                        <div>плюсов: 0</div>
                        ...<br />...<br />...
                    </div>
                    <div className={styles.listColumnMinus}>
                        <div>минусов: 0</div>
                        ...
                    </div>
                    <button className={styles.listRight}>&gt;</button>
                </div>
                <div className={styles.listPages}>. . . .</div>
            </div>
        </div>
    )
}