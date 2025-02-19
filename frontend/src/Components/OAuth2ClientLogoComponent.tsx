import styles from './OAuth2ClientLogoComponent.module.scss';
import classNames from 'classnames';
import React from 'react';
import {toast} from 'react-toastify';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import {useAppState} from '../AppState/AppState';

interface OAuth2ClientLogoComponentProps {
    url?: string;
    canManage: boolean;
    onNewLogo?: (url: string) => void;
}

export default function OAuth2ClientLogoComponent(props: OAuth2ClientLogoComponentProps) {
    const appState = useAppState();

    const handleLogoClick = () => {
        if (props.canManage) {
            appState.mediaUploader(
                {
                    onCancel: () => {
                    },
                    onSuccess: handleMediaUpload,
                    onError: () => {
                        toast('Не удалось обновить логотип', {type: 'error'});
                    }
                }
            );
        }
    };

    const handleMediaUpload = (url: string, type: 'video' | 'image') => {
        if (type === 'video') {
            toast('Нужна именно картинка', {type: 'error'});
            return;
        }
        props.onNewLogo?.(url);
    };

    return (
        <>
            <div
                onClick={handleLogoClick}
                className={classNames({
                    [styles.logo]: true,
                    [styles.canManage]: props.canManage
                })}
                {...(props.url ? {
                    style: {
                        backgroundImage: `url(${props.url})`
                    }
                } : {})}
            >
                {!props.url && props.canManage && (
                    <div className={styles.editIconContainer}>
                        <EditIcon/>
                    </div>
                )}
            </div>
        </>
    );
}
