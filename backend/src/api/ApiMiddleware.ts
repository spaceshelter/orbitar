import express, {RequestHandler} from 'express';
import {ObjectSchema} from 'joi';

type ResponseSuccess<T> = {
    result: 'success';
    payload: T;
    sync: Date;
}
type ResponseError = {
    result: 'error';
    code: string;
    message: string;
    meta?: any;
}
type ResponseBody<T> = ResponseSuccess<T> | ResponseError;

export interface APIRequest<T> extends express.Request<any, any, T> {

}
export interface APIResponse<T> extends express.Response<ResponseBody<T>> {
    success(payload: T): void;
}

function success<T>(payload: T) {
    return this.send({
        result: 'success',
        payload: payload,
        sync: new Date()
    });
}

function error(code: string, message: string, status?: number, meta?: any) {
    if (status) {
        this.status(status);
    }

    const body: ResponseError = {
        result: 'error',
        code: code,
        message: message
    };

    if (meta) {
        body.meta = meta;
    }

    return this.send(body);
}

function authRequired() {
    return this.error('auth-required', 'Authorization required');
}

export function apiMiddleware(): RequestHandler {
    return (req, res, next) => {
        res.success = success;
        res.error = error;
        res.authRequired = authRequired;
        next();
    }
}

export function validate<TSchema>(schema: ObjectSchema<TSchema>): RequestHandler {
    return (req: APIRequest<TSchema>, res, next) => {
        schema.validateAsync(req.body)
            .then(result => {
                req.body = result;
                next();
            })
            .catch(err => {
                res.error('invalid-payload', err.message, 401, {
                    details: err.details?.map(detail => { return { path: detail.path.join('.'), type: detail.type, error: detail.message } })
                });
            });
    }
}
