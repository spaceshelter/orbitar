import React, { useEffect, useRef, useState } from 'react'

import type * as Vimeo from '@vimeo/player'
import classNames from 'classnames'
import { autorun } from 'mobx'
import { createRoot } from 'react-dom/client'
import { useHotkeys } from 'react-hotkeys-hook'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'

import useOnBack from '../API/use/useOnBack'
import { AppState, useAppState } from '../AppState/AppState'
import { FakeRoot } from '../index'
import { observeOnHidden } from '../Services/ObserverService'
import { b64DecodeUnicode } from '../Utils/utils'
import InternalLinkExpandComponent from './InternalLinkExpandComponent'
import { OAuthEmbeddedAppComponent } from './OAuth2AppCardModalComponent'
import { SecretMailDecoderForm, SecretMailEncoderForm } from './SecretMailbox'
import { getLegacyZoom, getVideoAutopause } from './UserProfileSettings'

import styles from './ContentComponent.module.scss'
import overlayStyles from './Overlay.module.scss'

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

type ZoomedImg = {
  src: string
  width: number
  height: number
}

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
  setZoomedImg: (img: ZoomedImg | null) => void,
  setMailboxKey: (key: MailboxKey | MailKey | null) => void,
  setCut: (cut: boolean) => void,
  currentUsername?: string,
): Array<() => void> {
  // This array will collect all cleanup functions
  const cleanupFunctions: Array<() => void> = []

  div.querySelectorAll('img').forEach((img) => {
    if (img.complete) {
      updateImg(img, setZoomedImg)
      return
    }

    img.onload = () => {
      updateImg(img, setZoomedImg)
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
    const cleanup = updateMail(mail as HTMLSpanElement, setMailboxKey, currentUsername, appState)
    if (cleanup) cleanupFunctions.push(cleanup)
  })

  div.querySelectorAll('span.expand-button').forEach((expandButton) => {
    const cleanup = updateInternalExpandButton(expandButton as HTMLElement, appState)
    if (cleanup) cleanupFunctions.push(cleanup)
  })

  div.querySelectorAll('div.oauth-app').forEach((appEl) => {
    const cleanup = updateOauthAppEmbed(appEl as HTMLDivElement, appState)
    if (cleanup) cleanupFunctions.push(cleanup)
  })

  return cleanupFunctions
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

function renderWithTheme(container: HTMLElement, content: React.ReactNode, appState: AppState) {
  const root = createRoot(container)

  const disposer = autorun(() => {
    // create reactive dependency on theme
    void appState.theme // void for suppressing no-unused-expressions
    root.render(<FakeRoot appState={appState}>{content}</FakeRoot>)
  })

  return () => {
    disposer()
    root.unmount()
  }
}

function updateMail(
  mail: HTMLSpanElement,
  setMailboxKey: (key: MailKey | null) => void,
  currentUsername?: string,
  appState?: AppState,
): (() => void) | undefined {
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

  try {
    const j = JSON.parse(b64DecodeUnicode(secret))
    if (j.to && !mail.querySelector('span.mention')) {
      const mention = document.createElement('span')
      mention.classList.add('mention')
      mention.innerText = j.to
      mail.appendChild(document.createTextNode(' для '))
      mail.appendChild(mention)
    }

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
    mail.classList.add('secret-mail-error')
    return
  }

  const title = mail.innerText.trim()

  const mailInnerHtml = mail.innerHTML
  let decoded = false
  let cleanup: (() => void) | undefined

  const clickHandler = () => {
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
            if (cleanup) {
              cleanup()
              cleanup = undefined
            }
            mail.innerHTML = mailInnerHtml
          }
        }}
      />
    )

    cleanup = renderWithTheme(mail, mailContent, appState)
  }
  mail.addEventListener('click', clickHandler)

  return () => {
    mail.removeEventListener('click', clickHandler)
    if (cleanup) {
      cleanup()
    }
  }
}

