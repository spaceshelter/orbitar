import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Button from '@ui/Button'
import { observer } from 'mobx-react-lite'
import { toast } from 'react-toastify'

import { useAPI, useAppState } from '../AppState/AppState'
import { SiteWithUserInfo } from '../Types/SiteInfo'
import { pluralize } from '../Utils/utils'

import styles from './SitesPage.module.scss'

export const SitesPage = observer(() => {
  const api = useAPI()
  const [sites, setSites] = useState<SiteWithUserInfo[]>([])
  const [subsDisabled, setSubsDisabled] = useState(false)
  const { userRestrictions } = useAppState()

  useEffect(() => {
    api.site
      .list(1, 1000)
      .then(setSites)
      .catch((err) => {
        console.error('Site list error', err)
        toast.error('Не удалось загрузить список сайтов, увы.')
      })
    api.user.refreshUserRestrictions()
  }, [api])

  const handleSubscribe = async (site: string, value: boolean) => {
    setSubsDisabled(true)
    try {
      await api.site.subscribe(site, value, false)

      const siteInfo = sites.find((s) => s.site === site)
      if (siteInfo) {
        siteInfo.subscribe = { main: value, bookmarks: false }
        setSites(sites)
      }
    } finally {
      setSubsDisabled(false)
    }
  }

  return (
    <div className={styles.sites}>
      {sites.map((site) => (
        <div key={site.site} className='site'>
          <div className='site-info'>
            <Link className='title' to={`/s/${site.site}`}>
              {site.name}
            </Link>
            <div className='subscribers'>
              <Link to={`/s/${site.site}`}>/s/{site.site}</Link> •{' '}
              {pluralize(site.subscribers, ['подписчик', 'подписчика', 'подписчиков'])}
            </div>
          </div>
          <div>
            {site.subscribe?.main ? (
              <Button variant='ghost' disabled={subsDisabled} onClick={() => handleSubscribe(site.site, false)}>
                Отписаться
              </Button>
            ) : (
              <Button variant='primary' disabled={subsDisabled} onClick={() => handleSubscribe(site.site, true)}>
                Подписаться
              </Button>
            )}
          </div>
        </div>
      ))}

      {userRestrictions?.canCreateSubsites && (
        <div>
          <Link to='/sites/create'>Создать новый</Link>
        </div>
      )}
    </div>
  )
})
