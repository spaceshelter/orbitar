import React, {FunctionComponent} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import {AppStateProvider, useAppState} from './AppState/AppState';
import {getThemes, ThemeProvider} from './Theme/ThemeProvider';
import {Router} from 'react-router-dom';
import './icons.font';

(async () => {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    const registration = await navigator.serviceWorker.getRegistration('/service.js');
    if (!registration) {
        await navigator.serviceWorker.register('/service.js', {scope: '/'});
    }
})().then().catch();

const container = document.getElementById('root');
if (!container) {
    throw new Error('No root container found');
}

const MobXAwareRouter: FunctionComponent = (props) => {
    const {router} = useAppState();
    const [state, setState] = React.useState({
        action: router.history.action,
        location: router.history.location,
    });
    React.useLayoutEffect(() => router.subscribe(setState), []);

    return (
        <Router location={state.location} navigationType={state.action} navigator={router.history}>
            {props.children}
        </Router>
    );
};

const root = createRoot(container);

root.render(
    <AppStateProvider>
        <MobXAwareRouter>
            <ThemeProvider themeCollection={ getThemes() }>
                <App />
            </ThemeProvider>
        </MobXAwareRouter>
    </AppStateProvider>
);