import express, {RequestHandler, Response} from 'express';
import Joi, {ObjectSchema} from 'joi';
import * as core from 'express-serve-static-core';
import Session from '../session/Session';
import {NextFunction} from 'express-serve-static-core';
import isURL from 'validator/lib/isURL';

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
    res?: Response;
};

export class ResponseErrorHandler implements ResponseError {
    result: 'error';
    code: string;
    message: string;
    meta?: object;
    res?: Response;

    constructor(code: string, message: string, meta?: object, res?: Response) {
        this.code = code;
        this.message = message;
        this.meta = meta;
        this.res = res;
        this.sendError();
    }

    sendError() {
        if (this.res) {
            return this.res.status(parseInt(this.code, 10)).json({
                result: 'error',
                code: this.code,
                message: this.message,
                ...(this.meta && { meta: this.meta })
            } as ResponseError);
        }
    }
}

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

// TODO: have a single source of truth with frontend/src/Conf.ts
export const siteDomainMinLengthChars = 3; // restricted only during creation to allow select special names like "ai"
const siteDomainMaxLengthChars = 15;
const siteNameMinLengthChars = 3;
const siteNameMaxLengthChars = 20;

export const joiUsername = Joi.string().regex(/^[a-zа-я0-9_-]{2,30}$/i);
export const joiPassword = Joi.string().min(6);
export const joiFormat = Joi.valid('html', 'source').default('html');

export const joiSite = Joi.string().max(siteDomainMaxLengthChars).regex(/^[a-z\d-]*$/i);
export const joiSiteName = Joi.string().min(siteNameMinLengthChars).max(siteNameMaxLengthChars);

export const urisListValidator = Joi.string().custom((value, helpers) => {
    // remove optional trailing slash with star to support urls like https://example.com/*
    const urls = value.split(',').map(url => url.trim().replace(/\/*$/, ''));
    for (const url of urls) {
        if (!isURL(url, {
            ...(process.env.NODE_ENV === 'development' && { host_whitelist: ['localhost'] }),
            require_protocol: true,
            protocols: ['https', ...(process.env.NODE_ENV === 'development' ? ['http'] : [])]
        })) {
            return helpers.error('any.invalid');
        }
    }
    return value;
}, 'URLs Validation');