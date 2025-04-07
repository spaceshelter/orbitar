import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'

import { MarkerType } from '../API/MarkerAPI'
import { useAPI } from '../AppState/AppState'
import { CommentInfo, PostInfo } from '../Types/PostInfo'
import { UserInfo } from '../Types/UserInfo'
import CommentComponent from './CommentComponent'
import { LARGE_AUTO_CUT } from './ContentComponent'
import FeedFilterComponent from './FeedFilterComponent'
import Paginator from './Paginator'
import PostComponent from './PostComponent'
import Username from './Username'

import styles from '../Pages/FeedPage.module.scss'
import markedStyles from './UserProfileMarked.module.scss'

type UserProfileMarkedProps = {
  username: string
}

type ContentType = 'posts' | 'comments' | 'users'

export default function UserProfileMarked(props: UserProfileMarkedProps) {
  const api = useAPI()
  const [searchParams, setSearchParams] = useSearchParams()
  const perpage = 20
  const page = parseInt(searchParams.get('page') || '1')
  const defaultFilter = searchParams.get('filter') as string
  const contentType = (searchParams.get('type') as ContentType) || 'posts'
  const defaultMarkerTypes = (searchParams.get('markers')?.split(',') as MarkerType[]) || []

  const [filter, setFilter] = useState(defaultFilter || '')
  const [markerTypes, setMarkerTypes] = useState<MarkerType[]>(defaultMarkerTypes)
  const [posts, setPosts] = useState<PostInfo[]>([])
  const [comments, setComments] = useState<CommentInfo[]>([])
  const [markedUsers, setMarkedUsers] = useState<UserInfo[]>([])
  const [parentComments, setParentComments] = useState<Record<number, CommentInfo>>({})
  const [loading, setLoading] = useState(true)
  const [pages, setPages] = useState(0)
  const [error, setError] = useState<string>()
  const [reloadIdx, setReloadIdx] = useState(0)

  const { search } = useLocation()
  const filterInputRef = useRef<HTMLInputElement>(null) // Keep this for setting value on search params change

  const reload = () => {
    setReloadIdx(reloadIdx + 1)
  }

  const updateSearchParams = (params: { [key: string]: string | undefined }) => {
    const newParams = new URLSearchParams(searchParams)

    // Update or remove parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        newParams.set(key, value)
      } else {
        newParams.delete(key)
      }
    })

    setSearchParams(newParams)
  }

  const handleContentTypeChange = (type: ContentType) => {
    updateSearchParams({ type: type })
  }

  const toggleMarkerType = (type: MarkerType) => {
    let newMarkerTypes: MarkerType[]

    if (markerTypes.includes(type)) {
      newMarkerTypes = markerTypes.filter((t) => t !== type)
    } else {
      newMarkerTypes = [...markerTypes, type]
    }

    setMarkerTypes(newMarkerTypes)
    updateSearchParams({
      markers: newMarkerTypes.length > 0 ? newMarkerTypes.join(',') : undefined,
    })
  }

  const getParentComment = (commentId: number): CommentInfo | undefined => {
    if (parentComments && parentComments[commentId]) {
      return parentComments[commentId]
    }
    return undefined
  }

  // Handle search params changes
  useEffect(() => {
    const newSearchParams = new URLSearchParams(search)

    const newFilterValue = newSearchParams.get('filter') as string
    setFilter(newFilterValue || '')

    // const newContentType = (newSearchParams.get('type') as ContentType) || 'all'

    const newMarkerTypes = (newSearchParams.get('markers')?.split(',') as MarkerType[]) || []
    setMarkerTypes(newMarkerTypes)

    if (filterInputRef.current) {
      filterInputRef.current.value = newFilterValue || ''
    }
  }, [search])

  // Load data
  useEffect(() => {
    setLoading(true)

    api.userAPI
      .userMarkedContent(props.username, contentType, markerTypes, filter, page, perpage)
      .then((result) => {
        setPosts(result.posts)
        setComments(result.comments)
        setMarkedUsers(result.markedUsers)
        setParentComments(result.parentComments)
        setError(undefined)

        const pages = Math.floor((result.total - 1) / perpage) + 1
        setPages(pages)
      })
      .catch((error) => {
        console.error('USER PROFILE MARKED CONTENT ERROR', error)
        setError('Не удалось загрузить ленту избранного пользователя')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [page, reloadIdx, filter, contentType, markerTypes, api.userAPI, perpage, props.username])

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  // Generate query params for pagination
  const queryStringParams: Record<string, string> = {}
  if (filter) queryStringParams.filter = filter
  queryStringParams.type = contentType // Always include content type
  if (markerTypes.length > 0) queryStringParams.markers = markerTypes.join(',')

  const handlePostEdit = async (post: PostInfo, text: string, title?: string): Promise<PostInfo | undefined> => {
    try {
      const res = await api.postAPI.editPost(post.id, title || '', text)
      if (!res) return undefined

      const updatedPost: PostInfo = {
        ...post,
        content: res.post.content,
        title: res.post.title,
      }

      // Update the post in local state
      setPosts((prevPosts) => prevPosts.map((p) => (p.id === post.id ? updatedPost : p)))

      return updatedPost
    } catch (err) {
      console.log('Could not edit post', err)
      throw err
    }
  }

  const handleCommentEdit = async (partial: Partial<CommentInfo> & { id: number }) => {
    try {
      // Find the comment we need to update
      const commentToUpdate = comments?.find((c) => c.id === partial.id)
      if (!commentToUpdate) return undefined

      // Create an updated comment that preserves all CommentInfo properties
      const updatedComment = {
        ...commentToUpdate,
        ...partial,
      }

      // Update the comment in the local state
      setComments(comments?.map((c) => (c.id === partial.id ? updatedComment : c)))

      return updatedComment
    } catch (err) {
      console.log('Could not update comment', err)
      throw err
    }
  }

  return (
    <div className={styles.container}>
      <div className={markedStyles.contentTypeFilter}>
        <button
          className={contentType === 'posts' ? markedStyles.active : ''}
          onClick={() => handleContentTypeChange('posts')}
        >
          Посты
        </button>
        <button
          className={contentType === 'comments' ? markedStyles.active : ''}
          onClick={() => handleContentTypeChange('comments')}
        >
          Комментарии
        </button>
        <button
          className={contentType === 'users' ? markedStyles.active : ''}
          onClick={() => handleContentTypeChange('users')}
        >
          Пользователи
        </button>
      </div>

      <FeedFilterComponent
        filter={filter}
        markerTypes={markerTypes}
        onFilterChange={(value) => {
          setFilter(value)
          updateSearchParams({ filter: value })
        }}
        onMarkerToggle={toggleMarkerType}
        defaultFilter={defaultFilter || ''}
      />

      <div className={styles.feed}>
        {loading ? (
          <div className={styles.loading}></div>
        ) : (
          <>
            {error && (
              <div className={styles.error}>
                {error}
                <div>
                  <button onClick={reload}>Повторить</button>
                </div>
              </div>
            )}

            {!error && (
              <div className={styles.posts}>
                {contentType === 'posts' &&
                  posts.map((post) => (
                    <PostComponent
                      key={post.id}
                      post={post}
                      showSite={true}
                      onChange={(updatedPostId, updatedPost) =>
                        setPosts((prevPosts) =>
                          prevPosts.map((p) => (p.id === updatedPostId ? Object.assign(p, updatedPost) : p)),
                        )
                      }
                      onEdit={handlePostEdit}
                      autoCut={LARGE_AUTO_CUT}
                    />
                  ))}

                {contentType === 'comments' &&
                  comments.map((comment) => (
                    <CommentComponent
                      idx={getParentComment(comment.parentComment) ? 1 : 0}
                      parent={getParentComment(comment.parentComment)}
                      key={comment.id}
                      comment={comment}
                      showSite={comment.site !== 'main'}
                      onEdit={handleCommentEdit}
                    />
                  ))}

                {contentType === 'users' && (
                  <div className={markedStyles.userList}>
                    {markedUsers.length > 0 && (
                      <>
                        <h3>Отмеченные пользователи</h3>
                        <div className={markedStyles.users}>
                          {markedUsers.map((user) => (
                            <div key={user.id} className={markedStyles.userItem}>
                              <Username user={user} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!loading && posts.length === 0 && comments.length === 0 && markedUsers.length === 0 && (
                  <div className={styles.noContent}>Нет контента с выбранными фильтрами</div>
                )}
              </div>
            )}

            <div className={styles.paginatorContainer}>
              <Paginator
                page={page}
                pages={pages}
                base={`/u/${props.username}/marked`}
                queryStringParams={queryStringParams}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
