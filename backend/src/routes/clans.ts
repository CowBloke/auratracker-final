import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';

const router = Router();

const CLAN_CREATE_COST = 100;
const CLAN_MAX_MEMBERS = 5;

const clanMemberUserSelect = {
  id: true,
  username: true,
  aura: true,
  usernameColor: true,
  profilePicture: true,
};

type ClanWithMembers = Prisma.ClanGetPayload<{
  include: {
    members: {
      include: {
        user: {
          select: typeof clanMemberUserSelect;
        };
      };
    };
    owner: {
      select: {
        id: true;
        username: true;
        usernameColor: true;
        profilePicture: true;
      };
    };
  };
}>;

const mapClanSummary = (clan: ClanWithMembers) => {
  const totalAura = clan.members.reduce((sum, member) => sum + member.user.aura, BigInt(0));
  return {
    id: clan.id,
    name: clan.name,
    description: clan.description,
    imageUrl: clan.imageUrl,
    isPublic: clan.isPublic,
    maxMembers: clan.maxMembers,
    memberCount: clan.members.length,
    totalAura,
    createdAt: clan.createdAt,
    leader: clan.owner,
  };
};

// Get all clans
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const clans = await prisma.clan.findMany({
      include: {
        members: {
          include: {
            user: {
              select: clanMemberUserSelect,
            },
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ clans: clans.map(mapClanSummary) });
  } catch (error) {
    console.error('Get clans error:', error);
    res.status(500).json({ error: 'Failed to get clans' });
  }
});

// Get clan detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const clan = await prisma.clan.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: clanMemberUserSelect,
            },
          },
          orderBy: {
            user: { aura: 'desc' },
          },
        },
        owner: {
          select: {
            id: true,
            username: true,
            usernameColor: true,
            profilePicture: true,
          },
        },
        joinRequests: {
          include: {
            user: {
              select: clanMemberUserSelect,
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const summary = mapClanSummary(clan);
    const members = clan.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      username: member.user.username,
      usernameColor: member.user.usernameColor,
      aura: member.user.aura,
      profilePicture: member.user.profilePicture,
      joinedAt: member.joinedAt,
      isLeader: member.isLeader,
    }));

    const isMember = clan.members.some((member) => member.userId === userId);
    const isLeader = clan.members.some((member) => member.userId === userId && member.isLeader);

    const pendingRequest = userId
      ? await prisma.clanJoinRequest.findUnique({
          where: {
            clanId_userId: {
              clanId: clan.id,
              userId,
            },
          },
          select: { id: true },
        })
      : null;

    const joinRequests = isLeader
      ? clan.joinRequests.map((request) => ({
          id: request.id,
          userId: request.userId,
          username: request.user.username,
          usernameColor: request.user.usernameColor,
          aura: request.user.aura,
          profilePicture: request.user.profilePicture,
          requestedAt: request.createdAt,
        }))
      : [];

    res.json({
      clan: {
        ...summary,
        members,
        joinRequests,
        viewer: {
          isMember,
          isLeader,
          hasPendingRequest: Boolean(pendingRequest),
        },
      },
    });
  } catch (error) {
    console.error('Get clan error:', error);
    res.status(500).json({ error: 'Failed to get clan' });
  }
});

// Create a clan
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const rawName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const imageUrl = typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '';
    const isPublic = req.body.isPublic !== false;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (rawName.length < 3 || rawName.length > 32) {
      return res.status(400).json({ error: 'Nom de clan invalide (3-32 caracteres).' });
    }

    if (description.length > 300) {
      return res.status(400).json({ error: 'Description trop longue (max 300 caracteres).' });
    }

    const clan = await prisma.$transaction(async (tx) => {
      const [user, existingMembership] = await Promise.all([
        tx.user.findUnique({
          where: { id: userId },
          select: { money: true },
        }),
        tx.clanMember.findUnique({
          where: { userId },
          select: { id: true },
        }),
      ]);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (existingMembership) {
        throw new Error('ALREADY_IN_CLAN');
      }

      if (user.money < CLAN_CREATE_COST) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const created = await tx.clan.create({
        data: {
          name: rawName,
          description: description || null,
          imageUrl: imageUrl || null,
          isPublic,
          maxMembers: CLAN_MAX_MEMBERS,
          ownerId: userId,
          members: {
            create: {
              userId,
              isLeader: true,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: clanMemberUserSelect,
              },
            },
          },
          owner: {
            select: {
              id: true,
              username: true,
              usernameColor: true,
              profilePicture: true,
            },
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          money: { decrement: CLAN_CREATE_COST },
        },
      });

      return created;
    });

    res.json({ clan: mapClanSummary(clan) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'ALREADY_IN_CLAN') {
        return res.status(400).json({ error: 'Tu es deja dans un clan.' });
      }
      if (error.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'Pas assez d\'argent pour creer un clan.' });
      }
    }
    console.error('Create clan error:', error);
    res.status(500).json({ error: 'Failed to create clan' });
  }
});

