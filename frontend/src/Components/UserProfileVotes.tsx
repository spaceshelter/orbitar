import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { useDebouncedCallback } from 'use-debounce'

import { UserVoteFeedEvent, UserVoteFeedGroup, UserVotesDirection } from '../API/UserAPI'
import { useAPI, useAppState } from '../AppState/AppState'
import { CommentInfo, PostInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import { pluralize } from '../Utils/utils'
import CommentComponent from './CommentComponent'
import { LARGE_AUTO_CUT } from './ContentComponent'
import { formatRelativeAgeBucket } from './DateComponent'
import Paginator from './Paginator'
import PostComponent from './PostComponent'
import PostLink from './PostLink'
import RatingSwitch from './RatingSwitch'
import Username from './Username'

import feedStyles from '../Pages/FeedPage.module.scss'
import styles from './UserProfileVotes.module.scss'

const perpage = 20

const getTab = (searchParams: URLSearchParams): UserVotesDirection =>
  searchParams.get('tab') === 'received' ? 'received' : 'mine'

const getEventKey = (event: UserVoteFeedEvent) => {
  if (event.type === 'post') {
    return `post:${event.post.id}:${event.voterId}`
  }
  if (event.type === 'comment') {
    return `comment:${event.comment.id}:${event.voterId}`
  }
  return `user:${event.user.id}:${event.voterId}`
}

const getGroupKey = (group: UserVoteFeedGroup) =>
  `${group.kind}:${group.latestAt.toISOString()}:${group.events.map(getEventKey).join('|')}`

const getUser = (users: Record<number, UserInfo>, userId?: number) => (userId ? users[userId] : undefined)

const receivedVotingDisabledTitle = 'Здесь показана эта оценка; число посередине — общий рейтинг.'

const getVoteText = (vote: number) => (vote > 0 ? `+${vote}` : String(vote))

const getVoteClassName = (vote: number) =>
  `${styles.voteValue} ${vote > 0 ? styles.voteValuePlus : vote < 0 ? styles.voteValueMinus : styles.voteValueZero}`

const getScoreClassName = (rating: number) =>
  `${styles.subjectRatingValue} ${
    rating > 0 ? styles.voteValuePlus : rating < 0 ? styles.voteValueMinus : styles.voteValueZero
  }`

const getEventEntityKey = (event: UserVoteFeedEvent) => {
  if (event.type === 'post') {
    return `post:${event.post.id}`
  }
  if (event.type === 'comment') {
    return `comment:${event.comment.id}`
  }
  return `user:${event.user.id}`
}

const getEventRating = (event: UserVoteFeedEvent) => {
  if (event.type === 'post') {
    return event.post.rating
  }
  if (event.type === 'comment') {
    return event.comment.rating
  }
  return event.user.karma
}

const getGroupEntityName = (event?: UserVoteFeedEvent) => {
  if (event?.type === 'post') {
    return 'поста'
  }
  if (event?.type === 'comment') {
    return 'комментария'
  }
  return 'профиля'
}

const getCompactText = (text?: string, limit = 72) => {
  const compact = (text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()

  if (!compact) {
    return ''
  }

  if (compact.length <= limit) {
    return compact
  }

  return `${compact.slice(0, limit).trim()}...`
}

const getPostSubjectText = (post: PostInfo) => {
  const label = getCompactText(post.title) || getCompactText(post.content)
  return label ? `пост #${post.id}: ${label}` : `пост #${post.id}`
}

const renderGroupUserLink = (user?: UserInfo) => {
  if (!user) {
    return <span>пользователя</span>
  }

  return (
    <Link className={styles.groupUserLink} to={`/u/${user.username}`}>
      {user.username}
    </Link>
  )
}

const getVoteTimeGroups = (events: UserVoteFeedEvent[]) =>
  events.reduce<Array<{ bucket: string; events: UserVoteFeedEvent[] }>>((acc, event) => {
    const bucket = formatRelativeAgeBucket(event.votedAt)
    const lastGroup = acc[acc.length - 1]

    if (lastGroup?.bucket === bucket) {
      lastGroup.events.push(event)
    } else {
      acc.push({ bucket, events: [event] })
    }

    return acc
  }, [])

type UserProfileVotesProps = {
  basePath?: string
  queryStringParams?: Record<string, string>
  showTabs?: boolean
}

export default function UserProfileVotes({
  basePath = '/profile/votes',
  queryStringParams: persistentQueryStringParams = {},
  showTabs = true,
}: UserProfileVotesProps) {
  const api = useAPI()
  const { userInfo } = useAppState()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = getTab(searchParams)
  const page = parseInt(searchParams.get('page') || '1')
  const defaultFilter = searchParams.get('filter') || ''
  const [filter, setFilter] = useState(defaultFilter)
  const [groups, setGroups] = useState<UserVoteFeedGroup[]>()
  const [users, setUsers] = useState<Record<number, UserInfo>>({})
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const { search } = useLocation()
  const filterInputRef = useRef<HTMLInputElement>(null)

  const buildSearchParams = (nextTab: UserVotesDirection, nextFilter: string) => {
    const params: Record<string, string> = { ...persistentQueryStringParams, tab: nextTab }
    if (nextFilter) {
      params.filter = nextFilter
    }
    return params
  }

  const tabUrl = (nextTab: UserVotesDirection) => {
    const params = new URLSearchParams(buildSearchParams(nextTab, filter))
    return `${basePath}?${params.toString()}`
  }

  const setDebouncedFilter = useDebouncedCallback((value: string) => {
    setFilter(value)
    setSearchParams(buildSearchParams(tab, value))
  }, 1000)

  const handleFilterChange = (e: React.FormEvent<HTMLInputElement>) => {
    if (e.nativeEvent instanceof KeyboardEvent && e.nativeEvent.key === 'Enter') {
      const value = e.currentTarget.value
      setFilter(value)
      setSearchParams(buildSearchParams(tab, value))
    } else {
      setDebouncedFilter(e.currentTarget.value)
    }
  }

  useEffect(() => {
    const nextSearchParams = new URLSearchParams(search)
    const nextFilter = nextSearchParams.get('filter') || ''
    setFilter(nextFilter)
    if (filterInputRef.current) {
      filterInputRef.current.value = nextFilter
    }
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.userAPI
      .userVotes(tab, filter || '', page, perpage)
      .then((result) => {
        if (cancelled) {
          return
        }
        setGroups(result.groups)
        setUsers(result.users)
        setPages(result.total ? Math.floor((result.total - 1) / perpage) + 1 : 0)
        setError(undefined)
        setLoading(false)
      })
      .catch((error) => {
        console.log('USER PROFILE VOTES ERROR', error)
        if (!cancelled) {
          setError('Не удалось загрузить ленту оценок')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [api.userAPI, filter, page, tab])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const updateVoteEvent = (event: UserVoteFeedEvent, rating: number, vote?: number) => {
    const key = getEventKey(event)
    setGroups((currentGroups) =>
      currentGroups?.map((group) => ({
        ...group,
        events: group.events.map((groupEvent) => {
          if (getEventKey(groupEvent) !== key) {
            return groupEvent
          }

          if (groupEvent.type === 'post') {
            return {
              ...groupEvent,
              vote: vote ?? 0,
              post: {
                ...groupEvent.post,
                rating,
                vote,
              },
            }
          }

          if (groupEvent.type === 'comment') {
            return {
              ...groupEvent,
              vote: vote ?? 0,
              comment: {
                ...groupEvent.comment,
                rating,
                vote,
              },
            }
          }

          return {
            ...groupEvent,
            vote: vote ?? 0,
            user: {
              ...groupEvent.user,
              karma: rating,
              vote,
            },
          }
        }),
      })),
    )
  }

  const updateUserEvent = (event: UserVoteFeedEvent, karma: number, vote?: number) => {
    const key = getEventKey(event)
    setGroups((currentGroups) =>
      currentGroups?.map((group) => ({
        ...group,
        events: group.events.map((groupEvent) =>
          getEventKey(groupEvent) === key && groupEvent.type === 'user'
            ? {
                ...groupEvent,
                vote: vote ?? 0,
                user: {
                  ...groupEvent.user,
                  karma,
                  vote,
                },
              }
            : groupEvent,
        ),
      })),
    )
  }

  const renderGroupHeader = (group: UserVoteFeedGroup) => {
    if (tab !== 'received' && group.kind === 'single') {
      return null
    }

    if (group.kind === 'voter') {
      const voter = getUser(users, group.voterId)
      return (
        <span className={styles.groupTitle}>
          <span className={styles.groupActor}>
            <span>Оценки от</span>
            {renderGroupUserLink(voter)}
          </span>
        </span>
      )
    }

    if (group.kind === 'target-author') {
      const target = getUser(users, group.targetUserId)
      return (
        <span className={styles.groupTitle}>
          <span className={styles.groupActor}>
            <span>Материалы</span>
            {renderGroupUserLink(target)}
          </span>
        </span>
      )
    }

    if (group.kind === 'context-post') {
      return <span className={styles.groupTitle}>Оценки в одном обсуждении</span>
    }

    const firstEvent = group.events[0]
    return <span className={styles.groupTitle}>Оценки {getGroupEntityName(firstEvent)}</span>
  }

  const renderReceivedEventSubject = (event: UserVoteFeedEvent) => {
    if (event.type === 'post') {
      return (
        <PostLink className={styles.subjectLink} post={event.post}>
          {getPostSubjectText(event.post)}
        </PostLink>
      )
    }

    if (event.type === 'comment') {
      return (
        <PostLink className={styles.subjectLink} post={event.comment.postLink} commentId={event.comment.id}>
          комментарий #{event.comment.id} в посте #{event.comment.postLink.id}
        </PostLink>
      )
    }

    return (
      <span className={styles.subjectInline}>
        профиль <Username className={styles.voteUsername} user={event.user} />
      </span>
    )
  }

  const renderReceivedGroupSubject = (group: UserVoteFeedGroup, sameEntity: boolean) => {
    const firstEvent = group.events[0]
    if (!firstEvent) {
      return null
    }

    if (sameEntity) {
      const rating = getEventRating(firstEvent)
      return (
        <div className={styles.groupSubject}>
          <div className={styles.subjectMain}>{renderReceivedEventSubject(firstEvent)}</div>
          <div className={styles.subjectRating}>
            рейтинг <span className={getScoreClassName(rating)}>{rating}</span>
          </div>
        </div>
      )
    }

    if (group.kind === 'context-post') {
      const postLink =
        firstEvent.type === 'post'
          ? firstEvent.post
          : firstEvent.type === 'comment'
            ? firstEvent.comment.postLink
            : undefined
      if (postLink) {
        return (
          <div className={styles.groupSubject}>
            <div className={styles.subjectMain}>
              обсуждение{' '}
              <PostLink className={styles.subjectLink} post={postLink}>
                пост #{postLink.id}
              </PostLink>
            </div>
          </div>
        )
      }
    }

    return null
  }

  const renderReceivedVoteRow = (event: UserVoteFeedEvent, group: UserVoteFeedGroup, sameEntity: boolean) => {
    const voter = getUser(users, event.voterId)
    const rating = getEventRating(event)

    return (
      <div className={styles.voteRow} key={getEventKey(event)}>
        <span className={getVoteClassName(event.vote)}>{getVoteText(event.vote)}</span>
        <div className={styles.voteRowBody}>
          <div className={styles.voteRowMain}>
            {!sameEntity && <span className={styles.voteTarget}>{renderReceivedEventSubject(event)}</span>}
            {group.kind !== 'voter' && (
              <span className={styles.voteVoter}>
                от {voter ? <Username className={styles.voteUsername} user={voter} /> : 'пользователя'}
              </span>
            )}
          </div>
          {!sameEntity && (
            <div className={styles.voteRowMeta}>
              рейтинг <span className={getScoreClassName(rating)}>{rating}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderReceivedTimeGroup = (
    group: UserVoteFeedGroup,
    timeGroup: { bucket: string; events: UserVoteFeedEvent[] },
    sameEntity: boolean,
  ) => {
    return (
      <div className={styles.voteTimeGroup} key={`${timeGroup.bucket}:${timeGroup.events.map(getEventKey).join('|')}`}>
        <div className={styles.voteTimeHeader}>{timeGroup.bucket}</div>
        <div className={styles.voteRows}>
          {timeGroup.events.map((event) => renderReceivedVoteRow(event, group, sameEntity))}
        </div>
      </div>
    )
  }

  const renderReceivedGroup = (group: UserVoteFeedGroup) => {
    const header = renderGroupHeader(group)
    const firstEvent = group.events[0]
    const sameEntity =
      !!firstEvent && group.events.every((event) => getEventEntityKey(event) === getEventEntityKey(firstEvent))
    const timeGroups = getVoteTimeGroups(group.events)

    return (
      <section key={getGroupKey(group)} className={styles.group}>
        <div className={styles.groupHeader}>
          {header}
          <span className={styles.groupCount}>{pluralize(group.events.length, ['оценка', 'оценки', 'оценок'])}</span>
        </div>
        {renderReceivedGroupSubject(group, sameEntity)}
        <div className={styles.voteTimeGroups}>
          {timeGroups.map((timeGroup) => renderReceivedTimeGroup(group, timeGroup, sameEntity))}
        </div>
      </section>
    )
  }

  const renderPost = (event: Extract<UserVoteFeedEvent, { type: 'post' }>) => {
    const handleChange = (_id: number, post: Partial<PostInfo>, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, post.rating ?? event.post.rating, post.vote)
      }
    }

    const post =
      tab === 'received'
        ? {
            ...event.post,
            vote: event.vote,
          }
        : event.post

    return (
      <>
        <PostComponent
          post={post}
          showSite={true}
          votingDisabled={tab === 'received'}
          votingDisabledTitle={receivedVotingDisabledTitle}
          onChange={tab === 'mine' ? handleChange : undefined}
          autoCut={LARGE_AUTO_CUT}
        />
      </>
    )
  }

  const renderComment = (event: Extract<UserVoteFeedEvent, { type: 'comment' }>) => {
    const handleVote = (_id: number, comment: Partial<CommentInfo>, postApiCall?: boolean) => {
      if (postApiCall) {
        updateVoteEvent(event, comment.rating ?? event.comment.rating, comment.vote)
      }
    }

    const comment =
      tab === 'received'
        ? {
            ...event.comment,
            vote: event.vote,
          }
        : event.comment

    return (
      <>
        <CommentComponent
          idx={event.parentComment ? 1 : 0}
          parent={event.parentComment}
          currentUsername={userInfo?.username}
          comment={comment}
          showSite={event.comment.site !== 'main'}
          votingDisabled={tab === 'received'}
          votingDisabledTitle={receivedVotingDisabledTitle}
          onVote={tab === 'mine' ? handleVote : undefined}
        />
      </>
    )
  }

  const renderUser = (event: Extract<UserVoteFeedEvent, { type: 'user' }>) => {
    const handleVote = (karma: number, vote?: number, postApiCall?: boolean) => {
      if (postApiCall) {
        updateUserEvent(event, karma, vote)
      }
    }

    return (
      <>
        <div className={styles.userEvent}>
          <div className={styles.userInfo}>
            <Username user={event.user} />
            <span>карма</span>
          </div>
          {tab === 'mine' ? (
            <RatingSwitch
              type='user'
              id={event.user.id}
              double={true}
              rating={{ vote: event.user.vote, value: event.user.karma }}
              onVote={handleVote}
            />
          ) : (
            <RatingSwitch
              type='user'
              id={event.user.id}
              double={true}
              rating={{ vote: event.vote, value: event.user.karma }}
              votingDisabled={true}
              votingDisabledTitle={receivedVotingDisabledTitle}
            />
          )}
        </div>
      </>
    )
  }

  const renderEvent = (event: UserVoteFeedEvent) => {
    if (event.type === 'post') {
      return renderPost(event)
    }
    if (event.type === 'comment') {
      return renderComment(event)
    }
    return renderUser(event)
  }

  const queryStringParams: Record<string, string> = filter
    ? { ...persistentQueryStringParams, tab, filter }
    : { ...persistentQueryStringParams, tab }

  return (
    <div className={feedStyles.container}>
      {showTabs && (
        <div className={styles.tabs}>
          <Link className={`${styles.tab} ${tab === 'received' ? styles.tabActive : ''}`} to={tabUrl('received')}>
            Плюсы мне
          </Link>
          <Link className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`} to={tabUrl('mine')}>
            Мои плюсы
          </Link>
        </div>
      )}
      <div className={feedStyles.filter}>
        <input
          ref={filterInputRef}
          onKeyUp={handleFilterChange}
          onChange={handleFilterChange}
          placeholder={'фильтровать'}
          type='search'
          defaultValue={defaultFilter}
        />
      </div>
      <div className={feedStyles.feed}>
        {loading ? (
          <div className={feedStyles.loading}></div>
        ) : (
          <>
            {error && <div className={feedStyles.error}>{error}</div>}
            {!error && groups && groups.length === 0 && <div className={styles.empty}>Оценок пока нет.</div>}
            {!error && groups && groups.length > 0 && (
              <div className={styles.groups}>
                {groups.map((group) => {
                  if (tab === 'received') {
                    return renderReceivedGroup(group)
                  }

                  const header = renderGroupHeader(group)
                  return (
                    <section key={getGroupKey(group)} className={styles.group}>
                      {header && (
                        <div className={styles.groupHeader}>
                          {header}
                          <span className={styles.groupCount}>
                            {pluralize(group.events.length, ['оценка', 'оценки', 'оценок'])}
                          </span>
                        </div>
                      )}
                      <div className={styles.events}>
                        {group.events.map((event) => (
                          <div className={styles.event} key={getEventKey(event)}>
                            {renderEvent(event)}
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
            <div className={feedStyles.paginatorContainer}>
              <Paginator page={page} pages={pages} base={basePath} queryStringParams={queryStringParams} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
