import * as CryptoJS from 'crypto-js';

const b62 = BigInt(62);

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

export function charToB62Int(char) {
    const code = char.charCodeAt(0);
    if (code >= 48 && code <= 57) {
        return code - 48;
    }
    if (code >= 65 && code <= 90) {
        return code - 55;
    }
    if (code >= 97 && code <= 122) {
        return code - 61;
    }
    throw new Error('Invalid base62 string');
}

export function base62decodeToHex(base62) {
    let output = BigInt(0);
    let current;

    for (let i = 0; i < base62.length; i++) {
        current = BigInt(charToB62Int(base62[i]));
        output = output * b62 + current;
    }

    return output.toString(16);
}

/**
 *   PHP code used for encryption:
 *   try it: https://www.tehplayground.com/J5xhaBxh4YJ4AV5i
 *
 *   $algo = 'aes-256-cbc';
 *   $iv = openssl_random_pseudo_bytes(8);
 *   $metadata = ...;
 *   $key = ...;
 *   $v = 1; # protocol version
 *
 *   function base62_encode($str) {
 *       return gmp_strval(gmp_init(bin2hex($str), 16), 62);
 *   }
 *
 *   # note: $iv is doubled to shorten the resulting hash
 *   # (tradeoff between security and length)
 *   $encryptedMetadata = openssl_encrypt($metadata, $algo, $key, $options = OPENSSL_RAW_DATA, $iv . $iv);
 *
 *   # concat iv and encrypted metadata and encode to base62
 *   return base62_encode($v . $encryptedMetadata . $iv)
 */
export function decryptMetadata(base62, key) {
    if (key.length !== 32) {
        throw new Error('Invalid key length');
    }
    // base62decodeToHex base64 encoded string
    const hexData = base62decodeToHex(base62);

    if (hexData.length < 16 + 2) {
        throw new Error('Invalid metadata length');
    }

    // extract iv and encrypted metadata (last two words)
    let iv = CryptoJS.enc.Hex.parse(hexData.substring(hexData.length - 16));

    // concatenate iv with itself
    iv = iv.concat(iv);
    // const version = hexData.substring(0, 2);

    const ciphertext = CryptoJS.enc.Hex.parse(hexData.substring(2, hexData.length - 16));

    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const decryptedMetadata = CryptoJS.AES.decrypt({
        ciphertext
    } as any, CryptoJS.enc.Utf8.parse(key), {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });

    // convert to plaintext
    return decryptedMetadata.toString(CryptoJS.enc.Utf8);
}