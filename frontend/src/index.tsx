import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {AppStateProvider} from './AppState/AppState';
import {ThemeProvider} from './Theme/ThemeProvider';
import theme from './theme';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <AppStateProvider>
        <ThemeProvider themeCollection={theme}>
            <App />
        </ThemeProvider>
    </AppStateProvider>
)
