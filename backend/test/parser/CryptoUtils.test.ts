import {aesDecryptFromBase64, aesEncryptToBase64} from '../../src/parser/CryptoUtils';

test('aes encode decode', () => {
    const key = 'mVRW8ycqHYZQSgYcBN8PUz8hVRWB5n5q';
    expect(aesDecryptFromBase64(aesEncryptToBase64('test', key), key)).toBe('test');
    expect(aesDecryptFromBase64('TGBv/lDGJdJo9SK8kDxiaEnu3i9dFxUhl5pDJVDzCG8=', key)).toBe('test');
});

test('wrong input', () => {
    const key = 'mVRW8ycqHYZQSgYcBN8PUz8hVRWB5n5q';
    expect(aesDecryptFromBase64(aesEncryptToBase64('test', key), key + '1')).toBe('');
    expect(aesDecryptFromBase64('a' + aesEncryptToBase64('test', key), key)).toBe('');
    expect(aesDecryptFromBase64('TGBv/lDGJdJo9SK8kDxiaEnu4i9dFxUhl5pDJVDzCG8=', key)).toBe('');
});

test('ransdom input', () => {
    const key = 'mVRW8ycqHYZQSgYcBN8PUz8hVRWB5n5q';
    // try length 1 to 10
    for (let l = 1; l < 10; l++) {
        // 10 tries
        for (let i = 0; i < 10; i++) {
            // generate random string
            let s = '';
            for (let i = 0; i < l; i++) {
                s += String.fromCharCode(Math.floor(Math.random() * 256));
            }
            expect(aesDecryptFromBase64(aesEncryptToBase64(s, key), key)).toBe(s);
        }
    }
});
