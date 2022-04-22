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

    const handleVoteList = () => {

    };

    return (
        <div className={styles.container}>
            <div className={styles.rating}>
                <button className={state.vote && state.vote < 0 ? styles.votedMinus : undefined} onClick={() => handleVote(-1)}>－</button>
                <div className={styles.value} onClick={handleVoteList}>{state.rating}</div>
                <button className={state.vote && state.vote > 0 ? styles.votedPlus : undefined} onClick={() => handleVote(1)}>＋</button>

            </div>
            <div className={styles.list}>
                <span className={styles.arrow}>^</span>
                <div className={styles.container}>
                    <div className={styles.listHeader}> Рейтинг: {state.rating}</div>
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
        </div>
    )
}
