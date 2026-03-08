import MailManager from '../../src/managers/MailManager'

type MailManagerDependencies = ConstructorParameters<typeof MailManager>

const createMockMailRepository = () => ({
  createMail: jest.fn().mockResolvedValue(101),
  getMailsByIds: jest.fn(),
  syncPostBindings: jest.fn().mockResolvedValue(undefined),
  syncCommentBindings: jest.fn().mockResolvedValue(undefined),
})

const createMockUserManager = () => ({
  getById: jest.fn(),
  getUserIdByPublicKey: jest.fn(),
})

describe('MailManager', () => {
  let manager: MailManager
  let mailRepository: ReturnType<typeof createMockMailRepository>
  let userManager: ReturnType<typeof createMockUserManager>

  beforeEach(() => {
    mailRepository = createMockMailRepository()
    userManager = createMockUserManager()

    manager = new MailManager(
      mailRepository as unknown as MailManagerDependencies[0],
      userManager as unknown as MailManagerDependencies[1],
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('requires an existing recipient before creating mail', async () => {
    userManager.getById.mockResolvedValue(undefined)

    await expect(manager.createMail(1, 2, undefined, 2, '{"to":true}', '{"from":true}')).rejects.toThrow(
      'Recipient not found',
    )
    expect(mailRepository.createMail).not.toHaveBeenCalled()
  })

  it('resolves recipient by public key when user id is not provided', async () => {
    userManager.getUserIdByPublicKey.mockResolvedValue(2)
    userManager.getById.mockResolvedValue({ id: 2 })

    await expect(manager.createMail(1, undefined, 'recipient-public-key', 2, '{"to":true}')).resolves.toBe(101)

    expect(userManager.getUserIdByPublicKey).toHaveBeenCalledWith('recipient-public-key', 'x25519-scrypt-v1')
    expect(mailRepository.createMail).toHaveBeenCalledWith(1, 2, 2, '{"to":true}', undefined)
  })

  it('returns recipient payload to the addressee', async () => {
    mailRepository.getMailsByIds.mockResolvedValue([
      {
        mail_id: 10,
        created_at: new Date(),
        from_user_id: 1,
        to_user_id: 2,
        v: 2,
        to_payload: '{"for":"recipient"}',
        from_payload: '{"for":"sender"}',
        from_username: 'alice',
        to_username: 'bob',
      },
    ])

    await expect(manager.getMailsByIds([10], 2)).resolves.toEqual([
      {
        id: 10,
        v: 2,
        fromUserId: 1,
        toUserId: 2,
        fromUsername: 'alice',
        toUsername: 'bob',
        canDecrypt: true,
        role: 'to',
        payload: '{"for":"recipient"}',
      },
    ])
  })

  it('returns sender copy to the author when available', async () => {
    mailRepository.getMailsByIds.mockResolvedValue([
      {
        mail_id: 11,
        created_at: new Date(),
        from_user_id: 1,
        to_user_id: 2,
        v: 2,
        to_payload: '{"for":"recipient"}',
        from_payload: '{"for":"sender"}',
        from_username: 'alice',
        to_username: 'bob',
      },
    ])

    await expect(manager.getMailsByIds([11], 1)).resolves.toEqual([
      {
        id: 11,
        v: 2,
        fromUserId: 1,
        toUserId: 2,
        fromUsername: 'alice',
        toUsername: 'bob',
        canDecrypt: true,
        role: 'from',
        payload: '{"for":"sender"}',
      },
    ])
  })

  it('returns metadata without payload to other viewers', async () => {
    mailRepository.getMailsByIds.mockResolvedValue([
      {
        mail_id: 12,
        created_at: new Date(),
        from_user_id: 1,
        to_user_id: 2,
        v: 2,
        to_payload: '{"for":"recipient"}',
        from_payload: '{"for":"sender"}',
        from_username: 'alice',
        to_username: 'bob',
      },
    ])

    await expect(manager.getMailsByIds([12], 3)).resolves.toEqual([
      {
        id: 12,
        v: 2,
        fromUserId: 1,
        toUserId: 2,
        fromUsername: 'alice',
        toUsername: 'bob',
        canDecrypt: false,
        role: null,
        payload: undefined,
      },
    ])
  })

  it('marks sender copy as not decryptable when from payload is missing', async () => {
    mailRepository.getMailsByIds.mockResolvedValue([
      {
        mail_id: 13,
        created_at: new Date(),
        from_user_id: 1,
        to_user_id: 2,
        v: 2,
        to_payload: '{"for":"recipient"}',
        from_payload: undefined,
        from_username: 'alice',
        to_username: 'bob',
      },
    ])

    await expect(manager.getMailsByIds([13], 1)).resolves.toEqual([
      {
        id: 13,
        v: 2,
        fromUserId: 1,
        toUserId: 2,
        fromUsername: 'alice',
        toUsername: 'bob',
        canDecrypt: false,
        role: 'from',
        payload: undefined,
      },
    ])
  })
})
