import { mediaHostingUrlPattern } from '../../src/api/ApiMiddleware'

describe('mediaHostingUrlPattern', () => {
  const matches = (baseUrl: string, url: string) => mediaHostingUrlPattern(baseUrl).test(url)

  it('accepts a URL served by the configured host', () => {
    expect(matches('https://orbitar.media', 'https://orbitar.media/logo.png')).toBe(true)
  })

  it('rejects a host that merely starts with the configured one', () => {
    expect(matches('https://orbitar.media', 'https://orbitar.media.evil.example/logo.png')).toBe(false)
  })

  it('rejects the configured host appearing in the path of another host', () => {
    expect(matches('https://orbitar.media', 'https://evil.example/https://orbitar.media/logo.png')).toBe(false)
  })

  it('rejects the bare origin with no path', () => {
    expect(matches('https://orbitar.media', 'https://orbitar.media')).toBe(false)
  })

  it('rejects a different scheme on the same host', () => {
    expect(matches('https://orbitar.media', 'http://orbitar.media/logo.png')).toBe(false)
  })

  it('ignores a trailing slash in the configured URL', () => {
    expect(matches('https://orbitar.media/', 'https://orbitar.media/logo.png')).toBe(true)
    expect(matches('https://orbitar.media/', 'https://orbitar.media.evil.example/logo.png')).toBe(false)
  })

  it('keeps a path prefix in the configured URL', () => {
    expect(matches('https://cdn.example/orbitar', 'https://cdn.example/orbitar/logo.png')).toBe(true)
    expect(matches('https://cdn.example/orbitar', 'https://cdn.example/orbitar-evil/logo.png')).toBe(false)
  })

  it('treats regex metacharacters in the configured URL literally', () => {
    expect(matches('https://orbitar.media', 'https://orbitarXmedia/logo.png')).toBe(false)
  })
})
