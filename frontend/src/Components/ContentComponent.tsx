import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';
import {createObserverService, observeOnHidden} from '../Services/ObserverService';
import * as Vimeo from '@vimeo/player';

interface ContentComponentProps extends React.ComponentPropsWithRef<'div'> {
    content: string;
    autoCut?: boolean;
    lowRating?: boolean;
}

declare global {
    interface Window {
        Vimeo: typeof Vimeo;
        YT: typeof YT;
        onYouTubeIframeAPIReady: () => void;
    }
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

    div.querySelectorAll('iframe.vimeo-embed').forEach(iframe => {
        updateVimeo(iframe as HTMLIFrameElement);
    });

    div.querySelectorAll('span.spoiler').forEach(spoiler => {
        updateSpoiler(spoiler as HTMLSpanElement);
    });

    div.querySelectorAll('details.expand').forEach(expand => {
        updateExpand(expand as HTMLDetailsElement);
    });
}

function updateVideo(video: HTMLVideoElement) {
    video.addEventListener('play', () => stopInnerVideos(document.body, video));
    observeOnHidden(video, () => stopVideo(video));
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
            loadYTPlayer(iframe);
            observeOnHidden(iframe, () => stopVideo(iframe));
        });
    }
    return !!ytUrl;
}

function loadYTPlayer(iframe: HTMLIFrameElement) {
    const attachYTPlayer = () => {
        new YT.Player(iframe as HTMLIFrameElement,    {
            events: {
                onStateChange: (event) => {
                    if (event.data === YT.PlayerState.PLAYING) {
                        stopInnerVideos(document.body, iframe);
                    }
                },
            }
        });
    };

    if (window.YT) {
        attachYTPlayer();
    } else {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/player_api';
        window.onYouTubeIframeAPIReady = attachYTPlayer;
        document.head.append(tag);
    }
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
            video.addEventListener('play', () => stopInnerVideos(document.body, video));
            observeOnHidden(video, () => stopVideo(video));
        });
    }
    return !!videoUrl;
}

function updateVimeo(iframe: HTMLIFrameElement) {

    loadVimeoPlayer(iframe);
    observeOnHidden(iframe, () => stopVideo(iframe));

}

function loadVimeoPlayer(iframe: HTMLIFrameElement) {
    const attachVimeoPlayer = () => {
        const player = new window.Vimeo.Player(iframe);
        player.on('play', function() {
            stopInnerVideos(document.body, iframe);
        });
    };

    if (window.Vimeo) {
        attachVimeoPlayer();
    } else {
        const tag = document.createElement('script');
        tag.src = 'https://player.vimeo.com/api/player.js';
        tag.onload = () => {attachVimeoPlayer();};
        document.head.append(tag);
    }
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
            stopInnerVideos(expand);
        }
    });

    const expandClose = expand.querySelector('div[role="button"]');

    if (expandClose) {
        expandClose.addEventListener('click', () => {
            expand.open = false;
        });
    }
}

function stopVideo(el: HTMLVideoElement | HTMLIFrameElement) {
    if (el instanceof HTMLVideoElement) {
        (el as HTMLVideoElement).pause();
        return;
    }
    if (el instanceof HTMLIFrameElement && el.classList.contains('youtube-embed')) {
        (el as HTMLIFrameElement).contentWindow?.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}', '*'
        );
        return;
    }
    if (el instanceof HTMLIFrameElement && el.classList.contains('vimeo-embed')) {
        (el as HTMLIFrameElement).contentWindow?.postMessage(
            '{"method":"pause"}', '*'
        );
        return;
    }
}

function stopInnerVideos(el: Element, exept?: HTMLVideoElement | HTMLIFrameElement) {
    el.querySelectorAll('video').forEach(video => {
        if (video === exept)
            return;
        stopVideo(video);
    });
    el.querySelectorAll('iframe.youtube-embed').forEach(iframe => {
        if (iframe === exept)
            return;
        stopVideo(iframe as HTMLIFrameElement);
    });
    el.querySelectorAll('iframe.vimeo-embed').forEach(iframe => {
        if (iframe === exept)
            return;
        stopVideo(iframe as HTMLIFrameElement);
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

        createObserverService();
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
