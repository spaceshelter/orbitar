import TranslationRepository from '../db/repositories/TranslationRepository';
import {Translation} from './types/Translation';
import fetch from 'node-fetch';
import PostRepository from '../db/repositories/PostRepository';
import {ContentSourceRaw} from '../db/types/ContentSourceRaw';
import TheParser from '../parser/TheParser';
import {stripHtml} from 'string-strip-html';
import {Logger} from 'winston';
import {addOnPostRun, FastText, FastTextModel} from '../../langid/fasttext.js';
import {urlRegex} from '../parser/regexprs';

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

    async translateContentSource(contentSource: ContentSourceRaw, language: string): Promise<Translation> {
        const translation = await this.translationRepository.getTranslation(contentSource.content_source_id, language);
        if (translation) {
            return translation;
        }

        let html = contentSource.source;

        let uuidTag;
        if (contentSource.title) {
            uuidTag = `<t${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}/>`;
            //FIXME: strip html tags from title
            html = `${contentSource.title}${uuidTag}\n` + html;
        }
        const brUuidTag = `<br${Math.random().toString(36).substring(2, 8)}/>`;
        // replace line breaks with brUuidTag
        html = html.replace(/\n/g, brUuidTag);

        const translationResponse = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`
            },
            body: `text=${encodeURIComponent(html)}&target_lang=${language}&tag_handling=html`
        }).then(res => {
            if (res.status !== 200) {
                this.logger.error('Translation failed', {status: res.status, contentSource});
                throw new Error(`Translation failed with status ${res.status}`);
            }

            return res.json();
        });

        let translatedHtml = translationResponse.translations[0].text;
        // replace brUuidTag with line breaks
        translatedHtml = translatedHtml.replaceAll(brUuidTag, '\n');

        let translatedTitle = '';
        if (contentSource.title) {
            const titleMatch = translatedHtml.split(uuidTag);
            if (titleMatch.length === 2) {
                translatedTitle = titleMatch[0];
                translatedHtml = titleMatch[1];
            }
        }

        await this.translationRepository.saveTranslation(contentSource.content_source_id, language,
            translatedTitle, translatedHtml);
        return {
            title: translatedTitle,
            html: translatedHtml
        };
    }

    async translateEntity(ref_id: number, type: 'post' | 'comment'): Promise<Translation> {
        const contentSource = await this.postRepository.getLatestContentSource(ref_id, type);
        if (!contentSource) {
            throw new Error('ContentSource not found');
        }
        const translation = await this.translateContentSource(contentSource, defaultLanguage);
        return {
            title: translation.title,
            html: this.parser.parse(translation.html).text
        };
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
