import React from 'react'

import { Poll } from './Poll'

interface PollRendererProps {
  content: string
  onVote?: (pollId: string, optionId: number) => void
}

export const PollRenderer: React.FC<PollRendererProps> = ({ content, onVote }) => {
  console.log('content', content)
  const renderContent = () => {
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    const pollRegex = /<poll id="([^"]+)"><\/poll>/g

    let match

    while ((match = pollRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index))
      }

      const pollId = match[1]
      parts.push(<Poll key={`poll-${pollId}`} pollId={pollId} onVote={onVote} />)

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex))
    }

    return parts
  }

  return <>{renderContent()}</>
}
