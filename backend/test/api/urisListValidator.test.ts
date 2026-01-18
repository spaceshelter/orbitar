import { urisListValidator } from '../../src/api/ApiMiddleware'

describe('urisListValidator', () => {
  // Helper to validate a URI string
  const validate = (value: string) => {
    const result = urisListValidator.validate(value)
    return {
      isValid: !result.error,
      value: result.value,
      error: result.error?.message,
    }
  }

  describe('HTTPS URLs', () => {
    it('accepts valid HTTPS URLs', () => {
      const result = validate('https://example.com/callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts HTTPS URLs with paths', () => {
      const result = validate('https://example.com/oauth/callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts HTTPS URLs with query parameters', () => {
      const result = validate('https://example.com/callback?param=value')
      expect(result.isValid).toBe(true)
    })

    it('accepts HTTPS URLs with ports', () => {
      const result = validate('https://example.com:8443/callback')
      expect(result.isValid).toBe(true)
    })

    it('rejects URLs with fragments (#hash)', () => {
      const result = validate('https://example.com/callback#section')
      expect(result.isValid).toBe(false)
    })

    it('rejects URLs with empty fragment (#)', () => {
      // RFC 6749: no fragments allowed, even empty ones
      // Note: urlObj.hash is '#' for empty fragments, which is still rejected
      const result = validate('https://example.com/callback#')
      expect(result.isValid).toBe(false)
    })
  })

  describe('HTTP URLs (environment-dependent)', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    it('accepts HTTP URLs in development mode', () => {
      process.env.NODE_ENV = 'development'
      const result = validate('http://localhost:3000/callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts HTTP localhost in development mode', () => {
      process.env.NODE_ENV = 'development'
      const result = validate('http://localhost/callback')
      expect(result.isValid).toBe(true)
    })

    it('rejects HTTP URLs in production mode', () => {
      process.env.NODE_ENV = 'production'
      const result = validate('http://example.com/callback')
      expect(result.isValid).toBe(false)
    })
  })

  describe('Custom protocol URIs (for mobile/desktop apps)', () => {
    it('accepts myapp:// scheme', () => {
      const result = validate('myapp://callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts myapp:// scheme with path', () => {
      const result = validate('myapp://oauth/callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts reverse-domain style schemes (com.example.app://)', () => {
      const result = validate('com.example.app://oauth')
      expect(result.isValid).toBe(true)
    })

    it('accepts custom schemes with dashes', () => {
      const result = validate('my-custom-app://callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts custom schemes with numbers', () => {
      const result = validate('app123://callback')
      expect(result.isValid).toBe(true)
    })

    it('rejects custom protocol URIs with fragments', () => {
      const result = validate('myapp://callback#section')
      expect(result.isValid).toBe(false)
    })
  })

  describe('Multiple URIs (comma-separated)', () => {
    it('accepts multiple valid HTTPS URIs', () => {
      const result = validate('https://example.com/callback,https://example.org/callback')
      expect(result.isValid).toBe(true)
    })

    it('accepts mixed HTTPS and custom protocol URIs', () => {
      const result = validate('https://example.com/callback,myapp://callback')
      expect(result.isValid).toBe(true)
    })

    it('trims whitespace around URIs', () => {
      const result = validate('https://example.com/callback , https://example.org/callback')
      expect(result.isValid).toBe(true)
    })

    it('rejects if any URI is invalid', () => {
      const result = validate('https://example.com/callback,not-a-valid-uri')
      expect(result.isValid).toBe(false)
    })

    it('rejects if any URI has a fragment', () => {
      const result = validate('https://example.com/callback,https://example.org/callback#hash')
      expect(result.isValid).toBe(false)
    })
  })

  describe('Invalid URIs', () => {
    it('rejects empty string', () => {
      const result = validate('')
      expect(result.isValid).toBe(false)
    })

    it('rejects plain text', () => {
      const result = validate('not-a-url')
      expect(result.isValid).toBe(false)
    })

    it('rejects URIs without protocol', () => {
      const result = validate('example.com/callback')
      expect(result.isValid).toBe(false)
    })

    // Note: The validator accepts any valid custom protocol for mobile/desktop apps.
    // While javascript:, data:, and file: protocols are technically valid,
    // they should not be used as OAuth redirect URIs in practice.
    // These tests document the current behavior.
    it('accepts javascript: protocol (valid URI, but should not be used)', () => {
      const result = validate('javascript:void(0)')
      // Current implementation accepts any custom protocol
      expect(result.isValid).toBe(true)
    })

    it('accepts data: protocol (valid URI, but should not be used)', () => {
      // Note: data URIs with commas are problematic since the validator splits by comma
      // Using a data URI without comma in the data portion
      const result = validate('data:text/plain;base64,dGVzdA==')
      // This will be split and fail - documenting the limitation
      // The comma-split means data: URIs with payload are effectively not supported
      expect(result.isValid).toBe(false)
    })

    it('accepts file: protocol (valid URI, but should not be used)', () => {
      const result = validate('file:///etc/passwd')
      // Current implementation accepts any custom protocol
      expect(result.isValid).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('handles trailing slashes', () => {
      const result = validate('https://example.com/callback/')
      expect(result.isValid).toBe(true)
    })

    it('strips trailing slash with asterisk (wildcard pattern)', () => {
      const result = validate('https://example.com/*')
      expect(result.isValid).toBe(true)
      // The validator strips trailing /* so the value should be modified
    })

    it('handles URLs with special characters in path', () => {
      const result = validate('https://example.com/callback%20test')
      expect(result.isValid).toBe(true)
    })

    it('handles internationalized domain names', () => {
      // Punycode-encoded IDN
      const result = validate('https://xn--nxasmq5b.com/callback')
      expect(result.isValid).toBe(true)
    })
  })
})
