import express, {RequestHandler} from 'express';
import Joi, {ObjectSchema} from 'joi';
import * as core from 'express-serve-static-core';
import Session from '../session/Session';
import {NextFunction} from 'express-serve-static-core';

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

export interface APIRequestHandler<ReqBody, ResPayload, ResBody = ResponseBody<ResPayload>>
    extends RequestHandler<core.ParamsDictionary, ResBody, ReqBody>
{
    (
        req: APIRequest<ReqBody, ResBody>,
        res: APIResponse<ResPayload>,
        next: NextFunction,
    ): void;
}

export interface APIRequest<ReqBody, ResBody = object, P = core.ParamsDictionary> extends express.Request<P, ResBody, ReqBody> {
    session: Session;
}
export interface APIResponse<Payload> extends express.Response<ResponseBody<Payload>> {
    success(payload: Payload): void;
    error(code: string, message: string, status?: number, meta?: object): void;
    authRequired(): void;
}

function success<T, Payload = T extends ResponseBody<infer U> ? U : never>(payload: Payload) {
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

export function apiMiddleware(): APIRequestHandler<unknown, unknown> {
    return (req, res, next) => {
        res.success = success;
        res.error = error;
        res.authRequired = authRequired;
        next();
    };
}

export function validate<ReqBody, ResPayload>(schema: ObjectSchema<ReqBody>): APIRequestHandler<ReqBody, ResPayload> {
    return (req, res, next) => {
        schema.validateAsync(req.body)
            .then(result => {
                req.body = result;
                next();
            })
            .catch(err => {
                res.error('invalid-payload', err.message, 400, {
                    details: err.details?.map(detail => { return { path: detail.path.join('.'), type: detail.type, error: detail.message }; })
                });
            });
    };
}

export const joiUsername = Joi.string().regex(/^[a-zа-я0-9_-]{2,30}$/i);
export const joiFormat = Joi.valid('html', 'source').default('html');
export const joiSite = Joi.string().regex(/^[a-z\d-]{3,10}$/i);
