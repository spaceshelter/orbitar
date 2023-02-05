import {DomHandler, DomHandlerOptions, Parser, ParserOptions} from 'htmlparser2';
import { Document, Element, ChildNode } from 'domhandler';
import { escape as htmlEscape } from 'html-escaper';
import escapeHTML from 'escape-html';
import Url from 'url-parse';
import qs from 'qs';
import {urlRegex, urlRegexExact} from './urlregex';
import {MediaHostingConfig} from '../config';

export type ParseResult = {
    text: string;
    mentions: string[];
    urls: string[];
    images: string[];
    mediaUrls?: string[];
};

class ParserExtended extends Parser {
    override isVoidElement(name: string): boolean {
        if (name === 'video') {
            return true;
        }
        return super.isVoidElement(name);
    }
}

export default class TheParser {
    private readonly allowedTags: Record<string, ((node: Element) => ParseResult) | boolean>;

    // Bump this version when introducing breaking changes to the parser.
    // Content will be re-parsed and saved on access when this version changes.
    static readonly VERSION = 2;

    private readonly mediaHostingConfig: MediaHostingConfig;

    constructor(mediaHosting: MediaHostingConfig) {
        this.mediaHostingConfig = mediaHosting;
        this.allowedTags = {
            a: (node) => this.parseA(node),
            img: (node) => this.parseImg(node),
            irony: (node) => this.parseIrony(node),
            spoiler: (node) => this.parseSpoiler(node),
            video: (node) => this.parseVideo(node),
            blockquote: true,
            b: true,
            i: true,
            u: true,
            strike: true,
        };
    }

    private parseDocument(data: string, options?: ParserOptions & DomHandlerOptions): Document {
        const handler = new DomHandler(undefined, options);
        new ParserExtended(handler, options).end(data);
        return handler.root;
    }

    parse(text: string): ParseResult {
        // strip newlines from the beginning and end
        text = text.replace(/^[\r\n]+|[\r\n]+$/g, '');

        const doc = this.parseDocument(text, {
            decodeEntities: false
        });

        return this.parseChildNodes(doc.childNodes);
    }

    private parseChildNodes(doc: ChildNode[]): ParseResult {
        const p = {text: '', mentions: [], urls: [], images: [], mediaUrls: []};
        let prevBQ = false; // if previous node was blockquote
        for (let node of doc) {
            if (prevBQ && node.type === 'text') {
                // remove a single newline after blockquote, allow only a single one if multiple were present
                node = {
                    ...node,
                    data: node.data.replace(/^(\r?\n|[\r\n])(\r?\n|[\r\n])?(\r?\n|[\r\n])*/, '$2')
                } as ChildNode;
            }

            const res = this.parseNode(node);
            p.text += res.text;
            p.mentions.push(...res.mentions);
            p.urls.push(...res.urls);
            p.images.push(...res.images);
            p.mediaUrls.push(...res.mediaUrls);
            prevBQ = node.type === 'tag' && node.tagName.toLowerCase() === 'blockquote';
        }
        return p;
    }

    private parseNode(node: ChildNode): ParseResult {
        if (node.type === 'text') {
            return this.parseText(node.data);
        }

        if (node.type === 'tag') {
            const allowed = this.allowedTags[node.tagName];
            if (allowed === true) {
                return this.parseAllowedTag(node);
            }
            else if (allowed) {
                return allowed(node);
            }
            else {
                return this.parseDisallowedTag(node);
            }
        }

        if (node.type === 'script') {
            return this.parseDisallowedTag(node);
        }

        if (node.type === 'directive') {
            return escapeHTML(`<${node.data}>`);
        }

        if (node.type === 'comment') {
            return escapeHTML(`<!-- ${node.data} -->`);
        }

        return { text: '', mentions: [], urls: [], images: [], mediaUrls: [] };
    }

