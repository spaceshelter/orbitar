import {VoteListItemEntity, VoteType} from '../entities/VoteEntity';

export type VoteListRequest = {
    type: VoteType;
    id: number;
};

export type VoteListResponse = {
    votes: VoteListItemEntity[]
};
