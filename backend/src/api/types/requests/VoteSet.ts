import {VoteType} from '../entities/VoteEntity';

export type VoteSetRequest = {
    type: VoteType;
    id: number;
    vote: number;
};

export type VoteSetResponse = {
    type: VoteType;
    id: number;
    rating: number;
    vote?: number;
};