    private parseText(text: string): ParseResult {
        const tokens: { type: string; data: string }[] = [];

        let sText = text;
        urlRegex.lastIndex = 0;
        let match = urlRegex.exec(sText);
        while (match) {
            const url = match[0];
            const pText = sText.substring(0, match.index);
            tokens.push({ type: 'text', data: pText });
            sText = sText.substring(match.index + url.length);
            tokens.push({ type: 'url', data: url });
            urlRegex.lastIndex = 0; //match.index + url.length;

            match = urlRegex.exec(sText);
        }
        tokens.push({ type: 'text', data: sText });

        const mentions = [];
        const urls = [];
        const mediaUrls = [];

        let escaped = tokens
            .map((token) => {
                if (token.type === 'text') {
                    // check for mentions
                    const mentionRes = token.data.match(/\B(?:@|\/u\/)([a-zа-яе0-9_-]+)/gi);
                    if (mentionRes) {
                        mentions.push(...mentionRes);
                    }
                    return htmlEscape(token.data);
                } else if (token.type === 'url') {
                    urls.push(token.data);
                    if (token.data.match(/(jpg|gif|png|webp|jpeg|svg|mp4|webm)$/i)) {
                        mediaUrls.push(token.data);
                    }
                    return this.processUrl(token.data);
                }
            })
            .join('');

        escaped = escaped.replace(/\r\n|\r|\n/g, '<br />\n');
        return { text: escaped, mentions, urls, mediaUrls, images: [] };
    }

    processUrl(url: string) {
        const pUrl = new Url(url);

        const res =
            this.processYoutube(pUrl) ||
            this.processImage(pUrl) ||
            this.processVideo(pUrl);
        if (res !== false) {
            return res;
        }

        return `<a href="${encodeURI(decodeURI(url))}" target="_blank">${htmlEscape(decodeURI(url))}</a>`;
    }

    processImage(url: Url<string>) {
        if (url.pathname.match(/\.(jpg|gif|png|webp|jpeg|svg)$/)) {
            return `<img src="${encodeURI(url.toString())}" alt=""/>`;
        }

        return false;
    }

    processVideo(url: Url<string>) {
        if (url.pathname.match(/\.(mp4|webm)$/)) {
            return this.renderVideoTag(url.toString(), false);
        }

        return false;
    }

    processYoutube(url: Url<string>) {
        let videoId = '';
        let startTime = 0;

        const parseTime = (time: string) => {
            const groups = time.match(/^(\d+h)?(\d+m)?(\d+s?)?$/);
            if (!groups) {
                return 0;
            }
            const h = parseInt(groups[1], 10) || 0;
            const m = parseInt(groups[2], 10) || 0;
            const s = parseInt(groups[3], 10) || 0;
            return h * 3600 + m * 60 + s;
        };

        if (
            (url.host === 'youtube.com' || url.host === 'www.youtube.com') &&
            url.query &&
            url.pathname === '/watch'
        ) {
            const q = qs.parse(url.query.substring(1));
            if (typeof q.v === 'string') {
                videoId = q.v;
            }
            if (typeof q.t === 'string') {
                startTime = parseTime(q.t);
            }
        }
        else if (url.host === 'youtu.be') {
            videoId = url.pathname.substring(1);
            if (url.query) {
                const q = qs.parse(url.query.substring(1));
                if (typeof q.t === 'string') {
                    startTime = parseTime(q.t);
                }
            }
        }
        else {
            return false;
        }

        if (!videoId) {
            return false;
        }

        let embed = `https://www.youtube.com/embed/${videoId}`;
        const thumbnail = `https://img.youtube.com/vi/${videoId}/0.jpg`;
        let urlStr = `https://www.youtube.com/watch?v=${videoId}`;
        if (startTime) {
            embed += '?start=' + startTime;
            urlStr += '&t=' + startTime;
        }

        return `<a class="youtube-embed" href="${encodeURI(urlStr)}" target="_blank">`+
            `<img src="${encodeURI(thumbnail)}" alt="" data-youtube="${encodeURI(embed)}"/></a>`;
    }

    parseAllowedTag(node: Element): ParseResult {
        const haveChild = node.children.length > 0;
        let text = `<${node.name}${haveChild ? '' : '/'}>`;
        const res = this.parseChildNodes(node.children);
        text += res.text;
        text += `</${node.name}>`;
        return { ...res, text };
    }

