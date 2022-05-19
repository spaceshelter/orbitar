import {ContentFormat} from '../entities/common';
import {HistoryEntity} from '../entities/HistoryEntity';

export type PostHistoryRequest = {
    id: number;
    type: 'post' | 'comment';
    format?: ContentFormat;
};

export type PostHistoryResponse = {
    history: HistoryEntity[];
};
