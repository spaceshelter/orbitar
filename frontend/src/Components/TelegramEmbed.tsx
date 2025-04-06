// source: https://github.com/cudr/react-telegram-embed
// licence: MIT

import React, { Component } from 'react'

const styles = {
  frameBorder: '0',
  scrolling: 'no',
  border: 'none',
  overflow: 'hidden',
  colorScheme: 'light dark',
}

interface TelegramEmbedProps {
  src: string
  container?: string
  theme?: string
}

interface TelegramEmbedState {
  src: string
  id: string
  height: string
  loading: boolean
}

/**
 * Simple Component for Telegram embedding
 */
export default class TelegramEmbed extends Component<TelegramEmbedProps, TelegramEmbedState> {
  private urlObj: HTMLAnchorElement
  private iFrame: React.RefObject<HTMLIFrameElement> = React.createRef()

  constructor(props: TelegramEmbedProps) {
    super(props)

    this.state = {
      src: this.props.src,
      id: '',
      height: '80px',
      loading: true,
    }
    this.messageHandler = this.messageHandler.bind(this)
    this.urlObj = document.createElement('a')
  }

  componentDidMount() {
    window.addEventListener('message', this.messageHandler)

    this.iFrame.current?.addEventListener('load', () => {
      // Set loading to false when iframe loads
      this.setState({ loading: false })
      this.checkFrame(this.state.id)
    })
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.messageHandler)
  }

  messageHandler({ data, source }: any) {
    if (!data || typeof data !== 'string' || source !== this.iFrame.current?.contentWindow) {
      return
    }

    const action = JSON.parse(data)

    if (action.event === 'resize' && action.height) {
      this.setState({
        height: action.height + 'px',
        loading: false,
      })
    }
  }

  checkFrame(id: string) {
    this.iFrame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'visible', frame: id }), '*')
  }

  componentWillReceiveProps({ src }: TelegramEmbedProps) {
    if (this.state.src !== src) {
      this.urlObj.href = src
      const id = `telegram-post${this.urlObj.pathname.replace(/[^a-z0-9_]/gi, '-')}`

      this.setState({ src, id }, () => this.checkFrame(id))
    }
  }

  render() {
    const { src, height, loading } = this.state
    const { container } = this.props

    return (
      <div data-sharing-id={container}>
        {loading && <div>Загружаем...</div>}
        <iframe
          className='telegram-embed'
          ref={this.iFrame}
          src={src + '?embed=1' + (this.props.theme === 'dark' ? '&dark=1' : '')}
          height={height}
          id={'telegram-post' + this.urlObj.pathname.replace(/[^a-z0-9_]/gi, '-')}
          style={{ ...styles, display: loading ? 'none' : 'block' }}
        />
      </div>
    )
  }
}
