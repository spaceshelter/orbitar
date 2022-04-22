import Cookies from 'js-cookie';

type APIResponseError = {
    result: 'error';
    code: string;
    message: string;
};
type APIResponseSuccess = {
    result: 'success';
    payload: Object;
};
type APIResponse = APIResponseError | APIResponseSuccess;

export class APIError extends Error {
    public code: string;

    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

export default class APIBase {
    private sessionId?: string;
    private readonly endpoint: string;

    constructor() {
        this.sessionId = Cookies.get('session');
        this.endpoint = '//api.' + process.env.REACT_APP_ROOT_DOMAIN + '/api/v1';
    }

    async request(url: string, payload: object) {
        let headers: any = {
            'Content-Type': 'application/json',
        };
        if (this.sessionId) {
            headers['X-Session-Id'] = this.sessionId;
        }
        let response = await fetch(
            this.endpoint + url,
            {
                method: 'POST',
                body: JSON.stringify(payload),
                // mode: 'cors',
                // credentials: 'include',
                headers: headers
            }
        );

        if (response.status === 429) {
            throw new APIError('rate-limit', 'Rate limit exceeded');
        }

        let sessionId = response.headers.get('x-session-id');
        if (sessionId) {
            this.sessionId = sessionId;
            Cookies.set('session', sessionId, { domain: '.' + process.env.REACT_APP_ROOT_DOMAIN, expires: 365 })
        }

        let responseJson = await response.json() as APIResponse;

        console.log('RESPONSE', url, await responseJson);

        if (responseJson.result === 'error') {
            throw new APIError(responseJson.code, responseJson.message);
        }

        if (!responseJson.payload) {
            throw new APIError('no-payload', 'Payload required');
        }

        return responseJson.payload;
    }
}
