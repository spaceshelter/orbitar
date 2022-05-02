export type InviteRaw = {
    invite_id: number;
    code: string;
    issued_by: number;
    issued_at: Date;
    issued_count: number;
    left_count: number;
};

export type InviteRawWithIssuer = InviteRaw & {
    issuer: string;
};
