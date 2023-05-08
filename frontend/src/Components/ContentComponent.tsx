import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';
import type * as Vimeo from '@vimeo/player';

interface ContentComponentProps extends React.ComponentPropsWithRef<'div'> {
    content: string;
    autoCut?: number;
    lowRating?: boolean;
}

declare global {
    interface Window {
        Vimeo: typeof Vimeo;
        YT: typeof YT;
        onYouTubeIframeAPIReady: () => void;
    }
}

export const LARGE_AUTO_CUT = 650;
export const SMALL_AUTO_CUT = 100;

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

    updateVimeo(div);

    div.querySelectorAll('span.spoiler').forEach(spoiler => {
        updateSpoiler(spoiler as HTMLSpanElement);
    });

    div.querySelectorAll('details.expand').forEach(expand => {
        updateExpand(expand as HTMLDetailsElement);
    });
}

function updateVideo(video: HTMLVideoElement) {
    video.addEventListener('play', () => stopInnerVideos(document.body, video));
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
        });
    }
    return !!videoUrl;
}

function updateVimeo(div: HTMLDivElement) {
    const videos = div.querySelectorAll('iframe.vimeo-embed');

    if (videos.length === 0)
        return;

    const attachVimeoPlayer = (iframe: HTMLIFrameElement) => {
        const player = new window.Vimeo.Player(iframe);
        player.on('play', function() {
            stopInnerVideos(document.body, iframe);
        });
    };

    const attachAll = () => {
        videos.forEach(iframe => {
            attachVimeoPlayer(iframe as HTMLIFrameElement);
        });
    };

    if (window.Vimeo) {
        attachAll();
    } else {
        loadVimeoPlayer(attachAll);
    }
}

function loadVimeoPlayer(onload: () => void) {
    if (!document.getElementById('vimeo-embed')) {
        const tag = document.createElement('script');
        tag.id = 'vimeo-embed';
        tag.src = 'https://player.vimeo.com/api/player.js';
        tag.onload = onload;
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

    const checkAutoCut = (content: HTMLElement) => {
        if (props.autoCut) {
            const rect = content.getBoundingClientRect();
            if (rect.height > props.autoCut + 250) {
                setCut(true);
                return true;
            }
        }
        return false;
    };

    useEffect(() => {
        const content = contentDiv.current;
        if (!content) {
            return;
        }

        updateContent(content);
        let resizeObserver: ResizeObserver | null = null;

        if (props.lowRating) {
            content.querySelectorAll('img, video, iframe').forEach(el => el.classList.add('low-rating'));

            content.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                content.querySelectorAll('img, iframe, video').forEach(el => el.classList.remove('low-rating'));
                if (resizeObserver) {
                    resizeObserver.disconnect();
                }
                setCut(false);
                return false;
            }, {once: true});
        }

        if (!checkAutoCut(content)) {
            const handleResize = (entries: ResizeObserverEntry[]) => {
                for (const entry of entries) {
                    if (entry.target === content && checkAutoCut(content)) {
                        resizeObserver?.disconnect();
                        resizeObserver = null;
                    }
                }
            };

            if (props.autoCut) {
                resizeObserver = new ResizeObserver(handleResize);
                resizeObserver.observe(content);
            }

            return () => {
                if (resizeObserver) {
                    resizeObserver.disconnect();
                }
            };
        }

    }, [contentDiv, props.autoCut, props.lowRating]);

    const handleCut = () => {
        setCut(false);
    };

    return (
        <>
            <div className={classNames(styles.content, props.className, cut && styles.cut)}
                 style={{maxHeight: cut && props.autoCut ? props.autoCut: undefined}}
                 dangerouslySetInnerHTML={{__html: props.content}} ref={contentDiv} />
            {cut && <div className={styles.cutCover}><button className={styles.cutButton} onClick={handleCut}>Читать дальше</button></div>}
        </>
    );
}
