import { generateCodeChallenge, generateCodeVerifier, verifyCodeChallenge } from '../utils/oauth2TestHelpers'

describe('PKCE Utils', () => {
  describe('generateCodeVerifier', () => {
    it('generates a string of default length 43', () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBe(43)
    })

    it('generates a string of specified length', () => {
      const verifier = generateCodeVerifier(64)
      expect(verifier.length).toBe(64)
    })

    it('generates a string of maximum length 128', () => {
      const verifier = generateCodeVerifier(128)
      expect(verifier.length).toBe(128)
    })

    it('throws for length less than 43', () => {
      expect(() => generateCodeVerifier(42)).toThrow('Code verifier length must be between 43 and 128')
    })

    it('throws for length greater than 128', () => {
      expect(() => generateCodeVerifier(129)).toThrow('Code verifier length must be between 43 and 128')
    })

    it('uses only URL-safe characters [A-Za-z0-9-_]', () => {
      const verifier = generateCodeVerifier()
      // URL-safe base64 characters only (no +, /, or =)
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('generates unique values on each call', () => {
      const verifiers = new Set<string>()
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier())
      }
      // All 100 should be unique
      expect(verifiers.size).toBe(100)
    })
  })

  describe('generateCodeChallenge', () => {
    it('generates base64url-encoded string', () => {
      const verifier = generateCodeVerifier()
      const challenge = generateCodeChallenge(verifier)
      // Should be URL-safe base64 (no +, /, or =)
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('produces consistent output for same input', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      const challenge1 = generateCodeChallenge(verifier)
      const challenge2 = generateCodeChallenge(verifier)
      expect(challenge1).toBe(challenge2)
    })

    it('produces different output for different input', () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()
      const challenge1 = generateCodeChallenge(verifier1)
      const challenge2 = generateCodeChallenge(verifier2)
      expect(challenge1).not.toBe(challenge2)
    })

    // RFC 7636 Appendix B test vector
    it('matches RFC 7636 Appendix B test vector', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      const challenge = generateCodeChallenge(verifier)
      expect(challenge).toBe(expectedChallenge)
    })

    it('generates challenge of expected length (~43 chars for SHA-256)', () => {
      const verifier = generateCodeVerifier()
      const challenge = generateCodeChallenge(verifier)
      // SHA-256 = 32 bytes = 43 base64 chars (without padding)
      expect(challenge.length).toBe(43)
    })
  })

  describe('verifyCodeChallenge', () => {
    it('returns true for matching verifier/challenge pair', () => {
      const verifier = generateCodeVerifier()
      const challenge = generateCodeChallenge(verifier)
      expect(verifyCodeChallenge(verifier, challenge)).toBe(true)
    })

    it('returns false for mismatched verifier/challenge pair', () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()
      const challenge = generateCodeChallenge(verifier1)
      expect(verifyCodeChallenge(verifier2, challenge)).toBe(false)
    })

    it('returns false for tampered challenge', () => {
      const verifier = generateCodeVerifier()
      const challenge = generateCodeChallenge(verifier)
      const tamperedChallenge = challenge.slice(0, -1) + 'X'
      expect(verifyCodeChallenge(verifier, tamperedChallenge)).toBe(false)
    })

    it('verifies RFC 7636 test vector', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      expect(verifyCodeChallenge(verifier, challenge)).toBe(true)
    })
  })
})
