import {useAPI} from '../../AppState/AppState';
import {useEffect, useState} from 'react';
import {UserRestrictionsResponse} from '../UserAPI';


export function useRestrictions(username: string): UserRestrictionsResponse | undefined {
    const api = useAPI();
    const [restrictionsResult, setRestrictionsResult] = useState<UserRestrictionsResponse | undefined>();

    useEffect(() => {
        api.userAPI.userRestrictions(username)
            .then(result => {
                    console.log('Restrictions response', result);
                    setRestrictionsResult(result);
                }
            ).catch(err => {
            console.error('Restrictions response error', err);
        });
    }, [api, username]);

    return restrictionsResult;
}