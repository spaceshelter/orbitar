import {SubmitHandler, useForm} from 'react-hook-form';
import React, {useEffect, useState} from 'react';
import styles from './CreatePostPage.module.css';
import {SiteInfo} from '../Types/SiteInfo';
import {useAPI} from '../AppState/AppState';
import SiteSidebar from '../Components/SiteSidebar';
import {useNavigate} from 'react-location';

type CreatePostValues = {
    title: string;
    content: string;
};

export function CreatePostPage() {
    const api = useAPI();
    const [site, setSite] = useState<SiteInfo>();
    const navigate = useNavigate();

    const { register, handleSubmit, formState: { errors, isValid } } = useForm<CreatePostValues>({
        mode: "onChange"
    });

    useEffect(() => {
        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }

        const siteInfo = api.cache.getSite(site);
        if (siteInfo) {
            setSite(siteInfo);
        }
    }, [api]);

    const onSubmit: SubmitHandler<CreatePostValues> = data => {
        let site = 'main';
        if (window.location.hostname !== process.env.REACT_APP_ROOT_DOMAIN) {
            site = window.location.hostname.split('.')[0];
        }

        console.log(data);
        api.postAPI.create(site, data.title, data.content)
            .then(result => {
                console.log('CREATE', result);
                navigate({to: '/post/' + result.post.id})
            })
            .catch(error => {
                console.log('CREATE ERR', error);
            })
    }

    return (
        <div className={styles.container}>
            {site && <SiteSidebar site={site} />}

            <div className={styles.createpost}>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <label>Название</label>
                    <input type="text" placeholder="Без названия" {...register("title", {

                    })} />
                    {errors.title && <p className={styles.error}>{errors.title.message}</p>}

                    <label>Текст</label>
                    <textarea {...register("content", {
                        required: "Пост не может быть пустым",

                    })} />
                    {errors.content && <p className={styles.error}>{errors.content.message}</p>}

                    <div><input type="submit" disabled={!isValid} value="Создать пост" /></div>

                </form>
            </div>
        </div>
    )
}
