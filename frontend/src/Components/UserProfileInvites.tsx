import {useAPI, useAppState} from '../AppState/AppState';
import React, {useEffect, useState} from 'react';
import {InviteEntity, InvitesAvailability} from '../API/InviteAPI';
import {Link, useLocation} from 'react-router-dom';
import styles from './UserProfileInvites.module.scss';
import karmaStyles from './UserProfileKarma.module.scss';
import createPostStyles from '../Pages/CreatePostPage.module.css';
import commentStyles from './CommentComponent.module.scss';
import {toast} from 'react-toastify';
import Username from './Username';
import CreateCommentComponent from './CreateCommentComponent';
import {CommentInfo} from '../Types/PostInfo';
import ContentComponent from './ContentComponent';
import {observer} from 'mobx-react-lite';
import moment from 'moment';
import plural from 'plural-ru';
import {confirmAlert} from 'react-confirm-alert';
import 'react-confirm-alert/src/react-confirm-alert.css';
import {useRestrictions} from '../API/use/useRestrictions';
import classNames from 'classnames';
import DateComponent from './DateComponent'; // Import css

type UserProfileInvitesProps = {
    username: string;
    onInvitesChange: () => void;
};

export const UserProfileInvites = observer((props: UserProfileInvitesProps) => {
    const api = useAPI();

    const [loading, setLoading] = useState(true);
    const [activeInvites, setActiveInvites] = useState<InviteEntity[]>([]);
    const [inactiveInvites, setInactiveInvites] = useState<InviteEntity[]>([]);
    const [invitesAvailability, setInvitesAvailability] = useState<InvitesAvailability | undefined>(undefined);
    const restrictions = useRestrictions(props.username);
    const isMyProfile = props.username === useAppState().userInfo?.username;
    const location = useLocation();

    const usernameFilter = (location.hash.length > 1 && location.hash.substring(1)) || undefined;

    const [refreshCount, setRefreshCount] = useState(0);
    const [regeneratedIdx, setRegeneratedIdx] = useState<number | undefined>(undefined);
    const forceRefresh = () => setRefreshCount(refreshCount + 1);

    useEffect(() => {
        api.inviteAPI.list(props.username)
            .then(result => {
                setActiveInvites(result.active || []);
                if (usernameFilter) {
                    setInactiveInvites(result.inactive.filter(i => i.invited.find(u => u.username === usernameFilter)));
                } else {
                    setInactiveInvites(result.inactive);
                }
                setInvitesAvailability(result.invitesAvailability);
                setLoading(false);
            })
            .catch(err => {
                console.error('Invite list error', err);
            });
    }, [props.username, api.inviteAPI, refreshCount, usernameFilter]);

    const handleCreateInvite = async (reason: string): Promise<CommentInfo | undefined> => {
        try {
            const result = await api.inviteAPI.create(reason);
            console.log('CREATE', result);
            forceRefresh();
            props.onInvitesChange();
        } catch (error: any) {
            console.log('CREATE ERR', error);
            toast.error(error?.message || 'Не удалось создать инвайт.');
            throw error;
        }
        return;
    };

    const handleRegenerate = async (code: string, idx: number | undefined) => {
        setRegeneratedIdx(undefined);
        try {
            const result = await api.inviteAPI.regenerate(code);
            setRegeneratedIdx(idx);
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
            props.onInvitesChange();
        } catch (error: any) {
            console.log('DELETE ERR', error);
            toast.error(error?.message || 'Не удалось удалить инвайт.');
            throw error;
        }
    };

    const handleEdit = async (code: string, content: string) => {
        try {
            const result = await api.inviteAPI.edit(code, content);
            console.log('EDIT', result);
            forceRefresh();
            return result.reason;
        } catch (error: any) {
            console.log('EDIT ERR', error);
            toast.error(error?.message || 'Не удалось отредактировать инвайт.');
            throw error;
        }
    };

    const resetUsernameFilter = () => {
        window.location.hash = '';
    };

    return (
        loading ?
            <div>Загрузка...</div>
            :
            <div className={styles.invites}>
                {!restrictions?.canInvite ?
                    <div className={karmaStyles.info}>
                        <div>
                            {isMyProfile ? <>
                                <p>На текущий момент у вас нет возможности приглашать людей на орбитар.</p>
                                <p>Детальная информация об ограничнениях доступна во вкладке&nbsp;
                                    <Link to={'/profile/karma'}>Саморегуляция</Link>.
                                </p>
                            </> : <>
                                <p>На текущий момент этот пользователь не может приглашать людей на орбитар.</p>
                            </>}
                        </div>
                    </div> : !!invitesAvailability && !usernameFilter && <>
                    <div>
                        <h2>{isMyProfile ? 'Вам доступно' : 'Доступно'} {plural(invitesAvailability.invitesLeft,
                            '%d приглашение', '%d приглашения', '%d приглашений')}</h2>

                        {invitesAvailability?.daysLeftToNextAvailableInvite !== undefined &&
                            <p>До следующего инвайта
                                осталось
                                ждать {moment.duration(Math.round(invitesAvailability?.daysLeftToNextAvailableInvite * 24), 'hours').humanize(true)}.
                            </p>}

                        <p>
                            Приглашения доступны, когда за&nbsp;
                            {plural(Math.round(invitesAvailability.inviteWaitPeriodDays), 'последний', 'последние')}&nbsp;
                            {moment.duration(Math.round(invitesAvailability.inviteWaitPeriodDays), 'days').humanize(true)}
                            &nbsp;было использовано не более&nbsp;
                            {plural(invitesAvailability.invitesPerPeriod, 'одного приглашения', '%d приглашений')}.
                        </p>
                        {isMyProfile && <>
                            <p>
                                Чем больше хороших и активных людей вы зовете, тем больше приглашений вам доступно.
                                Если же тот, кого вы позвали, окажется слит, то период ожидания приглашений будет
                                увеличен.
                            </p>
                            <h2>Помните!</h2>
                            <p>
                                Вы отвечаете за тех, кого пригласили.
                            </p>
                        </>}
                    </div>
                </>}

                {!!invitesAvailability?.invitesLeft && isMyProfile && !usernameFilter && <div>
                    <h2>Создать приглашение</h2>
                    <div className={styles.createInvite}>
                        <p>
                            Этот текст <b>будет виден всем</b>.
                            Напишите пару слов о том, кого вы собираетесь позвать и зачем.
                            Если было обсуждение, оставьте ссылку на него.
                        </p>
                        <div className={createPostStyles.form}>
                            <CreateCommentComponent open={true} onAnswer={handleCreateInvite}/>
                        </div>
                    </div>
                </div>}

                {!!activeInvites.length && !usernameFilter && <>
                    <h3>Созданные приглашения</h3>
                    <div className="list">
                        {activeInvites.map((invite, idx) =>
                            <Invite invite={invite} key={idx}
                                    idx={idx}
                                    regeneratedIdx={regeneratedIdx}
                                    active={true}
                                    handleRegenerate={handleRegenerate}
                                    handleDelete={handleDelete}
                                    handleEdit={handleEdit}
                            />)}
                    </div>
                </>}

                {inactiveInvites.length > 0 &&
                    <>
                        <h3>История приглашений</h3>
                        <div className="list">
                            {inactiveInvites.map((invite, idx) =>
                                <Invite invite={invite} key={idx}
                                        active={false}
                                        handleRegenerate={handleRegenerate}
                                        handleDelete={handleDelete}
                                        usernameFilter={usernameFilter}
                                        handleEdit={handleEdit}
                                />
                            )}
                        </div>
                    </>
                }

                {!inactiveInvites.length && !activeInvites.length && <>Существующих приглашений не найдено.</>}

                {usernameFilter && <div><button onClick={resetUsernameFilter}>Показать всю историю</button></div>}

            </div>
    );
});

