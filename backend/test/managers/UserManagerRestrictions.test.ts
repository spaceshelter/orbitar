import { UserRestrictions } from '../../src/managers/types/UserInfo'
import UserManager from '../../src/managers/UserManager'

const restrictions = (effectiveKarma: number): UserRestrictions => ({
  effectiveKarma,
  senatePenalty: 0,
  postSlowModeWaitSec: 0,
  postSlowModeWaitSecRemain: 0,
  commentSlowModeWaitSec: 0,
  commentSlowModeWaitSecRemain: 0,
  restrictedToPostId: false,
  canVote: true,
  canVoteKarma: true,
  canInvite: true,
  canCreateSubsites: true,
  canEditOwnContent: true,
  canCreatePolls: true,
  editSlowModeEnabled: false,
})

describe('UserManager restriction isolation', () => {
  test('the enforcing method preserves low-karma vote cleanup', async () => {
    const manager = Object.create(UserManager.prototype) as UserManager
    manager.getUserRestrictionsSnapshot = jest.fn().mockResolvedValue(restrictions(-11))
    manager.removeVotesWhenKarmaIsLow = jest.fn().mockResolvedValue(undefined)

    await expect(manager.getUserRestrictions(42)).resolves.toMatchObject({ effectiveKarma: -11 })

    expect(manager.getUserRestrictionsSnapshot).toHaveBeenCalledWith(42)
    expect(manager.removeVotesWhenKarmaIsLow).toHaveBeenCalledWith(42)
  })

  test('the enforcing method skips cleanup when the snapshot is not restricted', async () => {
    const manager = Object.create(UserManager.prototype) as UserManager
    manager.getUserRestrictionsSnapshot = jest.fn().mockResolvedValue(restrictions(10))
    manager.removeVotesWhenKarmaIsLow = jest.fn().mockResolvedValue(undefined)

    await manager.getUserRestrictions(42)

    expect(manager.removeVotesWhenKarmaIsLow).not.toHaveBeenCalled()
  })
})
