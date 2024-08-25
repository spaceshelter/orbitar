import {DomHandler, DomHandlerOptions, Parser, ParserOptions} from 'htmlparser2';
import {ChildNode, Document, Element} from 'domhandler';
import {escape as htmlEscape} from 'html-escaper';
import escapeHTML from 'escape-html';
import Url from 'url-parse';
import qs from 'qs';
import {escapeRegExp, mentionsRegex, urlRegex, urlRegexExact} from './regexprs';
import {MediaHostingConfig} from '../config';
import render from 'dom-serializer';
import {joiSite} from '../api/ApiMiddleware';

export type ParseResult = {
    text: string;
    mentions: string[];
    urls: string[];
    images: string[];
};

export type ParserConfig = {
    mediaHosting: MediaHostingConfig;
    siteDomain: string;
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
    private readonly parserConfig: ParserConfig;
    private readonly mediaHostingUrlOrigin: string;

    constructor(parserConfig: ParserConfig) {
        this.parserConfig = parserConfig;
        this.mediaHostingConfig = parserConfig.mediaHosting;
        // add origin. subdomain to the url
        this.mediaHostingUrlOrigin =
            this.mediaHostingConfig.url.replace(/^https?:\/\//, 'https://origin.');

        this.allowedTags = {
            a: (node) => this.parseA(node),
            img: (node) => this.parseImg(node),
            irony: (node) => this.parseIrony(node),
            spoiler: (node) => this.parseSpoiler(node),
            expand: (node) => this.parseExpand(node),
            video: (node) => this.parseVideo(node),
            mailbox: (node) => this.parseSecretMailbox(node),
            mail: (node) => this.parseSecretMail(node),
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
        // strip non-printable characters from the beginning and the end (including newlines and spaces)
        // see https://stackoverflow.com/questions/1176904/how-to-remove-all-non-printable-characters-in-a-string
        // eslint-disable-next-line no-control-regex
        text = text.replace(/^[\x00-\x20\x7F-\xA0\xAD]+|[\x00-\x20\x7F-\xA0\xAD]+$/ug, '');

        const doc = this.parseDocument(text, {
            decodeEntities: false
        });

        const parseResult = this.parseChildNodes(doc.childNodes);
        parseResult.mentions = [...new Set(parseResult.mentions)];
        return parseResult;
    }

    private parseChildNodes(doc: ChildNode[]): ParseResult {
        const p = {text: '', mentions: [], urls: [], images: []};
        let prevIsBlock = false; // if previous node was block tag
        const blockTags = ['blockquote', 'expand'];
        for (let node of doc) {
            if (prevIsBlock && node.type === 'text') {
                // remove a single newline after block tags, allow only a single one if multiple were present
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
            prevIsBlock = node.type === 'tag' && blockTags.includes(node.tagName.toLowerCase());
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
            return {text: escapeHTML(`<${node.data}>`), mentions: [], urls: [], images: []};
        }

        if (node.type === 'comment') {
            return {text: escapeHTML(`<!--${node.data}-->`), mentions: [], urls: [], images: []};
        }

        return { text: '', mentions: [], urls: [], images: [] };
    }

    private extractMentions(text: string): { type: 'text' | 'mention', data: string }[] {
        const tokens: { type: 'text' | 'mention', data: string }[] = [];

        let sText = text;
        mentionsRegex.lastIndex = 0;
        let match = mentionsRegex.exec(sText);
        while (match) {
            const mention = match[0];
            const pText = sText.substring(0, match.index);
            if (pText) {
                tokens.push({type: 'text', data: pText});
            }
            sText = sText.substring(match.index + mention.length);
            tokens.push({ type: 'mention', data: match[1] });
            mentionsRegex.lastIndex = 0;
            match = mentionsRegex.exec(sText);
        }
        if (sText) {
            tokens.push({ type: 'text', data: sText });
        }
        return tokens;
    }

    private parseText(text: string): ParseResult {
        const tokens: { type: 'text' | 'url' | 'mention'; data: string }[] = [];

        let sText = text;
        urlRegex.lastIndex = 0;
        let match = urlRegex.exec(sText);
        while (match) {
            const url = match[0];
            tokens.push(...this.extractMentions(sText.substring(0, match.index)));
            sText = sText.substring(match.index + url.length);
            tokens.push({ type: 'url', data: url });
            urlRegex.lastIndex = 0; //match.index + url.length;

            match = urlRegex.exec(sText);
        }
        tokens.push(...this.extractMentions(sText));

        const mentions = [];
        const urls = [];

        let escaped = tokens
            .map((token) => {
                if (token.type === 'text') {
                    return htmlEscape(token.data);
                } else if (token.type === 'url') {
                    urls.push(token.data);
                    return this.processUrl(token.data);
                } else if (token.type === 'mention') {
                    mentions.push(token.data.toLowerCase());
                    return `<a href="${encodeURI(`/u/${token.data}`)}" target="_blank" class="mention">${htmlEscape(token.data)}</a>`;
                }
            })
            .join('');

        escaped = escaped.replace(/\r\n|\r|\n/g, '<br />\n');
        return { text: escaped, mentions, urls, images: [] };
    }

    processUrl(url: string) {
        const pUrl = new Url(url);

        const res =
            this.processYoutube(pUrl) ||
            this.processVimeo(pUrl) ||
            this.processImage(pUrl) ||
            this.processCoub(pUrl) ||
            this.processVideo(pUrl) ||
            this.processInternalUrl(url);
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
        if (url.pathname.match(/\.(mp4|webm)(\/raw)?$/)) {
            return this.renderVideoTag(url.toString(), false);
        }

        return false;
    }

    processInternalUrl(url: string, text?: string) {
        const internalUrlPattern = new RegExp(`^(https?://${escapeRegExp(this.parserConfig.siteDomain)})/(?:s/([^/]+)/)?p(\\d+)(?:#(\\d+))?$`, 'i');

        const match = url.match(internalUrlPattern);
        const site = match && match[2] || null;
        if (match && (!site || !joiSite.validate(site).error)) {
            const host = match[1];
            const postId = match[3];
            const commentId = match[4] || null;

            const origUrl = `${host}/${site ? 's/' + site + '/' : ''}p${postId}${commentId ? '#' + commentId : ''}`;
            const expandButton = `<span role="button" class="expand-button i i-expand" data-post-id="${postId}"${commentId ? ' data-comment-id="' + commentId + '"' : ''}></span>`;

            return `${expandButton}<a href="${encodeURI(origUrl)}" target="_blank">${text || url}</a>`;
        }

        return false;
    }


    processCoub(url: Url<string>) {
        const coubIdPattern = /^\/view\/(\w+)$/;

        if (url.host === 'coub.com' || url.host === 'www.coub.com') {
            const match = url.pathname.match(coubIdPattern);
            if (match) {
                const coubId = match[1];
                const origUrl = `https://coub.com/view/${coubId}`;
                const previewUrl = `${this.mediaHostingConfig.url}/coub/${coubId}`;
                const embedUrl = `https://coub.com/embed/${coubId}`;

                return `<a class="coub-embed" href="${encodeURI(origUrl)}" target="_blank">` +
                    `<img src="${encodeURI(previewUrl)}" alt="" data-coub="${encodeURI(embedUrl)}"/></a>`;
            }
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
        else if (
            (url.host === 'youtube.com' || url.host === 'www.youtube.com') &&
            url.pathname.match(/^\/shorts\/(\w+)$/)
        ) {
            videoId = url.pathname.match(/^\/shorts\/(\w+)$/)[1];
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

    processVimeo(url) {
        const isVimeo = url.host === 'vimeo.com' || url.host === 'www.vimeo.com';
        if (!isVimeo || !url.pathname) return false;

        const videoId = url.pathname.substring(1);
        if (!/^\d+$/.test(videoId)) return false;

        const startTime = url.hash ? parseTime(qs.parse(url.hash.substring(1)).t) : 0;

        const origUrl = `https://vimeo.com/${videoId}${startTime ? '#t=' + startTime : ''}`;
        const previewUrl = `${this.mediaHostingConfig.url}/vimeo/${videoId}`;
        const embedUrl = `https://player.vimeo.com/video/${videoId}${startTime ? '#t=' + startTime : ''}`;

        return `<a class="vimeo-embed" href="${encodeURI(origUrl)}" target="_blank">` +
        `<img src="${encodeURI(previewUrl)}" alt="" data-vimeo="${encodeURI(embedUrl)}"/></a>`;

        function parseTime(time) {
            if (!time) return 0;
            const [, h, m, s] = time.match(/^(\d+h)?(\d+m)?(\d+s?)?$/) || [];
            return (parseInt(h, 10) || 0) * 3600 + (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
        }
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
        this.removeInnerMailTagsRec(node);
        const result = this.parseChildNodes(node.children);
        if (result.urls.length > 0 || result.mentions.length > 0) {
            return result;
        }
        const parsedInternalUrl = this.processInternalUrl(url, result.text);
        const text = parsedInternalUrl ||
            `<a href="${encodeURI(decodeURI(url))}" target="_blank">${result.text}</a>`;

        return { ...result, text, urls: [ ...result.urls, url ] } ;
    }

    parseImg(node: Element): ParseResult {
        const url = node.attribs['src'] || '';
        if (!this.validUrl(url)) {
            return this.parseDisallowedTag(node);
        }

        return { text: `<img src="${encodeURI(url)}" alt=""/>`, mentions: [], urls: [], images: [url] };
    }

    removeInnerMailTagsRec(node: Element): Element {
        // Iterate over all child nodes
        for (let i = node.children.length-1; i >= 0 ; i--) {
            const child = node.children[i];

            // If the child node is a mailbox tag, remove it
            if (child.type === 'tag') {
                if (child.name === 'mailbox' || child.name === 'mail') {
                    node.children.splice(i, 1);
                } else {
                    // If the child node is not a mailbox tag, recursively call this function
                    this.removeInnerMailTagsRec(child);
                }
            }
        }
        return node;
    }

    static isValidBase64(str: string) {
        const regex = /^[A-Za-z0-9+/]*={0,3}$/;
        return regex.test(str);
    }

    parseSecretMailbox(node: Element): ParseResult {
        // retain secret attribute and content
        const secret = node.attribs['secret'];
        if (!secret || !TheParser.isValidBase64(secret)) {
            return this.parseDisallowedTag(node);
        }
        this.removeInnerMailTagsRec(node);

        const result = this.parseChildNodes(node.children);
        // render node.children back to html
        const rawNodes = node.children.map((n) => render(n, {
            encodeEntities: false,
        })).join('');

        const rawNodesBase64 = Buffer.from(rawNodes).toString('base64');
        const text =  `<span class="i i-mailbox-secure secret-mailbox" data-secret="${secret}" `+
            `data-raw-text="${rawNodesBase64}">${result.text}</span>`;
        return { ...result, text };
    }

    parseSecretMail(node: Element): ParseResult {
        // retain secret attribute and content
        const secret = node.attribs['secret'];
        if (!secret || !TheParser.isValidBase64(secret)) {
            return this.parseDisallowedTag(node);
        }
        this.removeInnerMailTagsRec(node);

        const result = this.parseChildNodes(node.children);

        const text =  `<span class="i i-mail-secure secret-mail" data-secret="${secret}">${result.text}</span>`;
        return { ...result, text };
    }

    parseVideo(node: Element): ParseResult {
        const url = node.attribs['src'] || '';
        if (!this.validUrl(url)) {
            return this.parseDisallowedTag(node);
        }
        const text = this.renderVideoTag(url, node.attribs['loop'] !== undefined);
        return { text, mentions: [], urls: [], images: [url] };
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
            if (url.startsWith(this.mediaHostingConfig.url) || url.startsWith(this.mediaHostingUrlOrigin)) {
                const match = url.match(/.*\/([^.]+\.mp4)(\/raw)?$/);
                return match && [`${this.mediaHostingConfig.url}/preview/${encodeURI(match[1])}`,
                    `${this.mediaHostingUrlOrigin}/${encodeURI(match[1])}/raw`];
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
            if (url.startsWith(this.mediaHostingUrlOrigin)) {
                url = url.replace(this.mediaHostingUrlOrigin, this.mediaHostingConfig.url);
            }
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

    parseExpand(node: Element): ParseResult {
        const title = node.attribs['title'] || 'Открой меня';

        const result = this.parseChildNodes(node.children);
        const text = `<details class="expand"><summary>${htmlEscape(title)}</summary>${result.text}<div role="button"></div></details>`;

        return { ...result, text } ;
    }

    validUrl(url: string): boolean {
        try {
            return encodeURI(decodeURI(url)).match(urlRegexExact) !== null;
        } catch (e) {
            return false;
        }
    }
}
