import {createContext, ReactNode, useContext, useEffect, useMemo} from 'react';
import APIBase from '../API/APIBase';
import APIHelper from '../API/APIHelper';
import {UserInfo} from '../Types/UserInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';
import {observable, makeObservable, autorun, action} from 'mobx';
import APICache from '../API/APICache';

export enum AppLoadingState {
    loading,
    unauthorized,
    authorized
}

export type UserStatus = {
    watch: {
        posts: number;
        comments: number;
    };
    notifications: number;
    subscriptions: SiteWithUserInfo[];
};

type AppStateContextState = {
    appState: AppState;
};

export class AppState {
    @observable
    appLoadingState = AppLoadingState.loading;

    @observable.struct
    userInfo: UserInfo | undefined = undefined; // undefined means not authorized

    @observable.deep
    userStatus: UserStatus = { notifications: 0, watch: { posts: 0, comments: 0 }, subscriptions: [] };

    @observable.struct
    siteInfo: SiteWithUserInfo | undefined = undefined;

    @observable
    site = 'main';

    readonly api: APIHelper;
    readonly cache: APICache;

    constructor() {
        makeObservable(this);

        const apiBase = new APIBase();
        this.cache = new APICache();
        this.api = new APIHelper(apiBase, this);
        this.api.init().then().catch();
    }

    @action
    setAppLoadingState(value: AppLoadingState) {
        this.appLoadingState = value;
    }

    @action
    setUserInfo(value: UserInfo | undefined) {
        this.userInfo = value;
    }

    @action
    setUserStatus(value: UserStatus) {
        if (value.notifications !== this.userStatus.notifications) {
            this.userStatus.notifications = value.notifications;
        }
        if (value.watch.comments !== this.userStatus.watch.comments) {
            this.userStatus.watch.comments = value.watch.comments;
        }
        if (value.subscriptions.length !== this.userStatus.subscriptions.length) {
            this.userStatus.subscriptions = value.subscriptions;
        }
        else {
            for (let i = 0; i < value.subscriptions.length; i++) {
                const oldSub = this.userStatus.subscriptions[i];
                const newSub = value.subscriptions[i];
                if (
                    oldSub.name !== newSub.name
                    || oldSub.site !== newSub.site
                    || oldSub.subscribe?.main !== newSub.subscribe?.main
                    || oldSub.subscribe?.bookmarks !== newSub.subscribe?.bookmarks
                ) {
                    this.userStatus.subscriptions[i] = newSub;
                }
            }
        }
    }

    @action
    setNotificationsCount(value: number) {
        this.userStatus.notifications = value;
    }

    @action
    setSiteInfo(value: SiteWithUserInfo | undefined) {
        this.siteInfo = value;
        if (value) {
            this.cache.setSite(value);
        }
    }

    @action
    setSite(value: string) {
        this.site = value;

        this.siteInfo = this.cache.getSite(value);
        if (!this.siteInfo) {
            // request site info
            this.api.site.site(value).then().catch();
        }
    }
}

const AppStateContext = createContext<AppStateContextState>({} as AppStateContextState);

export const AppStateProvider = (props: {children: ReactNode}) => {
    const appState = useMemo(() => {
        return new AppState();
    }, []);

    useEffect(() => {
        return autorun(() => {
            const link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement;
            if (!link) {
                return;
            }
            if (appState.userStatus.notifications > 0) {
                link.href = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/favicon-badge.png';
            }
            else {
                link.href = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/favicon.ico';
            }
        });
    }, [appState]);

    return <AppStateContext.Provider value={{ appState }}>
        {props.children}
    </AppStateContext.Provider>;
};

export function useAppState() {
    return useContext(AppStateContext).appState;
}

export function useAPI() {
    return useContext(AppStateContext).appState.api;
}

let siteName: string | undefined;
let fullSiteName: string | undefined;

export function useSiteName(site?: string): { siteName: string, fullSiteName: string } {
    if (!site && siteName && fullSiteName) {
        return { siteName, fullSiteName };
    }

    if (!site) {
        siteName = site || 'main';
        fullSiteName = process.env.REACT_APP_ROOT_DOMAIN || '';

        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            siteName = window.location.hostname.split('.')[0];
        }

        if (siteName !== 'main') {
            fullSiteName = siteName + '.' + process.env.REACT_APP_ROOT_DOMAIN;
        }

        // fix site
        if (siteName === 'design-test') {
            siteName = 'main';
        }

        return { siteName, fullSiteName };
    }
    else {
        if (site === 'main') {
            return { siteName: site, fullSiteName: process.env.REACT_APP_ROOT_DOMAIN || '' };
        }

        return { siteName: site, fullSiteName: site + '.' + process.env.REACT_APP_ROOT_DOMAIN };
    }
}
