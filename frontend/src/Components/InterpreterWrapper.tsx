import React from 'react';
import {stripHtml} from 'string-strip-html';

/*
* Child is a function that provides two arguments:
* - boolean whether to show altTranslate button
* - boolean whether to show annotate button
*
* Take content as a prop, strips it of html tags and uses the resulting length to determine
* whether to show annotate buttons
* */

// show annotate only if message is longer than
export const ANNOTATE_LIMIT = 1024;

interface InterpreterWrapperProps {
    children: (showAltTranslate: boolean, showAnnotate: boolean) => React.ReactNode
    content: string
}

export default function InterpreterWrapper ({children, content}: InterpreterWrapperProps) {
    const strippedContent = stripHtml(content,
        {stripTogetherWithTheirContents: [
                'script', // default
                'style', // default
                'xml', // default
                'a', // <-- custom-added
            ],
        }).result;
    const showAltTranslate =
        // content.length is used intentionally, we don't want to use it on the long content
        content.length < ANNOTATE_LIMIT && strippedContent.trim().length >= 6;
    const showAnnotate = strippedContent.length >= ANNOTATE_LIMIT;

    return <>{children(showAltTranslate, showAnnotate)}</>;
}