import express, {RequestHandler} from 'express';
import Joi, {ObjectSchema} from 'joi';
import * as core from 'express-serve-static-core';
import Session from '../session/Session';

type ResponseSuccess<T> = {
    result: 'success';
    payload: T;
    sync: Date;
}
type ResponseError = {
    result: 'error';
    code: string;
    message: string;
    meta?: object;
}
type ResponseBody<T> = ResponseSuccess<T> | ResponseError;

export interface APIRequest<ReqBody, P = core.ParamsDictionary, ResBody = object> extends express.Request<P, ResBody, ReqBody> {
    session: Session;
}
export interface APIResponse<ResBody> extends express.Response<ResponseBody<ResBody>> {
    success<T = ResBody>(payload: T): void;
    error(code: string, message: string, status?: number, meta?: object): void;
    authRequired(): void;
}

function success<T>(payload: T) {
    return this.send({
        result: 'success',
        payload: payload,
        sync: new Date()
    });
}

function error(code: string, message: string, status?: number, meta?: object) {
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

export function validate<ReqBody, ResBody, P = core.ParamsDictionary>(schema: ObjectSchema<ReqBody>): RequestHandler<P, ResBody, ReqBody> {
    return (req, res, next) => {
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

export const joiUsername = Joi.string().regex(/^[a-zа-я0-9_-]{2,30}$/i);
export const joiFormat = Joi.valid('html', 'source').default('html');
