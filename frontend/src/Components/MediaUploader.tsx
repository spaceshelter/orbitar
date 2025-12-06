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

  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [uploadArray, setUploadArray] = useState<MediaData[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState<boolean>(false)

  const [galleryOption, setGalleryOption] = useState<CreateGalletyOption>({
    create: false,
  })

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
    e.stopPropagation()
    e.preventDefault()
    setDragActive(true)
  }
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    setDragActive(false)
  }
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
  }
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()

    const data = e.dataTransfer

    if (data.files.length) {
      const files = Array.from(data.files)
      await handleAddFiles(files)
    }

    setDragActive(false)
  }

  const handleFileChoose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files.length) {
      return
    }

    const files = Array.from(e.target.files)
    await handleAddFiles(files)
  }

  const handleAddFiles = async (files: File[]) => {
    const processedFiles: MediaData[] = []

    for (const file of files) {
      const mediaData = await readFile(file)
      processedFiles.push(mediaData)
    }

    if (!processedFiles.length) return

    setUploadArray([...uploadArray, ...processedFiles])
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const processedFiles: MediaData[] = []
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile()
      if (file) {
        const mediaData = await readFile(file)
        processedFiles.push(mediaData)
        // prevent pasting into the editor
        e.preventDefault()
      }
    }

    if (!processedFiles.length) return

    setUploadArray((prev) => [...prev, ...processedFiles])
  }

  const handleUriChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true)

    const text = e.target.value
    const lines = text
      .trim()
      .split(text.includes('\n') ? '\n' : ' ')
      .filter((u) => u.trim())

    const arr: MediaData[] = []
    for (const url of lines) {
      const type = await parseUrl(url)
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

    try {
      if (!arr.length) return

      if (arr.length > 1) {
        setUploadArray([...uploadArray, ...arr])
        return
      }

      const data = arr[0]
      if (index === uploadArray.length) {
        setUploadArray([...uploadArray, ...arr])
        return
      }

      const newArr = [...uploadArray]
      newArr[index] = data
      setUploadArray(newArr)
    } finally {
      setLoading(false)
    }
  }

  const parseUrl = async (text: string) => {
    if (text.match(/^file:\/\//)) {
      return // skip local files
    }

    const getType = (value: string) => {
      const imageRegexp = /(png|jpg|gif|jpeg|webp)$/i
      const videoRegexp = /(mp4|webm|mov|quicktime)$/

      if (value.match(imageRegexp)) {
        return 'image-uri'
      } else if (value.match(videoRegexp)) {
        return 'video-uri'
      }
    }

    const type = getType(text)
    if (type) return type

    try {
      const url = new URL(text)
      const response = await fetch(url.toString())
      if (!response.ok) {
        return
      }

      const contentType = response.headers.get('Content-Type')
      if (contentType) return getType(contentType)
    } catch {}
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
      readFile(props.mediaData).then((data) => setUploadArray([...uploadArray, data]))
    }

    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

  const removeMedia = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()

    const newArray = [...uploadArray]
    newArray.splice(index, 1)
    setUploadArray(newArray)
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

  galleryElements.push({
    element: (
      <div
        className={styles.dropbox + (dragActive ? ' ' + styles.active : '')}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div style={{ pointerEvents: 'none' }}>Перетащите сюда и отпустите</div>
      </div>
    ),
  } as GalleryElement)

  return (
    <>
      <Overlay onClick={props.onCancel} zIndex={9999} />
      <div className={styles.container} style={{ zIndex: 10000 }}>
        <form className={styles.controls} onSubmit={handleUpload}>
          <div className={styles.upload}>
            <input
              disabled={uploading || loading}
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
                multiple
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
        <div className={styles.disclaimer}>Можете вставлять много ссылок списком. Прямо в поле ввода</div>
        <GalleryComponent
          className={styles.gallery}
          elements={galleryElements}
          showArrows={galleryElements.length > 1}
          showIndicators={galleryElements.length > 1}
          disableZoom
          disableDynamicHeight
          onChangeIndex={setIndex}
        />
        <Checkbox
          id='createGallery'
          label='Создать галерею'
          checked={galleryOption.create}
          onChange={(e) => setGalleryOption({ ...galleryOption, create: e.target.checked })}
        />
        {galleryOption.create && (
          <>
            <div className={styles.disclaimer}>
              Внутрь тега {'<gallery>'} можно вставлять теги img и video или просто ссылки на видео и изображения. Все
              остальное игнорируется.
              <br />
              Параметр alt у картинки можно использовать для создания подписи под каждой картинкой.
            </div>
          </>
        )}

        <div className={styles.disclaimer}>Загрузка картинок и видео в тестовом режиме, если не работает - сорян!</div>
      </div>
    </>
  )
}
