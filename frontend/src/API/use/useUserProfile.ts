import {useAPI} from '../../AppState/AppState';
import {useEffect, useState} from 'react';
import {APIError} from '../APIBase';
import {UserProfileResult} from '../UserAPIHelper';

type ProfileStateBase = {
    status: 'loading' | 'not-found';
};
type ProfileStateError = {
    status: 'error';
    message: string;
};
type ProfileStateReady = {
    status: 'ready';
    profile: UserProfileResult;
};
type ProfileState = ProfileStateBase | ProfileStateError | ProfileStateReady;

export function useUserProfile(username: string): [ProfileState, () => void] {
    const api = useAPI();
    const [state, setState] = useState<ProfileState>({ status: 'loading' });

    const refresh = () => {
        api.user.userProfile(username)
            .then(profile => {
                setState({
                    status: 'ready',
                    profile
                });
            })
            .catch(error => {
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
    };

    useEffect(() => {
        refresh();
    }, [username, api.user]);

    return [state, refresh];
}