import React, {useState} from 'react';
import styles from './CreatePostPage.module.css';
import createCommentStyles from '../Components/CommentComponent.module.scss';
import {useAPI, useSiteName} from '../AppState/AppState';
import {useNavigate} from 'react-router-dom';
import CreateCommentComponent from '../Components/CreateCommentComponent';
import {CommentInfo} from '../Types/PostInfo';
import {toast} from 'react-toastify';
import classNames from 'classnames';

export function CreatePostPage() {
    const api = useAPI();
    const {siteName} = useSiteName();
    const [title, setTitle] = useState('');
    const navigate = useNavigate();

    const handleAnswer = async (text: string): Promise<CommentInfo | undefined> => {
        console.log('post', title, text);

        try {
            const result = await api.postAPI.create(siteName, title, text);
            console.log('CREATE', result);
            navigate('/post/' + result.post.id);
        }
        catch (error) {
            console.log('CREATE ERR', error);
            toast.error('Пост хороший, но создать его не удалось 🤐');
            throw error;
        }

        return;
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
    };

    return (
        <div className={styles.container}>
            <div className={classNames(styles.createpost, createCommentStyles.content)}>
                <div className={styles.form}>
                    <input className={styles.title} type="text" placeholder="Без названия" maxLength={64} value={title} onChange={handleTitleChange} />
                    <CreateCommentComponent open={true} onAnswer={handleAnswer} />
                </div>
            </div>
        </div>
    );
}
