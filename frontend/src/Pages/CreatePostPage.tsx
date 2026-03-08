import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { toast } from 'react-toastify'

import { useAPI, useAppState } from '../AppState/AppState'
import CreateCommentComponent from '../Components/CreateCommentComponent'
import SlowMode from '../Components/SlowMode'
import { CommentInfo, PostLinkInfo } from '../Types/PostInfo'
import { EncryptedPayloadDraft } from '../Utils/mailCrypto'

import createCommentStyles from '../Components/CommentComponent.module.scss'
import styles from './CreatePostPage.module.css'

export const CreatePostPage = observer(() => {
  const api = useAPI()
  const { site, userRestrictions } = useAppState()
  const [title, setTitle] = useState('')
  const navigate = useNavigate()

  const handleAnswer = async (
    text: string,
    _post?: PostLinkInfo,
    _comment?: CommentInfo,
    encryptedPayload?: EncryptedPayloadDraft,
  ): Promise<CommentInfo | undefined> => {
    console.log('post', title, text)

    try {
      const result = await api.postAPI.create(site, title, text, encryptedPayload)
      console.log('CREATE', result)
      navigate((site !== 'main' ? `/s/${site}` : '') + `/p${result.post.id}`)
    } catch (error) {
      console.log('CREATE ERR', error)
      toast.error('Пост хороший, но создать его не удалось 🤐')
      throw error
    }

    return
  }

  useEffect(() => {
    api.user.refreshUserRestrictions()
  }, [api])

  const restrictedPostId =
    typeof userRestrictions?.restrictedToPostId === 'number' ? userRestrictions.restrictedToPostId : undefined

  if (restrictedPostId !== undefined) {
    return <RestrictedToPostIdMessage postId={restrictedPostId} />
  }

  if (userRestrictions?.postSlowModeWaitSecRemain) {
    return (
      <RestrictedSlowMode
        endTime={new Date(Date.now() + userRestrictions.postSlowModeWaitSecRemain * 1000)}
        endCallback={() => {
          api.user.refreshUserRestrictions()
        }}
      />
    )
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
  }

  return (
    <div className={styles.container}>
      <div className={classNames(styles.createpost, createCommentStyles.content)}>
        <div className={styles.form}>
          {userRestrictions?.restrictedToPostId === true && <LastPostMessage />}
          <input
            className={styles.title}
            type='text'
            placeholder='Без названия'
            maxLength={64}
            value={title}
            onChange={handleTitleChange}
            autoFocus
            tabIndex={1}
          />
          <CreateCommentComponent open={true} onAnswer={handleAnswer} storageKey={`np:${site}`} textareaTabIndex={2} />
        </div>
      </div>
    </div>
  )
})

const RestrictedToPostIdMessage = (props: { postId: number }) => {
  return (
    <div className={styles.restrictedToPostIdMessage}>
      Возможность создавать посты заблокирована из-за низкой кармы. Можно только комментировать{' '}
      <a href={`/p${props.postId}`}>этот пост</a>.
    </div>
  )
}

const LastPostMessage = () => {
  return (
    <div className={styles.lastPostMessage}>
      Внимание! Из-за низкой кармы возможность создавать посты ограничена. Этот пост, на данный момент, будет последним,
      который можно создать.
    </div>
  )
}

const RestrictedSlowMode = (props: { endTime: Date; endCallback: () => void }) => {
  return (
    <SlowMode endTime={props.endTime} endCallback={props.endCallback}>
      <div className={styles.restrictedSlowMode}>
        Возможность создавать посты ограничена из-за низкой кармы. До конца ожидания осталось:
      </div>
    </SlowMode>
  )
}
