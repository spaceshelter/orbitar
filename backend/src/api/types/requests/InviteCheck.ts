export type InviteCheckRequest = {
    code: string;
};

export type InviteCheckResponse = {
    code: string;
    inviter: string;
};
