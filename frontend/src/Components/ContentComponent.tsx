import React, {useEffect, useMemo, useRef, useState} from 'react';
import classNames from 'classnames';
import styles from './ContentComponent.module.scss';
import htmlParser, {Element } from 'html-react-parser';
import TelegramEmbed from './TelegramEmbed';
import {useTheme} from '../Theme/ThemeProvider';

interface ContentComponentProps extends React.ComponentPropsWithRef<'div'> {
    content: string;
    autoCut?: boolean;
}

function ScalableImage(props: { src: string }) {
    const ref = useRef<HTMLImageElement>(null);
    const [scaled, setScaled] = useState(false);
    const [scalable, setScalable] = useState<boolean | undefined>(undefined);

    const onLoad = () => {
        if (scalable === undefined) {
            setScalable(ref.current!.naturalWidth > 500 || ref.current!.naturalHeight > 500);
        }
    };
    const onClick = () => {
        if (scalable) {
            setScaled(!scaled);
        }
    };
    return <img src={props.src} className={classNames({ 'image-scalable' : scalable,  'image-preview' : scaled } )}
                onLoad={onLoad} ref={ref} onClick={onClick} />;
}

function parseContent(content: string, theme: string | undefined) {
    return htmlParser(content, {
        replace: domNode => {
            if (domNode instanceof Element && domNode.tagName.toUpperCase() === 'IMG') {
                let el: Element | null = domNode;
                while (el) {
                    if (el.tagName.toUpperCase() === 'A') {
                        return;
                    }
                    el = (el.parent instanceof Element) ? el.parent : null;
                }
                return <ScalableImage src={domNode.attribs['src']} />;
            }
            if (domNode instanceof Element && domNode.tagName.toUpperCase() === 'TELEGRAMEMBED') {
                return <TelegramEmbed src={domNode.attribs.src} theme={theme} />;
            }
        }
    });
}

export default function ContentComponent(props: ContentComponentProps) {
    const contentDiv = useRef<HTMLDivElement>(null);
    const [cut, setCut] = useState(false);

    useEffect(() => {
        const content = contentDiv.current;
        if (!content) {
            return;
        }

        if (props.autoCut) {
            const rect = content.getBoundingClientRect();
            if (rect.height > 1000) {
                setCut(true);
            }
        }
    }, [contentDiv, props.autoCut]);

    const handleCut = () => {
        setCut(false);
    };

    const {theme} = useTheme();
    const content = useMemo(() => parseContent(props.content, theme), [props.content, theme]);

    return (
        <>
            <div className={classNames(styles.content, props.className, cut && styles.cut)} ref={contentDiv}>
                {content}
            </div>
            {cut && <div className={styles.cutCover}><button className={styles.cutButton} onClick={handleCut}>Читать дальше</button></div>}
        </>
    );
}
