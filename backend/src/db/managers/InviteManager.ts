import {InviteRawWithIssuer} from '../types/InviteRaw';
import InviteRepository from '../repositories/InviteRepository';

export default class InviteManager {
    private inviteRepository: InviteRepository;

    constructor(inviteRepository: InviteRepository) {
        this.inviteRepository = inviteRepository;
    }

    async get(code: string): Promise<InviteRawWithIssuer | undefined> {
        return await this.inviteRepository.getInviteWithIssuer(code);
    }
}
