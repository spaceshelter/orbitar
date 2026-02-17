import React, { useEffect, useState } from 'react'
import { Link, Navigate, useMatch, useSearchParams } from 'react-router-dom'

import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

import { APIError } from '../API/APIBase'
import { FeedType, useFeed } from '../API/use/useFeed'
import { FeedRoute, useFeedPreference } from '../API/use/useFeedPreference'
import { useAPI, useAppState } from '../AppState/AppState'
import { LARGE_AUTO_CUT, SMALL_AUTO_CUT } from '../Components/ContentComponent'
import Paginator from '../Components/Paginator'
import PostComponent from '../Components/PostComponent'
import { ReloadingLink } from '../Components/ReloadingLink'
import { FeedSorting } from '../Types/FeedSortingSettings'

import styles from './FeedPage.module.scss'

/**
 * Map a feed route to the API feed type.
 */
function feedRouteToType(route: FeedRoute): FeedType {
  switch (route) {
    case '/posts':
      return 'site'
    case '/all':
      return 'all'
    case '/subscriptions':
    case '/':
    default:
      return 'subscriptions'
  }
}

/**
 * Wrapper component that handles the redirect-and-save logic.
 *
 * When the user navigates to /subscriptions, /posts, or /all on the main site:
 *   1. Saves the route as their feed preference
 *   2. Redirects to / (which renders the preferred feed)
 *
 * This keeps the URL canonical (always /) while letting tab links
 * go through explicit routes to trigger the preference save.
 */
const FeedPageRouter = observer(() => {
  const { site } = useAppState()
  const [search] = useSearchParams()
  const { feedRoute, setFeedRoute } = useFeedPreference()

  const matchSubscriptions = !!useMatch('/subscriptions')
  const matchPosts = !!useMatch('/posts')
  const matchAll = !!useMatch('/all')

  // Determine which explicit route we're on (if any)
  const explicitRoute: FeedRoute | null = matchSubscriptions
    ? '/subscriptions'
    : matchPosts
      ? '/posts'
      : matchAll
        ? '/all'
        : null

  // On explicit feed routes on main site: save preference and redirect to /
  if (site === 'main' && explicitRoute) {
    if (feedRoute !== explicitRoute) {
      setFeedRoute(explicitRoute)
    }
    const query = search.toString()
    return <Navigate to={'/' + (query ? '?' + query : '')} replace />
  }

  return <FeedPageContent />
})

/**
 * The actual feed page content.
 * On main site (/), reads the saved preference to determine which feed to show.
 * On subsites (/s/:site), always shows the site feed.
 */
const FeedPageContent = observer(() => {
  const { site, siteInfo } = useAppState()
  const api = useAPI()
  const [search] = useSearchParams()
  const { feedRoute } = useFeedPreference()

  const resolvedFeedType: FeedType = site === 'main' ? feedRouteToType(feedRoute) : 'site'
  const baseRoute = site === 'main' ? '/' : '/s/' + site

  const perpage = 20
  const page = parseInt(search.get('page') || '1')

  const [sorting, setSorting] = useState<FeedSorting>()
  const { posts, loading, pages, error, updatePost, setLoading } = useFeed(
    site,
    resolvedFeedType,
    page,
    perpage,
    setSorting,
    sorting,
  )

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  useEffect(() => {
    let docTitle = siteInfo?.name || 'ЪУЪ'
    if (resolvedFeedType === 'subscriptions') {
      docTitle += ' / Подписки'
    } else if (resolvedFeedType === 'all') {
      docTitle += ' / Все посты'
    }
    document.title = docTitle
  }, [siteInfo, resolvedFeedType])

  const handleFeedSortingChange = (newFeedSorting: FeedSorting) => async (e: React.MouseEvent) => {
    e.preventDefault()
    setLoading(true)
    await api.feed.saveSorting(site, newFeedSorting)
    setSorting(newFeedSorting)
    setLoading(false)
  }

  const liveSorting = sorting !== FeedSorting.postCreatedAt

  return (
    <div className={styles.container}>
      <div className={styles.feed}>
        <div className={styles.feedControlsWrapper}>
          {siteInfo && (
            <div className={styles.feedControls}>
              <a
                href='#'
                className={classNames({ [styles.active]: liveSorting })}
                onClick={handleFeedSortingChange(FeedSorting.postCommentedAt)}
              >
                <i className='i i-live'></i>LIVE
              </a>
              <a
                href='#'
                className={classNames({ [styles.active]: !liveSorting })}
                onClick={handleFeedSortingChange(FeedSorting.postCreatedAt)}
              >
                <i className='i i-new'></i>НОВОЕ
              </a>
            </div>
          )}
          {siteInfo?.site === 'main' && (
            <div className={styles.feedControls}>
              <ReloadingLink
                to='/subscriptions'
                className={resolvedFeedType === 'subscriptions' ? styles.active : ''}
                replace={true}
              >
                подписки
              </ReloadingLink>
              •
              <ReloadingLink to='/all' className={resolvedFeedType === 'all' ? styles.active : ''} replace={true}>
                всё
              </ReloadingLink>
              •
              <ReloadingLink to='/posts' className={resolvedFeedType === 'site' ? styles.active : ''} replace={true}>
                главная
              </ReloadingLink>
            </div>
          )}
        </div>
        {!error && loading && <div className={styles.loading}></div>}
        {error && (
          <div className={styles.error}>
            {(error[1] as APIError)?.code === 'no-site' ? (
              <>
                Нет такого сайта. <Link to='/sites/create'>Создать</Link>?
              </>
            ) : (
              error[0]
            )}
          </div>
        )}
        {posts && (
          <div className={styles.posts}>
            {posts.map((post) => (
              <PostComponent
                key={post.id}
                post={post}
                showSite={siteInfo?.site !== post.site}
                onChange={updatePost}
                autoCut={post.vote === -1 ? SMALL_AUTO_CUT : LARGE_AUTO_CUT}
              />
            ))}
          </div>
        )}

        <div className={styles.paginatorContainer}>
          <Paginator page={page} pages={pages} base={baseRoute} />
        </div>
      </div>
    </div>
  )
})

export default FeedPageRouter
