// source: https://github.com/cudr/react-telegram-embed
// licence: MIT

import React, { Component } from 'react';

const styles = {
    width: '100%',
    frameBorder: '0',
    scrolling: 'no',
    border: 'none',
    overflow: 'hidden'
};

interface TelegramEmbedProps {
    src: string
    container?: string
    theme?: string
}

interface TelegramEmbedState {
    src: string
    id: string
    height: string
}

/**
 * Simple Component for Telegram embedding
 */
export default class TelegramEmbed extends Component<TelegramEmbedProps, TelegramEmbedState> {
    private urlObj: HTMLAnchorElement;
    private iFrame: React.RefObject<HTMLIFrameElement> = React.createRef();

    constructor(props: TelegramEmbedProps) {
        super(props);

        this.state = {
            src: this.props.src,
            id: '',
            height: '80px'
        };
        this.messageHandler = this.messageHandler.bind(this);
        this.urlObj = document.createElement('a');
    }

    componentDidMount() {
        window.addEventListener('message', this.messageHandler);

        this.iFrame.current?.addEventListener('load', () => {

            this.checkFrame(this.state.id);
        });
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.messageHandler);
    }

    messageHandler({ data, source }: any) {
        if (!data || typeof data !== 'string' || source !== this.iFrame.current?.contentWindow) {
            return;
        }

        const action = JSON.parse(data);

        if (action.event === 'resize' && action.height) {
            this.setState({
                height: action.height + 'px',
            });
        }
    }

    checkFrame(id: string) {
        this.iFrame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'visible', frame: id }), '*');
    }

    componentWillReceiveProps({ src }: TelegramEmbedProps) {
        if (this.state.src !== src) {
            this.urlObj.href = src;
            const id = `telegram-post${this.urlObj.pathname.replace(/[^a-z0-9_]/ig, '-')}`;

            this.setState({ src, id }, () =>
                this.checkFrame(id)
            );
        }
    }

    render () {
        const { src, height } = this.state;
        const { container } = this.props;

        return (
            <div data-sharing-id={container}>
                <iframe
                    ref={this.iFrame}
                    src={src + '?embed=1' + (this.props.theme === 'dark' ? '&dark=1' : '')}
                    height={height}
                    id={'telegram-post' + this.urlObj.pathname.replace(/[^a-z0-9_]/ig, '-')}
                    style={styles}
                />
            </div>
        );
    }
}