self.addEventListener('push', ev => {
    const data = ev.data.json();
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        data: {
            url: data.url
        }
    });
});

self.addEventListener('notificationclick', ev => {
    ev.notification.close();
    ev.waitUntil(
        clients.openWindow(ev.notification.data.url)
    );
});
