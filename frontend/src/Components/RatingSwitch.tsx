import styles from './RatingSwitch.module.css';
import React, {useState} from 'react';
import {useAPI} from '../AppState/AppState';

interface RatingSwitchProps {
    rating: {
        vote?: number;
        value: number;
    };
    type: 'post' | 'comment' | 'user';
    id: number;
}

export default function RatingSwitch(props: RatingSwitchProps) {
    const api = useAPI();
    const [state, setState] = useState({rating: props.rating.value, vote: props.rating.vote});

    const handleVote = (vote: number) => {
        api.voteAPI.vote(props.type, props.id, vote)
            .then(result => {
                console.log('VOTE RESULT', result);
                setState({
                    rating: result.rating,
                    vote: result.vote
                })
            })
            .catch(error => {
                console.log('VOTE ERROR', error);
            });
    };

    return (
        <div className={styles.rating}>
            <button className={state.vote && state.vote < 0 ? styles.votedMinus : undefined} onClick={() => handleVote(-1)}>－</button>
            <div className={styles.value}>{state.rating}</div>
            <button className={state.vote && state.vote > 0 ? styles.votedPlus : undefined} onClick={() => handleVote(1)}>＋</button>
        </div>
    )
}
