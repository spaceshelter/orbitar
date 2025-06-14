import React from 'react'

import { useTheme } from '@theme/ThemeProvider'
import { Tweet } from 'react-tweet'

import 'react-tweet/theme.css'

interface TwitterEmbedProps {
  url: string
}

export default function TwitterEmbed({ url }: TwitterEmbedProps) {
  const { theme } = useTheme()
  const match = url.match(/status\/(\d+)/)
  if (!match) return null
  const id = match[1]

  return (
    <div data-theme={theme} className='tweet-embed'>
      <Tweet id={id} />
    </div>
  )
}
