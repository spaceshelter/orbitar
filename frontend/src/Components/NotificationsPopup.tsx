import styles from './NotificationsPopup.module.scss';
import {ReactComponent as CommentIcon} from '../Assets/notifications/comment.svg';
import {ReactComponent as MentionIcon} from '../Assets/notifications/mention.svg';
import {ReactComponent as CloseIcon} from '../Assets/close.svg';
import {useAPI, useAppState, useSiteName} from '../AppState/AppState';
import React, {useEffect, useMemo, useState} from 'react';
import {NotificationInfo} from '../API/NotificationsAPIHelper';
import PostLink from './PostLink';
import DateComponent from './DateComponent';
import {usePushService} from '../Services/PushService';
import classNames from 'classnames';

type NotificationsPopupProps = {
    onClose?: () => void;
};

export default function NotificationsPopup(props: NotificationsPopupProps) {
    const api = useAPI();
    const {siteName} = useSiteName();
    const [notifications, setNotifications] = useState<NotificationInfo[]>();
    const [error, setError] = useState('');
    const pushService = usePushService();
    const app = useAppState();

    const fetchNotifications = useMemo(() => {
        return async () => {
            let auth = undefined;
            try {
                auth = siteName === 'main' ? await pushService.getAuth() : undefined;
                console.log('have auth:', auth);
            } catch (e) {
                console.error('failed to get auth', e);
            }
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

    const handleNotificationClick = (notify: NotificationInfo) => (e: React.MouseEvent<HTMLAnchorElement>) => {
        api.notifications.read(notify.id)
            .then()
            .catch();
        if (!notify.read) {
            app.setUnreadNotificationsCount(app.unreadNotificationsCount - 1);
        }
        if (props.onClose) {
            props.onClose();
        }
    };

    const handleNotificationHide = (notify: NotificationInfo) => (e: React.MouseEvent<unknown>) => {
        e.preventDefault();
        e.stopPropagation();
        api.notifications.hide(notify.id)
            .then()
            .catch();
        if (!notify.read) {
            app.setUnreadNotificationsCount(app.unreadNotificationsCount - 1);
        }
        app.setVisibleNotificationsCount(app.visibleNotificationsCount - 1);
        setNotifications(notifications?.filter(n => n.id !== notify.id));
    };

    const handleClearAll = () => {
        app.setVisibleNotificationsCount(0);
        app.setUnreadNotificationsCount(0);
        api.notifications.hideAll()
            .then()
            .catch();
        if (props.onClose) {
            props.onClose();
        }
    };

    const handleReadAll = () => {
        app.setUnreadNotificationsCount(0);
        api.notifications.readAll()
            .then()
            .catch();
    };

    return (
        <>
            <div className={styles.overlay} onClick={props.onClose}/>
            <div className={styles.container}>
                <div className={styles.notifications}>
                    {error}
                    {notifications && notifications.map(notify => {
                        return <PostLink
                            key={notify.id}
                            className={classNames(styles.notification, {[styles.read]: notify.read})}
                            post={{ id: notify.source.post.id, site: notify.source.post.site }}
                            commentId={notify.source.comment?.id}
                            onClick={handleNotificationClick(notify)}
                            onlyNew={true}
                        >
                            <div className={styles.type}>{notify.type === 'answer' ? <CommentIcon /> : <MentionIcon />}</div>
                            <div className={styles.content}>
                                <div className={styles.date}>{notify.source.byUser.username} {notify.type === 'answer' ? 'ответил вам' : 'упомянул вас'} <DateComponent date={notify.date} /></div>
                                <div className={styles.text}>{notify.source.comment?.content}</div>
                            </div>
                            <div className={styles.remove} onClick={handleNotificationHide(notify)}><CloseIcon/></div>
                        </PostLink>;
                    })}
                </div>
                <div className={styles.buttons}>
                    <button className={styles.buttonClear} onClick={handleClearAll}>Очистить</button>
                    <button className={styles.buttonRead} onClick={handleReadAll}>Прочитать все</button>
                    {/*<button className={styles.buttonAll} disabled={true}>Все чпяки</button>*/}
                </div>
            </div>
        </>
    );
}


