import Cookies from 'js-cookie';

type APIResponseError = {
    result: 'error';
    code: string;
    message: string;
};
type APIResponseSuccess<Response> = {
    result: 'success';
    payload: Response;
    sync: string;
};
type APIResponse<Response> = APIResponseError | APIResponseSuccess<Response>;

export class APIError extends Error {
    public code: string;
    public statusCode?: number;

    constructor(code: string, message: string, statusCode?: number) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}

export default class APIBase {
    private sessionId?: string;
    private readonly endpoint: string;
    private sync: number = 0;

    constructor() {
        this.sessionId = Cookies.get('session');
        this.endpoint = '//api.' + process.env.REACT_APP_ROOT_DOMAIN + '/api/v1';
    }

    async request<Req, Res>(url: string, payload: Req): Promise<Res> {
        const headers: any = {
            'Content-Type': 'application/json',
        };
        if (this.sessionId) {
            headers['X-Session-Id'] = this.sessionId;
        }
        const response = await fetch(
            this.endpoint + url,
            {
                method: 'POST',
                body: JSON.stringify(payload),
                // mode: 'cors',
                // credentials: 'include',
                headers
            }
        );

        if (response.status === 429) {
            throw new APIError('rate-limit', 'Rate limit exceeded', response.status);
        }

        const sessionId = response.headers.get('x-session-id');
        if (sessionId) {
            this.sessionId = sessionId;
            Cookies.set('session', sessionId, { domain: '.' + process.env.REACT_APP_ROOT_DOMAIN, expires: 365 })
        }

        const responseJson = await response.json() as APIResponse<Res>;

        if (responseJson.result === 'error') {
            throw new APIError(responseJson.code, responseJson.message, response.status);
        }

        if (!responseJson.payload) {
            throw new APIError('no-payload', 'Payload required', response.status);
        }

        if (responseJson.sync) {
            const cTime = new Date();
            const rTime = new Date(responseJson.sync);
            this.sync = Math.round((cTime.getTime() - rTime.getTime()) / 1000 / 900) / 4 * 3600 * 1000;
        }

        return responseJson.payload;
    }

    fixDate(date: Date) {
        return new Date(date.getTime() + this.sync);
    }
}
