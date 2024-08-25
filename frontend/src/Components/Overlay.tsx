import React from 'react';
import useNoScroll from '../API/use/useNoScroll'; // Assuming you have an Overlay.css file for styling
import styles from './Overlay.module.scss';
import {useHotkeys} from 'react-hotkeys-hook';

const Overlay = (props: { onClick: () => void }) => {
    useNoScroll();
    useHotkeys('esc', props.onClick);

    return (
        <div className={styles.overlay} onClick={props.onClick}></div>
    );
};

export default Overlay;