export interface Invite {
    id: number;
    code: string;
    issuedBy: number;
    issuedAt: Date;
    issuedCount: number;
    leftCount: number;
}
