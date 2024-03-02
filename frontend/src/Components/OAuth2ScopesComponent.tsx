import styles from './OAuth2ScopesComponent.module.scss';
import { OAuth2ScopesLabels } from '../Types/OAuth2';

function ScopeControl(props: { name: string, description: string, checked: boolean }) {
  return (
    <label>
      <input
        type={'checkbox'} {...(props.checked ? { defaultChecked: true } : {})} {...(props.name === 'openid' ? { disabled: true } : {})}
        name={props.name}/>
      <span>
        <b>{props.name}</b> - {props.description}
      </span>

    </label>
  );
}

export default function OAuth2ScopesComponent(props: { appRequests: string | null }) {
  const requestedScopesNames = ['openid'].concat(props.appRequests?.split(',').map(s => s.trim()) || []);
  return (<div className={styles.container}>
    {
      Object.keys(OAuth2ScopesLabels)
        .filter(scope => requestedScopesNames && requestedScopesNames.includes(scope))
        .map((scope) => {
        if ((requestedScopesNames && requestedScopesNames.includes(scope))) {
          return (<ScopeControl key={scope} name={scope} checked={requestedScopesNames.includes(scope)} description={OAuth2ScopesLabels[scope]} />);
        }
        return null;
      })
    }
  </div>);
}
