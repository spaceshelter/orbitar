import { b64DecodeUnicode, b64EncodeUnicode, pluralize } from '../utils'

describe('utils', () => {
  test('b64 encode/decode works', () => {
    const text = 'Привет'
    const encoded = b64EncodeUnicode(text)
    expect(b64DecodeUnicode(encoded)).toBe(text)
  })

  test('pluralize returns correct form', () => {
    expect(pluralize(1, ['комментарий', 'комментария', 'комментариев'])).toBe('1 комментарий')
    expect(pluralize(2, ['комментарий', 'комментария', 'комментариев'])).toBe('2 комментария')
    expect(pluralize(5, ['комментарий', 'комментария', 'комментариев'])).toBe('5 комментариев')
  })
})
