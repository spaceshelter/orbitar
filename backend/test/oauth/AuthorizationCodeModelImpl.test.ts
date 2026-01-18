import { AuthorizationCode } from '@node-oauth/oauth2-server'

import AuthorizationCodeModelImpl from '../../src/oauth/AuthorizationCodeModelImpl'
import {
  createMockConfidentialClient,
  createMockLogger,
  createMockOAuth2Repository,
  createMockPublicClient,
  createMockRedisClient,
  generateCodeChallenge,
  generateCodeVerifier,
  hashString,
} from '../utils/oauth2TestHelpers'

// Mock the ExpressOauth2ScopesFilter
const createMockScopesFilter = () => ({
  minimizeAndFilterScopes: jest.fn((scopes: string[]) => scopes),
  filterScopes: jest.fn((scopes: string[]) => scopes),
  getAllScopes: jest.fn(() => ['user', 'user:profile']),
  getAllScopesSet: jest.fn(() => new Set(['user', 'user:profile'])),
})

describe('AuthorizationCodeModelImpl', () => {
  let model: AuthorizationCodeModelImpl
  let mockRepo: ReturnType<typeof createMockOAuth2Repository>
  let mockRedis: ReturnType<typeof createMockRedisClient>
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockScopesFilter: ReturnType<typeof createMockScopesFilter>

  const testConfig = {
    authorizationCodeTtlSeconds: 600,
    accessTokenTtlSeconds: 1800,
    refreshTokenTtlSeconds: 86400,
    maxNumberOfClientsPerDeveloper: 10,
  }

  beforeEach(() => {
    mockRepo = createMockOAuth2Repository()
    mockRedis = createMockRedisClient()
    mockLogger = createMockLogger()
    mockScopesFilter = createMockScopesFilter()

    model = new AuthorizationCodeModelImpl(
      mockRepo as any,
      mockRedis as any,
      mockScopesFilter as any,
      testConfig,
      mockLogger as any,
    )
  })

  afterEach(() => {
    mockRedis._clear()
    jest.clearAllMocks()
  })

  describe('getClient', () => {
    describe('public clients', () => {
      it('returns client when no secret provided', async () => {
        mockRepo.getClientByClientId.mockResolvedValue(createMockPublicClient())

        const result = await model.getClient('test-public-client-id')

        expect(result).not.toBeNull()
        expect(result).not.toBe(false)
        if (result) {
          expect(result.id).toBe('test-public-client-id')
          expect(result.grants).toEqual(['authorization_code', 'refresh_token'])
        }
      })

      it('returns client when empty string secret provided', async () => {
        mockRepo.getClientByClientId.mockResolvedValue(createMockPublicClient())

        const result = await model.getClient('test-public-client-id', '')

        // Empty string is falsy, so this should work
        expect(result).not.toBeNull()
      })

      it('returns null when secret IS provided (public clients cannot use secrets)', async () => {
        mockRepo.getClientByClientId.mockResolvedValue(createMockPublicClient())

        const result = await model.getClient('test-public-client-id', 'any-secret')

        expect(result).toBeNull()
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Public client attempted authentication with client_secret (not allowed)',
          { clientId: 'test-public-client-id' },
        )
      })

      it('parses redirect URIs correctly', async () => {
        mockRepo.getClientByClientId.mockResolvedValue(
          createMockPublicClient({
            redirect_uris: 'myapp://callback, https://example.com/callback',
          }),
        )

        const result = await model.getClient('test-public-client-id')

        expect(result).toBeTruthy()
        if (result) {
          expect(result.redirectUris).toEqual(['myapp://callback', 'https://example.com/callback'])
        }
      })
    })

    describe('confidential clients', () => {
      it('returns client when correct secret provided', async () => {
        mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

        const result = await model.getClient('test-confidential-client-id', 'test-secret')

        expect(result).toBeTruthy()
        if (result) {
          expect(result.id).toBe('test-confidential-client-id')
        }
      })

      it('returns null when wrong secret provided', async () => {
        mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

        const result = await model.getClient('test-confidential-client-id', 'wrong-secret')

        expect(result).toBeNull()
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Confidential client authentication failed: invalid client_secret',
          { clientId: 'test-confidential-client-id' },
        )
      })

      it('returns client when no secret provided (authorization phase)', async () => {
        // During the authorization phase, client_secret is not required
        mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

        const result = await model.getClient('test-confidential-client-id')

        expect(result).toBeTruthy()
        if (result) {
          expect(result.id).toBe('test-confidential-client-id')
        }
      })

      it('returns client when no secret provided (PKCE flow)', async () => {
        // Confidential clients using PKCE may not provide client_secret
        mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

        const result = await model.getClient('test-confidential-client-id', undefined)

        expect(result).not.toBeNull()
      })
    })

    it('returns null for non-existent client', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(undefined)

      const result = await model.getClient('non-existent-client-id')

      expect(result).toBeNull()
    })

    it('returns null for null client', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(null)

      const result = await model.getClient('non-existent-client-id')

      expect(result).toBeNull()
    })
  })

  describe('saveAuthorizationCode', () => {
    const baseCode: AuthorizationCode = {
      authorizationCode: 'test-auth-code-123',
      expiresAt: new Date(Date.now() + 600000),
      redirectUri: 'https://example.com/callback',
      scope: ['user'],
      client: { id: 'test-client-id', grants: ['authorization_code'] },
      user: { id: 1 },
    }

    it('stores authorization code in Redis', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

      await model.saveAuthorizationCode(baseCode, baseCode.client, baseCode.user)

      expect(mockRedis.set).toHaveBeenCalled()
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'oauth2code:test-auth-code-123',
        testConfig.authorizationCodeTtlSeconds,
      )
    })

    it('stores PKCE data when provided', async () => {
      const verifier = generateCodeVerifier()
      const challenge = generateCodeChallenge(verifier)
      mockRepo.getClientByClientId.mockResolvedValue(createMockPublicClient())

      const codeWithPKCE: AuthorizationCode = {
        ...baseCode,
        client: { id: 'test-public-client-id', grants: ['authorization_code'] },
        redirectUri: 'myapp://callback',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      }

      await model.saveAuthorizationCode(codeWithPKCE, codeWithPKCE.client, codeWithPKCE.user)

      expect(mockRedis.set).toHaveBeenCalled()
      const storedValue = JSON.parse(mockRedis.set.mock.calls[0][1])
      expect(storedValue.codeChallenge).toBe(challenge)
      expect(storedValue.codeChallengeMethod).toBe('S256')
    })

    it('omits PKCE data when not provided', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

      await model.saveAuthorizationCode(baseCode, baseCode.client, baseCode.user)

      const storedValue = JSON.parse(mockRedis.set.mock.calls[0][1])
      expect(storedValue.codeChallenge).toBeUndefined()
      expect(storedValue.codeChallengeMethod).toBeUndefined()
    })

    it('returns null if client does not exist', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(undefined)

      const result = await model.saveAuthorizationCode(baseCode, baseCode.client, baseCode.user)

      expect(result).toBeNull()
      expect(mockRedis.set).not.toHaveBeenCalled()
    })

    // Note: saveOrUpdateConsent is called in generateAuthorizationCode, not saveAuthorizationCode
    // This test verifies the code storage behavior only
  })

  describe('getAuthorizationCode', () => {
    it('retrieves code from Redis', async () => {
      const storedCode = {
        authorizationCode: 'test-code',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        redirectUri: 'https://example.com/callback',
        scope: ['user'],
        client: { id: 'test-client-id', grants: ['authorization_code', 'refresh_token'] },
        user: { id: 1 },
      }
      mockRedis._store.set('oauth2code:test-code', JSON.stringify(storedCode))

      const result = await model.getAuthorizationCode('test-code')

      expect(result).not.toBeNull()
      expect(result!.authorizationCode).toBe('test-code')
    })

    it('retrieves code with PKCE data intact', async () => {
      const challenge = generateCodeChallenge(generateCodeVerifier())
      const storedCode = {
        authorizationCode: 'test-pkce-code',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        redirectUri: 'myapp://callback',
        scope: ['user'],
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
        client: { id: 'test-public-client-id', grants: ['authorization_code', 'refresh_token'] },
        user: { id: 1 },
      }
      mockRedis._store.set('oauth2code:test-pkce-code', JSON.stringify(storedCode))

      const result = await model.getAuthorizationCode('test-pkce-code')

      expect(result!.codeChallenge).toBe(challenge)
      expect(result!.codeChallengeMethod).toBe('S256')
    })

    it('converts expiresAt string back to Date object', async () => {
      const expiresAt = new Date(Date.now() + 60000)
      const storedCode = {
        authorizationCode: 'test-code',
        expiresAt: expiresAt.toISOString(),
        redirectUri: 'https://example.com/callback',
        scope: ['user'],
        client: { id: 'test-client-id', grants: ['authorization_code'] },
        user: { id: 1 },
      }
      mockRedis._store.set('oauth2code:test-code', JSON.stringify(storedCode))

      const result = await model.getAuthorizationCode('test-code')

      expect(result!.expiresAt).toBeInstanceOf(Date)
    })

    it('converts grants string to array when needed', async () => {
      const storedCode = {
        authorizationCode: 'test-code',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        redirectUri: 'https://example.com/callback',
        scope: ['user'],
        client: { id: 'test-client-id', grants: 'authorization_code,refresh_token' }, // String, not array
        user: { id: 1 },
      }
      mockRedis._store.set('oauth2code:test-code', JSON.stringify(storedCode))
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

      const result = await model.getAuthorizationCode('test-code')

      expect(Array.isArray(result!.client.grants)).toBe(true)
      expect(result!.client.grants).toContain('authorization_code')
      expect(result!.client.grants).toContain('refresh_token')
    })

    it('returns null for non-existent code', async () => {
      const result = await model.getAuthorizationCode('non-existent-code')

      expect(result).toBeNull()
    })

    it('returns null and revokes expired codes', async () => {
      const storedCode = {
        authorizationCode: 'expired-code',
        expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired
        redirectUri: 'https://example.com/callback',
        scope: ['user'],
        client: { id: 'test-client-id', grants: ['authorization_code'] },
        user: { id: 1 },
      }
      mockRedis._store.set('oauth2code:expired-code', JSON.stringify(storedCode))

      const result = await model.getAuthorizationCode('expired-code')

      expect(result).toBeNull()
      expect(mockRedis.del).toHaveBeenCalledWith('oauth2code:expired-code')
    })

    it('returns null for invalid JSON', async () => {
      mockRedis._store.set('oauth2code:bad-code', 'not valid json')

      const result = await model.getAuthorizationCode('bad-code')

      expect(result).toBeNull()
    })
  })

  describe('revokeAuthorizationCode', () => {
    it('deletes code from Redis', async () => {
      const code: AuthorizationCode = {
        authorizationCode: 'code-to-revoke',
        expiresAt: new Date(),
        redirectUri: 'https://example.com/callback',
        scope: ['user'],
        client: { id: 'test-client-id', grants: ['authorization_code'] },
        user: { id: 1 },
      }

      const result = await model.revokeAuthorizationCode(code)

      expect(result).toBe(true)
      expect(mockRedis.del).toHaveBeenCalledWith('oauth2code:code-to-revoke')
    })
  })

  describe('static methods', () => {
    describe('generateClientId', () => {
      it('generates a UUID', () => {
        const clientId = AuthorizationCodeModelImpl.generateClientId()
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        expect(clientId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      })

      it('generates unique values', () => {
        const ids = new Set<string>()
        for (let i = 0; i < 100; i++) {
          ids.add(AuthorizationCodeModelImpl.generateClientId())
        }
        expect(ids.size).toBe(100)
      })
    })

    describe('generateClientSecret', () => {
      it('generates a 64-character hex string', () => {
        const secret = AuthorizationCodeModelImpl.generateClientSecret()
        expect(secret).toMatch(/^[0-9a-f]{64}$/i)
      })

      it('generates unique values', () => {
        const secrets = new Set<string>()
        for (let i = 0; i < 100; i++) {
          secrets.add(AuthorizationCodeModelImpl.generateClientSecret())
        }
        expect(secrets.size).toBe(100)
      })
    })

    describe('hashString', () => {
      it('produces consistent SHA-256 hash', () => {
        const hash1 = AuthorizationCodeModelImpl.hashString('test-value')
        const hash2 = AuthorizationCodeModelImpl.hashString('test-value')
        expect(hash1).toBe(hash2)
      })

      it('produces different hashes for different inputs', () => {
        const hash1 = AuthorizationCodeModelImpl.hashString('value1')
        const hash2 = AuthorizationCodeModelImpl.hashString('value2')
        expect(hash1).not.toBe(hash2)
      })

      it('produces 64-character hex string', () => {
        const hash = AuthorizationCodeModelImpl.hashString('test')
        expect(hash).toMatch(/^[0-9a-f]{64}$/i)
      })

      it('matches our test helper hashString', () => {
        const value = 'test-secret'
        expect(AuthorizationCodeModelImpl.hashString(value)).toBe(hashString(value))
      })
    })
  })
})
