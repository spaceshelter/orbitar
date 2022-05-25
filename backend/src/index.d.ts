import Session from './session/Session';

type ResponseSuccess<T> = {
    result: 'success';
    payload: T;
    sync: Date;
};
type ResponseError = {
    result: 'error';
    code: string;
    message: string;
    meta?: object;
};
type ResponseBody<T> = ResponseSuccess<T> | ResponseError;

declare global {
    namespace Express {
        export interface Request {
            session: Session;
        }
        // export interface Response <ResBody = any, Locals extends Record<string, any> = Record<string, any>> {
        export interface Response<ResBody = unknown, ResPayload = ResBody extends ResponseSuccess<infer U> ? U : never>
            // extends core.Response<ResBody, Locals>
        {
            success(payload: ResPayload): void;
            error(code: string, message: string, status?: number, meta?: object): void;
            authRequired(): void;
        }
    }
}
