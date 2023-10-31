import {useAPI} from '../../AppState/AppState';
import React, {useEffect, useRef, useState} from 'react';
import {TranslateModes} from '../PostAPI';
import googleTranslate from '../../Utils/googleTranslate';
import {toast} from 'react-toastify';
import {scrollUnderTopbar} from '../../Utils/utils';
import xssFilter from '../../Utils/xssFilter';

export type AltContentType = 'translate' | TranslateModes;

// show annotate only if message is longer than
export const ANNOTATE_LIMIT = 1024;

export function useInterpreter(originalContent: string, originalTitle: string | undefined, id: number, type: 'post' | 'comment') {
    const api = useAPI();
    const contentRef = useRef<HTMLDivElement>(null);
    const [currentMode, setCurrentMode] = React.useState<AltContentType | undefined >();
    const [cachedTitleTranslation, setCachedTitleTranslation] = useState<string | undefined>();
    const [cachedContentTranslation, setCachedContentTranslation] = useState< string | undefined>();
    const [streamingAnnotation, setStreamingAnnotation] = useState<string | undefined>();
    const [cachedAnnotation, setCachedAnnotation] = useState<string | undefined>();
    const [streamingAltTranslation, setStreamingAltTranslation] = useState<string | undefined>();
    const [cachedAltTranslation, setCachedAltTranslation] = useState<string | undefined>();
    const [inProgress, setInProgress] = useState<boolean>(false);

    const altTitle = currentMode === 'translate' && cachedTitleTranslation ? xssFilter(cachedTitleTranslation) : undefined;

    const altContent = (currentMode === 'translate' && cachedContentTranslation) ||
        (currentMode === 'altTranslate' && (cachedAltTranslation || streamingAltTranslation)) ||
        (currentMode === 'annotate' && (cachedAnnotation || streamingAnnotation)) ||
        undefined;


    const translate = () => {
        getAlternative('translate', currentMode, setCurrentMode, cachedContentTranslation, undefined, async () => {
            if(originalTitle){
                const title = await googleTranslate(originalTitle);
                setCachedTitleTranslation(title);
            }

            const html = await googleTranslate(originalContent);
            setCachedContentTranslation(html);
        });
    };

    const retrieveStreamResponse =  (mode: TranslateModes, setStreamingValue: (str: string | undefined) => void, setCachedValue: (str: string) => void): () => Promise<void> => {
        return async () => {
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
                    if(value.indexOf('{"result":"error","code":"error"') === 0) {
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
        streamingContent: string | undefined,
        retrieveContent: () => Promise<void>
    ): Promise<void> => {
        if (currentMode === newMode) {
            setCurrentMode(undefined);
        } else if(cachedContent || streamingContent){
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
        if(contentRef.current) {
            const rect = contentRef.current.getBoundingClientRect();
            const topbarHeight = document.getElementById('topbar')?.clientHeight;

            if(rect.top < (topbarHeight || 0)){
                scrollUnderTopbar(contentRef.current);
            }
        }

    }, [currentMode]);

    return {contentRef, currentMode, inProgress, altTitle, altContent, translate, annotate, altTranslate};
}
