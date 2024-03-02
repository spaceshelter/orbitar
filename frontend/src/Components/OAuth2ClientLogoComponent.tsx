import styles from './OAuth2ClientLogoComponent.module.scss';
import classNames from 'classnames';
import React, { useState } from 'react';
import MediaUploader from './MediaUploader';
import {toast} from 'react-toastify';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';

interface OAuth2ClientLogoComponentProps {
  url?: string;
  isMy: boolean;
  onNewLogo?: (url: string) => void;
}

export default function OAuth2ClientLogoComponent(props: OAuth2ClientLogoComponentProps) {
  const [mediaUploaderOpen, setMediaUploaderOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(props.url);

  const handleLogoClick = () => {
    setMediaUploaderOpen(true);
  };

  const handleMediaUpload = (url: string, type: 'video' | 'image') => {
    if (type === 'video') {
      toast('Нужна именно картинка', {type: 'error'});
      return;
    }
    setMediaUploaderOpen(false);
    setLogoUrl(url);
    props.onNewLogo?.(url);
  };

  const handleMediaUploadCancel = () => {
    setMediaUploaderOpen(false);
  };

  return (
    <>
      {mediaUploaderOpen && <MediaUploader onSuccess={handleMediaUpload} onCancel={handleMediaUploadCancel} onError={() => {
        setMediaUploaderOpen(false);
        toast('Не удалось обновить логотип', {type: 'error'});
      }} />}
      <div
        onClick={handleLogoClick}
        className={classNames({
          [styles.logo]: true,
          [styles.isMy]: props.isMy
        })}
        {...(logoUrl ? {
          style: {
            backgroundImage: `url(${logoUrl})`
          }
        } : {})}
      >
        {!logoUrl && (
          <div className={styles.editIconContainer}>
            <EditIcon  />
          </div>
        )}
      </div>
    </>
  );
}
