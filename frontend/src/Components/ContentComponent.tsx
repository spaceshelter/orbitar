import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';

interface ContentComponentProps extends React.ComponentPropsWithRef<'div'> {
    content: string;
    autoCut?: boolean;
    lowRating?: boolean;
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

    div.querySelectorAll('video').forEach(video => {
        updateVideo(video);
    });

    div.querySelectorAll('span.spoiler').forEach(spoiler => {
        updateSpoiler(spoiler as HTMLSpanElement);
    });    
}

function updateVideo(video: HTMLVideoElement) {
    if (video.dataset.aspectRatioProcessed) {
        return;
    }
    video.addEventListener('loadeddata', () => {
        if (video.readyState < 3 || video.videoHeight === 0) {
            return;
        }
        video.style.aspectRatio = (video.videoWidth / video.videoHeight).toString();
        video.dataset.aspectRatioProcessed = '1';
    });
}

function updateImg(img: HTMLImageElement) {
    if (img.naturalWidth > 500 || img.naturalHeight > 500) {
        // will be displayed as block if not immediately surrounded by <br>
        const nextBr = !img.nextSibling || img.nextSibling.nodeName === 'BR';
        const prevBr = !img.previousSibling || img.previousSibling.nodeName === 'BR';
        if (!nextBr || !prevBr) {
            img.classList.add('image-large');
        }
    }

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

function updateSpoiler(spoiler: HTMLSpanElement) {
    spoiler.onclick = () => {
        spoiler.classList.toggle('spoiler');
    };
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

        if (props.lowRating) {
            content.querySelectorAll('img, video, iframe').forEach(el => el.classList.add('low-rating'));

            content.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                content.querySelectorAll('img, iframe, video').forEach(el => el.classList.remove('low-rating'));
                return false;
            }, {once: true});
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