function updateInternalExpandButton(expandButton: HTMLElement, appState: AppState): (() => void) | undefined {
  const postId = expandButton.getAttribute('data-post-id')
  const commentId = expandButton.getAttribute('data-comment-id')
  const nextLink = expandButton.nextElementSibling
  let contentCleanup: (() => void) | undefined

  const listener = (e: Event) => {
    const link = nextLink as HTMLAnchorElement

    e.preventDefault()
    const rect = link.nextElementSibling as HTMLDivElement

    if (rect && rect.className === 'internal-link-rect') {
      if (contentCleanup) {
        contentCleanup()
        contentCleanup = undefined
      }
      rect.remove()
      expandButton.classList.remove('expanded')
    } else {
      expandButton.classList.add('expanded')
      const newRect = document.createElement('div')
      newRect.className = 'internal-link-rect'
      link.parentNode?.insertBefore(newRect, link.nextSibling)

      const content = (
        <InternalLinkExpandComponent
          postId={Number(postId)}
          commentId={commentId ? Number(commentId) : undefined}
          onClose={() => {
            if (contentCleanup) {
              contentCleanup()
              contentCleanup = undefined
            }
            newRect.remove()
          }}
        />
      )

      contentCleanup = renderWithTheme(newRect, content, appState)
    }
    return false
  }

  if (nextLink && nextLink.tagName === 'A') {
    expandButton.addEventListener('click', listener)
    nextLink.addEventListener('click', listener)
    return () => {
      expandButton.removeEventListener('click', listener)
      nextLink.removeEventListener('click', listener)
      if (contentCleanup) {
        contentCleanup()
      }
    }
  }

  return undefined
}

function updateOauthAppEmbed(appEl: HTMLDivElement, appState: AppState): (() => void) | undefined {
  const clientId = appEl.dataset.clientId
  if (!clientId) {
    return undefined
  }
  return renderWithTheme(appEl, <OAuthEmbeddedAppComponent clientId={clientId} />, appState)
}

function updateVideo(video: HTMLVideoElement) {
  video.addEventListener('play', () => stopInnerVideos(document.body, video))
  if (getVideoAutopause()) {
    observeOnHidden(video, () => stopVideo(video))
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
      video.addEventListener('play', () => stopInnerVideos(document.body, video))
      if (getVideoAutopause()) {
        observeOnHidden(video, () => stopVideo(video))
      }
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
      iframe.width = img.getBoundingClientRect().width.toString()
      iframe.height = img.getBoundingClientRect().height.toString()
      iframe.allow = 'autoplay'
      img.parentElement?.replaceWith(iframe)

      iframeToOriginalEl.set(iframe, orignalEl)
      stopInnerVideos(document.body, iframe)

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

  if (img.naturalWidth > 500 || img.naturalHeight > 500) {
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
      (el.tagName.toUpperCase() === 'SPAN' && el.className.indexOf('secret-mail') !== -1)
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

export default function ContentComponent(props: ContentComponentProps) {
  const contentDiv = useRef<HTMLDivElement>(null)
  const [cut, setCut] = useState(false)
  const [zoomedImg, setZoomedImg] = useState<ZoomedImg | null>(null)
  const [mailboxKey, setMailboxKey] = useState<MailboxKey | MailKey | null>(null)
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

    // Track all cleanup functions that need to be called when unmounting
    const cleanupFunctions: Array<() => void> = []

    // Update content and collect any cleanup functions
    const updateCleanupFns = updateContent(
      appState,
      content,
      setZoomedImg,
      setMailboxKey,
      setCut,
      props.currentUsername,
    )
    if (updateCleanupFns) {
      cleanupFunctions.push(...updateCleanupFns)
    }

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
      cleanupFunctions.forEach((cleanup) => cleanup())

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
          <button className={styles.cutButton} onClick={handleCut}>
            Читать дальше
          </button>
        </div>
      )}
      {zoomedImg && <ZoomComponent {...zoomedImg} onExit={() => setZoomedImg(null)} />}
      {mailboxKey && mailboxKey.type === 'mailbox' && (
        <SecretMailEncoderForm {...mailboxKey} onClose={() => setMailboxKey(null)} />
      )}
    </>
  )
}

interface ZoomComponentProps {
  src: string
  width: number
  height: number
  onExit: () => void
}

function ZoomComponent(props: ZoomComponentProps) {
  const minScale = Math.min(1, window.innerWidth / props.width, window.innerHeight / props.height)
  const defaultScale = Math.min(window.innerWidth / props.width, window.innerHeight / props.height)
  const defaultTranslateX = (window.innerWidth - props.width * defaultScale) / 2
  const defaultTranslateY = (window.innerHeight - props.height * defaultScale) / 2
  useHotkeys('esc', props.onExit)
  useOnBack(props.onExit)

  return (
    <div
      className={overlayStyles.overlay}
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('react-transform-wrapper')) {
          props.onExit()
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
          wrapperStyle={{
            width: '100vw',
            height: '100vh',
          }}
        >
          <img
            src={props.src}
            alt=''
            style={{
              maxWidth: 'auto !important',
              maxHeight: 'auto !important',
            }}
          />
        </TransformComponent>
      </TransformWrapper>
      <span className={classNames('i i-close', styles.overlayCloseButton)} onClick={props.onExit} />
    </div>
  )
}
