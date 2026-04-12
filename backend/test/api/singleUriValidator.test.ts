import { singleUriValidator } from '../../src/api/ApiMiddleware'

describe('singleUriValidator', () => {
  const validate = (value: string) => {
    const result = singleUriValidator.validate(value)
    return { isValid: !result.error, error: result.error?.message }
  }

  const originalNodeEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('accepts a single https URL', () => {
    process.env.NODE_ENV = 'production'
    expect(validate('https://example.com/start').isValid).toBe(true)
  })

  it('accepts a URL with commas in query params (no splitting)', () => {
    process.env.NODE_ENV = 'production'
    expect(validate('https://example.com/start?tags=a,b,c').isValid).toBe(true)
  })

  it('accepts custom protocol URIs', () => {
    process.env.NODE_ENV = 'production'
    expect(validate('myapp://open').isValid).toBe(true)
  })

  it('accepts http://localhost in production', () => {
    process.env.NODE_ENV = 'production'
    expect(validate('http://localhost:3000/start').isValid).toBe(true)
  })

  it('rejects http://example.com in production', () => {
    process.env.NODE_ENV = 'production'
    expect(validate('http://example.com/start').isValid).toBe(false)
  })

  it('rejects URLs with fragments', () => {
    process.env.NODE_ENV = 'production'
    expect(validate('https://example.com/start#frag').isValid).toBe(false)
  })

  it('does not split on commas — treats input as one URL', () => {
    // A list like "https://a.com,http://example.com" must NOT be accepted by
    // splitting and validating each piece; the whole string is one URL.
    // The second part "http://example.com" would pass urisListValidator but
    // the combined string is an invalid single URL.
    process.env.NODE_ENV = 'production'
    expect(validate('https://a.com,http://example.com').isValid).toBe(false)
  })
})
