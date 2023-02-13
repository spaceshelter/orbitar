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

    div.querySelectorAll('details.expand').forEach(expand => {
        updateExpand(expand as HTMLDetailsElement);
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

function processYtEmbed(img: HTMLImageElement) {
    // if has class youtube-embed convert to iframe on click
    const ytUrl = img.dataset.youtube;

    if (ytUrl && !img.classList.contains('youtube-embed-processed')) {
        img.classList.add('youtube-embed-processed');
        img.addEventListener('click', (e) => {
            e.preventDefault();
            const iframe = document.createElement('iframe');
            iframe.src = ytUrl + (ytUrl.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1&enablejsapi=1';
            iframe.width = img.width.toString();
            iframe.height = img.height.toString();
            iframe.allowFullscreen = true;
            iframe.frameBorder = '0';
            iframe.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture';
            iframe.classList.add('youtube-embed');
            img.parentElement?.replaceWith(iframe);
        });
    }
    return !!ytUrl;
}

/**
 * Convert mp4 video embeds into video elements
 */
function processVideoEmbed(img: HTMLImageElement) {
    const videoUrl = img.dataset.video;

    if (videoUrl && !img.classList.contains('video-embed-processed')) {
        img.classList.add('video-embed-processed');
        img.addEventListener('click', (e) => {
            e.preventDefault();
            const video = document.createElement('video');
            video.src = videoUrl;
            video.controls = true;
            video.autoplay = true;
            video.loop = !!img.dataset.loop && img.dataset.loop !== 'false';
            video.style.width = img.width.toString() + 'px';
            video.style.height = img.height.toString() + 'px';
            img.parentElement?.replaceWith(video);
        });
    }
    return !!videoUrl;
}

function updateImg(img: HTMLImageElement) {
    if (processYtEmbed(img) || processVideoEmbed(img)) {
        return;
    }

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
    const spoilerOnClickHandler = () => {
        spoiler.classList.remove('spoiler');
        spoiler.removeEventListener('click', spoilerOnClickHandler);
    };
    spoiler.addEventListener('click', spoilerOnClickHandler);
}

function updateExpand(expand: HTMLDetailsElement) {
    expand.addEventListener('toggle', () => {
        if (!expand.open) {
            stopVideo(expand);
        }
    });

    const expandClose = expand.querySelector('div[role="button"]');

    if (expandClose) {
        expandClose.addEventListener('click', () => {
            expand.open = false;
        });
    }
}

function stopVideo(el: HTMLElement) {
    el.querySelectorAll('video').forEach(video => {
        video.pause();
    });

    el.querySelectorAll('iframe.youtube-embed').forEach(iframe => {
        const iframeYt = iframe as HTMLIFrameElement;
        iframeYt.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    });
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
