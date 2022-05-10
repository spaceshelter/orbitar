import {ContentFormat} from '../entities/ContentFormat';
import {UserEntity} from '../entities/UserEntity';
import {CommentEntity} from "../entities/CommentEntity";
import {SiteEntity} from "../entities/SiteEntity";

export type UserCommentsRequest = {
    username: string;
    format: ContentFormat;
    page?: number;
    perpage?: number;
};

export type UserCommentsResponse = {
    comments: CommentEntity[];
    total: number;
    users: Record<number, UserEntity>;
    sites: Record<number, SiteEntity>;
};