import {useAPI} from '../../AppState/AppState';
import React, {useState} from 'react';
import {TranslateModes} from '../PostAPI';
import googleTranslate from '../../Utils/googleTranslate';
import {toast} from 'react-toastify';

export type AltContentType = 'translate' | TranslateModes;

export function useInterpreter(originalContent: string, originalTitle: string | undefined, id: number, type: 'post' | 'comment') {
    const api = useAPI();
    const [currentMode, setCurrentMode] = React.useState<AltContentType | undefined >();
    const [cachedTitleTranslation, setCachedTitleTranslation] = useState<string | undefined>();
    const [cachedContentTranslation, setCachedContentTranslation] = useState< string | undefined>();
    const [streamingAnnotation, setStreamingAnnotation] = useState<string | undefined>();
    const [cachedAnnotation, setCachedAnnotation] = useState<string | undefined>();
    const [streamingAltTranslation, setStreamingAltTranslation] = useState<string | undefined>();
    const [cachedAltTranslation, setCachedAltTranslation] = useState<string | undefined>();

    const altTitle = currentMode === 'translate' ? cachedTitleTranslation : undefined;

    const altContent = (currentMode === 'translate' && cachedContentTranslation) ||
        (currentMode === 'altTranslate' && (cachedAltTranslation || streamingAltTranslation)) ||
        (currentMode === 'annotate' && (cachedAnnotation || streamingAnnotation)) ||
        undefined;


    const translate = () => {
        getAlternative('translate', currentMode, setCurrentMode, cachedContentTranslation, async () => {
            if(originalTitle){
                const title = await googleTranslate(originalTitle);
                setCachedTitleTranslation(title);
            }

            const html = await googleTranslate(originalContent);
            setCachedContentTranslation(html);
        });
    };

    const retrieveStreamResponse =  (mode: TranslateModes, setStreamingValue: (str: string) => void, setCachedValue: (str: string) => void): () => Promise<void> => {
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
                console.log(value, done, currentMode, mode, currentMode === mode);
                if (done) {
                    finalValue = chunks.join('');
                    setCachedValue(finalValue);
                }

                if(value && value !== ''){
                    setStreamingValue(chunks.join(''));
                    chunks.push(value);
                }
            }
        };
    };

    const altTranslate = () => {
        getAlternative('altTranslate', currentMode, setCurrentMode, cachedAltTranslation, retrieveStreamResponse('altTranslate', setStreamingAltTranslation, setCachedAltTranslation));
    };

    const annotate = () => {
        getAlternative('annotate', currentMode, setCurrentMode, cachedAnnotation, retrieveStreamResponse('annotate', setStreamingAnnotation, setCachedAnnotation));
    };

    const getAlternative = async (
        newMode: AltContentType,
        currentMode: AltContentType | undefined,
        setCurrentMode: (mode: AltContentType | undefined) => void,
        cachedContent: string | undefined,
        retrieveContent: () => Promise<void>
    ): Promise<void> => {
        if (currentMode === newMode) {
            setCurrentMode(undefined);
        } else if(cachedContent){
            setCurrentMode(newMode);
        } else {
            try {
                setCurrentMode(newMode);
                await retrieveContent();
            } catch (err) {
                console.error(err);
                setCurrentMode(undefined);
                toast.error('Роботы не справились - восстание машин откладывается.');
            }
        }
    };

    return {currentMode, setCurrentMode, altTitle, altContent, translate, annotate, altTranslate};
}