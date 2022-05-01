import Session from './session/Session';

declare global {
    namespace Express {
        export interface Request {
            session: Session;
        }
        // export interface Response <ResBody = any, Locals extends Record<string, any> = Record<string, any>> {
        export interface Response {
            success<T>(payload: T): void;
            error(code: string, message: string, status?: number, meta?: object): void;
            authRequired(): void;
        }
    }
}
