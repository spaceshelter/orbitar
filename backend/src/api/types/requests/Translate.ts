export type TranslateRequest = {
    id: number;
    type: 'post' | 'comment';
};

export type TranslateResponse = {
    title: string;
    html: string;
};