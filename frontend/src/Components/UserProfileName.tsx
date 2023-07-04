import React, {useEffect, useState} from 'react';
import nameStyles from './UserProfileName.module.scss';
import postStyles from './PostComponent.module.scss';
import {ReactComponent as EditIcon} from '../Assets/edit.svg';
import {ReactComponent as SendIcon} from '../Assets/send.svg';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';

type UserProfileNameProps = {
  name: string;
  mine: boolean;
};

export default function UserProfileBio(props: UserProfileNameProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.name);
  const api = useAPI();

  useEffect(() => {
    setName(props.name);
    setEditing(false);
  }, []);

  const handleEditName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleEditNameComplete = async () => {
    try {
      const newName = await api.userAPI.saveName(name);
      console.log(newName);
      setEditing(false);
    } catch (error: any) {
      toast.error('Не удалось сохранить.');
      throw error;
    }
  };

  return <div className={nameStyles.controls_align}>
    <div className={postStyles.controls}>
      {!editing &&
        <div className={`${postStyles.control} ${nameStyles.profile_name}`}>{name}</div>}
      {editing &&
        <div className={`${postStyles.control} ${nameStyles.edit_active}`}>
          <input className={postStyles.title} value={name} onChange={handleEditName} placeholder={name} type='text'/>
        </div>}

      {props.mine && !editing &&
        <div className={postStyles.control}>
          <button onClick={() => setEditing(true)}><EditIcon/></button>
        </div>}
      {props.mine && editing &&
        <div className={postStyles.control}>
          <button onClick={handleEditNameComplete}><SendIcon/></button>
        </div>}
    </div>
  </div>;
}
