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

    @observable
    notificationsCount = 0;

    @observable
    watchCommentsCount = 0;

    @observable.struct
    subscriptions: SiteWithUserInfo[] = [];

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
        this.notificationsCount = value.notifications;
        this.watchCommentsCount = value.watch.comments;
        this.subscriptions = value.subscriptions;
    }

    @action
    setSubscriptions(value: SiteWithUserInfo[]) {
        this.subscriptions = value;
    }

    @action
    setWatchCommentsCount(value: number) {
        this.watchCommentsCount = value;
    }

    @action
    setNotificationsCount(value: number) {
        this.notificationsCount = value;
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
            if (appState.notificationsCount > 0) {
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
