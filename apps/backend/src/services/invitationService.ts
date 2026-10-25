import type { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../db/data-source';
import { ShoppingList } from '../entities/ShoppingList';
import { Invitation } from '../entities/Invitation';
import { User } from '../entities/User';
import { notifyShoppingListInvitation } from './push/notifyInvitation';

type SerializedInvitation = {
  id: string;
  shoppingListId: string;
  inviteeEmail: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

type PendingInvitationSummary = {
  id: string;
  shoppingListId: string;
  shoppingListName: string;
  inviterName: string;
  createdAt: string;
};

export class InvitationService {
  private _invitationRepository?: Repository<Invitation>;
  private _shoppingListRepository?: Repository<ShoppingList>;
  private _userRepository?: Repository<User>;

  private get invitationRepository(): Repository<Invitation> {
    if (!this._invitationRepository) {
      this._invitationRepository = AppDataSource.getRepository(Invitation);
    }
    return this._invitationRepository;
  }

  private get shoppingListRepository(): Repository<ShoppingList> {
    if (!this._shoppingListRepository) {
      this._shoppingListRepository = AppDataSource.getRepository(ShoppingList);
    }
    return this._shoppingListRepository;
  }

  private get userRepository(): Repository<User> {
    if (!this._userRepository) {
      this._userRepository = AppDataSource.getRepository(User);
    }
    return this._userRepository;
  }

  async createInvitation(
    shoppingListId: string,
    inviteeEmail: string,
    inviterUserId: string,
  ): Promise<SerializedInvitation> {
    const shoppingList = await this.shoppingListRepository
      .createQueryBuilder('shoppingList')
      .innerJoin('shoppingList.members', 'membership', 'membership.id = :userId', { userId: inviterUserId })
      .leftJoinAndSelect('shoppingList.members', 'member')
      .where('shoppingList.id = :shoppingListId', { shoppingListId })
      .getOne();

    if (!shoppingList) {
      throw new Error('List not found or you are not a member.');
    }

    const email = inviteeEmail.trim().toLowerCase();

    const existing = await this.invitationRepository.findOne({
      where: { shoppingListId, inviteeEmail: email, status: 'pending' },
    });

    if (existing) {
      throw new Error('Invitation already pending for this email.');
    }

    const inviteeUser = await this.userRepository.findOne({ where: { email } });
    const inviteeId = inviteeUser ? inviteeUser.id : null;

    const invitation = this.invitationRepository.create({
      shoppingList,
      shoppingListId,
      inviterId: inviterUserId,
      inviteeId,
      inviteeEmail: email,
      status: 'pending',
    });

    const saved = await this.invitationRepository.save(invitation);

    // Only the invitee that already has an account can be notified — see
    // ADR-0020: `inviteeId` is null until the invitee registers, and there
    // is nothing to subscribe to yet in that case.
    if (inviteeId) {
      const inviter = shoppingList.members.find(
        (member) => member.id === inviterUserId,
      );
      void notifyShoppingListInvitation({
        shoppingListId,
        shoppingListName: shoppingList.name,
        inviterName: inviter?.displayName ?? '',
        inviteeUserId: inviteeId,
      });
    }

    return this.serializeInvitation(saved);
  }

  async acceptInvitation(invitationId: string, userId: string): Promise<SerializedInvitation> {
    const invitation = await AppDataSource.transaction(async (manager) => {
      const invitationRepo = manager.getRepository(Invitation);

      // TOCTOU fix: pessimistic_write lock prevents concurrent cancel/decline from racing with accept (see ADR-0011 Consequences).
      const invitation = await invitationRepo.findOne({
        where: { id: invitationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invitation) {
        throw new Error('Invitation not found.');
      }

      if (invitation.inviteeId !== userId) {
        throw new Error('You are not the invitee of this invitation.');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is no longer pending.');
      }

      const shoppingListRepo = manager.getRepository(ShoppingList);
      const userRepo = manager.getRepository(User);

      const shoppingList = await shoppingListRepo.findOne({
        where: { id: invitation.shoppingListId },
        relations: { members: true },
      });

      if (!shoppingList) {
        throw new Error('List not found.');
      }

      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new Error('User not found.');
      }

      if (!shoppingList.members.some((member) => member.id === userId)) {
        shoppingList.members.push(user);
        await shoppingListRepo.save(shoppingList);
      }

      invitation.status = 'accepted';
      await invitationRepo.save(invitation);

      return invitation;
    });

    return this.serializeInvitation(invitation);
  }

  async declineInvitation(invitationId: string, userId: string): Promise<SerializedInvitation> {
    const invitation = await this.invitationRepository.findOne({ where: { id: invitationId } });

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.inviteeId !== userId) {
      throw new Error('You are not the invitee of this invitation.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending.');
    }

    invitation.status = 'declined';
    const saved = await this.invitationRepository.save(invitation);

    return this.serializeInvitation(saved);
  }

  async cancelInvitation(invitationId: string, inviterUserId: string): Promise<void> {
    const invitation = await this.invitationRepository.findOne({ where: { id: invitationId } });

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.inviterId !== inviterUserId) {
      throw new Error('You are not the inviter of this invitation.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is no longer pending.');
    }

    await this.invitationRepository.remove(invitation);
  }

  async listPendingForInvitee(userId: string): Promise<PendingInvitationSummary[]> {
    const invitations = await this.invitationRepository
      .createQueryBuilder('invitation')
      .innerJoinAndSelect('invitation.shoppingList', 'shoppingList')
      .leftJoinAndSelect('invitation.inviter', 'inviter')
      .where('invitation.inviteeId = :userId', { userId })
      .andWhere('invitation.status = :status', { status: 'pending' })
      .orderBy('invitation.createdAt', 'ASC')
      .getMany();

    return invitations.map((invitation) => ({
      id: invitation.id,
      shoppingListId: invitation.shoppingListId,
      shoppingListName: invitation.shoppingList.name,
      inviterName: invitation.inviter?.displayName ?? '',
      createdAt: invitation.createdAt.toISOString(),
    }));
  }

  async attachPendingInvitationsForEmail(
    user: { id: string; email: string },
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager?.getRepository(Invitation) ?? this.invitationRepository;
    const result = await repo
      .createQueryBuilder()
      .update(Invitation)
      .set({ inviteeId: user.id })
      .where('inviteeEmail = :email', { email: user.email })
      .andWhere('inviteeId IS NULL')
      .andWhere('status = :status', { status: 'pending' })
      .execute();

    return result.affected ?? 0;
  }

  private serializeInvitation(invitation: Invitation): SerializedInvitation {
    return {
      id: invitation.id,
      shoppingListId: invitation.shoppingListId,
      inviteeEmail: invitation.inviteeEmail,
      status: invitation.status,
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}

const invitationService = new InvitationService();

export { invitationService };
