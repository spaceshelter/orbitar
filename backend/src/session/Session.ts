import {Request, RequestHandler, Response} from 'express';
import * as crypto from 'crypto';
import DB from '../db/DB';
import {Logger} from 'winston';

const sessionStorage: Record<string, { created: Date, data: SessionData}> = {};

export default class Session {
    private request: Request;
    private response: Response;
    private db: DB;
    private logger: Logger;
    private static SESSION_HEADER = 'X-Session-Id';
    public id?: string;
    public data?: SessionData;
    public created: Date;

    constructor(db: DB, logger: Logger, request: Request, response: Response) {
        this.request = request;
        this.response = response;
        this.db = db;
        this.logger = logger;

        this.id = request.header(Session.SESSION_HEADER);
    }

    async restore() {
        if (!this.id || this.id === '-') {
            this.data = new SessionData('');
            return;
        }

        const cached = sessionStorage[this.id];
        if (cached) {
            this.data = cached.data;
            this.created = cached.created;
            this.response.setHeader(Session.SESSION_HEADER, this.id);
            return;
        }

        const storedData = await this.db.fetchOne<{
            data: string,
            used: Date
        }>('select used, data from sessions where id=:id', {
            id: this.id
        });
        if (storedData) {
            this.logger.verbose(`Session ${this.id} restored from DB`, { session: this.id, data: storedData.data });
            try {
                const parsedData = JSON.parse(storedData.data);
                if (parsedData.userId) {
                    this.data = new SessionData(this.id, parsedData.userId);
                    this.created = storedData.used;
                    sessionStorage[this.id] = {
                        created: this.created,
                        data: this.data
                    };
                    this.response.setHeader(Session.SESSION_HEADER, this.id);
                    return;
                }
            }
            catch {
                // could not parse session, continue to reset
            }
        }

        this.logger.verbose(`Session ${this.id} not found in DB`, { session: this.id });

        this.response.setHeader(Session.SESSION_HEADER, '-');
        this.data = new SessionData('');
    }

    public getAgeMillis() {
        if (!this.created) return 0;
        const now = new Date();
        return now.getTime() - this.created.getTime();
    }

    private async generate(): Promise<string> {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(32, (err, buffer) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(buffer.toString('hex'));
            });
        });
    }

    async init() {
        if (this.id) {
            await this.destroy();
        }

        this.id = await this.generate();
        this.data = new SessionData(this.id);
        this.created = new Date();
        sessionStorage[this.id] = {created: this.created, data: this.data};

        this.response.setHeader(Session.SESSION_HEADER, this.id);

        return this.id;
    }

    async destroy() {
        if (!this.id) return;
        this.data.clear();
        this.data = new SessionData('');
        delete sessionStorage[this.id];

        this.logger.verbose(`Session ${this.id} removed from DB`, { session: this.id });

        await this.db.query('delete from sessions where id=:id', {
            id: this.id
        });

        this.id = undefined;
        this.response.setHeader(Session.SESSION_HEADER, '-');
    }

    async store() {
        if (!this.id) return;

        const data = {
            userId: this.data.userId
        };
        const stringData = JSON.stringify(data);

        await this.db.query('insert into sessions (id, data) values (:id, :data) on duplicate key update data=:data', {
            id: this.id,
            data: stringData
        });

        this.logger.verbose(`Session ${this.id} stored to DB`, { session: this.id, data: data });
    }
}

export class SessionData {
    private sessionId: string;
    public userId = 0;

    constructor(id, userId?: number) {
        this.sessionId = id;
        this.userId = userId;
    }

    clear() {
        this.userId = undefined;
    }
}

export function session(db: DB, logger: Logger): RequestHandler {
    return (req, res, next) => {
        req.session = new Session(db, logger, req, res);
        return (async () => {
            try {
                await req.session.restore();
                // TODO: implement session timeout
                // if (req.session.getAgeMillis() > 3600000 /*1 hour*/) {
                //     await req.session.destroy();
                // }
                next();
            }
            catch (error) {
                logger.error('Could not restore session', { error: error });
                res.error('error', 'Unknown error', 500);
            }
        })();
    };
}

