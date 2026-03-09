import EncryptedPayloadController from '../../src/api/EncryptedPayloadController'

function createMockEncryptedPayloadManager() {
  return {
    getEncryptedPayloadsByIds: jest.fn().mockResolvedValue([
      {
        id: 10,
        v: 1,
        parserProfile: 'lite-v1',
        canDecrypt: true,
        payload: {
          ciphertext: 'ciphertext',
          iv: 'payloadIv',
          wrap: {
            role: 'recipient',
            publicKey: 'publicKey',
            publicKeyAlg: 'x25519-scrypt-v1',
            ephemeralPublicKey: 'ephemeralKey',
            iv: 'wrapIv',
            encryptedKey: 'encryptedKey',
          },
        },
      },
    ]),
  }
}

function createMockOauth() {
  return jest.fn().mockReturnValue((_req, _res, next) => next())
}

function createMockLogger() {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
  }
}

function createMockRequest(userId: number | undefined, body: Record<string, unknown> = {}) {
  return {
    session: {
      data: { userId },
    },
    body,
  } as any
}

function createMockResponse() {
  return {
    success: jest.fn(),
    error: jest.fn(),
    authRequired: jest.fn(),
  } as any
}

function createController(overrides: Record<string, any> = {}) {
  const deps = {
    encryptedPayloadManager: createMockEncryptedPayloadManager(),
    oauth: createMockOauth(),
    logger: createMockLogger(),
    ...overrides,
  }

  const controller = new EncryptedPayloadController(
    deps.encryptedPayloadManager as any,
    deps.oauth as any,
    deps.logger as any,
  )

  return { controller, ...deps }
}

describe('EncryptedPayloadController', () => {
  describe('router registration', () => {
    it('registers the batch fetch route', () => {
      const { controller } = createController()
      const routes = controller.router.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }))

      expect(routes).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: '/encrypted-payload/get', methods: ['post'] })]),
      )
    })
  })

  describe('getPayloads', () => {
    it('requires authentication', async () => {
      const { controller } = createController()
      const req = createMockRequest(undefined, { ids: [10] })
      const res = createMockResponse()

      await controller['getPayloads'](req, res)

      expect(res.authRequired).toHaveBeenCalled()
      expect(res.success).not.toHaveBeenCalled()
    })

    it('deduplicates ids and returns payloads for the current user', async () => {
      const { controller, encryptedPayloadManager } = createController()
      const req = createMockRequest(42, { ids: [10, 11, 10] })
      const res = createMockResponse()

      await controller['getPayloads'](req, res)

      expect(encryptedPayloadManager.getEncryptedPayloadsByIds).toHaveBeenCalledWith([10, 11], 42)
      expect(res.success).toHaveBeenCalledWith({
        payloads: [
          {
            id: 10,
            v: 1,
            parserProfile: 'lite-v1',
            canDecrypt: true,
            payload: {
              ciphertext: 'ciphertext',
              iv: 'payloadIv',
              wrap: {
                role: 'recipient',
                publicKey: 'publicKey',
                publicKeyAlg: 'x25519-scrypt-v1',
                ephemeralPublicKey: 'ephemeralKey',
                iv: 'wrapIv',
                encryptedKey: 'encryptedKey',
              },
            },
          },
        ],
      })
    })

    it('logs and returns 500 when the manager fails', async () => {
      const encryptedPayloadManager = createMockEncryptedPayloadManager()
      encryptedPayloadManager.getEncryptedPayloadsByIds.mockRejectedValue(new Error('db failed'))

      const { controller, logger } = createController({ encryptedPayloadManager })
      const req = createMockRequest(42, { ids: [10] })
      const res = createMockResponse()

      await controller['getPayloads'](req, res)

      expect(logger.error).toHaveBeenCalledWith('Get encrypted payloads error', {
        error: expect.any(Error),
        payloadIds: [10],
        userId: 42,
      })
      expect(res.error).toHaveBeenCalledWith('error', 'Unknown error', 500)
    })
  })
})
