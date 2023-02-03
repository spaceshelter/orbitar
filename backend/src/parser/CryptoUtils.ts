import * as CryptoJS from 'crypto-js';

export function aesEncryptToBase64(data, key) {
    const iv = CryptoJS.lib.WordArray.random(16);
    const cipher = CryptoJS.AES.encrypt(data, CryptoJS.enc.Utf8.parse(key), {iv});
    const toEncode = iv.concat(cipher.ciphertext);
    return CryptoJS.enc.Base64.stringify(toEncode);
}

export function aesDecryptFromBase64(base64data, key) {
    try {
        const decoded = CryptoJS.enc.Base64.parse(base64data);
        const iv = CryptoJS.lib.WordArray.create(decoded.clone().words.slice(0, 4));
        const ciphertext = CryptoJS.lib.WordArray.create(decoded.clone().words.slice(4));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const decrypted = CryptoJS.AES.decrypt({ciphertext} as any, CryptoJS.enc.Utf8.parse(key), {
            iv
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return '';
    }
}