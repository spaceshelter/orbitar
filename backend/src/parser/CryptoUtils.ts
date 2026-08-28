import * as CryptoJS from 'crypto-js'

export function aesEncryptToBase64(data, key) {
  const iv = CryptoJS.lib.WordArray.random(16)
  const cipher = CryptoJS.AES.encrypt(data, CryptoJS.enc.Utf8.parse(key), { iv })
  const toEncode = iv.concat(cipher.ciphertext)
  return CryptoJS.enc.Base64.stringify(toEncode)
}

// CBC+Pkcs7 without a MAC: a wrong key or corrupted input usually fails the
// padding/UTF-8 checks and yields '', but can occasionally decode to garbage.
// Callers must validate the returned plaintext (isValidBarmaliniPassword
// parses it as a date and applies a time window).
export function aesDecryptFromBase64(base64data, key) {
  try {
    const decoded = CryptoJS.enc.Base64.parse(base64data)
    const iv = CryptoJS.lib.WordArray.create(decoded.clone().words.slice(0, 4))
    const ciphertext = CryptoJS.lib.WordArray.create(decoded.clone().words.slice(4))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decrypted = CryptoJS.AES.decrypt({ ciphertext } as any, CryptoJS.enc.Utf8.parse(key), {
      iv,
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (e) {
    return ''
  }
}
