import Session from './session/Session';

declare global {
    namespace Express {
        export interface Request {
            session: Session;
        }
        export interface Response {
            success(payload: object): void;
            error(code: string, message: string, status?: number): void;
            authRequired(): void;
        }
    }
}
