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