import React, { useEffect, useRef, useState } from 'react'

import { PollComponent } from '@components/Poll/PollComponent'
import Button from '@ui/Button'
import type * as Vimeo from '@vimeo/player'
import classNames from 'classnames'
import { reaction } from 'mobx'
import { createRoot } from 'react-dom/client'

import { AppState, useAppState, ZoomedImg } from '../AppState/AppState'
import { FakeRoot } from '../index'
import { observeOnHidden } from '../Services/ObserverService'
import { useTheme } from '../Theme/ThemeProvider'
import { b64DecodeUnicode } from '../Utils/utils'
import GalleryComponent, { GalleryElement } from './GalleryComponent'
import InternalLinkExpandComponent from './InternalLinkExpandComponent'
import { OAuthEmbeddedAppComponent } from './OAuth2AppCardModalComponent'
import { SecretMailDecoderForm, SecretMailEncoderForm } from './SecretMailbox'
import TelegramEmbed from './TelegramEmbed'
import TwitterEmbed from './TwitterEmbed'
import {
  getAutoMuteVideos,
  getLegacyZoom,
  getVideoAutopause,
  getVideoVolume,
  setVideoVolume,
} from './UserProfileSettings'

import styles from './ContentComponent.module.scss'

type CleanupHandler = {
  cleanup: () => void
  unregister: () => void
}

export class CleanupRegistry {
  private callbacks = new Set<() => void>()

  register(callback: () => void): CleanupHandler {
    this.callbacks.add(callback)

    return {
      cleanup: () => {
        callback()
        this.callbacks.delete(callback)
      },
      unregister: () => {
        this.callbacks.delete(callback)
      },
    }
  }

  cleanup() {
    this.callbacks.forEach((callback) => callback())
    this.callbacks.clear()
  }
}

interface ContentComponentProps extends React.ComponentPropsWithRef<'div'> {
  content: string
  autoCut?: number
  lowRating?: boolean
  currentUsername?: string
}

