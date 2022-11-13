import {useAPI, useAppState} from '../AppState/AppState';
import React, {useEffect, useState} from 'react';
import {InviteEntity, InvitesAvailability} from '../API/InviteAPI';
import {Link} from 'react-router-dom';
import styles from './UserProfileInvites.module.scss';
import karmaStyles from './UserProfileKarma.module.scss';
import {toast} from 'react-toastify';
import Username from './Username';
import createPostStyles from '../Pages/CreatePostPage.module.css';
import createCommentStyles from '../Components/CommentComponent.module.scss';
import classNames from 'classnames';
import CreateCommentComponent from './CreateCommentComponent';
import {CommentInfo} from '../Types/PostInfo';
import ContentComponent from './ContentComponent';
import {observer} from 'mobx-react-lite';
import moment from 'moment';

export const UserProfileInvites = observer(() => {
    const api = useAPI();
    const restrictions = useAppState().userRestrictions;
    console.log(restrictions);
    const [loading, setLoading] = useState(true);
    const [activeInvites, setActiveInvites] = useState<InviteEntity[]>([]);
    const [inactiveInvites, setInactiveInvites] = useState<InviteEntity[]>([]);
    const [invitesAvailability, setInvitesAvailability] = useState<InvitesAvailability | undefined>(undefined);

    const [createNewInviteForm, setCreateNewInviteForm] = useState(false);
    const toggleCreateNewInviteForm = () => setCreateNewInviteForm(!createNewInviteForm);
    const [refreshCount, setRefreshCount] = useState(0);
    const forceRefresh = () => setRefreshCount(refreshCount + 1);

    useEffect(() => {
        if (restrictions?.canInvite) {
            api.inviteAPI.list()
                .then(result => {
                    console.log('INVITES', result);
                    const activeInvites = result.active.filter(invite => !invite.restricted);
                    const restrictedInvites = result.active.filter(invite => invite.restricted);
                    setActiveInvites(activeInvites.concat(restrictedInvites));
                    setInactiveInvites(result.inactive);
                    setInvitesAvailability(result.invitesAvailability);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Invite list error', err);
                });
        } else {
            setLoading(false);
        }
    }, [api.inviteAPI, refreshCount, restrictions?.canInvite]);

    const handleCreateInvite = async (reason: string): Promise<CommentInfo | undefined> => {
        try {
            const result = await api.inviteAPI.create(reason);
            console.log('CREATE', result);
            setCreateNewInviteForm(false);
            forceRefresh();
        } catch (error: any) {
            console.log('CREATE ERR', error);
            toast.error(error?.message || 'Не удалось создать инвайт.');
            throw error;
        }
        return;
    };

    const handleRegenerate = async (code: string) => {
        try {
            const result = await api.inviteAPI.regenerate(code);
            console.log('REGENERATE', result);
            forceRefresh();
        } catch (error: any) {
            console.log('REGENERATE ERR', error);
            toast.error(error?.message || 'Не удалось создать инвайт.');
            throw error;
        }
    };

    const handleDelete = async (code: string) => {
        try {
            const result = await api.inviteAPI.delete(code);
            console.log('DELETE', result);
            forceRefresh();
        } catch (error: any) {
            console.log('DELETE ERR', error);
            toast.error(error?.message || 'Не удалось удалить инвайт.');
            throw error;
        }
    };

    return (
        loading ?
            <div>Загрузка...</div>
            : !restrictions?.canInvite ?
            <div className={karmaStyles.info}>
                <div>
                    <p>На текущий момент у вас нет возможности приглашать людей на орбитар.</p>
                    <p>Детальная информация об ограничнениях доступна во вкладке&nbsp;
                        <Link to={'/profile/karma'}>Саморегуляция</Link>.
                    </p>
                </div>
            </div>
            :
            <div className={styles.invites}>
                <h4>Ваши инвайты</h4>
                <div className="list">
                    {!!activeInvites.length && <>
                        {activeInvites.map(invite => <Invite invite={invite} key={invite.code}
                                                             handleRegenerate={handleRegenerate}
                                                             handleDelete={handleDelete}/>)}
                    </>}
                    {!inactiveInvites.length && !activeInvites.length && <>Кажется, инвайтов у вас нет.</>}
                </div>

                {restrictions?.canInvite && invitesAvailability?.invitesLeft === 0 && <>Больше инвайтов пока создать нельзя.</>}

                {restrictions?.canInvite && !createNewInviteForm && !!invitesAvailability?.invitesLeft &&
                    <button onClick={toggleCreateNewInviteForm}>Создать новый инвайт
                        ({invitesAvailability?.invitesLeft === 1 ? 'остался один' : `осталось ${invitesAvailability?.invitesLeft}`})</button>}

                {restrictions?.canInvite && !createNewInviteForm && invitesAvailability?.daysLeftToNextAvailableInvite !== undefined &&
                    <div>До следующего доступного инвайта
                        осталось ждать {moment.duration(Math.round(invitesAvailability?.daysLeftToNextAvailableInvite * 24), 'hours').humanize(true)}.
                        <br/>
                        Выдается инвайтов: {invitesAvailability.invitesPerPeriod} в&nbsp;
                        {moment.duration(Math.round(invitesAvailability.inviteWaitPeriodDays), 'days').humanize(true)}.
                    </div>}


                {createNewInviteForm && <div className={createPostStyles.container}>
                    <div className={classNames(createPostStyles.createpost, createCommentStyles.content)}>
                        <div className={createPostStyles.form}>
                            Причина для инвайта:
                            <CreateCommentComponent open={true} onAnswer={handleCreateInvite}/>
                        </div>
                    </div>
                </div>}

                {inactiveInvites.length > 0 &&
                    <>
                        <h4>Использованные инвайты</h4>
                        <div className="list">
                            {inactiveInvites.map(invite =>
                                <div className="item" key={invite.code}>
                                    <div className="code">{invite.code}</div>
                                    {invite.invited.length > 0 &&
                                        <div className="invited">
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
});

const Invite = (props: {
    invite: InviteEntity,
    handleRegenerate: (code: string) => void,
    handleDelete: (code: string) => void
}) => {
    const {invite} = props;

    const [showReason, setShowReason] = useState(false);

    const handleCopyInvite = (e: React.MouseEvent) => {
        if (!navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(`https://${process.env.REACT_APP_ROOT_DOMAIN}/invite/${invite.code}`).then(() => {
            toast('В буфере!');
        }).catch();
        e.preventDefault();
    };

    return <div className="item" key={invite.code}>
        <button onClick={() => handleCopyInvite}>Скопировать</button>
        <div className="code"><Link to={`//${process.env.REACT_APP_ROOT_DOMAIN}/invite/${invite.code}`}
                                    onClick={handleCopyInvite}>{process.env.REACT_APP_ROOT_DOMAIN}/invite/{invite.code}</Link>
        </div>
        &nbsp;<ConfirmButton onAction={() => props.handleRegenerate(invite.code)}>Перегенерить</ConfirmButton>
        {invite.restricted && !invite.invited?.length &&
            <ConfirmButton onAction={() => props.handleDelete(invite.code)}>Удалить</ConfirmButton>}
        {invite.reason && <button title={'Причина'} onClick={() => setShowReason(!showReason)}>?</button>}
        {invite.reason && showReason && <div className="content"><ContentComponent content={invite.reason}/></div>}
        {invite.invited.length > 0 &&
            <div className="invited">
                {invite.invited.map(user => <Username key={user.username} user={user}/>)}
            </div>
        }
    </div>;
};

const ConfirmButton = (props: { onAction: () => void, children: React.ReactNode }) => {
    const [confirm, setConfirm] = useState(false);
    const handleConfirm = () => {
        setConfirm(true);
    };
    const handleCancel = () => {
        setConfirm(false);
    };
    const handleAction = () => {
        setConfirm(false);
        props.onAction();
    };
    return <>
        {!confirm && <button onClick={handleConfirm}>{props.children}</button>}
        {confirm && <div className="confirm">
                <span>Точно?
                    &nbsp;
                    <button onClick={handleAction}>Да</button>
                <button onClick={handleCancel}>Нет</button>
                </span>
        </div>}
    </>;
};