import styles from './SitesCreatePage.module.scss';
import React, {useEffect, useState} from 'react';
import {useAPI} from '../AppState/AppState';
import {useNavigate} from 'react-router-dom';
import {APIError} from '../API/APIBase';
import Conf from '../Conf';

export const SitesCreatePage = () => {
    const api = useAPI();
    const [siteDomain, setSiteDomain] = useState('');
    const [siteName, setSiteName] = useState('');
    const [domainError, setDomainError] = useState<string>();
    const [createEnabled, setCreateEnabled] = useState(false);
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();

    const handleSiteDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSiteDomain(e.target.value);
        const domainValidationRegex = new RegExp('^[a-z\\d-]{' + Conf.SITE_DOMAIN_MIN_LENGTH_CHARS + ',' + Conf.SITE_DOMAIN_MAX_LENGTH_CHARS + '}$');
        if (e.target.value && !e.target.value.match(domainValidationRegex)) {
            setDomainError(
              `Только строчные латинские буквы, цифры и минус! ` +
              `От ${Conf.SITE_DOMAIN_MIN_LENGTH_CHARS} до ${Conf.SITE_DOMAIN_MAX_LENGTH_CHARS} символов.`
            );
        }
        else if (domainError) {
            setDomainError(undefined);
        }
    };
    const handleSiteNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSiteName(e.target.value);
    };

    useEffect(() => {
        const enabled = !creating &&
          !domainError &&
          siteDomain.length >= Conf.SITE_DOMAIN_MIN_LENGTH_CHARS &&
          siteName.trim().length >= Conf.SITE_NAME_MIN_LENGTH_CHARS;
        setCreateEnabled(enabled);
    }, [domainError, siteDomain, siteName, creating]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const site = await api.site.create(siteDomain, siteName);
            navigate('/s/' + site.site.site);
        }
        catch (err) {
            if (err instanceof APIError) {
                if (err.code === 'site-limit') {
                    setDomainError('Многовато подсайтов создали вы уже!');
                }
                else if (err.code === 'site-exists') {
                    setDomainError('Такой подсайт уже существует!');
                } else {
                    setDomainError('Произошла ужасная ошибка!');
                }
            }
            console.error('Create site error', err);
        }
        finally {
            setCreating(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className='form'>
                <div className='site'>
                    <label className='s'>{process.env.REACT_APP_ROOT_DOMAIN}/s/</label><input className={styles.title} type="text" placeholder="site" maxLength={Conf.SITE_DOMAIN_MAX_LENGTH_CHARS} value={siteDomain} onChange={handleSiteDomainChange} />
                </div>
                {domainError && <div className='error'>{domainError}</div>}
                <div className='name'>
                    <input className={styles.title} type="text" placeholder="Заголовок" maxLength={Conf.SITE_NAME_MAX_LENGTH_CHARS} value={siteName} onChange={handleSiteNameChange} />
                </div>
                <div className='confirm'>
                    <button className='button' disabled={!createEnabled} onClick={handleCreate}>Создать</button>
                </div>
            </div>
        </div>
    );
};
