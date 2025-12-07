import React, { useEffect, useRef, useState } from 'react'

import Button from '@ui/Button'
import Checkbox from '@ui/Checkbox'
import { toast } from 'react-toastify'

import useFocus from '../API/use/useFocus'
import GalleryComponent, { GalleryElement } from './GalleryComponent'
import Overlay from './Overlay'

import { ReactComponent as RemoveIcon } from '../Assets/trash.svg'
import styles from './MediaUploader.module.scss'

export type MediaResult = {
  type: 'video' | 'image'
  url: string
}

type UploadDataUri = {
  type: 'video-uri' | 'image-uri'
  uri: string
}
type UploadDataFile = {
  type: 'video' | 'image'
  file: File
}

export type UploadData = UploadDataUri | UploadDataFile

export type MediaUploaderProps = {
  onCancel: () => void
  onError?: (error: string) => void
  onSuccess: (result: MediaResult[], gallery?: CreateGalletyOption | undefined) => void
  mediaData?: File
  singleUpload?: boolean
}

export type CreateGalletyOption = {
  create: boolean
}

type MediaData = {
  preview?: string
  url?: string
  uploadData?: UploadData
}

export default function MediaUploader(props: MediaUploaderProps) {
  const uriRef = useFocus()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const skipNextUriChange = useRef(false)
  const dragCounter = useRef(0)

  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [uploadArray, setUploadArray] = useState<MediaData[]>([])
  const [index, setIndex] = useState(0)
  const [scrollToIndex, setScrollToIndex] = useState<{ index: number; key: number } | undefined>(undefined)
  const scrollKeyRef = useRef(0)

  const [galleryOption, setGalleryOption] = useState<CreateGalletyOption>({
    create: false,
  })

  const scrollToGalleryIndex = (idx: number) => {
    scrollKeyRef.current++
    setScrollToIndex({ index: idx, key: scrollKeyRef.current })
  }

  const currentMedia = uploadArray[index] || ({} as MediaData)

  const readFile = (file: File): Promise<MediaData> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve({
            uploadData: { type: 'image', file },
            preview: reader.result as string,
          })
        }
        reader.readAsDataURL(file)
      } else if (file.type.startsWith('video/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          resolve({
            uploadData: { type: 'video', file },
            preview: reader.result as string,
          })
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current++
    setDragActive(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragActive(false)
    }
  }
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragActive(false)

    const data = e.dataTransfer

    if (data.files.length) {
      const files = Array.from(data.files)
      await handleAddFiles(files)
    }
  }

  const handleFileChoose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) {
      return
    }

    const files = Array.from(e.target.files)
    await handleAddFiles(files)
  }

  const handleAddFiles = async (files: File[]) => {
    const filesToProcess = props.singleUpload ? files.slice(0, 1) : files
    const processedFiles: MediaData[] = []

    for (const file of filesToProcess) {
      const mediaData = await readFile(file)
      processedFiles.push(mediaData)
    }

    if (!processedFiles.length) return

    if (props.singleUpload) {
      setUploadArray(processedFiles)
      scrollToGalleryIndex(0)
    } else {
      const newLength = uploadArray.length + processedFiles.length
      setUploadArray([...uploadArray, ...processedFiles])
      scrollToGalleryIndex(newLength - 1)
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    // Only handle paste if it originated within our container
    if (!containerRef.current?.contains(e.target as Node)) return

    const items = e.clipboardData?.items
    if (!items) return

    const hasFiles = Array.from(items).some((item) => item.getAsFile())
    if (!hasFiles) return

    // Prevent default and skip onChange before async processing
    e.preventDefault()
    skipNextUriChange.current = true

    const processFiles = async () => {
      const processedFiles: MediaData[] = []
      for (let i = 0; i < items.length; i++) {
        const file = items[i].getAsFile()
        if (file) {
          const mediaData = await readFile(file)
          processedFiles.push(mediaData)
          if (props.singleUpload) break
        }
      }
      if (processedFiles.length) {
        if (props.singleUpload) {
          setUploadArray(processedFiles)
          scrollToGalleryIndex(0)
        } else {
          setUploadArray((prev) => {
            scrollToGalleryIndex(prev.length + processedFiles.length - 1)
            return [...prev, ...processedFiles]
          })
        }
      }
    }
    processFiles()
  }

  const handleUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Skip if this change was triggered by a file paste
    if (skipNextUriChange.current) {
      skipNextUriChange.current = false
      return
    }

    const text = e.target.value
    const lines = text
      .trim()
      .split(text.includes('\n') ? '\n' : ' ')
      .filter((u) => u.trim())

    const arr: MediaData[] = []
    for (const url of lines) {
      const type = parseUrl(url)
      if (!type) {
        arr.push({ url })
      } else {
        arr.push({
          uploadData: { type: type, uri: url },
          preview: url,
          url,
        })
      }
    }

    if (!arr.length) return

    if (props.singleUpload) {
      // In single upload mode, only use the first URL and replace the array
      setUploadArray([arr[0]])
      scrollToGalleryIndex(0)
      return
    }

    if (arr.length > 1) {
      const newLength = uploadArray.length + arr.length
      setUploadArray([...uploadArray, ...arr])
      scrollToGalleryIndex(newLength - 1)
      return
    }

    const data = arr[0]
    if (index === uploadArray.length) {
      setUploadArray([...uploadArray, ...arr])
      scrollToGalleryIndex(uploadArray.length)
      return
    }

    const newArr = [...uploadArray]
    newArr[index] = data
    setUploadArray(newArr)
  }

  const parseUrl = (text: string): 'image-uri' | 'video-uri' | undefined => {
    // Skip local files and data URLs
    if (text.match(/^(file|data|blob):/)) {
      return
    }

    const imageRegexp = /\.(png|jpg|gif|jpeg|webp)(\?.*)?$/i
    const videoRegexp = /\.(mp4|webm|mov)(\?.*)?$/i

    if (text.match(imageRegexp)) {
      return 'image-uri'
    } else if (text.match(videoRegexp)) {
      return 'video-uri'
    }
  }

  const handleError = (error: string) => {
    toast.error(error)
    if (props.onError) {
      props.onError(error)
    }
  }

  const handleUpload = async (e: React.SyntheticEvent) => {
    e.preventDefault()

    const result: MediaResult[] = []
    try {
      for (const data of uploadArray) {
        const res = await uploadMedia(data)
        if (res) {
          result.push(res)
        }
      }

      props.onSuccess(result, galleryOption)
    } catch (e) {
      handleError('Произошла ошибка при загрузке 🥺')
    }
  }

  const uploadMedia = async (mediaData: MediaData) => {
    if (!mediaData.uploadData) {
      return
    }

    const { uploadData } = mediaData

    if (uploadData.type === 'video-uri') {
      return {
        url: uploadData.uri!,
        type: 'video',
      } as MediaResult
    }

    if (uploadData.type === 'image-uri') {
      return {
        url: uploadData.uri!,
        type: 'image',
      } as MediaResult
    }

    if (uploadData.type === 'video' || uploadData.type === 'image') {
      return await uploadFile(uploadData.file, uploadData.type)
    }
  }

  const uploadFile = async (file: File, type: string) => {
    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      })

      console.debug('UPLOAD RESPONSE', response)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Неизвестная ошибка')
        console.error('UPLOAD FAILED', response.status, file.type, errorText)
        throw new Error('UPLOAD FAILED: ' + errorText)
      }

      const data = await response.json()

      if (data.status === 'ok') {
        console.debug('UPLOAD COMPLETE', data)
        return {
          type,
          url: process.env.REACT_APP_MEDIA_HOSTING_URL + '/' + data.url,
        } as MediaResult
      } else {
        console.error('UPLOAD FAILED: no link', data, file.type)
        throw new Error('UPLOAD FAILED: no link')
      }
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (props.mediaData) {
      readFile(props.mediaData).then((data) => setUploadArray((prev) => [...prev, data]))
    }

    document.addEventListener('paste', handlePaste)

    // Show "forbidden" cursor when dragging outside the form
    const handleDocumentDragOver = (e: DragEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        e.preventDefault()
        e.dataTransfer!.dropEffect = 'none'
      }
    }
    document.addEventListener('dragover', handleDocumentDragOver)

    return () => {
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('dragover', handleDocumentDragOver)
    }
  }, [])

  const removeMedia = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    const newArray = [...uploadArray]
    newArray.splice(index, 1)
    setUploadArray(newArray)

    // Adjust index if we deleted the last element
    if (index >= newArray.length && newArray.length > 0) {
      const newIndex = newArray.length - 1
      setIndex(newIndex)
      scrollToGalleryIndex(newIndex)
    }
  }

  const galleryElements = uploadArray
    .filter((u) => u.preview)
    .map((data, i) => {
      if (data.uploadData?.type === 'image' || data.uploadData?.type === 'image-uri') {
        return {
          image: { src: data.preview || '', alt: '' },
        } as GalleryElement
      }

      return {
        element: (
          <video className={styles.video} ref={videoRef} loop={false} controls={true}>
            <source src={data.preview} type='video/mp4' />
          </video>
        ),
      } as GalleryElement
    })

  return (
    <>
      <Overlay onClick={props.onCancel} zIndex={9999} />
      <div
        ref={containerRef}
        className={styles.container + (dragActive ? ' ' + styles.dragActive : '')}
        style={{ zIndex: 10000 }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <form className={styles.controls} onSubmit={handleUpload}>
          <div className={styles.upload}>
            <input
              disabled={uploading}
              className={styles.url}
              ref={uriRef}
              type='text'
              placeholder='https://'
              title='Вставьте ссылку или картинку'
              value={currentMedia.url || ''}
              onChange={handleUriChange}
            />
            <label className={styles.selector}>
              <input
                disabled={uploading}
                type='file'
                accept='image/*,video/mp4,video/webm'
                onChange={handleFileChoose}
                multiple={!props.singleUpload}
              />
              {uploadArray.length > 0 && (
                <div className={styles.remove} onClick={removeMedia}>
                  <RemoveIcon />
                </div>
              )}
              <div className={styles.choose}>Выбрать</div>
            </label>
          </div>
          <Button variant='primary' disabled={uploading} type='submit' loading={uploading}>
            {uploading ? 'Загрузка' : 'Фьють'}
          </Button>
        </form>
        <GalleryComponent
          className={styles.gallery}
          elements={galleryElements}
          showArrows={galleryElements.length > 1}
          showIndicators={galleryElements.length > 1}
          disableZoom
          disableDynamicHeight
          onChangeIndex={setIndex}
          scrollToIndex={scrollToIndex?.index}
          scrollToKey={scrollToIndex?.key}
        />
        {!props.singleUpload && (
          <>
            <Checkbox
              id='createGallery'
              label='Создать галерею'
              checked={galleryOption.create}
              onChange={(e) => setGalleryOption({ ...galleryOption, create: e.target.checked })}
            />
            {galleryOption.create && (
              <div className={styles.disclaimer}>
                Внутрь тега {'<gallery>'} можно вставлять теги img и video или просто ссылки на видео и изображения. Все
                остальное игнорируется.
                <br />
                Параметр alt у картинки можно использовать для создания подписи под каждой картинкой.
              </div>
            )}
          </>
        )}

        <div className={styles.disclaimer}>Загрузка картинок и видео в тестовом режиме, если не работает - сорян!</div>
      </div>
    </>
  )
}
