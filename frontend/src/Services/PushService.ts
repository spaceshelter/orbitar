export class PushService {
    private registration?: ServiceWorkerRegistration;
    private subscription?: PushSubscription;

    async getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
        if (this.registration) {
            return this.registration;
        }

        if (!('serviceWorker' in navigator)) {
            return;
        }

        const registration = await navigator.serviceWorker.getRegistration('/service.js')
        if (!registration) {
            return;
        }

        await navigator.serviceWorker.ready;
        this.registration = registration;

        return registration;
    }

    async getSubscription() {
        if (this.subscription) {
            return this.subscription;
        }

        const registration = await this.getRegistration();
        if (!registration) {
            return;
        }

        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            return;
        }
        this.subscription = subscription;

        return subscription;
    }

    async getAuth() {
        const subscription = await this.getSubscription();
        if (!subscription) {
            return;
        }

        return subscription.toJSON().keys?.auth;
    }

    async subscribe() {
        const registration = await this.getRegistration();
        if (!registration) {
            return;
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY
        });

        this.subscription = subscription;
        return subscription;
    }
}

const pushService = new PushService();

export function usePushService() {
    return pushService;
}
