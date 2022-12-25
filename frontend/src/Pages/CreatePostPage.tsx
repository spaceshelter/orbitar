import React, {useEffect} from 'react';
import styles from './CreatePostPage.module.css';
import createCommentStyles from '../Components/CommentComponent.module.scss';
import {useAPI, useAppState} from '../AppState/AppState';
import {useNavigate} from 'react-router-dom';
import {toast} from 'react-toastify';
import classNames from 'classnames';
import SlowMode from '../Components/SlowMode';
import {observer} from 'mobx-react-lite';
import PostEditComponent from '../Components/PostEditComponent';


export const CreatePostPage = observer(() => {
    const api = useAPI();
    const {site, userRestrictions} = useAppState();
    const navigate = useNavigate();

    const handleAnswer = async (text: string, title: string, site: string, main: boolean) => {
        console.log('post', title, text);

        try {
            const result = await api.postAPI.create(site, title, text, main);
            console.log('CREATE', result);
            navigate((site !== 'main' ? `/s/${site}` : '') + `/p${result.post.id}`);
        } catch (error) {
            console.log('CREATE ERR', error);
            toast.error('Пост хороший, но создать его не удалось 🤐');
            throw error;
        }

        return;
    };

    useEffect(() => {
        api.user.refreshUserRestrictions();
    }, [api]);

    if (Number.isInteger(userRestrictions?.restrictedToPostId)) {
        return <RestrictedToPostIdMessage postId={userRestrictions!.restrictedToPostId as number}/>;
    }

    if (userRestrictions?.postSlowModeWaitSecRemain) {
        return <RestrictedSlowMode
            endTime={new Date(Date.now() + userRestrictions.postSlowModeWaitSecRemain * 1000)}
            endCallback={() => {
                api.user.refreshUserRestrictions();
            }}
        />;
    }


    return (
        <div className={styles.container}>
            <div className={classNames(styles.createpost, createCommentStyles.content)}>
                <div className={styles.form}>
                    {userRestrictions?.restrictedToPostId === true && <LastPostMessage/>}
                    <PostEditComponent title="" content="" site={site} main={true} onEdit={handleAnswer} storageKey={`np:${site}`}/>
                </div>
            </div>
        </div>
    );
});

const RestrictedToPostIdMessage = (props: { postId: number }) => {
    return <div className={styles.restrictedToPostIdMessage}>
        Возможность создавать посты заблокирована из-за низкой кармы.
        Можно только комментировать <a href={`/p${props.postId}`}>этот пост</a>.
    </div>;
};

const LastPostMessage = () => {
    return <div className={styles.lastPostMessage}>
        Внимание! Из-за низкой кармы возможность создавать посты ограничена.
        Этот пост, на данный момент, будет последним, который можно создать.
    </div>;
};

const RestrictedSlowMode = (props: { endTime: Date; endCallback: () => void }) => {
    return <SlowMode endTime={props.endTime} endCallback={props.endCallback}>
        <div className={styles.restrictedSlowMode}>
            Возможность создавать посты ограничена из-за низкой кармы. До конца ожидания осталось:
        </div>
    </SlowMode>;
};