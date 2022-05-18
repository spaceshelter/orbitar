import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';

import {ReactComponent as CloseIcon} from '../Assets/close.svg';

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
    const [showHistory, setShowHistory] = useState(false);

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

    const toggleHistory = () => {
        setShowHistory(!showHistory);
    };

    return (
        showHistory
        ?<>
            <div className={styles.history}>
                <div className='content' dangerouslySetInnerHTML={{__html: props.content}}></div>
                <div className='sideNav' >
                    <div className='top' ><span>История</span><div className='close' onClick={toggleHistory}><CloseIcon /></div></div>

                    <div className='item selected' >
                        <div className='version'> Текущая версия </div>
                        <div className='date'>Сегодня 23:59</div>
                        <div className='info'> изменено 1% </div>
                    </div>
                    <div className='item' >
                        <div className='date'>Вчера 23:33 </div>
                        <div className='info'> изменено 8% </div>
                    </div>
                    <div className='item' >
                        <div className='date'> Июнь 20, 23:33 </div>
                        <div className='info danger'> изменено 99% </div>
                    </div>
                    <div className='item' >
                        <div className='date'>Апр 20, 23:33 </div>
                        <div className='info danger'> изменено 99% </div>
                    </div>
                    <div className='item' >
                        <div className='date'>Янв 20, 23:33 </div>
                        <div className='info'> изменено 2% </div>
                    </div>
                    <div className='item' >
                        <div className='version'> Исходная версия </div>
                        <div className='date'>Окт 12, 23:33 </div>
                    </div>
                </div>
            </div>
        </>
        :<>
            <a className={styles.toggleHistory} onClick={toggleHistory}> Show History </a>
            <div className={classNames(styles.content, props.className, cut && styles.cut)} dangerouslySetInnerHTML={{__html: props.content}} ref={contentDiv} />
            {cut && <div className={styles.cutCover}><button className={styles.cutButton} onClick={handleCut}>Читать дальше</button></div>}
        </>
    );
}