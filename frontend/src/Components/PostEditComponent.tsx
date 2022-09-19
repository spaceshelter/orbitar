import styles from './PostComponent.module.scss';
import React, {useEffect, useState} from 'react';
import {CommentInfo} from '../Types/PostInfo';

import {useAPI} from '../AppState/AppState';
import CreateCommentComponent from './CreateCommentComponent';
import Select from 'react-select';

interface PostEditComponentProps {
    title: string,
    content: string,
    site: string,
    main: boolean,
    storageKey?: string,
    onEdit?: (text: string, title: string, site: string, main: boolean) => Promise<void>,
}

type OptionType = {
    value: string,
    label: string
};

export default function PostEditComponent(props: PostEditComponentProps) {
    const api = useAPI();

    const [title, setTitle] = useState(props.title);
    const [main, setMain] = useState(props.main);
    const [selectedSite, setSelectedSite] = useState<OptionType | undefined>(undefined);
    const [sitesList, setSitesList] = useState<OptionType[] | undefined>();

    useEffect(() => {
        api.siteAPI.list(true, 1, 1024).then(
            (result) => {
                const siteList = [];
                for (const site of result.sites) {
                    const option = {
                        label: site.site + ' - ' + site.name,
                        value: site.site
                    };
                    if (option.value === props.site) {
                        setSelectedSite(option);
                    }
                    siteList.push(option);
                }
                setSitesList(siteList);
            }
        );
    }, [api, props.site]);

    const handleAnswer = async (text: string): Promise<CommentInfo | undefined> => {
        return selectedSite && props?.onEdit?.(text, title, selectedSite.value, main).then();
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
    };

    return (
        <>
            {sitesList && <Select options={sitesList}
                                          value={selectedSite}
                                          placeholder="Подсайт"
                                          isMulti={false}
                                          onChange={selectedValue => {
                                      selectedValue && setSelectedSite(selectedValue);
                                      return true;
                                  }}
            />}
            <input type="checkbox" id="main" disabled={selectedSite?.value === 'main'}
                   checked={selectedSite?.value === 'main' || main} onChange={(e) => setMain(e.target.checked)}/>
            <label htmlFor="main" >Выводить также на главную</label>
            <input className={styles.title} type="text" placeholder="Без названия" maxLength={64} value={title}
                   onChange={handleTitleChange}/>
            {sitesList && <CreateCommentComponent open={true} text={props.content} storageKey={props.storageKey} onAnswer={handleAnswer}/>}
        </>
    );
}