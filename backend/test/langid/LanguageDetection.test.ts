import {getLanguage} from '../../src/managers/TranslationManager';

test('english detection', async () => {
    const {lang} = await getLanguage('hello world');
    expect(lang).toBe('en');

}, 10000);

test('russian detection', async () => {
    const {lang} = await getLanguage('Привет мир');
    expect(lang).toBe('ru');
}, 10000);

test('ukrainian detection', async () => {
    const {lang} = await getLanguage('Привіт світ');
    expect(lang).toBe('uk');
}, 10000);

test('belarusian detection', async () => {
    const {lang} = await getLanguage('Прывітанне свет');
    expect(lang).toBe('be');
}, 10000);
