import TranslationRepository from '../db/repositories/TranslationRepository';
import PostRepository from '../db/repositories/PostRepository';
import TheParser from '../parser/TheParser';
import {stripHtml} from 'string-strip-html';
import {Logger} from 'winston';
import {addOnPostRun, FastText, FastTextModel} from '../../langid/fasttext.js';
import {urlRegex} from '../parser/regexprs';
import OpenAI from 'openai';
import {ChatCompletionChunk} from 'openai/src/resources/chat/completions';
import {APIPromise} from 'openai/core';
import {Stream} from 'openai/streaming';
import {config} from '../config';

const openai = new OpenAI({
    apiKey: config.openai.apiKey
});

const TEXT_SIZE_LIMIT = 2048;

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
        const PRE_PROMPT = 'Переведи текст ';
        const POST_PROMPT = ':';
        const FILTERS = [
            ['как пьяный викинг', 'викинг mode'],
            ['как пьяница в крайней степени опьянения', 'пьяница mode'],
            ['как неандерталец', 'неандерталец mode'],
            ['на emoji', 'emoji mode'],
            ['на языке танца', 'язык танца mode'],
            ['как занудный мегаинтеллектуал', 'интеллектуал mode'],
            ['как крестьянин 18-го века', 'крестьянин mode'],
            ['как заносчивый аристократ 19-го века', 'аристократ mode'],
            ['как заика', 'заика mode'],
            ['как философ', 'философ mode'],
            ['как похотливая монашка', 'монашка mode'],
            ['как уголовник', 'урка mode'],
            ['как одессит', 'Одесса mode'],
            ['как закарпатский вуйко', 'закарпатье mode'],
            ['как Шекспир', 'Шекспир mode'],
            ['как панк', 'панк mode'],
            ['в стиле аниме', 'аниме mode'],
            ['на корейский', 'Корея mode'],
            ['на грузинский', 'Грузия mode'],
            ['на вьетнамский', 'Вьетнам mode'],
            ['на санскрит', 'санскрит mode'],
            ['на арабский', 'арабский mode'],
            ['как рассказываешь сказку', 'сказка mode'],
            ['как злой пират', 'пират mode'],
            ['как зомби', 'зомби mode'],
            ['на рыбий', 'рыба mode'],
            ['на кошачий', 'кот mode'],
            ['на l33t', 'хакер mode']
        ];

        const [role, hint] = FILTERS[Math.floor(Math.random()*FILTERS.length)];
        return [PRE_PROMPT + role + POST_PROMPT, hint];
    }

    static interpreterString(prompt: string, content: string): APIPromise<Stream<ChatCompletionChunk>> {
        return openai.chat.completions.create({
            messages: [
                {role: 'system', content: prompt},
                {role: 'user', content: content}
            ],
            model: 'gpt-3.5-turbo',
            stream: true
        });
    }

    async translateEntity(ref_id: number, type: 'post' | 'comment', mode: TranslationMode, write: (str: string) => void): Promise<void> {
        const contentSource = await this.postRepository.getLatestContentSource(ref_id, type);
        if (!contentSource) {
            throw new Error('ContentSource not found');
        }

        const cachedTranslation = await this.translationRepository.getTranslation(contentSource.content_source_id, mode);
        if (cachedTranslation) {
            write(cachedTranslation.html);
            return;
        }

        let prompt, hint;
        switch(mode) {
            case 'altTranslate':
                [prompt, hint] = this.getAltTranslatePrompt();
                hint = `<span class="interpretation"><span class="i i-alttranslate"></span>${hint}</span><br />`;
                break;
            case 'annotate':
                prompt = 'Кратко перескажи о чём говориться в тексте';
                hint = '<span class="interpretation"><span class="i i-annotate"></span>Аннотация</span><br />';
                break;
        }

        if(!prompt){
            throw new Error('Invalid prompt');
        }
        // TODO review limitations to fit into budget
        const content = contentSource.source.substring(0, TEXT_SIZE_LIMIT);

        const fullResponse: string[] = [hint];
        const readableGPTStream = await TranslationManager.interpreterString(prompt, content);
        write(hint);
        for await (const part of readableGPTStream) {
            const chunk = part.choices[0]?.delta?.content || '';
            write(chunk);
            fullResponse.push(chunk);
        }
        const fullResponseStr = fullResponse.join('');
        await this.translationRepository.saveTranslation(contentSource.content_source_id, mode, contentSource.title || '', fullResponseStr);
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
