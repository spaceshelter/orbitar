import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';

interface ContentComponentProps extends React.ComponentPropsWithRef<'div'> {
    content: string;
    autoCut?: boolean;
}

function updateContent(div: HTMLDivElement) {
    div.querySelectorAll('img').forEach(img => {
        if (img.complete) {
            updateImg(img);
            return;
        }

        img.onload = () => {
            updateImg(img);
        };
    });
}

function updateImg(img: HTMLImageElement) {
    let el: HTMLElement | null = img;
    while (el) {
        if (el.tagName.toUpperCase() === 'A') {
            return;
        }
        el = el.parentElement;
    }

    let imageLarge = false;
    img.classList.add('image-scalable');
    if (img.naturalWidth > 500 || img.naturalHeight > 500) {
        img.onclick = () => {
            if (imageLarge) {
                imageLarge = false;
                img.classList.remove('image-preview');
                return;
            }
            imageLarge = true;
            img.classList.add('image-preview');
        };
    }
}

export default function ContentComponent(props: ContentComponentProps) {
    const contentDiv = useRef<HTMLDivElement>(null);
    const [cut, setCut] = useState(false);

    useEffect(() => {
        const content = contentDiv.current;
        if (!content) {
            return;
        }

        updateContent(content);

        if (props.autoCut) {
            const rect = content.getBoundingClientRect();
            if (rect.height > 1000) {
                setCut(true);
            }
        }
    }, [contentDiv, props.autoCut]);

    const handleCut = () => {
        setCut(false);
    };

    return (
        <>
            <div className={classNames(styles.content, props.className, cut && styles.cut)} dangerouslySetInnerHTML={{__html: props.content}} ref={contentDiv} />
            {cut && <div className={styles.cutCover}><button className={styles.cutButton} onClick={handleCut}>Читать дальше</button></div>}
        </>
    );
}