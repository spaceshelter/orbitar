import styles from './OAuth2ScopesComponent.module.scss';
import {useEffect, useState} from 'react';
import {useAPI} from '../AppState/AppState';

function ScopeControl(props: { name: string, description: string, checked: boolean }) {
  return (
    <label>
      <input
        disabled={true}
        type={'checkbox'} {...(props.checked ? { defaultChecked: true } : {})}
        name={props.name}/>
      <span>
        <b>{props.name}</b> - {props.description}
      </span>

    </label>
  );
}

export default function OAuth2ScopesComponent(props: { appRequests: string | null }) {

    const [scopes, setScopes] = useState<Record<string, string> | undefined>(undefined);
    const {oauth2Api} = useAPI();

    useEffect(() => {
        oauth2Api.verifyScopes(props.appRequests || '').then((response) => {
            setScopes(response);
        });
    }, []);

    if (!scopes) {
        return <div>Загрузка...</div>;
    }

    return <div className={styles.container}>
        {
            Object.keys(scopes)
                .map((scope) =>
                    <ScopeControl key={scope} name={scope} checked={true} description={scopes[scope]}/>
                )
        }
    </div>;
}
