import styles from './HistoryComponent.module.scss';
import {ReactComponent as CloseIcon} from '../Assets/close.svg';
import React, {useEffect, useState} from 'react';
import ContentComponent from './ContentComponent';
import {useAPI} from '../AppState/AppState';
import {toast} from 'react-toastify';
import {HistoryInfo} from '../Types/HistoryInfo';
import DateComponent from './DateComponent';
import classNames from 'classnames';

interface HistoryComponentProps {
    history: {
        id: number;
        type: string;
    };
    onClose?: () => void;
    initial?: {
        title?: string;
        content: string;
        date: Date;
    };
}

export const HistoryComponent = (props: HistoryComponentProps) => {
    const api = useAPI();
    const [title, setTitle] = useState(props.initial?.title);
    const [content, setContent] = useState(props.initial?.content || '');
    const [selectedId, setSelectedId] = useState(0);
    const [historyEntries, setHistoryEntries] = useState<HistoryInfo[]>(props.initial ? [{
        id: 0,
        content: props.initial.content,
        title: props.initial.title,
        date: props.initial.date,
        changed: 0,
        editor: 0
    }] : []);

    const {history, onClose} = props;

    const select = (id: number) => {
        const entry = historyEntries.find(h => h.id === id);
        if (!entry) {
            return;
        }

        setSelectedId(id);
        setContent(entry.content);
        setTitle(entry.title);
    };

    useEffect(() => {
        api.post.history(history.id, history.type)
            .then(result => {
                console.log(history);
                setHistoryEntries(result);
                if (result.length > 0) {
                    const last = result[0];
                    setSelectedId(last.id);
                    setTitle(last.title);
                    setContent(last.content);
                }
            })
            .catch(err => {
                console.error('History error', err);
                toast.error('Не удалось загрузить историю');
                onClose?.();
            });
    }, [api, history, onClose]);

    return (
        <div className={styles.history}>
            <div className='content'>
                {title && <div className='title'>{title}</div>}
                <ContentComponent content={content} />
            </div>
            <div className='sideNav' >
                <div className='top' ><span>История</span><div className='close' onClick={props.onClose}><CloseIcon /></div></div>

                {historyEntries.map((entry, idx) => {
                    return <div key={entry.id} className={classNames('item', selectedId === entry.id ? 'selected' : '')} onClick={() => select(entry.id)}>
                        {idx === 0 && <div className='version'>Текущая версия</div>}
                        {idx === historyEntries.length - 1 && <div className='version'>Исходная версия</div>}
                        <div className='date'><DateComponent date={entry.date} /></div>
                        {/*<div className='info'> изменено 1% </div>*/}
                    </div>;
                })}
            </div>
        </div>
    );
};
