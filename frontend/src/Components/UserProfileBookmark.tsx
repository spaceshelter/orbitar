import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useFeed } from '../API/use/useFeed'
import { useAPI } from '../AppState/AppState'
import { PostInfo } from '../Types/PostInfo'
import { LARGE_AUTO_CUT } from './ContentComponent'
import Paginator from './Paginator'
import PostComponent from './PostComponent'

import styles from '../Pages/FeedPage.module.scss'

export default function UserProfileBookmark() {
  const api = useAPI()
  const [searchParams] = useSearchParams()
  const perpage = 20
  const page = parseInt(searchParams.get('page') || '1')

  const { posts, loading, pages, error, updatePost } = useFeed('', 'bookmarked', page, perpage)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [page])

  const handlePostEdit = async (post: PostInfo, text: string, title?: string): Promise<PostInfo | undefined> => {
    try {
      const res = await api.postAPI.editPost(post.id, title || '', text)
      if (!res) return undefined

      const updatedPost: PostInfo = {
        ...post,
        content: res.post.content,
        title: res.post.title,
      }
      updatePost(post.id, updatedPost)
      return updatedPost
    } catch (err) {
      console.log('Could not edit post', err)
      throw err
    }
  }

  return (
    <div className={styles.container}>
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
              <Paginator page={page} pages={pages} base='/profile/bookmark' />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
