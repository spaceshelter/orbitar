import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useFeed } from '../API/use/useFeed'
import { useAPI } from '../AppState/AppState'
import Paginator from '../Components/Paginator'
import PostComponent from '../Components/PostComponent'
import { PostInfo } from '../Types/PostInfo'
import { LARGE_AUTO_CUT } from './ContentComponent'
import { useProfileFeedFilter } from './useProfileFeedFilter'

import styles from '../Pages/FeedPage.module.scss'
import feedStyles from '../Pages/FeedPage.module.scss'

type UserProfilePostsProps = {
  username: string
}

export default function UserProfilePosts(props: UserProfilePostsProps) {
  const api = useAPI()
  const [searchParams] = useSearchParams()
  const perpage = 20
  const page = parseInt(searchParams.get('page') || '1')
  const { filter, defaultFilter, filterInputRef, handleFilterChange } = useProfileFeedFilter((value) => ({
    filter: value,
  }))

  const { posts, loading, pages, error, updatePost } = useFeed(
    props.username,
    'user-profile',
    page,
    perpage,
    undefined,
    undefined,
    filter || '',
  )
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const params = filter ? { filter } : undefined

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
      updatePost(post.id, updatedPost)

      return updatedPost
    } catch (err) {
      console.log('Could not edit post', err)
      throw err
    }
  }

  return (
    <div className={styles.container}>
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
      <div className={styles.feed}>
        {loading ? (
          <div className={styles.loading}></div>
        ) : (
          <>
            {error && <div className={styles.error}>{styles.error}</div>}
            {posts && (
              <div className={styles.posts}>
                {posts.map((post) => (
                  <PostComponent
                    key={post.id}
                    post={post}
                    showSite={true}
                    onChange={updatePost}
                    onEdit={handlePostEdit}
                    autoCut={LARGE_AUTO_CUT}
                  />
                ))}
              </div>
            )}
            <div className={styles.paginatorContainer}>
              <Paginator page={page} pages={pages} base={`/u/${props.username}/posts`} queryStringParams={params} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
