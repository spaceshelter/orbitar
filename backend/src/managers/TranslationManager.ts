import TranslationRepository from '../db/repositories/TranslationRepository';
import {Translation} from './types/Translation';
import fetch from 'node-fetch';
import PostRepository from '../db/repositories/PostRepository';
import {ContentSourceRaw} from '../db/types/ContentSourceRaw';
import TheParser from '../parser/TheParser';
import { stripHtml } from 'string-strip-html';
import LanguageDetection from '@smodin/fast-text-language-detection';


export default class TranslationManager {

    private translationRepository: TranslationRepository;
    private postRepository: PostRepository;
    private parser: TheParser;

    private languageDetector = new LanguageDetection();

    constructor(
        translationRepository: TranslationRepository,
        postRepository: PostRepository,
        parser: TheParser
    ) {
        this.translationRepository = translationRepository;
        this.postRepository = postRepository;
        this.parser = parser;
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

        const translationResponse = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`
            },
            body: `text=${encodeURIComponent(html)}&target_lang=${language}&tag_handling=html`
        }).then(res => {
            if (res.status !== 200) {
                throw new Error(`Translation failed with status ${res.status}`);
            }
            return res.json();
        });

        let translatedHtml = translationResponse.translations[0].text;
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
        const translation = await this.translateContentSource(contentSource, 'ru');
        return {
            title: translation.title,
            html: this.parser.parse(translation.html).text
        };
    }

    async detectLanguage(title, source): Promise<string> {
        const text = stripHtml(title + '\n' + source).result;
        if (text.length < 6) {
            return 'ru';
        }
        const lang: { lang: string, prob: number }[] = await this.languageDetector.predict(text);
        if (lang.length > 0 && lang[0].prob >= 0.95) {
            return lang[0].lang;
        }
        return 'ru';
    }
}
