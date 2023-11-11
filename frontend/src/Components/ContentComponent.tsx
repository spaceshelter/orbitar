import React, {useEffect, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';
import overlayStyles from './Overlay.module.scss';
import {observeOnHidden} from '../Services/ObserverService';
import type * as Vimeo from '@vimeo/player';
import {getLegacyZoom, getVideoAutopause} from './UserProfileSettings';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import {useHotkeys} from 'react-hotkeys-hook';
import {SecretMailEncoderForm, SecretMailDecoderForm} from './SecretMailbox';

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

type ZoomedImg = {
    src: string;
    width: number;
    height: number;
};

type MailboxKey = {
    type: 'mailbox';
    forUsername?: string;
    openKey: string;
};

type MailKey = {
    type: 'mail';
    secret: string;
    title: string;
};

function updateContent(
    div: HTMLDivElement,
    setZoomedImg: (img: ZoomedImg | null) => void,
    setMailboxKey: (key: MailboxKey | MailKey | null) => void
) {
    div.querySelectorAll('img').forEach(img => {
        if (img.complete) {
            updateImg(img, setZoomedImg);
            return;
        }

        img.onload = () => {
            updateImg(img, setZoomedImg);
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

    div.querySelectorAll('span.secret-mailbox').forEach(mailbox => {
        updateMailbox(mailbox as HTMLSpanElement, setMailboxKey);
    });

    div.querySelectorAll('span.secret-mail').forEach(mail => {
        updateMail(mail as HTMLSpanElement, setMailboxKey);
    });
}

function updateMailbox(mailbox: HTMLSpanElement,
                          setMailboxKey: (key: MailboxKey | null) => void
                       ) {
    const secret = mailbox.dataset.secret;
    if (!secret) {
        return;
    }
    // try to find username as the text in in a.mention
    const mention = mailbox.querySelector('a.mention');
    const username = mention?.textContent?.trim();

    mailbox.addEventListener('click', () => {
        setMailboxKey({
            type: 'mailbox',
            openKey: secret,
            forUsername: username,
        });
    });
}

function updateMail(mail: HTMLSpanElement,
                    setMailboxKey: (key: MailKey | null) => void
) {
    const secret = mail.dataset.secret;
    if (!secret) {
        return;
    }
    // just the text
    const title = mail.innerText.trim();

    mail.addEventListener('click', () => {
        setMailboxKey({
            type: 'mail',
            secret: secret,
            title: title,
        });
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

            loadYTPlayer(() => {
                const player = new YT.Player(iframe, {
                    events: {
                        onStateChange: (event) => {
                            if (event.data === YT.PlayerState.PLAYING) {
                                stopInnerVideos(document.body, iframe);
                            }
                        },
                    }
                });
                player.playVideo(); //?
            });

            if (getVideoAutopause()) {
                observeOnHidden(iframe, () => stopVideo(iframe));
            }
        });
    }
    return !!ytUrl;
}

function loadYTPlayer(onload: () => void) {
    if (window.YT) {
        onload();
        return;
    }
    if (!document.getElementById('yt-embed')) {
        const tag = document.createElement('script');
        tag.id = 'yt-embed';
        tag.src = 'https://www.youtube.com/player_api';
        window.onYouTubeIframeAPIReady = onload;
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
                player.play();
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

function updateImg(img: HTMLImageElement, setZoomedImg: (img: ZoomedImg | null) => void) {
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
    if (img.naturalWidth > 500 || img.naturalHeight > 500) {
        img.classList.add('image-scalable');
        img.onclick = () => {
            if (getLegacyZoom()) {
                if (imageLarge) {
                    imageLarge = false;
                    img.classList.remove('image-preview');
                    return;
                }
                imageLarge = true;
                img.classList.add('image-preview');
            } else {
                setZoomedImg({
                    src: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                });
            }
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
            updateImg(originalEl.querySelector(`img`) as HTMLImageElement, () => {} );
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
    const [zoomedImg, setZoomedImg] = useState<ZoomedImg | null>(null);
    const [mailboxKey, setMailboxKey] = useState<MailboxKey | MailKey | null>(null);

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

        updateContent(content, setZoomedImg, setMailboxKey);
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

    useEffect(() => {
        if (!props.autoCut && cut) {
            setCut(false);
        }
    }, [props.autoCut, cut]);

    const handleCut = () => {
        setCut(false);
    };

    return (
        <>
            <div className={classNames(styles.content, props.className, cut && styles.cut)}
                 style={{maxHeight: cut && props.autoCut ? props.autoCut: undefined}}
                 dangerouslySetInnerHTML={{__html: props.content}} ref={contentDiv} />
            {cut && <div className={styles.cutCover}><button className={styles.cutButton} onClick={handleCut}>Читать дальше</button></div>}
            {zoomedImg &&  <ZoomComponent {...zoomedImg} onExit={() => setZoomedImg(null)} />}
            {mailboxKey &&
                (mailboxKey.type === 'mailbox' && <SecretMailEncoderForm {...mailboxKey} onClose={() => setMailboxKey(null)} /> ||
                mailboxKey.type === 'mail' && <SecretMailDecoderForm {...mailboxKey} onClose={() => setMailboxKey(null)} />)
            }
        </>
    );
}

// extract zoom component

interface ZoomComponentProps {
    src: string;
    width: number;
    height: number;
    onExit: () => void;
}

function ZoomComponent(props: ZoomComponentProps) {
    // need to account for retina displays
    const minScale = Math.min(1, window.innerWidth / props.width, window.innerHeight / props.height);
    const defaultScale = Math.min(window.innerWidth / props.width, window.innerHeight / props.height);
    const defaultTranslateX = (window.innerWidth - props.width * defaultScale) / 2;
    const defaultTranslateY = (window.innerHeight - props.height * defaultScale) / 2;
    useHotkeys('esc', props.onExit);

    return (
        <div className={overlayStyles.overlay}
            onClick={(e) => {
                // check if click originated from this element
                if ((e.target as HTMLElement).classList.contains('react-transform-wrapper')) {
                    props.onExit();
                }
            }}
        >
            <TransformWrapper
                initialScale={defaultScale}
                limitToBounds={true}
                centerZoomedOut={true}
                minScale={minScale}
                initialPositionX={defaultTranslateX}
                initialPositionY={defaultTranslateY}
            >
                <TransformComponent
                    wrapperStyle={
                        {
                            width: '100vw',
                            height: '100vh',
                        }
                    }
                >
                <img src={props.src} alt="" style={
                    {
                        maxWidth: 'auto !important',
                        maxHeight: 'auto !important',
                    }
                }/>
                </TransformComponent>
            </TransformWrapper>
            <span className={classNames('i i-close', styles.overlayCloseButton)} onClick={props.onExit} />
        </div>
    );
}