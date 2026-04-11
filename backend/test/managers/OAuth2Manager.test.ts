import OAuth2Manager from '../../src/managers/OAuth2Manager'
import {
  createMockConfidentialClient,
  createMockLogger,
  createMockOAuth2Repository,
  createMockPublicClient,
} from '../utils/oauth2TestHelpers'

// Mock the config
jest.mock('../../src/config', () => ({
  config: {
    oauth: {
      maxNumberOfClientsPerDeveloper: 10,
    },
  },
}))

// Mock UserManager
const createMockUserManager = () => ({
  getById: jest.fn().mockResolvedValue({
    id: 1,
    username: 'testuser',
    gender: 'unknown',
  }),
})

describe('OAuth2Manager', () => {
  let manager: OAuth2Manager
  let mockRepo: ReturnType<typeof createMockOAuth2Repository>
  let mockUserManager: ReturnType<typeof createMockUserManager>
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockRepo = createMockOAuth2Repository()
    mockUserManager = createMockUserManager()
    mockLogger = createMockLogger()

    manager = new OAuth2Manager(mockRepo as any, mockUserManager as any, mockLogger as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('registerClient', () => {
    describe('public clients', () => {
      it('creates public client without client_secret', async () => {
        mockRepo.createClient.mockImplementation(async (...args) => ({
          name: args[0],
          description: args[1],
          logo_url: args[2],
          initial_authorization_url: args[3],
          client_id: args[4],
          client_secret_hash: args[5],
          redirect_uris: args[6],
          user_id: args[7],
          client_type: args[8],
          grants: 'authorization_code,refresh_token',
        }))

        const result = await manager.registerClient(
          'Test Public App',
          'A test application',
          '',
          '',
          'myapp://callback',
          1,
          'public',
        )

        expect(result.client_secret_original).toBeUndefined()
        expect(result.client_type).toBe('public')
      })

      it('stores empty client_secret_hash for public clients', async () => {
        mockRepo.createClient.mockImplementation(async (...args) => ({
          client_id: args[4],
          client_secret_hash: args[5],
          client_type: args[8],
          grants: 'authorization_code,refresh_token',
        }))

        await manager.registerClient('Test App', 'Description', '', '', 'myapp://callback', 1, 'public')

        expect(mockRepo.createClient).toHaveBeenCalledWith(
          'Test App',
          'Description',
          '',
          '',
          expect.any(String), // clientId (UUID)
          '', // Empty secret hash for public clients
          'myapp://callback',
          1,
          'public',
        )
      })
    })

    describe('confidential clients', () => {
      it('creates confidential client with client_secret', async () => {
        mockRepo.createClient.mockImplementation(async (...args) => ({
          name: args[0],
          description: args[1],
          logo_url: args[2],
          initial_authorization_url: args[3],
          client_id: args[4],
          client_secret_hash: args[5],
          redirect_uris: args[6],
          user_id: args[7],
          client_type: args[8],
          grants: 'authorization_code,refresh_token',
        }))

        const result = await manager.registerClient(
          'Test Confidential App',
          'A test application',
          '',
          '',
          'https://example.com/callback',
          1,
          'confidential',
        )

        expect(result.client_secret_original).toBeDefined()
        expect(result.client_secret_original!.length).toBe(64) // 32 bytes hex = 64 chars
        expect(result.client_type).toBe('confidential')
      })

      it('stores non-empty client_secret_hash for confidential clients', async () => {
        mockRepo.createClient.mockImplementation(async (...args) => ({
          client_id: args[4],
          client_secret_hash: args[5],
          client_type: args[8],
          grants: 'authorization_code,refresh_token',
        }))

        await manager.registerClient(
          'Test App',
          'Description',
          '',
          '',
          'https://example.com/callback',
          1,
          'confidential',
        )

        expect(mockRepo.createClient).toHaveBeenCalledWith(
          'Test App',
          'Description',
          '',
          '',
          expect.any(String), // clientId (UUID)
          expect.stringMatching(/^[0-9a-f]{64}$/i), // Non-empty SHA-256 hash
          'https://example.com/callback',
          1,
          'confidential',
        )
      })
    })

    it('enforces max clients per user limit', async () => {
      mockRepo.getNumberOfClientsCreatedByUser.mockResolvedValue(10) // At limit

      await expect(
        manager.registerClient('Test App', 'Description', '', '', 'https://example.com/callback', 1, 'confidential'),
      ).rejects.toBe('Too many clients already created')
    })

    it('allows creation when under the limit', async () => {
      mockRepo.getNumberOfClientsCreatedByUser.mockResolvedValue(9) // Under limit
      mockRepo.createClient.mockResolvedValue({
        client_id: 'new-client-id',
        client_type: 'confidential',
        grants: 'authorization_code,refresh_token',
      })

      const result = await manager.registerClient(
        'Test App',
        'Description',
        '',
        '',
        'https://example.com/callback',
        1,
        'confidential',
      )

      expect(result).toBeDefined()
      expect(mockRepo.createClient).toHaveBeenCalled()
    })

    it('generates unique client IDs', async () => {
      const clientIds = new Set<string>()

      mockRepo.createClient.mockImplementation(async (...args) => {
        clientIds.add(args[4]) // clientId is 5th argument
        return {
          client_id: args[4],
          client_type: args[8],
          grants: 'authorization_code,refresh_token',
        }
      })

      // Create multiple clients
      for (let i = 0; i < 10; i++) {
        await manager.registerClient(
          'App ' + i,
          'Description',
          '',
          '',
          'https://example.com/callback',
          1,
          'confidential',
        )
      }

      expect(clientIds.size).toBe(10)
    })
  })

  describe('getClientType', () => {
    it('returns "public" for public clients', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockPublicClient())

      const result = await manager.getClientType('test-public-client-id')

      expect(result).toBe('public')
    })

    it('returns "confidential" for confidential clients', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient())

      const result = await manager.getClientType('test-confidential-client-id')

      expect(result).toBe('confidential')
    })

    it('returns undefined for non-existent clients', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(undefined)

      const result = await manager.getClientType('non-existent')

      expect(result).toBeUndefined()
    })

    it('returns undefined and logs error on exception', async () => {
      mockRepo.getClientByClientId.mockRejectedValue(new Error('DB error'))

      const result = await manager.getClientType('test-client')

      expect(result).toBeUndefined()
      expect(mockLogger.error).toHaveBeenCalledWith('Error getting OAuth client type', { error: expect.any(Error) })
    })
  })

  describe('regenerateClientSecret', () => {
    it('generates new secret and updates in database', async () => {
      mockRepo.updateClientSecret.mockResolvedValue(true)

      const result = await manager.regenerateClientSecret('test-client-id', 1)

      expect(result).toBeDefined()
      expect(result!.length).toBe(64) // 32 bytes hex
      expect(mockRepo.updateClientSecret).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f]{64}$/i), // New hash
        'test-client-id',
        1,
      )
    })

    it('returns null if update fails', async () => {
      mockRepo.updateClientSecret.mockResolvedValue(false)

      const result = await manager.regenerateClientSecret('test-client-id', 1)

      expect(result).toBeNull()
    })
  })

  describe('deleteClient', () => {
    it('deletes client when owner initiates', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient({ user_id: 1 }))
      mockRepo.deleteClient.mockResolvedValue(true)

      const result = await manager.deleteClient('test-client-id', 1)

      expect(result).toBe(true)
      expect(mockRepo.deleteClient).toHaveBeenCalledWith('test-client-id', 1)
    })

    it('returns false for non-existent client', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(undefined)

      const result = await manager.deleteClient('non-existent', 1)

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting OAuth client, no such client', {
        clientId: 'non-existent',
      })
    })

    it('returns false when non-owner tries to delete', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient({ user_id: 1 }))

      const result = await manager.deleteClient('test-client-id', 999) // Different user

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error deleting OAuth client, not client owner initiated', {
        clientId: 'test-client-id',
        byUserId: 999,
        authorId: 1,
      })
      expect(mockRepo.deleteClient).not.toHaveBeenCalled()
    })
  })

  describe('getClientByClientId', () => {
    it('returns enriched client entity', async () => {
      mockRepo.getClientByClientIdWithConsent.mockResolvedValue(createMockConfidentialClient())

      const result = await manager.getClientByClientId('test-client-id', 1)

      expect(result).toBeDefined()
      expect(result!.clientId).toBe('test-confidential-client-id')
      expect(result!.clientType).toBe('confidential')
      expect(result!.author).toEqual({
        id: 1,
        username: 'testuser',
        gender: 'unknown',
      })
    })

    it('returns undefined for non-existent client', async () => {
      mockRepo.getClientByClientIdWithConsent.mockResolvedValue(undefined)

      const result = await manager.getClientByClientId('non-existent', 1)

      expect(result).toBeUndefined()
    })

    it('returns undefined if author not found', async () => {
      mockRepo.getClientByClientIdWithConsent.mockResolvedValue(createMockConfidentialClient())
      mockUserManager.getById.mockResolvedValue(undefined)

      const result = await manager.getClientByClientId('test-client-id', 1)

      expect(result).toBeUndefined()
    })

    it('includes clientType in response for public clients', async () => {
      mockRepo.getClientByClientIdWithConsent.mockResolvedValue(createMockPublicClient())

      const result = await manager.getClientByClientId('test-public-client-id', 1)

      expect(result!.clientType).toBe('public')
    })
  })

  describe('editClient', () => {
    it('edits client when owner initiates', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient({ user_id: 1 }))
      mockRepo.editClient.mockResolvedValue(true)

      const result = await manager.editClient('test-client-id', 1, 'new desc', 'https://new.uri', 'https://auth.url')

      expect(result).toBe(true)
      expect(mockRepo.editClient).toHaveBeenCalledWith(
        'test-client-id',
        1,
        'new desc',
        'https://new.uri',
        'https://auth.url',
      )
    })

    it('returns false for non-existent client', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(undefined)

      const result = await manager.editClient('non-existent', 1, 'desc', 'https://uri', '')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error editing OAuth client, no such client', {
        clientId: 'non-existent',
      })
      expect(mockRepo.editClient).not.toHaveBeenCalled()
    })

    it('returns false when non-owner tries to edit', async () => {
      mockRepo.getClientByClientId.mockResolvedValue(createMockConfidentialClient({ user_id: 1 }))

      const result = await manager.editClient('test-client-id', 999, 'hacked', 'https://evil.uri', '')

      expect(result).toBe(false)
      expect(mockLogger.error).toHaveBeenCalledWith('Error editing OAuth client, not client owner initiated', {
        clientId: 'test-client-id',
        byUserId: 999,
        authorId: 1,
      })
      expect(mockRepo.editClient).not.toHaveBeenCalled()
    })
  })

  describe('unAuthorizeClient', () => {
    it('resets consent scope and updates revoke date', async () => {
      mockRepo.resetConsentScope.mockResolvedValue(true)
      mockRepo.updateConsentLastRevokeDate.mockResolvedValue(true)

      const result = await manager.unAuthorizeClient('test-client-id', 1)

      expect(result).toBe(true)
      expect(mockRepo.resetConsentScope).toHaveBeenCalledWith('test-client-id', 1)
      expect(mockRepo.updateConsentLastRevokeDate).toHaveBeenCalledWith('test-client-id', 1)
    })
  })
})
