import styles from './NotificationsPopup.module.css';
import {ReactComponent as CommentIcon} from '../Assets/notifications/comment.svg';
import {ReactComponent as MentionIcon} from '../Assets/notifications/mention.svg';
import {useAPI, useSiteName} from '../AppState/AppState';
import React, {useEffect, useMemo, useState} from 'react';
import {NotificationInfo} from '../API/NotificationsAPIHelper';
import PostLink from './PostLink';
import DateComponent from './DateComponent';

type NotificationsPopupProps = {
    onClose?: () => void;
};

export default function NotificationsPopup(props: NotificationsPopupProps) {
    const api = useAPI();
    const {siteName} = useSiteName();
    const [notifications, setNotifications] = useState<NotificationInfo[]>();
    const [error, setError] = useState('');

    const registerWebPush = useMemo(() => {
        return async () => {
            if (siteName !== 'main') {
                // register service only on main domain
                return;
            }
            // unregister old workers
            // (await navigator.serviceWorker.getRegistrations()).forEach(r => {console.log(r); r.unregister().then();});

            let registration = await navigator.serviceWorker.getRegistration('/service.js');
            if (!registration) {
                registration = await navigator.serviceWorker.register('/service.js', {scope: '/'});
            }

            await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
            });
            await api.webpushAPI.subscribe(subscription);
        }
    }, [api]);

    useEffect(() => {
        api.notifications.list()
            .then(result => {
                setNotifications(result.notifications);

                if (siteName !== 'main') {
                    // ask for permissions only on main domain
                    return;
                }
                if (!('serviceWorker' in navigator) || !('Notification' in window)) {
                    return;
                }
                if (Notification.permission === 'default') {
                     Notification.requestPermission().then(result => {
                         if (result === 'granted') {
                             registerWebPush().then().catch();
                         }
                     })
                }
                else if (Notification.permission === 'granted' && !result.webPushRegistered) {
                    registerWebPush().then().catch();
                }


            })
            .catch(err => {
                setError('Не удалось загрузить уведомления');
                console.log('notifications error', err);
            });
    }, []);

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
                    </PostLink>
                })}
            </div>
            <div className={styles.buttons}>
                <button className={styles.buttonClear} onClick={handleClearAll}>Очистить</button>
                <button className={styles.buttonAll} disabled={true}>Все чпяки</button>
            </div>
        </div>
    )
}


