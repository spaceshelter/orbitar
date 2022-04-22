import AuthAPI from './AuthAPI';
import {AppState, AppStateSetters} from '../AppState/AppState';

export default class AuthAPIHelper {
    private api: AuthAPI;
    setters: AppStateSetters;

    constructor(api: AuthAPI, setters: AppStateSetters) {
        this.api = api;
        this.setters = setters;
    }

    async signIn(username: string, password: string) {
        try {
            let auth = await this.api.signIn(username, password)

            console.log('SIGN IN', auth);

            this.setters.setUserInfo(auth.user);
            this.setters.setAppState(AppState.authorized);
            // navigate({replace: true});
            return auth.user;
        }
        catch (error) {
            console.log('ERROR SIGN IN', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.api.signOut();
            this.setters.setUserInfo(undefined);
            this.setters.setAppState(AppState.unauthorized);
        }
        catch (error) {
            console.log('ERROR SIGN IN', error);
            throw new Error('Could not sign out')
        }
    }
}
