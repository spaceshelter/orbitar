import {TranslationMode} from '../../../managers/TranslationManager';

export type TranslateRequest = {
    id: number;
    type: 'post' | 'comment';
    mode: TranslationMode;
};

export type TranslateResponse = string;