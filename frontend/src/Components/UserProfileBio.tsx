import React, {useEffect, useState} from 'react';
import styles from '../Pages/UserPage.module.scss';
import ContentComponent from './ContentComponent';
import postStyles from './PostComponent.module.scss';
import CreateCommentComponent from './CreateCommentComponent';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import {useAPI, useAppState} from '../AppState/AppState';
import {toast} from 'react-toastify';

type UserProfileBioProps = {
  username: string;
  bio_source: string;
  bio_html: string;
  mine: boolean;
};

export default function UserProfileBio(props: UserProfileBioProps) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(props.bio_source);
  const [html, setHtml] = useState(props.bio_html);
  const api = useAPI();
  const currentUsername = useAppState().userInfo?.username;

  useEffect(() => {
    setHtml(props.bio_html);
    setSource(props.bio_source);
    setEditing(false);
  }, [props.bio_source]);

  const handleUpdateBio = async (bio: string): Promise<string | undefined> => {
    try {
      const newBio = await api.userAPI.saveBio(bio);
      setEditing(false);
      setSource(bio);
      setHtml(newBio.bio);
      return newBio.bio as unknown as string;
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось сохранить.');
      throw error;
    }
  };

  return <div className={styles.bio}>
    <div>
      {!editing && <ContentComponent currentUsername={currentUsername} content={html} />}
      {editing && <CreateCommentComponent open={true} text={source} onAnswer={handleUpdateBio}/>}
    </div>
    <div className={styles.controls}>
      {props.mine && !editing && <div className={postStyles.control}><button onClick={() => setEditing(true)}><EditIcon /> {source ? 'Редактировать' : 'Расскажите что-нибудь о себе'}</button></div>}
    </div>
  </div>;
}
