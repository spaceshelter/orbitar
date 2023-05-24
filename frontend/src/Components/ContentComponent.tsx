import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';
import {observeOnHidden} from '../Services/ObserverService';
import type * as Vimeo from '@vimeo/player';
import {getVideoAutopause} from './UserProfileSettings';

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

const iframeToOriginalEl = new WeakMap<HTMLIFrameElement, HTMLElement>();

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
    video.addEventListener('play', () => stopInnerVideos(document.body, video));
    if (getVideoAutopause()) {
        observeOnHidden(video, () => stopVideo(video));
    }

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
            if (getVideoAutopause()) {
                observeOnHidden(iframe, () => stopVideo(iframe));
            }
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
            if (getVideoAutopause()) {
                observeOnHidden(video, () => stopVideo(video));
            }
        });
    }
    return !!videoUrl;
}

function processCoubEmbed(img: HTMLImageElement) {
    const coubUrl = img.dataset.coub;

    if (coubUrl && !img.classList.contains('coub-embed-processed')) {
        const orignalEl = img.parentElement?.cloneNode(true) as HTMLImageElement; // Clone the original img element

        img.classList.add('coub-embed-processed');
        img.addEventListener('click', (e) => {
            e.preventDefault();
            const iframe = document.createElement('iframe');
            iframe.src = coubUrl + (coubUrl.indexOf('?') === -1 ? '?' : '&') +
                'muted=false&autostart=true&originalSize=false&startWithHD=true';

            iframe.classList.add('coub-embed');
            iframe.allowFullscreen = true;
            iframe.frameBorder = '0';
            // use current rendered image size as iframe size
            iframe.width = img.getBoundingClientRect().width.toString();
            iframe.height = img.getBoundingClientRect().height.toString();
            iframe.allow = 'autoplay';
            img.parentElement?.replaceWith(iframe);

            iframeToOriginalEl.set(iframe, orignalEl);
            stopInnerVideos(document.body, iframe);

            // coubs are always stopped when hidden
            observeOnHidden(iframe, () => {
                stopVideo(iframe);
            });
        });
    }
    return !!coubUrl;
}

function processVimeoEmbed(img: HTMLImageElement) {
    const vimeoUrl = img.dataset.vimeo;

    if (vimeoUrl && !img.classList.contains('vimeo-embed-processed')) {
        img.classList.add('vimeo-embed-processed');
        img.addEventListener('click', (e) => {
            e.preventDefault();
            const iframe = document.createElement('iframe');
            iframe.src = vimeoUrl;
            iframe.width = img.width.toString();
            iframe.height = img.height.toString();
            iframe.allowFullscreen = true;
            iframe.frameBorder = '0';
            iframe.allow = 'autoplay; fullscreen; picture-in-picture';
            iframe.classList.add('vimeo-embed');
            img.parentElement?.replaceWith(iframe);

            loadVimeoPlayer(() => {
                const player = new window.Vimeo.Player(iframe);
                player.on('play', function() {
                    stopInnerVideos(document.body, iframe);
                });
            });

            if (getVideoAutopause()) {
                observeOnHidden(iframe, () => stopVideo(iframe));
            }
        });
    }
    return !!vimeoUrl;
}

function loadVimeoPlayer(onload: () => void) {
    if (window.Vimeo) {
        onload();
        return;
    }
    if (!document.getElementById('vimeo-embed')) {
        const tag = document.createElement('script');
        tag.id = 'vimeo-embed';
        tag.src = 'https://player.vimeo.com/api/player.js';
        tag.onload = onload;
        document.head.append(tag);
    }
}

function updateImg(img: HTMLImageElement) {
    if (processYtEmbed(img) || processVideoEmbed(img) || processCoubEmbed(img) || processVimeoEmbed(img)) {
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
    if (el instanceof HTMLIFrameElement && el.classList.contains('coub-embed')) {
        const originalEl = iframeToOriginalEl.get(el);
        if (originalEl) {
            el.replaceWith(originalEl);
            updateImg(originalEl.querySelector(`img`) as HTMLImageElement);
        }
    }
}

function stopInnerVideos(el: Element, except?: HTMLVideoElement | HTMLIFrameElement) {
    el.querySelectorAll('video,iframe.youtube-embed,iframe.vimeo-embed,iframe.coub-embed')
        .forEach(iframe => {
            if (iframe === except) {
                return;
            }
            if (iframe instanceof HTMLIFrameElement || iframe instanceof HTMLVideoElement) {
                stopVideo(iframe as HTMLIFrameElement | HTMLVideoElement);
            }
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
