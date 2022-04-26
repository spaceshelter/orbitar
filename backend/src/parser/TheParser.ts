import { parseDocument } from "htmlparser2";
import { Element, ChildNode } from "domhandler";
import { escape as htmlEscape } from "html-escaper";
import escapeHTML from "escape-html";
import Url from "url-parse";
import qs from "qs";

export type TheParserOptions = {
    tags: Record<string, ((node: Element) => string) | boolean>;
}

export default class TheParser {
    private readonly allowedTags: Record<string, ((node: Element) => string) | boolean>;

    constructor(options?: TheParserOptions) {
        this.allowedTags = {
            a: (node) => this.parseA(node),
            img: (node) => this.parseImg(node),
            irony: (node) => this.parseIrony(node),
            b: true,
            i: true,
            u: true,
            strike: true,
        };
    }

    parse(text: string) {
        let doc = parseDocument(text, {
            decodeEntities: false
        });

        return this.parseChildNodes(doc.childNodes);
    }

    private parseChildNodes(doc: ChildNode[]) {
        return doc.reduce((p, c) => {
            return p + this.parseNode(c);
        }, '');
    }

    private parseNode(node: ChildNode) {
        if (node.type === 'text') {
            return this.parseText(node.data);
        }

        if (node.type === 'tag') {
            let allowed = this.allowedTags[node.tagName];
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

        return '';
    }

    private parseText(text: string) {
        let regex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/g;
        let tokens: { type: string; data: string }[] = [];

        let sText = text;
        let match = regex.exec(sText);
        while (match) {
            let url = match[0];
            let pText = sText.substring(0, match.index);
            tokens.push({ type: 'text', data: pText });
            sText = sText.substring(match.index + url.length);
            tokens.push({ type: 'url', data: url });
            regex.lastIndex = 0; //match.index + url.length;

            match = regex.exec(sText);
        }
        tokens.push({ type: 'text', data: sText });

        let escaped = tokens
            .map((token) => {
                if (token.type === 'text') {
                    return htmlEscape(token.data);
                } else if (token.type === 'url') {
                    return this.processUrl(token.data);
                }
            })
            .join('');

        escaped = escaped.replace(/\r\n|\r|\n/g, '<br />\n');
        return escaped;
    }

    processUrl(url: string) {
        let pUrl = new Url(url);

        let res =
            this.processYoutube(pUrl) ||
            this.processImage(pUrl) ||
            this.processVideo(pUrl);
        if (res !== false) {
            return res;
        }

        return `<a href="${encodeURI(decodeURI(url))}" target="_blank">${htmlEscape(decodeURI(url))}</a>`;
    }

    processImage(url: Url<string>) {
        if (url.pathname.match(/\.(jpg|gif|png|webp|jpeg)$/)) {
            return `<img src="${encodeURI(url.toString())}" alt=""/>`;
        }

        return false;
    }

    processVideo(url: Url<string>) {
        if (url.pathname.match(/\.(mp4|webm)$/)) {
            return `<video loop="" preload="metadata" controls="" width="500"><source src="${encodeURI(url.toString())}" type="video/mp4"></video>`;
        }

        return false;
    }

    processYoutube(url: Url<string>) {
        let videoId = '';
        let startTime = 0;

        const parseTime = (time: string) => {
            let groups = time.match(/^(\d+h)?(\d+m)?(\d+s?)?$/);
            if (!groups) {
                return 0;
            }
            let h = parseInt(groups[1], 10) || 0;
            let m = parseInt(groups[2], 10) || 0;
            let s = parseInt(groups[3], 10) || 0;
            return h * 3600 + m * 60 + s;
        };

        if (
            (url.host === 'youtube.com' || url.host === 'www.youtube.com') &&
            url.query &&
            url.pathname === '/watch'
        ) {
            let q = qs.parse(url.query.substring(1));
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
                let q = qs.parse(url.query.substring(1));
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
        if (startTime) {
            embed += '?start=' + startTime;
        }

        return `<iframe width="500" height="282" src="${encodeURI(embed)}" allowfullscreen frameborder="0"></iframe>`;
    }

    parseAllowedTag(node: Element) {
        let haveChild = node.children.length > 0;
        let s = `<${node.name}${haveChild ? "" : "/"}>`;
        s += this.parseChildNodes(node.children);
        s += `</${node.name}>`;
        return s;
    }

    parseDisallowedTag(node: Element) {
        let haveChild = node.children.length > 0;
        let s = `<${node.name}`;
        for (let a in node.attribs) {
            s += ` ${a}="${node.attribs[a]}"`;
        }
        s += haveChild ? '>' : '/>';
        s = htmlEscape(s);
        s += this.parseChildNodes(node.children);
        s += htmlEscape(`</${node.name}>`);
        return s;
    }

    parseA(node: Element) {
        let url = node.attribs['href'] || '';
        let regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*$/;
        if (!url.match(regex)) {
            return this.parseDisallowedTag(node);
        }

        return `<a href="${encodeURI(url)}" target="_blank">${this.parseChildNodes(node.children)}</a>`;
    }

    parseImg(node: Element) {
        let url = node.attribs['src'] || '';
        let regex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*$/;
        if (!url.match(regex)) {
            return this.parseDisallowedTag(node);
        }

        return `<img src="${encodeURI(url)}" alt=""/>`;
    }

    parseIrony(node: Element) {
        return `<span class="irony">${this.parseChildNodes(node.children)}</span>`;
    }
}
