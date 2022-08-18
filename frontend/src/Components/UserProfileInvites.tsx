import {useAPI} from '../AppState/AppState';
import React, {useEffect, useState} from 'react';
import {InviteEntity} from '../API/InviteAPI';
import {Link} from 'react-router-dom';
import styles from './UserProfileInvites.module.scss';
import {toast} from 'react-toastify';
import Username from './Username';

export const UserProfileInvites = () => {
    const api = useAPI();
    const [loading, setLoading] = useState(true);
    const [activeInvites, setActiveInvites] = useState<InviteEntity[]>([]);
    const [inactiveInvites, setInactiveInvites] = useState<InviteEntity[]>([]);

    useEffect(() => {
        api.inviteAPI.list()
            .then(result => {
                console.log('INVITES', result);
                setActiveInvites(result.active);
                setInactiveInvites(result.inactive);
                setLoading(false);
            })
            .catch(err => {
                console.error('Invite list error', err);
            });
    }, [api.inviteAPI]);

    const handleCopyInvite = (e: React.MouseEvent, code: string) => {
        if (!navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(`https://${process.env.REACT_APP_ROOT_DOMAIN}/invite/${code}`).then(() => {
            toast('В буфере!');
        }).catch();
        e.preventDefault();
    };

    return (
        loading ?
            <div>Загрузка...</div>
            :
        <div className={styles.invites}>
            <h4>Ваши инвайты</h4>
            <div className='list'>
                {activeInvites.length
                ?
                    <>
                        {activeInvites.map(invite =>
                            <div className='item' key={invite.code}>
                                <button onClick={e => handleCopyInvite(e, invite.code)}>Скопировать</button>
                                <div className='code'><Link to={`//${process.env.REACT_APP_ROOT_DOMAIN}/invite/${invite.code}`} onClick={e => handleCopyInvite(e, invite.code)}>{process.env.REACT_APP_ROOT_DOMAIN}/invite/{invite.code}</Link></div>
                                {invite.invited.length > 0 &&
                                    <div className='invited'>
                                        {invite.invited.map(user => <Username key={user.username} user={user} />)}
                                    </div>
                                }
                            </div>
                        )}
                    </>
                :
                    <>Кажется, инвайтов у вас нет. Попробуете <Link to='/create'>пост интересный</Link> написать?</>
                }
            </div>
            {inactiveInvites.length > 0 &&
                <>
                    <h4>Использованные инвайты</h4>
                    <div className='list'>
                        {inactiveInvites.map(invite =>
                            <div className='item' key={invite.code}>
                                <div className='code'>{invite.code}</div>
                                {invite.invited.length > 0 &&
                                    <div className='invited'>
                                        {invite.invited.map(user => <Username key={user.username} user={user}/>)}
                                    </div>
                                }
                            </div>
                        )}
                    </div>
                </>
            }
        </div>
    );
};
