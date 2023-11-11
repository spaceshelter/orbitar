import TranslationRepository from '../db/repositories/TranslationRepository';
import PostRepository from '../db/repositories/PostRepository';
import TheParser from '../parser/TheParser';
import {stripHtml} from 'string-strip-html';
import {Logger} from 'winston';
import {addOnPostRun, FastText, FastTextModel} from '../../langid/fasttext.js';
import {urlRegex} from '../parser/regexprs';
import OpenAI from 'openai';
import {ChatCompletionChunk, ChatCompletionMessageParam} from 'openai/src/resources/chat/completions';
import {APIPromise} from 'openai/core';
import {Stream} from 'openai/streaming';
import {config} from '../config';

const openai = new OpenAI({
    apiKey: config.openai.apiKey
});

const TEXT_SIZE_LIMIT = 4096;

export const TRANSLATION_MODES = ['altTranslate', 'annotate'] as const;
export type TranslationMode = typeof TRANSLATION_MODES[number];

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
        const PRE_PROMPT = 'Перепиши данный текст ';
        const POST_PROMPT =
            '. Результат должен быть максимально смешным и дурашливым, но не глупым. ' +
            'Постарайся сохранить или уменьшить объем текста.';
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
            ['как житель закарпатья', 'закарпатье mode'],
            ['как Шекспир', 'Шекспир mode'],
            ['как панк', 'панк mode'],
            ['в стиле аниме', 'аниме mode'],
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

    static interpreterString(prompt: string, content: string, temperature: number): APIPromise<Stream<ChatCompletionChunk>> {
        const messages: Array<ChatCompletionMessageParam> = [];
        const short = content.length < prompt.length * 2;

        if (short) {
            // let's duplicate the instructions for better emphasis
            messages.push(
                {role: 'system', content: (prompt + ' Текст ниже:')},
            );
        }

        // push all
        messages.push(
            {role: 'user', content: content},
            {role: 'system', content: (`Текст выше. ${ short ? 'Инструкция:' : 'Напоминаю инструкцию:'}\n${prompt}`)},
            {
                role: 'system', content: 'Answer MUST CONTAIN ONLY THE MODIFIED TEXT ' +
                    'as if written by the original author. PRESERVE the original HTML tags and formatting AS IS.\n' +
                    'Strive for the best quality. Answer in Russian if not specified otherwise.'
            }
        );

        return openai.chat.completions.create({
            messages : messages,
            model: 'gpt-4-1106-preview',
            stream: true,
            temperature: temperature,
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

        let prompt, hint, temp;
        switch(mode) {
            case 'altTranslate':
                [prompt, hint] = this.getAltTranslatePrompt();
                hint = `<span class="interpretation"><span class="i i-alttranslate"></span>${hint}</span><br />`;
                temp = 1;
                break;
            case 'annotate':
                prompt = 'Напиши сжатое изложение текста, один-два абзаца, до 200 слов.\n';
                hint = '<span class="interpretation"><span class="i i-annotate"></span>TL;DR</span><br />';
                temp = 0.5;
                break;
        }

        if(!prompt){
            throw new Error('Invalid prompt');
        }
        // TODO review limitations to fit into budget
        const parsingResult = this.parser.parse(contentSource.source).text;
        const content = parsingResult.substring(0, TEXT_SIZE_LIMIT);

        // if parsingResult without html tags and whitespace is too short, don't do anything
        if (stripHtml(parsingResult).result.trim().length < 6) {
            // return empty response
            return Promise.resolve();
        }

        const fullResponse: string[] = [];

        // 1% chance
        if (mode === 'altTranslate' && Math.random() < 0.03) {
            fullResponse.push(hint,
                'Ⓘ Данная функция доступна только пользователям Orbitar Premium');
            write(fullResponse.join(''));
        } else {
            const readableGPTStream = await TranslationManager.interpreterString(prompt, content, temp);
            // Important!
            // Ensure that the first chunk is written after the stream is created,
            // otherwise the error cannot be set in http response downstream

            write(hint);
            fullResponse.push(hint);

            for await (const part of readableGPTStream) {
                const chunk = part.choices[0]?.delta?.content || '';
                write(chunk);
                fullResponse.push(chunk);
            }
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
