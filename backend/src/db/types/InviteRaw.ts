export type InviteRaw = {
    invite_id: number;
    code: string;
    issued_by: number;
    issued_at: Date;
    issued_count: number;
    restricted: number;
    left_count: number;
    reason?: string;
    reason_source?: string;
};

export type InviteRawWithIssuer = InviteRaw & {
    issuer: string;
};

export type InviteRawWithInvited = InviteRaw & {
    invited_user_id: number;
    invited_user_username: string;
    invited_user_gender: number;
};
