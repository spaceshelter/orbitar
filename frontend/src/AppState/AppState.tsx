import {createContext, ReactNode, useContext, useEffect, useMemo, useState} from 'react';
import APIBase from '../API/APIBase';
import APIHelper from '../API/APIHelper';
import {UserInfo} from '../Types/UserInfo';

export enum AppState {
    loading,
    unauthorized,
    authorized
}

type AppStateContextState = {
    userInfo: UserInfo | undefined;
    appState: AppState;
    api: APIHelper;
};

export type AppStateSetters = {
    setUserInfo: (user: UserInfo | undefined) => void;
    setAppState: (state: AppState) => void;
}

const AppStateContext = createContext<AppStateContextState>({} as AppStateContextState);

const apiBase = new APIBase();

export const AppStateProvider = (props: {children: ReactNode}) => {
    const [userInfo, setUserInfo] = useState<UserInfo | undefined>(undefined);
    const [appState, setAppState] = useState<AppState>(AppState.loading);
    const api = useMemo(() => new APIHelper(apiBase, {setUserInfo, setAppState}), []);
    api.updateSetters({setUserInfo, setAppState});

    useEffect(() => {
        api.init().then();
    }, [api]);

    return <AppStateContext.Provider value={{ userInfo, appState, api: api }}>
        {props.children}
    </AppStateContext.Provider>
}

export function useAppState() {
    return useContext(AppStateContext);
}

export function useAPI() {
    return useContext(AppStateContext).api;
}