const Invite = (props: {
    invite: InviteEntity,
    active: boolean,
    handleRegenerate: (code: string, idx: number | undefined) => void,
    handleDelete: (code: string) => void,
    handleEdit: (code: string, content: string) => Promise<any>,
    usernameFilter?: string,
    idx?: number,
    regeneratedIdx?: number
}) => {
    const {invite, idx, regeneratedIdx} = props;
    const [editing, setEditing] = useState(false);

    const handleCopyInvite = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(`https://${process.env.REACT_APP_ROOT_DOMAIN}/invite/${invite.code}`).then(() => {
            toast('В буфере!');
        }).catch();
    };

    return <div className={classNames('item', 'invite')}>
        <div className="generated">создан <DateComponent date={new Date(invite.issued)} /></div>
        {invite.invited.length > 0 &&
            <div className="invited">
                {invite.invited.map(user => <Username key={user.username}
                                                      className={classNames({[styles.highlighted]: props.usernameFilter === user.username})}
                                                      user={user}/>)}
            </div>}

        {!!invite.reason && <div className={classNames(commentStyles.content, styles.content)}>
            {editing ?
                <CreateCommentComponent open={true} onAnswer={async (text) => {
                    if (text === invite.reasonSource) {
                        setEditing(false);
                        return invite.reason;
                    }
                    const res = await props.handleEdit(invite.code, text);
                    setEditing(false);
                    return res.content;
                }} text={invite.reasonSource}/>
                : <ContentComponent content={invite.reason}/>}
            </div>
        }

        {props.active && !!invite.code && <>
            <div className={classNames('code', {'regenerated': idx === regeneratedIdx})}><Link to={`//${process.env.REACT_APP_ROOT_DOMAIN}/invite/${invite.code}`}
                                        onClick={handleCopyInvite}>{process.env.REACT_APP_ROOT_DOMAIN}/invite/{invite.code}</Link>
            </div>
            <button onClick={handleCopyInvite}>Скопировать</button>
            <ConfirmButton onAction={() => props.handleRegenerate(invite.code, props.idx)}
                message={`Вы уверены, что хотите сгенерировать новый код для приглашения?`}
            >Отозвать</ConfirmButton>
            <button onClick={() => setEditing(!editing)}>{editing ? 'Отмена' : 'Редактировать'}</button>
            {invite.restricted && props.active && !invite.invited?.length &&
                <ConfirmButton onAction={() => props.handleDelete(invite.code)}
                    message={`Вы уверены, что хотите удалить приглашение?`}
                >Удалить</ConfirmButton>}
        </>}
    </div>;
};

type ConfirmButtonProps = {
    onAction: () => void,
    children: React.ReactNode,
    message?: string
};

const ConfirmButton = (props: ConfirmButtonProps) => {
    const handleConfirm = () => {
        confirmAlert({
            title: 'Астанавитесь!',
            message: props.message,
            buttons: [
                {
                    label: 'Да!',
                    onClick: () => props.onAction()
                },
                {
                    label: 'Отмена',
                    className: 'cancel'
                }
            ],
            overlayClassName: 'orbitar-confirm-overlay'
        });
    };

    return <>
        <button onClick={handleConfirm}>{props.children}</button>
    </>;
};