import TranslationRepository from '../db/repositories/TranslationRepository';
import PostRepository from '../db/repositories/PostRepository';
import TheParser from '../parser/TheParser';
import {stripHtml} from 'string-strip-html';
import {Logger} from 'winston';
import {addOnPostRun, FastText, FastTextModel} from '../../langid/fasttext.js';
import {urlRegex} from '../parser/regexprs';
import OpenAI from 'openai';
const NodeStream = require('stream')
import {ChatCompletionChunk} from "openai/src/resources/chat/completions";
import {APIPromise} from "openai/core";
import {Stream} from "openai/streaming";

const openai = new OpenAI({
    apiKey: process.env["OPENAI_API_KEY"]
});

export type TranslationMode = 'altTranslate' | 'annotate';

const fasttextModelPromise: Promise<FastTextModel> = new Promise<FastText>((resolve) => {
    addOnPostRun(() => {
        const ft = new FastText();
        resolve(ft);
    });
}).then((ft) => {
    return ft.loadModel('./langid/lid.176.ftz');
});

const defaultLanguage = process.env.DEFAULT_LANGUAGE || 'ru';

export async function getLanguage(text: string): Promise<{lang: string, prob: number} | undefined> {
    const model = await fasttextModelPromise;
    const lang = model.predict(text, 4);

    if (lang.length > 0) {
        return {lang: lang[0][1], prob: lang[0][0]};
    }
}

export default class TranslationManager {
    private translationRepository: TranslationRepository;
    private postRepository: PostRepository;
    private parser: TheParser;
    private logger: Logger;

    constructor(
        translationRepository: TranslationRepository,
        postRepository: PostRepository,
        parser: TheParser,
        logger: Logger
    ) {
        this.translationRepository = translationRepository;
        this.postRepository = postRepository;
        this.parser = parser;
        this.logger = logger;
    }

    getAltTranslatePrompt(): [string, string] {
        const PRE_PROMPT = "Переведи текст "
        const POST_PROMPT = ':'
        const FILTERS = [
            "как пьяный викинг",
            "как пьяница в крайней степени опьянения",
            "как неандерталец",
            "на эмодзи",
            "на языке танца",
            "как мегаинтеллектуал",
            "как крестьянин 18-го века",
            "как заносчивый аристократ 19-го века",
            "как заика",
            "как философ",
            "как похотливая монашка",
            "как уголовник",
            "как одессит",
            "как закарпатский вуйко",
            "как Шекспир",
            "как панк",
            "на японский",
            "на корейский",
            "на китайский",
            "на грузинский",
            "на вьетнамский",
            "на санскрит",
            "на арабский",
            "как рассказываешь сказку",
            "как злой пират",
            "как зомби",
            "на хакерский"
        ];

        const role = FILTERS[Math.floor(Math.random()*FILTERS.length)]
        return [PRE_PROMPT + role + POST_PROMPT, role]
    }

    static interpreterString(prompt: string, content: string): APIPromise<Stream<ChatCompletionChunk>> {
        return openai.chat.completions.create({
            messages: [
                {role: 'system', content: prompt},
                {role: 'user', content: content}
            ],
            model: 'gpt-3.5-turbo',
            max_tokens: 2048,
            stream: true
        });
    }

    async translateEntity(ref_id: number, type: 'post' | 'comment', mode: TranslationMode): Promise<string | ReadableStream<string>> {
        const contentSource = await this.postRepository.getLatestContentSource(ref_id, type);
        if (!contentSource) {
            throw new Error('ContentSource not found');
        }
        const cachedTranslation = await this.translationRepository.getTranslation(contentSource.content_source_id, mode);
        if (cachedTranslation) {
            // return cachedTranslation.html;
        }

        let prompt, hint;
        switch(mode) {
            case 'altTranslate':
                [prompt, hint] = this.getAltTranslatePrompt();
                break;
            case 'annotate':
                prompt = 'Кратко перескажи о чём говориться в тексте';
                hint = 'Аннотация'
                break;
        }

        if(!prompt){
            throw new Error('Invalid prompt');
        }
        // TODO review limitations to fit into budget
        const content = contentSource.source.substring(0, 1024)

        const readableGPTStream = await TranslationManager.interpreterString(prompt, content);

        // Now need to remove ChatGPT related responses, \
        // transform to simple text stream
        // and cache final interpretation
        const rs = new NodeStream.Readable({read: async () => {
                for await (const part of readableGPTStream) {
                    const chunk = part.choices[0]?.delta?.content || ''
                    console.log('async', chunk)
                    fullResponse.push(chunk);
                    rs.push(chunk);
                }
                // HACK to write received response into repository even if user has reloaded the page and
                // interrupted the response - doing this at the end of _read
                if(fullResponse.length > 1) {
                    const fullResponseStr = fullResponse.join('');
                    console.log('end of stream', fullResponseStr)
                    await this.translationRepository.saveTranslation(contentSource.content_source_id, mode, contentSource.title || '', fullResponseStr);
                    rs.push(null)
                    // empty array to prevent future calls
                    fullResponse.length = 0;
                }
            }
        });
        rs.push(`<irony>${hint}</irony>\n`)
        const fullResponse: string[] = [`<irony>${hint}</irony>\n`];

        return rs
    }

    async detectLanguage(title, source): Promise<string> {
        const text = stripHtml(title + '\n' + source)
            .result
            .replace(/\B(@|\/u\/)[a-zа-яе0-9_-]+/gi, '') //mentions
            .replace(urlRegex, ''); //urls

        if (text.length < 6) {
            return defaultLanguage;
        }
        try {
            const {lang, prob} = await getLanguage(text);
            this.logger.info('Language detected', {lang, text});
            if (prob > 0.8) {
                return lang;
            }
        } catch (e) {
            this.logger.error('Language detection failed', {title, source});
            this.logger.error(e);
        }
        return defaultLanguage;
    }
}
