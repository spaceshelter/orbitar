import AuthAPI from './AuthAPI';
import {AppLoadingState, AppState} from '../AppState/AppState';

export default class AuthAPIHelper {
    private api: AuthAPI;
    appState: AppState;

    constructor(api: AuthAPI, appState: AppState) {
        this.api = api;
        this.appState = appState;
    }

    async signIn(username: string, password: string) {
        try {
            const auth = await this.api.signIn(username, password);

            this.appState.setUserInfo(auth.user);
            this.appState.setAppLoadingState(AppLoadingState.authorized);

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
            this.appState.setUserInfo(undefined);
            this.appState.setAppLoadingState(AppLoadingState.unauthorized);
        }
        catch (error) {
            console.log('ERROR SIGN IN', error);
            throw new Error('Could not sign out');
        }
    }
}
