import xss from 'xss';

export default function xssFilter(html: string): string {
    return xss(html, {
        whiteList: {
            a: ['href', 'target', 'class'],
            img: ['src', 'alt', 'data-video'],
            span: ['class'],
            details: ['class'],
            video: ['preload', 'controls', 'width'],
            source: ['src', 'type'],
            blockquote: [],
            b: [],
            i: [],
            u: [],
            strike: [],
            br: []
        }
    });
}
