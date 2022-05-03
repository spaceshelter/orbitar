import {createContext, Dispatch, ReactNode, SetStateAction, useContext, useEffect, useMemo, useState} from 'react';
import APIBase from '../API/APIBase';
import APIHelper from '../API/APIHelper';
import {UserInfo} from '../Types/UserInfo';
import {SiteInfo, SiteWithUserInfo} from '../Types/SiteInfo';

export enum AppState {
    loading,
    unauthorized,
    authorized
}

type AppStateContextState = {
    userInfo?: UserInfo;
    appState: AppState;
    api: APIHelper;
    site?: SiteWithUserInfo;
};

export type AppStateSetters = {
    setSite: Dispatch<SetStateAction<SiteWithUserInfo | undefined>>;
    setUserInfo: (user: UserInfo | undefined) => void;
    setAppState: (state: AppState) => void;
}

const AppStateContext = createContext<AppStateContextState>({} as AppStateContextState);

const apiBase = new APIBase();

export const AppStateProvider = (props: {children: ReactNode}) => {
    const [userInfo, setUserInfo] = useState<UserInfo | undefined>(undefined);
    const [appState, setAppState] = useState<AppState>(AppState.loading);
    const [site, setSite] = useState<SiteInfo>();
    const api = useMemo(() => new APIHelper(apiBase, {setUserInfo, setAppState, setSite}), []);
    api.updateSetters({setUserInfo, setAppState, setSite});

    useEffect(() => {
        api.init().then();
    }, [api]);

    return <AppStateContext.Provider value={{ userInfo, appState, api: api, site: site }}>
        {props.children}
    </AppStateContext.Provider>
}

export function useAppState() {
    return useContext(AppStateContext);
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
        return { siteName: site, fullSiteName: site + '.' + process.env.REACT_APP_ROOT_DOMAIN };
    }
}
