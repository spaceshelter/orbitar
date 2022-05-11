import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {AppStateProvider} from './AppState/AppState';
import {ThemeProvider} from './Theme/ThemeProvider';
import theme from './theme';
import { BrowserRouter } from "react-router-dom";

(async () => {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    let registration = await navigator.serviceWorker.getRegistration('/service.js');
    if (!registration) {
        await navigator.serviceWorker.register('/service.js', {scope: '/'});
    }
})().then().catch();

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <BrowserRouter>
        <AppStateProvider>
            <ThemeProvider themeCollection={theme}>
                <App />
            </ThemeProvider>
        </AppStateProvider>
    </BrowserRouter>
)
