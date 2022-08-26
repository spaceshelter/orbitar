import React, {FC, useEffect, useState} from 'react';
import styles from './SlowMode.module.scss';

export type SlowModeProps = {
    endTime: Date;
    endCallback?: () => void; // called when slow mode ends
};

/**
 * Displays a message with a countdown to the end of the slow mode.
 * @param props
 */
const SlowMode: FC<SlowModeProps> = (props) => {
    const {endTime, endCallback} = props;
    const [timeLeft, setTimeLeft] = useState(endTime.getTime() - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const newTimeLeft = endTime.getTime() - Date.now();
            if (newTimeLeft <= 0) {
                if (endCallback) {
                    endCallback();
                }
                clearInterval(interval);
            } else {
                setTimeLeft(endTime.getTime() - Date.now());
            }
        }, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [endTime]);

    return <div className={styles.slowmode}>
        {props.children}
        <div className={styles.timeleft}>{formatTimeLeft(timeLeft)}</div>
    </div>;
};
export default SlowMode;

/*
* Formats time (in ms) to the format  hh:mm:ss
* */
const formatTimeLeft = (timeLeft: number) => {
    const hours = Math.floor(timeLeft / 1000 / 60 / 60);
    const minutes = Math.floor(timeLeft / 1000 / 60 % 60);
    const seconds = Math.floor(timeLeft / 1000 % 60);
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};
