import {createContext, ReactNode, useContext, useEffect, useMemo} from 'react';
import APIBase from '../API/APIBase';
import APIHelper from '../API/APIHelper';
import {UserInfo} from '../Types/UserInfo';
import {SiteWithUserInfo} from '../Types/SiteInfo';
import {observable, makeObservable, autorun, action} from 'mobx';

export enum AppLoadingState {
    loading,
    unauthorized,
    authorized
}

export type UserStats = {
    watch: {
        posts: number;
        comments: number;
    };
    notifications: number;
};

type AppStateContextState = {
    api: APIHelper;
    appState: AppState;
};

export class AppState {
    @observable
    appLoadingState = AppLoadingState.loading;

    @observable.struct
    userInfo: UserInfo | undefined = undefined; // undefined means not authorized

    @observable.deep
    userStats: UserStats = { notifications: 0, watch: { posts: 0, comments: 0 } };

    @observable.deep
    site: SiteWithUserInfo | undefined = undefined;

    constructor() {
        makeObservable(this);
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
    setUserStats(value: UserStats) {
        this.userStats = value;
    }

    @action
    setNotificationsCount(value: number) {
        this.userStats.notifications = value;
    }

    @action
    setSite(value: SiteWithUserInfo | undefined) {
        this.site = value;
    }
}

const AppStateContext = createContext<AppStateContextState>({} as AppStateContextState);

export const AppStateProvider = (props: {children: ReactNode}) => {
    const {appState, api} = useMemo(() => {
        const appState = new AppState();
        const apiBase = new APIBase();
        const api = new APIHelper(apiBase, appState);
        api.init().then().catch();
        return {appState, api};
    }, []);

    useEffect(() => {
        return autorun(() => {
            const link = document.querySelector('link[rel~="icon"]') as HTMLLinkElement;
            if (!link) {
                return;
            }
            if (appState.userStats.notifications > 0) {
                link.href = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/favicon-badge.png';
            }
            else {
                link.href = '//' + process.env.REACT_APP_ROOT_DOMAIN + '/favicon.ico';
            }
        });
    }, [appState]);

    return <AppStateContext.Provider value={{ api: api, appState }}>
        {props.children}
    </AppStateContext.Provider>;
};

export function useAppState() {
    return useContext(AppStateContext).appState;
}

export function useAPI() {
    return useContext(AppStateContext).api;
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