// Join or request to join a clan
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: {
        id: true,
        isPublic: true,
        maxMembers: true,
      },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const existingMembership = await prisma.clanMember.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'Tu es deja dans un clan.' });
    }

    const memberCount = await prisma.clanMember.count({
      where: { clanId: clan.id },
    });

    if (memberCount >= clan.maxMembers) {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }

    if (clan.isPublic) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.clanMember.create({
          data: {
            clanId: clan.id,
            userId,
            isLeader: false,
          },
        });

        await tx.clanJoinRequest.deleteMany({
          where: { clanId: clan.id, userId },
        });

        return { status: 'joined' as const };
      });

      return res.json(result);
    }

    const request = await prisma.clanJoinRequest.create({
      data: {
        clanId: clan.id,
        userId,
      },
    });

    // Notify clan leader about the join request
    const [clanDetail, requester] = await Promise.all([
      prisma.clan.findUnique({ where: { id }, select: { name: true, ownerId: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
    ]);
    if (clanDetail && requester) {
      createNotification({
        userId: clanDetail.ownerId,
        type: 'CLAN_JOIN_REQUEST',
        title: 'Demande d\'adhésion',
        body: `${requester.username} souhaite rejoindre ${clanDetail.name}.`,
        data: { requesterId: userId, requesterUsername: requester.username, clanId: id, requestId: request.id },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ status: 'requested', requestId: request.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'CLAN_FULL') {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Demande deja envoyee.' });
    }
    console.error('Join clan error:', error);
    res.status(500).json({ error: 'Failed to join clan' });
  }
});

// Accept a join request (leader only)
router.post('/:id/requests/:requestId/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut accepter.' });
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: { maxMembers: true },
    });

    if (!clan) {
      return res.status(404).json({ error: 'Clan not found' });
    }

    const request = await prisma.clanJoinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clanId: true, userId: true },
    });

    if (!request || request.clanId !== id) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    await prisma.$transaction(async (tx) => {
      const memberCount = await tx.clanMember.count({
        where: { clanId: id },
      });
      if (memberCount >= clan.maxMembers) {
        throw new Error('CLAN_FULL');
      }

      await tx.clanMember.create({
        data: {
          clanId: id,
          userId: request.userId,
          isLeader: false,
        },
      });

      await tx.clanJoinRequest.delete({
        where: { id: request.id },
      });
    });

    // Notify the accepted user
    const clanInfo = await prisma.clan.findUnique({ where: { id }, select: { name: true } });
    if (clanInfo) {
      createNotification({
        userId: request.userId,
        type: 'CLAN_JOIN_ACCEPTED',
        title: 'Demande acceptée !',
        body: `Vous avez rejoint le clan ${clanInfo.name}.`,
        data: { clanId: id, clanName: clanInfo.name },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'CLAN_FULL') {
      return res.status(400).json({ error: 'Ce clan est complet.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(400).json({ error: 'Ce joueur est deja dans un clan.' });
    }
    console.error('Accept clan request error:', error);
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// Reject a join request (leader only)
router.post('/:id/requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, requestId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut refuser.' });
    }

    const request = await prisma.clanJoinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, clanId: true, userId: true },
    });

    if (!request || request.clanId !== id) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }

    await prisma.clanJoinRequest.delete({
      where: { id: request.id },
    });

    // Notify the rejected user
    const clanInfo = await prisma.clan.findUnique({ where: { id }, select: { name: true } });
    if (clanInfo) {
      createNotification({
        userId: request.userId,
        type: 'CLAN_JOIN_REJECTED',
        title: 'Demande refusée',
        body: `Votre demande pour rejoindre ${clanInfo.name} a été refusée.`,
        data: { clanId: id, clanName: clanInfo.name },
        link: '/clans',
        icon: 'users',
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reject clan request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Leave a clan
router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the member
    const member = await prisma.clanMember.findUnique({
      where: {
        clanId_userId: {
          clanId: id,
          userId,
        },
      },
      select: {
        id: true,
        isLeader: true,
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Tu n\'es pas membre de ce clan.' });
    }

    await prisma.$transaction(async (tx) => {
      // If the member is the leader, handle leadership transfer or clan deletion
      if (member.isLeader) {
        const remainingMembers = await tx.clanMember.findMany({
          where: {
            clanId: id,
            userId: { not: userId },
          },
          include: {
            user: {
              select: {
                id: true,
                aura: true,
              },
            },
          },
          orderBy: {
            user: { aura: 'desc' },
          },
        });

        // If there are remaining members, transfer leadership to the one with highest aura
        if (remainingMembers.length > 0) {
          const newLeader = remainingMembers[0];
          await tx.clanMember.update({
            where: { id: newLeader.id },
            data: { isLeader: true },
          });
          // Update clan owner
          await tx.clan.update({
            where: { id },
            data: { ownerId: newLeader.userId },
          });
        } else {
          // If no remaining members, delete the clan
          await tx.clan.delete({
            where: { id },
          });
          // The member will be deleted by cascade
          return;
        }
      }

      // Remove the member
      await tx.clanMember.delete({
        where: { id: member.id },
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Leave clan error:', error);
    res.status(500).json({ error: 'Failed to leave clan' });
  }
});

// Remove a member from the clan (leader only)
router.delete('/:id/members/:targetUserId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id, targetUserId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the requester is a clan leader
    const leader = await prisma.clanMember.findFirst({
      where: {
        clanId: id,
        userId,
        isLeader: true,
      },
      select: { id: true },
    });

    if (!leader) {
      return res.status(403).json({ error: 'Seul le chef peut retirer des membres.' });
    }

    // Prevent self-removal (leaders should leave voluntarily)
    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Tu ne peux pas te retirer toi-meme. Quitte le clan a la place.' });
    }

    // Find the member to remove
    const member = await prisma.clanMember.findUnique({
      where: {
        clanId_userId: {
          clanId: id,
          userId: targetUserId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Membre introuvable dans ce clan.' });
    }

    // Remove the member
    await prisma.clanMember.delete({
      where: { id: member.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove clan member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
