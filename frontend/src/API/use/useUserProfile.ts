import {UserInfo, UserProfileInfo} from '../../Types/UserInfo';
import {useAPI} from '../../AppState/AppState';
import {useEffect, useState} from 'react';
import {APIError} from '../APIBase';

type ProfileStateBase = {
    status: 'loading' | 'not-found';
}
type ProfileStateError = {
    status: 'error';
    message: string;
}
type ProfileStateReady = {
    status: 'ready';
    profile: {
        profile: UserProfileInfo;
        invitedBy: UserInfo;
        invites: UserInfo[];
    };
}
type ProfileState = ProfileStateBase | ProfileStateError | ProfileStateReady;

export function useUserProfile(username: string): ProfileState {
    const api = useAPI();
    const [state, setState] = useState<ProfileState>({ status: 'loading' });

    useEffect(() => {
        let reject = false;

        api.user.userProfile(username)
            .then(profile => {
                if (reject) {
                    return;
                }
                setState({
                    status: 'ready',
                    profile
                });
            })
            .catch(error => {
                if (reject) {
                    return;
                }
                console.log('ERROR', error);
                if (error instanceof APIError) {
                    if (error.statusCode === 404) {
                        setState({status: 'not-found'});
                        return;
                    }

                    setState({ status: 'error', message: error.message });
                    return;
                }

                setState( { status: 'error', message: 'Неизвестная ошибка' });
            });

        return () => { reject = true; }
    }, [username, api.user]);

    return state;
}