import {RequestHandler} from 'express';

function success(payload: object) {
    return this.send({
        result: 'success',
        payload: payload,
        sync: new Date()
    });
}

function error(code: string, message: string, status?: number) {
    if (status) {
        this.status(status);
    }

    return this.send({
        result: 'error',
        code: code,
        message: message
    });
}

function authRequired() {
    return this.error('auth-required', 'Authorization required');
}

export function apiMiddleware(): RequestHandler {
    return (req, res, next) => {
        res.success = success;
        res.error = error;
        res.authRequired = authRequired;
        // res.success = (payload) => {
        //     return res.send({
        //         result: 'success',
        //         payload: payload
        //     });
        // };
        // res.error = (code: string, message: string) => {
        //     return res.send({
        //         result: 'error',
        //         code: code,
        //         message: message
        //     });
        // };
        //
        next();
    }
}
