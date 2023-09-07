import styles from './MediaUploader.module.css';
import React, {useEffect, useRef, useState} from 'react';
import {toast} from 'react-toastify';

type UploadDataUri = {
    type: 'video-uri' | 'image-uri';
    uri: string;
};
type UploadDataFile = {
    type: 'video' | 'image';
    file: File;
};

export type UploadData = UploadDataUri | UploadDataFile;

export type MediaUploaderProps = {
    onCancel: () => void;
    onSuccess: (uri: string, type: 'video' | 'image') => void;
};

export default function MediaUploader(props: MediaUploaderProps) {
    const uriRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewRef = useRef<HTMLImageElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [uri, setUri] = useState<string>('');
    const [preview, setPreview] = useState<string | undefined>();
    const [videoPreview, setVideoPreview] = useState<{ uri: string, type: string } | undefined>();
    const [uploadEnabled, setUploadEnabled] = useState<boolean>(false);
    const [uploadData, setUploadData] = useState<UploadData>();
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        uriRef.current?.focus();
        document.addEventListener('paste', handlePaste);
        const htmlElement = document.getElementsByTagName('html')[0];
        htmlElement.classList.add('no-scroll');
        return () => {
            document.removeEventListener('paste', handlePaste);
            htmlElement.classList.remove('no-scroll');
        };
    }, []);

    const readFile = (file: File) => {
        setUri('');
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setVideoPreview(undefined);
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setUploadData({ type: 'image', file });
        }
        else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(undefined);
                setVideoPreview({uri: reader.result as string, type: 'video/mp4'});
                videoRef.current?.load();
            };
            reader.readAsDataURL(file);
            setUploadData({ type: 'video', file });
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setDragActive(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setDragActive(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const data = e.dataTransfer;
        console.log(e);
        if (data.files.length) {
            readFile(data.files[0]);
        }
        else if (data.types.indexOf('text/uri-list') !== -1) {
            const uri = data.getData('text/uri-list');
            console.log('uri', uri);
            if (uri) {
                setUri(uri);
                setPreview(uri);
            }
        }

        e.stopPropagation();
        e.preventDefault();
        setDragActive(false);
    };

    const handleUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uri = e.target.value;
        setUri(uri);
        if (uri.match(/\.(png|jpg|gif|jpeg)$/i)) {
            setPreview(undefined);
            setVideoPreview(undefined);
            setTimeout(() => {
                setPreview(uri);
            }, 1);

            setUploadData({ type: 'image-uri', uri });
        }
        else if (uri.match(/\.(mp4|webm|mov)/)) {
            setPreview(undefined);
            setVideoPreview(undefined);
            setTimeout(() => {
                setVideoPreview({ uri, type: 'video/mp4' });
            }, 1);

            setUploadData({ type: 'video-uri', uri });
        }
    };

    const handleFileChoose = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files.length) {
            return;
        }
        readFile(e.target.files[0]);
    };

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const image = e.target as HTMLImageElement;
        if (image.complete) {
            setUploadEnabled(true);
        }
    };

    const handlePaste = (e: ClipboardEvent) =>{
        const items = e.clipboardData?.items;
        if (!items) 
            return;
        for (let i = 0; i < items.length; i++) {
            const file = items[i].getAsFile();
            if (file) {
                readFile(file);
            }
        }
    };

    const handleLoadVideo = () => {
        setUploadEnabled(true);
    };

    const handleUpload = () => {
        if (!uploadData) {
            return;
        }

        if (uploadData.type === 'video-uri') {
            props.onSuccess(uploadData.uri, 'video');
            return;
        }
        else if (uploadData.type === 'image-uri') {
            props.onSuccess(uploadData.uri, 'image');
            return;
        }
        else if (uploadData.type === 'video' || uploadData.type === 'image') {
            const file = uploadData.file;
            const formData = new FormData();
            formData.append('file', file);

            setUploading(true);

            fetch('/upload', {
                method: 'POST',
                body: formData
            }).then(response => {
                setUploading(false);

                console.log('UPLOAD RESPONSE', response);

                if (response.ok) {
                    response.json()
                        .then(data => {
                            if (data.status === 'ok') {
                                console.log('UPLOAD COMPLETE', data);
                                props.onSuccess(process.env.REACT_APP_MEDIA_HOSTING_URL +
                                    '/' + data.url, uploadData.type);
                            } else {
                                console.log('UPLOAD FAILED: no link', data, file.type);
                                toast.error('Произошла ошибка при загрузке 🥺');
                            }
                        })
                        .catch(error => {
                            console.error('UPLOAD FAILED', error, file.type);
                            toast.error('Произошла ошибка при загрузке 🥺');
                        });
                }
                else {
                    response.text().then(text => {
                        console.error('UPLOAD FAILED', response.status, file.type, text);
                    }).catch(err => {
                        console.error('UPLOAD FAILED', response.status, file.type, response, err);
                    });

                    toast.error('Произошла ошибка при загрузке 🥺');
                }
            }).catch(error => {
                setUploading(false);
                console.error('UPLOAD FAILED', file.type, error);
                toast.error('Произошла ошибка при загрузке 🥺');
            });
        }
    };

    const handleOverlayClick = () => {
        props.onCancel();
    };

    return (
        <>
            <div className={styles.overlay} onClick={handleOverlayClick}></div>
            <div className={styles.container}>
                <div className={styles.controls}>
                    <div className={styles.upload}>
                        <input disabled={uploading} className={styles.url} ref={uriRef} type="text" placeholder="https://" title='Вставьте ссылку или картинку' value={uri} onChange={handleUriChange} />
                        <label className={styles.selector}>
                            <input disabled={uploading} type="file" accept="image/*,video/mp4,video/webm" onChange={handleFileChoose} />
                            <div className={styles.choose}>Выбрать</div>
                        </label>
                    </div>
                    <button disabled={!uploadEnabled || uploading} className={styles.done + ' button'} onClick={handleUpload}>{uploading ? 'Загрузка' : 'Фьють'}</button>
                </div>
                <div className={styles.dropbox + (dragActive ? ' ' + styles.active : '')} onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    <div className={styles.preview}>
                        {preview && <img draggable={false} className={styles.preview} src={preview} onLoad={handleImageLoad} ref={previewRef} alt="" />}
                        {videoPreview && <video ref={videoRef} loop={false} preload="metadata" controls={true} onLoadedMetadata={handleLoadVideo}><source src={videoPreview.uri} type={videoPreview.type} /></video>}
                    </div>
                </div>
                <div className={styles.disclaimer}>Загрузка картинок и видео в тестовом режиме, если не работает - сорян!</div>
            </div>
        </>
    );
}
