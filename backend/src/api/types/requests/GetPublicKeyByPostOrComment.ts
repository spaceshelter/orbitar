export type GetPublicKeyByPostOrCommentRequest = {
    postId?: number;
    commentId?: number;
};

export type GetPublicKeyByPostOrCommentResponse = {
    publicKey?: string;
    username?: string;
};
