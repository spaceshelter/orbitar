export interface InviteInfo {
    id: number;
    code: string;
    issuedBy: number;
    issuedAt: Date;
    issuedCount: number;
    leftCount: number;
}
