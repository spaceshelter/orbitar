import React, {useEffect, useState} from 'react';
import styles from '../Pages/UserPage.module.scss';
import ContentComponent from './ContentComponent';
import postStyles from './PostComponent.module.scss';
import CreateCommentComponent from './CreateCommentComponent';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';

type UserProfileBioProps = {
  source?: string;
  html?: string;
  mine: boolean;
  site: string;
};

export default function SiteInfo(props: UserProfileBioProps) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(props.source);
  const [html, setHtml] = useState(props.html);
  const api = useAPI();

  useEffect(() => {
    setHtml(props.html);
    setSource(props.source);
    setEditing(false);
  }, [props.source]);

  const handleUpdateInfo = async (info: string): Promise<string | undefined> => {
    try {
      const newInfo = await api.siteAPI.saveFeedInfo(props.site, info);
      setEditing(false);
      setSource(info);
      setHtml(newInfo.info);
      return newInfo.info as unknown as string;
    } catch (error: any) {
      toast.error(error?.message || 'Не удалось сохранить.');
      throw error;
    }
  };

  return <div className={styles.bio}>
    <div>
      {!editing && <ContentComponent content={html || ''} />}
      {editing && <CreateCommentComponent open={true} text={source || ''} onAnswer={handleUpdateInfo}/>}
    </div>
    <div className={styles.controls}>
      {props.mine && !editing && <div className={postStyles.control}><button onClick={() => setEditing(true)}><EditIcon /> {source ? 'Редактировать описание' : 'Добавить описание'}</button></div>}
    </div>
  </div>;
}
