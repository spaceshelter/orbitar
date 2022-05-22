import styles from './NotificationsPopup.module.css';
import {ReactComponent as CommentIcon} from '../Assets/notifications/comment.svg';
import {ReactComponent as MentionIcon} from '../Assets/notifications/mention.svg';
import {useAPI, useSiteName} from '../AppState/AppState';
import React, {useEffect, useMemo, useState} from 'react';
import {NotificationInfo} from '../API/NotificationsAPIHelper';
import PostLink from './PostLink';
import DateComponent from './DateComponent';
import {usePushService} from '../Services/PushService';

type NotificationsPopupProps = {
    onClose?: () => void;
};

export default function NotificationsPopup(props: NotificationsPopupProps) {
    const api = useAPI();
    const {siteName} = useSiteName();
    const [notifications, setNotifications] = useState<NotificationInfo[]>();
    const [error, setError] = useState('');
    const pushService = usePushService();

    const fetchNotifications = useMemo(() => {
        return async () => {
            const auth = siteName === 'main' ? await pushService.getAuth() : undefined;
            console.log('have auth:', auth);
            return await api.notifications.list(auth);
        };
    }, [api, pushService, siteName]);

    const subscribe = useMemo(() => {
        return async () => {
            if (siteName !== 'main') {
                // request notifications only at main domain
                return;
            }

            if (!('serviceWorker' in navigator) || !('Notification' in window)) {
                // notifications not supported
                return;
            }

            if (Notification.permission === 'denied') {
                return;
            }

            if (Notification.permission === 'default') {
                if (await Notification.requestPermission() !== 'granted') {
                    return;
                }
            }

            const subscription = await pushService.subscribe();
            if (subscription) {
                await api.notifications.subscribe(subscription);
            }
        };
    }, [api, pushService, siteName]);

    useEffect(() => {
        fetchNotifications()
            .then(result => {
                setNotifications(result.notifications);

                if (!result.webPushRegistered) {
                    subscribe().then().catch();
                }
            })
            .catch(err => {
                setError('Не удалось загрузить уведомления');
                console.log('notifications error', err);
            });
    }, [fetchNotifications, subscribe]);

    const handleNotificationClick = (e: React.MouseEvent<HTMLAnchorElement>, notify: NotificationInfo) => {
        api.notifications.read(notify.id)
            .then()
            .catch();
        if (props.onClose) {
            props.onClose();
        }
    };

    const handleClearAll = () => {
        api.notifications.readAll()
            .then()
            .catch();
        if (props.onClose) {
            props.onClose();
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.notifications}>
                {error}
                {notifications && notifications.map(notify => {
                    return <PostLink
                        key={notify.id}
                        className={styles.notification}
                        post={{ id: notify.source.post.id, site: notify.source.post.site }}
                        commentId={notify.source.comment?.id}
                        onClick={e => handleNotificationClick(e, notify)}
                    >
                        <div className={styles.type}>{notify.type === 'answer' ? <CommentIcon /> : <MentionIcon />}</div>
                        <div className={styles.content}>
                            <div className={styles.date}>{notify.source.byUser.username} {notify.type === 'answer' ? 'ответил вам' : 'упомянул вас'} <DateComponent date={notify.date} /></div>
                            <div className={styles.text}>{notify.source.comment?.content}</div>
                        </div>
                    </PostLink>;
                })}
            </div>
            <div className={styles.buttons}>
                <button className={styles.buttonClear} onClick={handleClearAll}>Очистить</button>
                <button className={styles.buttonAll} disabled={true}>Все чпяки</button>
            </div>
        </div>
    );
}


