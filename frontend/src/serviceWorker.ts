export type {};
declare const self: ServiceWorkerGlobalScope;

type NotificationData = {
    title: string;
    body: string;
    icon: string;
    url: string;
};

self.addEventListener('push', ev => {
    if (!ev.data) {
        return;
    }

    try {
        const data = ev.data.json() as NotificationData;

        if (!data || !data.title || !data.body || !data.url || !data.icon) {
            return;
        }

        ev.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: data.icon,
                data: {
                    url: data.url
                }
            })
        );
    }
    catch (err) {
        console.log('ERROR', err);
        return;
    }
});

self.addEventListener('notificationclick', ev => {
    ev.notification.close();

    if (!ev.notification.data || !ev.notification.data.url) {
        return;
    }

    ev.waitUntil(
        self.clients.openWindow(ev.notification.data.url)
    );
});
