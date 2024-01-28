import {useAPI} from '../../AppState/AppState';
import React, {useEffect, useRef, useState} from 'react';
import {TranslateModes} from '../PostAPI';
import googleTranslate from '../../Utils/googleTranslate';
import {toast} from 'react-toastify';
import {scrollUnderTopbar} from '../../Utils/utils';
import xssFilter from '../../Utils/xssFilter';
import {useLazy} from './useLazy';
import xss from 'xss';

export type AltContentType = 'translate' | TranslateModes;

// show annotate only if message is longer than
export const ANNOTATE_LIMIT = 1024;
export const ALT_TRANSLATE_LIMIT = 2048;

export function useInterpreter(originalContent: string, originalTitle: string | undefined, id: number, type: 'post' | 'comment') {
    const api = useAPI();
    const contentRef = useRef<HTMLDivElement>(null);
    const [currentMode, setCurrentMode] = React.useState<AltContentType | undefined>();
    const [cachedTitleTranslation, setCachedTitleTranslation] = useState<string | undefined>();
    const [cachedContentTranslation, setCachedContentTranslation] = useState<string | undefined>();
    const [streamingAnnotation, setStreamingAnnotation] = useState<string | undefined | null>(); // null is a special value indication that content is being fetched
    const [cachedAnnotation, setCachedAnnotation] = useState<string | undefined>();
    const [streamingAltTranslation, setStreamingAltTranslation] = useState<string | undefined | null>();  // null is a special value indication that content is being fetched
    const [cachedAltTranslation, setCachedAltTranslation] = useState<string | undefined>();
    const [inProgress, setInProgress] = useState<boolean>(false);

    const calcStrippedOriginalContentLength = useLazy(() =>
        xss(originalContent, {
            whiteList: {},
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style', 'xml', 'a']
        }).trim().length, [originalContent]);

    const calcShowAltTranslate = () =>
        // content.length is used intentionally, we don't want to use it on the long content
        originalContent.length < ALT_TRANSLATE_LIMIT && calcStrippedOriginalContentLength() >= 6;
    const calcShowAnnotate = () => calcStrippedOriginalContentLength() >= ANNOTATE_LIMIT;

    const altTitle = currentMode === 'translate' && cachedTitleTranslation ? xssFilter(cachedTitleTranslation) : undefined;

    const altContent = (currentMode === 'translate' && cachedContentTranslation) ||
        (currentMode === 'altTranslate' && mergeContent(cachedAltTranslation, streamingAltTranslation, originalContent)) ||
        (currentMode === 'annotate' && mergeContent(cachedAnnotation, streamingAnnotation, originalContent)) ||
        undefined;

    const translate = () => {
        getAlternative('translate', currentMode, setCurrentMode, cachedContentTranslation, undefined, async () => {
            setInProgress(true);

            if(originalTitle){
                const title = await googleTranslate(originalTitle);
                setCachedTitleTranslation(title);
            }

            const html = await googleTranslate(originalContent);
            setCachedContentTranslation(html);
            setInProgress(false);
        });
    };

    const retrieveStreamResponse =  (mode: TranslateModes, setStreamingValue: (str: string | undefined | null) => void, setCachedValue: (str: string) => void): () => Promise<void> => {
        return async () => {
            // set special value to indicate that content is being fetched
            setStreamingValue(null);
            const rs = await api.postAPI.translate(id, type, mode);
            const reader = rs.pipeThrough((new TextDecoderStream()) as unknown as ReadableWritablePair<string, string>).getReader();
            if(!reader){
                throw new Error('Invalid response');
            }

            const chunks: string[] = [];
            let done, value, finalValue = '';
            while (!done) {
                ({ value, done } = await reader.read());

                if (done) {
                    finalValue = chunks.join('');
                    setStreamingValue(undefined);
                    setCachedValue(finalValue);
                }

                if(value && value !== ''){
                    // FIXME: This is a dirty hack, succeptible to injection attack
                    if(value.indexOf('{"result":"error","code":"error"') !== -1) {
                        throw new Error('Error fetching interpretation');
                    }
                    setStreamingValue(xssFilter(chunks.join('')));
                    chunks.push(value);
                }
            }
        };
    };

    const altTranslate = () => {
        getAlternative('altTranslate', currentMode, setCurrentMode, cachedAltTranslation, streamingAltTranslation, retrieveStreamResponse('altTranslate', setStreamingAltTranslation, setCachedAltTranslation));
    };

    const annotate = () => {
        getAlternative('annotate', currentMode, setCurrentMode, cachedAnnotation, streamingAnnotation, retrieveStreamResponse('annotate', setStreamingAnnotation, setCachedAnnotation));
    };

    const getAlternative = async (
        newMode: AltContentType,
        currentMode: AltContentType | undefined,
        setCurrentMode: (mode: AltContentType | undefined) => void,
        cachedContent: string | undefined,
        streamingContent: string | undefined | null,
        retrieveContent: () => Promise<void>
    ): Promise<void> => {
        if (currentMode === newMode) {
            setCurrentMode(undefined);
        } else if(cachedContent || streamingContent || streamingContent === null){
            setCurrentMode(newMode);
        } else {
            try {
                setCurrentMode(newMode);
                setInProgress(true);
                await retrieveContent();
            } catch (err) {
                console.error(err);
                setCurrentMode(undefined);
                toast.error('Роботы не справились - восстание машин откладывается.');
            } finally {
                setInProgress(false);
            }
        }
    };

    // bring top of the content into view when updating content
    useEffect(() => {
        if (!currentMode) {
            return;
        }
        if(contentRef.current) {
            const rect = contentRef.current.getBoundingClientRect();
            const topbarHeight = document.getElementById('topbar')?.clientHeight;

            if (currentMode === 'altTranslate' || currentMode === 'annotate') {
                // scroll to bottom
                if (rect.bottom > window.innerHeight) {
                    scrollUnderTopbar(contentRef.current, /*toBottom*/ true);
                }
            } else {
                if (rect.top < (topbarHeight || 0)) {
                    scrollUnderTopbar(contentRef.current);
                }
            }
        }

    }, [currentMode]);

    return {contentRef, currentMode, inProgress, altTitle, altContent, translate, annotate, altTranslate,
        calcShowAltTranslate, calcShowAnnotate
    };
}

function mergeContent(cachedAnnotation: string | undefined,
                      streamingAnnotation: string | undefined | null,
                      originalContent: string
                      ): string | undefined {
    const annotation = cachedAnnotation || streamingAnnotation;
    if (annotation) {
        return `${originalContent}<br/><br/>${annotation}`;
    }
    return undefined;
}