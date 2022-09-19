import {ContentFormat} from '../entities/common';
import {UserEntity} from '../entities/UserEntity';
import {PostEntity} from '../entities/PostEntity';

export type PostEditRequest = {
    id: number;
    title?: string;
    main: boolean;
    site: string;
    content: string;
    format?: ContentFormat;
};

export type PostEditResponse = {
    post: PostEntity;
    users: Record<number, UserEntity>;
};