    parseDisallowedTag(node: Element): ParseResult {
        const haveChild = node.children.length > 0;
        let text = `<${node.name}`;
        for (const a in node.attribs) {
            text += ` ${a}="${node.attribs[a]}"`;
        }
        text += haveChild ? '>' : '/>';
        text = htmlEscape(text);
        const result = this.parseChildNodes(node.children);
        text += result.text;
        text += htmlEscape(`</${node.name}>`);
        return { ...result, text };
    }

    parseA(node: Element): ParseResult {
        const url = node.attribs['href'] || '';
        if (!this.validUrl(url)) {
            return this.parseDisallowedTag(node);
        }

        const result = this.parseChildNodes(node.children);
        const text = `<a href="${encodeURI(decodeURI(url))}" target="_blank">${result.text}</a>`;

        return { ...result, text, urls: [ ...result.urls, url ] } ;
    }

    parseImg(node: Element): ParseResult {
        const url = node.attribs['src'] || '';
        if (!this.validUrl(url)) {
            return this.parseDisallowedTag(node);
        }

        return { text: `<img src="${encodeURI(url)}" alt=""/>`, mentions: [], urls: [], mediaUrls: [url], images: [url] };
    }

    parseVideo(node: Element): ParseResult {
        const url = node.attribs['src'] || '';
        if (!this.validUrl(url)) {
            return this.parseDisallowedTag(node);
        }
        const text = this.renderVideoTag(url, node.attribs['loop'] !== undefined);
        return { text, mentions: [], urls: [], mediaUrls: [url], images: [url] };
    }

    renderVideoTag(url: string, loop: boolean) {
        const imgurPoster = () => {
            const match = url.match(/https?:\/\/i.imgur.com\/([^.]+).mp4$/);
            return match && [`https://i.imgur.com/${encodeURI(match[1])}.jpg`, url];
        };
        const idiodPoster = () => {
            const match = url.match(/https?:\/\/idiod.video\/([^.]+\.mp4)$/);
            return match && [`https://idiod.video/preview/${encodeURI(match[1])}`,
                `https://idiod.video/${encodeURI(match[1])}`];
        };
        const orbitarMediaPoster = () => {
            if (url.startsWith(this.mediaHostingConfig.url)) {
                const match = url.match(/.*\/([^.]+\.mp4)$/);
                return match && [`${this.mediaHostingConfig.url}/preview/${encodeURI(match[1])}`,
                    `${this.mediaHostingConfig.url}/${encodeURI(match[1])}/raw`];
            }
        };
        const dumpVideoPoster = () => {
            const match = url.match(/https?:\/\/dump.video\/i\/([^.]+)\.mp4$/);
            return match && [`https://dump.video/i/${encodeURI(match[1])}.jpg`,
                `https://dump.video/i/${encodeURI(match[1])}.mp4`];
        };
        const posterUrl = imgurPoster() || idiodPoster() || dumpVideoPoster() || orbitarMediaPoster();
        if (posterUrl) {
            const [poster, video] = posterUrl;
            return `<a class="video-embed" href="${encodeURI(url)}" target="_blank">` +
                `<img src="${encodeURI(poster)}" alt="" data-video="${encodeURI(video)}"${loop?' data-loop="true"':''}/></a>`;
        }
        return `<video ${loop ? 'loop=""' : ''} preload="metadata" controls="" width="500"><source src="${encodeURI(url)}" type="video/mp4"></video>`;
    }

    parseIrony(node: Element): ParseResult {
        const result = this.parseChildNodes(node.children);
        const text = `<span class="irony">${result.text}</span>`;
        return { ...result, text };
    }

    parseSpoiler(node: Element): ParseResult {
        const result = this.parseChildNodes(node.children);
        const text = `<span class="spoiler">${result.text}</span>`;
        return { ...result, text };
    }

    validUrl(url: string) {
        return encodeURI(decodeURI(url)).match(urlRegexExact);
    }
}
