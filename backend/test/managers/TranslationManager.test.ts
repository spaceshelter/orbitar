import {TRANSLATION_MODES} from '../../src/managers/TranslationManager';

test('TRANSLATION_MODES must have unique first letters', () => {
    const firstTwoLetters = new Set();
    for (const mode of TRANSLATION_MODES) {
        const firstTwo = mode.substr(0, 2).toLowerCase();
        expect(firstTwoLetters.has(firstTwo)).toBe(false);
        firstTwoLetters.add(firstTwo);
    }
});