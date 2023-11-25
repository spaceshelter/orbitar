import TranslationManager, {TRANSLATION_MODES} from '../../src/managers/TranslationManager';

test('TRANSLATION_MODES must have unique first letters', () => {
    const firstTwoLetters = new Set();
    for (const mode of TRANSLATION_MODES) {
        const firstTwo = mode.substr(0, 2).toLowerCase();
        expect(firstTwoLetters.has(firstTwo)).toBe(false);
        firstTwoLetters.add(firstTwo);
    }
});

// test mailbox tags stripping
test('stripMailboxTags', () => {
    const stripMailboxTags = TranslationManager.stripMailboxTags;

    expect(stripMailboxTags('')).toBe('');
    expect(stripMailboxTags('test')).toBe('test');
    expect(stripMailboxTags('test <mailbox secret="abc">11</mailbox>')).toBe('test 11');
    expect(stripMailboxTags('test <mail secret="abc">11</mail>')).toBe('test 11');
    expect(stripMailboxTags('test <mail secret="abc"><b>11</b></mail>')).toBe('test <b>11</b>');
});
