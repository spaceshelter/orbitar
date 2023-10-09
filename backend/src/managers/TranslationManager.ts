import TranslationRepository from '../db/repositories/TranslationRepository';
import {Translation} from './types/Translation';
import PostRepository from '../db/repositories/PostRepository';
import {ContentSourceRaw} from '../db/types/ContentSourceRaw';
import TheParser from '../parser/TheParser';
import {stripHtml} from 'string-strip-html';
import {Logger} from 'winston';
import {addOnPostRun, FastText, FastTextModel} from '../../langid/fasttext.js';
import {urlRegex} from '../parser/regexprs';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env["OPENAI_API_KEY"]
});
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

        const PRE_PROMPT = "Переведи текст "

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
            "как хакер"
        ];

        const POST_PROMPT = ':'

        let uuidTag;
        let html = contentSource.source.substring(0, 1024);

        if (contentSource.title) {
            uuidTag = `<t${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}/>`;
            //FIXME: strip html tags from title
            html = `${contentSource.title}${uuidTag}\n` + html;
        }

        const role = FILTERS[Math.floor(Math.random()*FILTERS.length)]
        const prompt = PRE_PROMPT + role + POST_PROMPT

        const chatCompletion = await openai.chat.completions.create({
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: html }
            ],
            model: 'gpt-3.5-turbo',
        });

        let translatedHtml = chatCompletion.choices[0].message.content

        let translatedTitle = '';
        if (contentSource.title) {
            const titleMatch = translatedHtml.split(uuidTag);
            if (titleMatch.length === 2) {
                translatedTitle = titleMatch[0];
                translatedHtml = titleMatch[1];
            }
        }
        translatedHtml = `<irony>${role}</irony>\n${translatedHtml}`;

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
