export type HistoryEntity = {
    id: number;
    content: string;
    title?: string;
    comment?: string;
    date: string;
    editor: number;
    changed?: number;
};
