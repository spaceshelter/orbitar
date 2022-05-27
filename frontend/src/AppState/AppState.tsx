import {createContext, ReactNode, useContext, useEffect, useMemo} from 'react';
import APIBase from '../API/APIBase';
import APIHelper from '../API/APIHelper';
import {UserInfo} from '../Types/UserInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';
import {observable, makeObservable, autorun, action, computed, makeAutoObservable} from 'mobx';
import APICache from '../API/APICache';
import {createBrowserHistory} from 'history';
import {RouterStore} from '@superwf/mobx-react-router';

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

    browserHistory = createBrowserHistory();
    router = new RouterStore(this.browserHistory);

    readonly api: APIHelper;
    readonly cache: APICache;

    constructor() {
        makeObservable(this);

        this.router.appendPathList('/s/:site');

        const apiBase = new APIBase();
        this.cache = makeAutoObservable(new APICache());
        this.api = new APIHelper(apiBase, this);
        this.api.init().then().catch();

        autorun(() => {
            console.log('Change site:', this.site);
        });

        autorun(() => {
            console.log('Change siteInfo:', this.siteInfo);
        });
    }

    @computed
    get site() {
        return this.router.pathValue['site'] || 'main';
    }

    @computed.struct
    get siteInfo() {
        return this.cache.getSite(this.site);
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
        value && this.cache.setSite(value);
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
