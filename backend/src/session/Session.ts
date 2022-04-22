import {Request, RequestHandler, Response} from 'express';
import * as crypto from 'crypto';

const sessionStorage: Record<string, SessionData> = {};

export default class Session {
    public id?: string;
    public data: SessionData;
    private request: Request;
    private response: Response;
    private static SESSION_HEADER = 'X-Session-Id';

    constructor(request: Request, response: Response) {
        this.request = request;
        this.response = response;

        let sessionId = request.header(Session.SESSION_HEADER);
        let data = sessionStorage[sessionId];

        if (data) {
            this.id = sessionId;
            this.data = data;

            this.response.setHeader(Session.SESSION_HEADER, this.id);
        }
        else {
            this.data = new SessionData('');
        }
    }

    private async generate(): Promise<string> {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(32, (err, buffer) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(buffer.toString('hex'));
            })
        });

    }

    async init() {
        if (this.id) {
            await this.destroy();
        }

        this.id = await this.generate();
        this.data = new SessionData(this.id);
        sessionStorage[this.id] = this.data;

        this.response.setHeader(Session.SESSION_HEADER, this.id);

        return this.id;
    }

    async destroy() {
        if (!this.id) return;
        this.data.clear();
        this.data = new SessionData('');
        delete sessionStorage[this.id];

        // TODO: write to storage

        this.id = undefined;
    }

    async store() {
        // TODO: clear storage
    }
}

export class SessionData {
    private sessionId: string;
    public userId?: number;

    constructor(id) {
        this.sessionId = id;
    }

    clear() {
        this.userId = undefined;
    }
}

export function session(): RequestHandler {
    return (req, res, next) => {
        req.session = new Session(req, res);
        next();
    }
}

