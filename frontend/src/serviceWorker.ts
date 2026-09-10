export type {}
declare const self: ServiceWorkerGlobalScope

type NotificationData = {
  title: string
  body: string
  icon: string
  url: string
  notificationId: number
}

type CloseNotificationData = {
  closeNotificationId: number
}

self.addEventListener('push', (ev) => {
  if (!ev.data) {
    return
  }

  try {
    const data = ev.data.json() as NotificationData | CloseNotificationData

    // Check if this is a close notification message
    if ('closeNotificationId' in data) {
      console.debug('CLOSE_PUSH', data.closeNotificationId)
      ev.waitUntil(
        self.registration
          .getNotifications({ tag: `notification-${data.closeNotificationId}` })
          .then((notifications) => {
            notifications.forEach((notification) => notification.close())
          }),
      )
      return
    }

    // Otherwise, show a new notification
    if (!data.title || !data.body || !data.url || !data.icon) {
      return
    }

    console.debug('PUSH', data)
    ev.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        tag: data.notificationId ? `notification-${data.notificationId}` : undefined,
        data: {
          url: data.url,
          notificationId: data.notificationId,
        },
      }),
    )
  } catch (err) {
    console.log('ERROR', err)
    return
  }
})

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close()

  if (!ev.notification.data || !ev.notification.data.url) {
    return
  }

  ev.waitUntil(self.clients.openWindow(ev.notification.data.url))
})
