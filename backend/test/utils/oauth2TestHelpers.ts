import crypto from 'crypto'

import { OAuth2ClientRaw } from '../../src/db/types/OAuth2'

/**
 * Generates a PKCE code verifier (43-128 characters, URL-safe)
 * Per RFC 7636 Section 4.1
 */
export function generateCodeVerifier(length = 43): string {
  if (length < 43 || length > 128) {
    throw new Error('Code verifier length must be between 43 and 128')
  }
  const buffer = crypto.randomBytes(Math.ceil((length * 3) / 4))
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, length)
}

/**
 * Generates a PKCE code challenge from a verifier using SHA-256
 * Per RFC 7636 Section 4.2
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest()
  return hash.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Verifies that a code_verifier matches a code_challenge
 */
export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computedChallenge = generateCodeChallenge(verifier)
  return computedChallenge === challenge
}

/**
 * Creates a mock public OAuth2 client (no client_secret)
 */
export function createMockPublicClient(overrides?: Partial<OAuth2ClientRaw>): OAuth2ClientRaw {
  return {
    id: 1,
    name: 'Test Public App',
    description: 'A test public application',
    client_id: 'test-public-client-id',
    client_secret_hash: '',
    client_type: 'public',
    redirect_uris: 'myapp://callback',
    grants: 'authorization_code,refresh_token',
    user_id: 1,
    logo_url: '',
    initial_authorization_url: '',
    ...overrides,
  }
}

/**
 * Creates a mock confidential OAuth2 client (with client_secret)
 */
export function createMockConfidentialClient(overrides?: Partial<OAuth2ClientRaw>): OAuth2ClientRaw {
  const secretHash = crypto.createHash('sha256').update('test-secret').digest('hex')
  return {
    id: 2,
    name: 'Test Confidential App',
    description: 'A test confidential application',
    client_id: 'test-confidential-client-id',
    client_secret_hash: secretHash,
    client_type: 'confidential',
    redirect_uris: 'https://example.com/callback',
    grants: 'authorization_code,refresh_token',
    user_id: 1,
    logo_url: '',
    initial_authorization_url: '',
    ...overrides,
  }
}

/**
 * Creates a mock Redis client for testing
 */
export function createMockRedisClient() {
  const store = new Map<string, string>()
  const expiries = new Map<string, number>()

  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key) || null)),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value)
      return Promise.resolve('OK')
    }),
    del: jest.fn((key: string) => {
      const existed = store.has(key)
      store.delete(key)
      expiries.delete(key)
      return Promise.resolve(existed ? 1 : 0)
    }),
    expire: jest.fn((key: string, seconds: number) => {
      if (store.has(key)) {
        expiries.set(key, Date.now() + seconds * 1000)
        return Promise.resolve(1)
      }
      return Promise.resolve(0)
    }),
    // Test helpers
    _store: store,
    _expiries: expiries,
    _clear: () => {
      store.clear()
      expiries.clear()
    },
  }
}

/**
 * Creates a mock logger for testing
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}

/**
 * Creates a mock OAuth2Repository for testing
 */
export function createMockOAuth2Repository() {
  return {
    getClientByClientId: jest.fn(),
    getClientByClientIdWithConsent: jest.fn(),
    getClients: jest.fn(),
    getNumberOfClientsCreatedByUser: jest.fn().mockResolvedValue(0),
    createClient: jest.fn(),
    updateClientSecret: jest.fn(),
    deleteClient: jest.fn(),
    saveOrUpdateConsent: jest.fn().mockResolvedValue(true),
    resetConsentScope: jest.fn(),
    updateConsentLastRevokeDate: jest.fn(),
    updateClientLogoUrl: jest.fn(),
    hasOwnApps: jest.fn(),
    editClient: jest.fn(),
    getClientsByClientIds: jest.fn(),
  }
}

/**
 * Hash a string using SHA-256 (matches AuthorizationCodeModelImpl.hashString)
 */
export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}
