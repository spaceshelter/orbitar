import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AppStateProvider} from './AppState/AppState';
import {getThemes, ThemeProvider} from './Theme/ThemeProvider';
import {BrowserRouter} from 'react-router-dom';
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

const root = createRoot(container);
root.render(
    <BrowserRouter>
        <AppStateProvider>
            <ThemeProvider themeCollection={ getThemes() }>
                <App />
            </ThemeProvider>
        </AppStateProvider>
    </BrowserRouter>
);