declare global {
  interface Window {
    Vimeo: typeof Vimeo
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

export const LARGE_AUTO_CUT = 650
export const SMALL_AUTO_CUT = 100

const iframeToOriginalEl = new WeakMap<HTMLIFrameElement, HTMLElement>()

type MailboxKey = {
  type: 'mailbox'
  mailboxTitle?: string
  openKey: string
  forUsername?: string
}

type MailKey = {
  type: 'mail'
  secret: string
  title: string
}

function updateContent(
  appState: AppState,
  div: HTMLDivElement,
  setMailboxKey: (key: MailboxKey | MailKey | null) => void,
  setCut: (cut: boolean) => void,
  cleanupRegistry: CleanupRegistry,
  currentUsername?: string,
): void {
  div.querySelectorAll('div.gallery').forEach((gallery) => {
    updateGallery(gallery as HTMLDivElement, appState, cleanupRegistry, setCut)
  })

  div.querySelectorAll('img').forEach((img) => {
    if (img.complete) {
      updateImg(img, appState.setZoomedImg.bind(appState))
      return
    }

    img.onload = () => {
      updateImg(img, appState.setZoomedImg.bind(appState))
    }
  })

  div.querySelectorAll('video').forEach((video) => {
    updateVideo(video)
  })

  div.querySelectorAll('span.spoiler').forEach((spoiler) => {
    updateSpoiler(spoiler as HTMLSpanElement)
  })

  div.querySelectorAll('details.expand').forEach((expand) => {
    updateExpand(expand as HTMLDetailsElement, setCut)
  })

  div.querySelectorAll('span.secret-mailbox').forEach((mailbox) => {
    updateMailbox(mailbox as HTMLSpanElement, setMailboxKey)
  })

  div.querySelectorAll('span.secret-mail').forEach((mail) => {
    updateMail(mail as HTMLSpanElement, setMailboxKey, currentUsername, appState, cleanupRegistry)
  })

  div.querySelectorAll('span.expand-button').forEach((expandButton) => {
    updateInternalExpandButton(expandButton as HTMLElement, appState, cleanupRegistry)
  })

  div.querySelectorAll('div.oauth-app').forEach((appEl) => {
    updateOauthAppEmbed(appEl as HTMLDivElement, appState, cleanupRegistry)
  })

  div.querySelectorAll('div.poll').forEach((pollEl) => {
    updatePoll(pollEl as HTMLDivElement, appState, cleanupRegistry)
  })
}

function updateMailbox(mailbox: HTMLSpanElement, setMailboxKey: (key: MailboxKey | null) => void) {
  const secret = mailbox.dataset.secret
  if (!secret) {
    return
  }
  let mailboxTitle = mailbox.dataset.rawText
  try {
    mailboxTitle = mailboxTitle && b64DecodeUnicode(mailboxTitle)
  } catch (e) {
    mailboxTitle = undefined
  }

  mailbox.addEventListener('click', () => {
    setMailboxKey({
      type: 'mailbox',
      openKey: secret,
      mailboxTitle,
    })
  })
}

// Map to track containers and their associated root instances
const containerToRootMap = new WeakMap<HTMLElement, ReturnType<typeof createRoot>>()

function renderWithTheme(container: HTMLElement, content: React.ReactNode, appState: AppState) {
  // Check if a root already exists for this container
  const root =
    containerToRootMap.get(container) ||
    (() => {
      const root = createRoot(container)
      containerToRootMap.set(container, root)
      return root
    })()

  const disposer = reaction(
    () => appState.theme,
    () => {
      root.render(<FakeRoot appState={appState}>{content}</FakeRoot>)
    },
    { fireImmediately: true },
  )

  return () => {
    disposer()
    Promise.resolve().then(() => {
      root.unmount()
      // Remove the root from the map when unmounted
      containerToRootMap.delete(container)
    })
  }
}

function updateMail(
  mail: HTMLSpanElement,
  setMailboxKey: (key: MailKey | null) => void,
  currentUsername: string | undefined,
  appState: AppState,
  cleanupRegistry: CleanupRegistry,
) {
  // check processed
  if (mail.dataset.processed) {
    return
  }
  mail.dataset.processed = '1'

  const secret = mail.dataset.secret
  if (!secret) {
    mail.classList.add('secret-mail-error')
    return
  }
  let cipher: string | undefined
  let encodedKey: string

  // try decode secret as json
  try {
    const j = JSON.parse(b64DecodeUnicode(secret))
    // add mention "для @username"
    if (j.to && !mail.querySelector('span.mention')) {
      const mention = document.createElement('span')
      mention.classList.add('mention')
      mention.innerText = j.to
      mail.appendChild(document.createTextNode(' для '))
      mail.appendChild(mention)
    }

    // check v, to, c
    if (!j.v || !j.c || !Number.isInteger(j.v) || !j.toKey) {
      throw new Error('Invalid secret')
    } else if (j.to && j.to === currentUsername && j.toKey) {
      encodedKey = j.toKey
      cipher = j.c
    } else if (j.from && j.from === currentUsername && j.fromKey) {
      encodedKey = j.fromKey
      cipher = j.c
    } else if (!j.to) {
      encodedKey = j.toKey
      cipher = j.c
    }

    if (!cipher) {
      mail.classList.add('secret-mail-disabled')
      return
    }
  } catch (e) {
    // add error class
    mail.classList.add('secret-mail-error')
    return
  }

  // just the text
  const title = mail.innerText.trim()

  const mailInnerHtml = mail.innerHTML
  let decoded = false
  let cleanup: CleanupHandler | undefined

  mail.addEventListener('click', () => {
    if (decoded || !cipher || !appState) {
      return
    }
    mail.classList.remove('i', 'i-mail-secure')
    mail.classList.add('secret-mail-decoding')

    const mailContent = (
      <SecretMailDecoderForm
        cipher={cipher}
        title={title}
        encodedKey={encodedKey}
        onClose={(result) => {
          if (result) {
            decoded = true
            mail.classList.add('i-mail-open', 'secret-mail-decoded', 'i')
            mail.classList.remove('secret-mail-decoding')
          } else {
            mail.classList.add('i', 'i-mail-secure')
            mail.classList.remove('secret-mail-decoding')
            cleanup?.cleanup()
            cleanup = undefined
            mail.innerHTML = mailInnerHtml
          }
        }}
      />
    )

    cleanup = cleanupRegistry.register(renderWithTheme(mail, mailContent, appState))
  })
}

function processExpandLink(
  expandButton: HTMLElement,
  getContent: () => React.ReactNode,
  appState: AppState,
  cleanupRegistry: CleanupRegistry,
): void {
  let contentCleanupHandler: CleanupHandler | undefined
  const nextLink = expandButton.nextElementSibling
  // Add click event listener to the expand button
  const listener = (e: Event) => {
    const link = nextLink as HTMLAnchorElement
    if ((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey) {
      return true
    }
    e.preventDefault()
    // after the expand button there is a link
    const rect = link.nextElementSibling as HTMLDivElement

    if (rect && rect.className === 'internal-link-rect') {
      // If rect exists, unmount the component and remove the rect
      contentCleanupHandler?.cleanup()
      contentCleanupHandler = undefined
      rect.remove()
      expandButton.classList.remove('expanded')
    } else {
      expandButton.classList.add('expanded')
      // If rect doesn't exist, create a new rect and mount the component
      const newRect = document.createElement('div')
      newRect.className = 'internal-link-rect'

      // Add the rect after the link
      link.parentNode?.insertBefore(newRect, link.nextSibling)

      contentCleanupHandler = cleanupRegistry.register(renderWithTheme(newRect, getContent(), appState))
    }
    return false
  }

  if (nextLink && nextLink.tagName === 'A') {
    expandButton.addEventListener('click', listener)
    nextLink.addEventListener('click', listener)
  }
}

function processTelegramEmbed(expandButton: HTMLElement, appState: AppState, cleanupRegistry: CleanupRegistry): void {
  const src = expandButton.getAttribute('data-telegram-url')
  if (!src) return

  processExpandLink(
    expandButton,
    () => {
      const ThemeAwareTelegramEmbed = () => {
        const { theme } = useTheme()
        return <TelegramEmbed src={src} theme={theme === 'dark' ? 'dark' : undefined} />
      }
      return <ThemeAwareTelegramEmbed />
    },
    appState,
    cleanupRegistry,
  )
}

function processTwitterEmbed(expandButton: HTMLElement, appState: AppState, cleanupRegistry: CleanupRegistry): void {
  const src = expandButton.getAttribute('data-twitter-url')
  if (!src) return

  processExpandLink(expandButton, () => <TwitterEmbed url={src} />, appState, cleanupRegistry)
}

function processInternalLink(expandButton: HTMLElement, appState: AppState, cleanupRegistry: CleanupRegistry): void {
  const postId = expandButton.getAttribute('data-post-id')
  const commentId = expandButton.getAttribute('data-comment-id')
  if (!postId) return

  processExpandLink(
    expandButton,
    () => (
      <InternalLinkExpandComponent
        postId={Number(postId)}
        commentId={commentId ? Number(commentId) : undefined}
        onClose={() => {
          expandButton.classList.remove('expanded')
        }}
      />
    ),
    appState,
    cleanupRegistry,
  )
}

function updateInternalExpandButton(expandButton: HTMLElement, appState: AppState, cleanupRegistry: CleanupRegistry) {
  const tg = expandButton.getAttribute('data-telegram-url')
  const tw = expandButton.getAttribute('data-twitter-url')

  if (tg) {
    processTelegramEmbed(expandButton, appState, cleanupRegistry)
  } else if (tw) {
    processTwitterEmbed(expandButton, appState, cleanupRegistry)
  } else if (expandButton.getAttribute('data-post-id')) {
    processInternalLink(expandButton, appState, cleanupRegistry)
  }
}

function updateOauthAppEmbed(appEl: HTMLDivElement, appState: AppState, cleanupRegistry: CleanupRegistry) {
  const clientId = appEl.dataset.clientId
  if (!clientId) {
    return undefined
  }
  cleanupRegistry.register(renderWithTheme(appEl, <OAuthEmbeddedAppComponent clientId={clientId} />, appState))
}

function updateVideo(video: HTMLVideoElement) {
  video.addEventListener('play', () => stopInnerVideos(document.body, video))
  if (getVideoAutopause()) {
    observeOnHidden(video, () => stopVideo(video))
  }

  if (getAutoMuteVideos()) {
    video.muted = true
  } else {
    const volume = getVideoVolume()
    if (!isNaN(volume)) {
      video.volume = volume
    }
  }

  if (!video.dataset.volumeProcessed) {
    video.addEventListener('volumechange', () => {
      setVideoVolume(video.volume)
    })
    video.dataset.volumeProcessed = '1'
  }

  if (video.dataset.aspectRatioProcessed) {
    return
  }
  video.addEventListener('loadeddata', () => {
    if (video.readyState < 3 || video.videoHeight === 0) {
      return
    }
    video.style.aspectRatio = (video.videoWidth / video.videoHeight).toString()
    video.dataset.aspectRatioProcessed = '1'
  })
}

function processYtEmbed(img: HTMLImageElement) {
  // if has class youtube-embed convert to iframe on click
  const ytUrl = img.dataset.youtube

  if (ytUrl && !img.classList.contains('youtube-embed-processed')) {
    img.classList.add('youtube-embed-processed')
    img.addEventListener('click', (e) => {
      e.preventDefault()
      const iframe = document.createElement('iframe')
      iframe.src = ytUrl + (ytUrl.indexOf('?') === -1 ? '?' : '&') + 'autoplay=1&enablejsapi=1'
      iframe.width = img.width.toString()
      iframe.height = img.height.toString()
      iframe.allowFullscreen = true
      iframe.frameBorder = '0'
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture'
      iframe.classList.add('youtube-embed')
      img.parentElement?.replaceWith(iframe)

      loadYTPlayer(() => {
        const player = new YT.Player(iframe, {
          events: {
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.PLAYING) {
                stopInnerVideos(document.body, iframe)
              }
            },
          },
        })
        player.playVideo() //?
      })

      if (getVideoAutopause()) {
        observeOnHidden(iframe, () => stopVideo(iframe))
      }
    })
  }
  return !!ytUrl
}

function loadYTPlayer(onload: () => void) {
  if (window.YT) {
    onload()
    return
  }
  if (!document.getElementById('yt-embed')) {
    const tag = document.createElement('script')
    tag.id = 'yt-embed'
    tag.src = 'https://www.youtube.com/player_api'
    window.onYouTubeIframeAPIReady = onload
    document.head.append(tag)
  }
}

/**
 * Convert mp4 video embeds into video elements
 */
function processVideoEmbed(img: HTMLImageElement) {
  const videoUrl = img.dataset.video

  if (videoUrl && !img.classList.contains('video-embed-processed')) {
    img.classList.add('video-embed-processed')
    img.addEventListener('click', (e) => {
      e.preventDefault()
      const video = document.createElement('video')
      video.src = videoUrl
      video.controls = true
      video.autoplay = true
      video.loop = !!img.dataset.loop && img.dataset.loop !== 'false'
      video.style.width = img.width.toString() + 'px'
      video.style.height = img.height.toString() + 'px'
      img.parentElement?.replaceWith(video)
      // Apply standard video behavior (mute/volume/autopause/stop-on-play/aspect ratio)
      updateVideo(video)
    })
  }
  return !!videoUrl
}

function processCoubEmbed(img: HTMLImageElement) {
  const coubUrl = img.dataset.coub

  if (coubUrl && !img.classList.contains('coub-embed-processed')) {
    const orignalEl = img.parentElement?.cloneNode(true) as HTMLImageElement // Clone the original img element

    img.classList.add('coub-embed-processed')
    img.addEventListener('click', (e) => {
      e.preventDefault()
      const iframe = document.createElement('iframe')
      iframe.src =
        coubUrl +
        (coubUrl.indexOf('?') === -1 ? '?' : '&') +
        'muted=false&autostart=true&originalSize=false&startWithHD=true'

      iframe.classList.add('coub-embed')
      iframe.allowFullscreen = true
      iframe.frameBorder = '0'
      // use current rendered image size as iframe size
      iframe.width = img.getBoundingClientRect().width.toString()
      iframe.height = img.getBoundingClientRect().height.toString()
      iframe.allow = 'autoplay'
      img.parentElement?.replaceWith(iframe)

      iframeToOriginalEl.set(iframe, orignalEl)
      stopInnerVideos(document.body, iframe)

      // coubs are always stopped when hidden
      observeOnHidden(iframe, () => {
        stopVideo(iframe)
      })
    })
  }
  return !!coubUrl
}

function processVimeoEmbed(img: HTMLImageElement) {
  const vimeoUrl = img.dataset.vimeo

  if (vimeoUrl && !img.classList.contains('vimeo-embed-processed')) {
    img.classList.add('vimeo-embed-processed')
    img.addEventListener('click', (e) => {
      e.preventDefault()
      const iframe = document.createElement('iframe')
      iframe.src = vimeoUrl
      iframe.width = img.width.toString()
      iframe.height = img.height.toString()
      iframe.allowFullscreen = true
      iframe.frameBorder = '0'
      iframe.allow = 'autoplay; fullscreen; picture-in-picture'
      iframe.classList.add('vimeo-embed')
      img.parentElement?.replaceWith(iframe)

      loadVimeoPlayer(() => {
        const player = new window.Vimeo.Player(iframe)
        player.on('play', function () {
          stopInnerVideos(document.body, iframe)
        })
        player.play()
      })

      if (getVideoAutopause()) {
        observeOnHidden(iframe, () => stopVideo(iframe))
      }
    })
  }
  return !!vimeoUrl
}

function loadVimeoPlayer(onload: () => void) {
  if (window.Vimeo) {
    onload()
    return
  }
  if (!document.getElementById('vimeo-embed')) {
    const tag = document.createElement('script')
    tag.id = 'vimeo-embed'
    tag.src = 'https://player.vimeo.com/api/player.js'
    tag.onload = onload
    document.head.append(tag)
  }
}

function updateImg(img: HTMLImageElement, setZoomedImg: (img: ZoomedImg | null) => void) {
  if (processYtEmbed(img) || processVideoEmbed(img) || processCoubEmbed(img) || processVimeoEmbed(img)) {
    return
  }

  if (img.className.includes('thumbnail')) {
    return
  }

  // if image is large enough and not inside a link or secret-mail, make it scalable

  if (img.naturalWidth > 500 || img.naturalHeight > 500) {
    // will be displayed as block if not immediately surrounded by <br>
    const nextBr = !img.nextSibling || img.nextSibling.nodeName === 'BR'
    const prevBr = !img.previousSibling || img.previousSibling.nodeName === 'BR'
    if (!nextBr || !prevBr) {
      img.classList.add('image-large')
    }
  }

  let el: HTMLElement | null = img
  while (el) {
    if (
      el.tagName.toUpperCase() === 'A' ||
      (el.tagName.toUpperCase() === 'SPAN' && el.className.indexOf('secret-mail') !== -1) ||
      el.classList.contains('gallery')
    ) {
      return
    }
    el = el.parentElement
  }

  let imageLarge = false
  if (img.naturalWidth > 500 || img.naturalHeight > 500) {
    img.classList.add('image-scalable')
    img.onclick = () => {
      if (getLegacyZoom()) {
        if (imageLarge) {
          imageLarge = false
          img.classList.remove('image-preview')
          return
        }
        imageLarge = true
        img.classList.add('image-preview')
      } else {
        setZoomedImg({
          src: img.src,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }
    }
  }
}

function updateSpoiler(spoiler: HTMLSpanElement) {
  const spoilerOnClickHandler = () => {
    spoiler.classList.remove('spoiler')
    spoiler.removeEventListener('click', spoilerOnClickHandler)
  }
  spoiler.addEventListener('click', spoilerOnClickHandler)
}

function updateExpand(expand: HTMLDetailsElement, setCut: (cut: boolean) => void) {
  expand.addEventListener('toggle', () => {
    if (!expand.open) {
      stopInnerVideos(expand)
    }
    setCut(false)
  })

  const expandClose = expand.querySelector('div[role="button"]')

  if (expandClose) {
    expandClose.addEventListener('click', () => {
      expand.open = false
    })
  }
}

function stopVideo(el: HTMLVideoElement | HTMLIFrameElement) {
  if (el instanceof HTMLVideoElement) {
    ;(el as HTMLVideoElement).pause()
    return
  }
  if (el instanceof HTMLIFrameElement && el.classList.contains('youtube-embed')) {
    ;(el as HTMLIFrameElement).contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*')
    return
  }
  if (el instanceof HTMLIFrameElement && el.classList.contains('vimeo-embed')) {
    ;(el as HTMLIFrameElement).contentWindow?.postMessage('{"method":"pause"}', '*')
    return
  }
  if (el instanceof HTMLIFrameElement && el.classList.contains('coub-embed')) {
    const originalEl = iframeToOriginalEl.get(el)
    if (originalEl) {
      el.replaceWith(originalEl)
      updateImg(originalEl.querySelector(`img`) as HTMLImageElement, () => {})
    }
  }
}

function stopInnerVideos(el: Element, except?: HTMLVideoElement | HTMLIFrameElement) {
  el.querySelectorAll('video,iframe.youtube-embed,iframe.vimeo-embed,iframe.coub-embed').forEach((iframe) => {
    if (iframe === except) {
      return
    }
    if (iframe instanceof HTMLIFrameElement || iframe instanceof HTMLVideoElement) {
      stopVideo(iframe as HTMLIFrameElement | HTMLVideoElement)
    }
  })
}

function updatePoll(pollEl: HTMLDivElement, appState: AppState, cleanupRegistry: CleanupRegistry) {
  const pollId = pollEl.getAttribute('data-poll-id')
  if (!pollId) {
    return
  }
  cleanupRegistry.register(renderWithTheme(pollEl, <PollComponent pollId={Number(pollId)} />, appState))
}

function updateGallery(
  galleryEl: HTMLDivElement,
  appState: AppState,
  cleanupRegistry: CleanupRegistry,
  setCut: (cut: boolean) => void,
) {
  const elements: GalleryElement[] = []
  galleryEl.querySelectorAll(':scope > img, :scope > a[class$="-embed"]').forEach((el) => {
    if (el.tagName.toLowerCase() === 'img') {
      const img = el as HTMLImageElement
      elements.push({ image: { src: img.src, alt: img.alt || undefined } })
    } else if (el.tagName.toLowerCase() === 'a') {
      const img = el.querySelector('img')
      if (!img) return
      elements.push({
        isVideo: true,
        htmlElement: el as HTMLElement,
        image: { src: img.src, alt: img.alt || undefined },
      })
    }
  })

  if (elements.length === 0) {
    return
  }

  const autoPlayInterval = Number(galleryEl.getAttribute('auto-play-interval') || 0)
  const showArrows = !galleryEl.hasAttribute('data-no-arrows')
  const showIndicators = !galleryEl.hasAttribute('data-no-indicators')
  const showThumbnails = !galleryEl.hasAttribute('data-no-thumbnails')

  // When gallery expands, remove the autoCut to allow fullscreen overlay
  const handleExpand = () => {
    setCut(false)
  }

  // Stop media in slide when navigating away
  const handleSlideLeave = (slideEl: HTMLElement) => {
    stopInnerVideos(slideEl)
  }

  const component = (
    <GalleryComponent
      elements={elements}
      showArrows={showArrows}
      autoPlayInterval={autoPlayInterval}
      showIndicators={showIndicators}
      showThumbnails={showThumbnails}
      onExpand={handleExpand}
      onSlideLeave={handleSlideLeave}
    />
  )

  cleanupRegistry.register(renderWithTheme(galleryEl, component, appState))
}

export default function ContentComponent(props: ContentComponentProps) {
  const contentDiv = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState(false)
  const [mailboxKey, setMailboxKey] = useState<MailboxKey | MailKey | null>(null)
  const cleanupRegistryRef = useRef<CleanupRegistry>(new CleanupRegistry())
  const appState = useAppState()

  const checkAutoCut = (content: HTMLElement) => {
    if (props.autoCut) {
      const rect = content.getBoundingClientRect()
      if (rect.height > props.autoCut + 250) {
        setCut(true)
        return true
      }
    }
    return false
  }

  useEffect(() => {
    const content = contentDiv.current
    if (!content) {
      return
    }

    // Create a fresh registry for this content update
    const cleanupRegistry = cleanupRegistryRef.current

    // Clear any previous cleanups
    cleanupRegistry.cleanup()

    // Update content using the registry
    updateContent(appState, content, setMailboxKey, setCut, cleanupRegistry, props.currentUsername)

    let resizeObserver: ResizeObserver | null = null

    if (props.lowRating) {
      content.querySelectorAll('img, video, iframe').forEach((el) => el.classList.add('low-rating'))

      content.addEventListener(
        'click',
        (evt) => {
          evt.preventDefault()
          evt.stopPropagation()
          content.querySelectorAll('img, iframe, video').forEach((el) => el.classList.remove('low-rating'))
          if (resizeObserver) {
            resizeObserver.disconnect()
          }
          setCut(false)
          return false
        },
        { once: true },
      )
    }

    if (!checkAutoCut(content)) {
      const handleResize = (entries: ResizeObserverEntry[]) => {
        for (const entry of entries) {
          if (entry.target === content && checkAutoCut(content)) {
            resizeObserver?.disconnect()
            resizeObserver = null
          }
        }
      }

      if (props.autoCut) {
        resizeObserver = new ResizeObserver(handleResize)
        resizeObserver.observe(content)
      }
    }

    // Return a combined cleanup function that runs all collected cleanups
    return () => {
      // Run all registered cleanups
      cleanupRegistry.cleanup()

      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [props.content, contentDiv, props.autoCut, props.lowRating, appState])

  useEffect(() => {
    if (!props.autoCut && cut) {
      setCut(false)
    }
  }, [props.autoCut, cut])

  const handleCut = () => {
    setCut(false)
  }

  return (
    <>
      <div
        className={classNames(styles.content, props.className, cut && styles.cut)}
        style={{ maxHeight: cut && props.autoCut ? props.autoCut : undefined }}
        dangerouslySetInnerHTML={{ __html: props.content }}
        ref={contentDiv}
      />
      {cut && (
        <div className={styles.cutCover}>
          <Button onClick={handleCut} size='small' className={styles.cutButton}>
            Читать дальше
          </Button>
        </div>
      )}
      {mailboxKey && mailboxKey.type === 'mailbox' && (
        <SecretMailEncoderForm {...mailboxKey} onClose={() => setMailboxKey(null)} />
      )}
    </>
  )
}
