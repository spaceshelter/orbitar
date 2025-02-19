import React, {MouseEvent} from 'react';
import styles from './CopyableEmbedCodeComponent.module.scss';
import {toast} from 'react-toastify';

interface CopyableEmbedCodeComponentProps {
    text: string;
}

export default function CopyableEmbedCodeComponent(props: CopyableEmbedCodeComponentProps) {
const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    if (e.target instanceof HTMLElement) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(e.target);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }
    navigator.clipboard.writeText(props.text).then(
        () => toast.success('В буфере!'),
        () => toast.error('Не удалось скопировать в буфер :(')
    );
};

    return (
        <div className={styles.embedCodeContainer} onClick={handleClick}>
            {props.text}
        </div>
    );
}