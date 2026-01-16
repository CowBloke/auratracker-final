import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';
import { sendPendingPlayAgainPrompt, sendActiveGameState } from './bombparty.js';
import { logParty } from '../utils/logger.js';

interface PartyInvite {
  partyId: string;
  inviterId: string;
  inviterUsername: string;
}

interface PartyJoinRequest {
  partyId: string;
  partyName: string | null;
  userId: string;
  username: string;
  usernameColor?: string | null;
  requestedAt: number;
}

interface InviteCooldown {
  inviterId: string;
  targetUserId: string;
  expiresAt: number;
}

const partyInvites = new Map<string, PartyInvite[]>(); // userId -> invites
const partyJoinRequests = new Map<string, PartyJoinRequest[]>(); // partyId -> join requests
const userSockets = new Map<string, string>(); // userId -> socketId
const inviteCooldowns = new Map<string, InviteCooldown>(); // key: `${inviterId}:${targetUserId}` -> cooldown

// Auto-disband inactive parties (15 minutes)
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;

// Invite cooldown (5 minutes) after rejection
const INVITE_COOLDOWN = 5 * 60 * 1000;

const getPartyRoomId = (partyId: string) => `party:${partyId}`;

const getPartyMembers = async (partyId: string) => {
  const members = await prisma.partyMember.findMany({
    where: { partyId },
    select: { userId: true, isLeader: true, joinedAt: true },
    orderBy: { joinedAt: 'asc' },
  });
  const leader = members.find((m) => m.isLeader);
  return { members, leaderId: leader?.userId || null };
};

const serializePartyPayload = (party: {
  id: string;
  name: string | null;
  isPublic: boolean;
  maxSize: number;
  members: Array<{ userId: string; isLeader: boolean; user: { username: string; usernameColor?: string | null } }>;
}) => ({
  party: {
    id: party.id,
    name: party.name,
    isPublic: party.isPublic,
    maxSize: party.maxSize,
  },
  members: party.members.map((m) => ({
    userId: m.userId,
    username: m.user.username,
    usernameColor: m.user.usernameColor,
    isLeader: m.isLeader,
  })),
});

const removeJoinRequest = (partyId: string, userId: string) => {
  const requests = partyJoinRequests.get(partyId) || [];
  const updated = requests.filter((request) => request.userId !== userId);
  if (updated.length === 0) {
    partyJoinRequests.delete(partyId);
  } else {
    partyJoinRequests.set(partyId, updated);
  }
};

const clearJoinRequestsForUser = (userId: string) => {
  for (const [partyId, requests] of partyJoinRequests.entries()) {
    const updated = requests.filter((request) => request.userId !== userId);
    if (updated.length === 0) {
      partyJoinRequests.delete(partyId);
    } else if (updated.length !== requests.length) {
      partyJoinRequests.set(partyId, updated);
    }
  }
};

export const setupPartyHandlers = (socket: Socket, io: Server) => {
  // Track socket to user mapping and restore party state if user is in a party
  socket.on('party:register', async (data: { userId: string }) => {
    userSockets.set(data.userId, socket.id);

    // Check if user is already in a party and restore state
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId: data.userId },
        include: {
          party: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, username: true, usernameColor: true },
                  },
                },
              },
            },
          },
        },
      });

      if (membership) {
        // Rejoin socket to party room
        socket.join(`party:${membership.partyId}`);

        // Send party state to user
        socket.emit('party:restored', {
          party: {
            id: membership.party.id,
            name: membership.party.name,
            isPublic: membership.party.isPublic,
            maxSize: membership.party.maxSize,
          },
          members: membership.party.members.map((m) => ({
            userId: m.userId,
            username: m.user.username,
            usernameColor: m.user.usernameColor,
            isLeader: m.isLeader,
          })),
        });

        // Send any active game state or pending play again prompt to the reconnecting player
        sendActiveGameState(socket, membership.partyId, data.userId);
        sendPendingPlayAgainPrompt(socket, membership.partyId, data.userId);

        // Update party activity
        await prisma.party.update({
          where: { id: membership.partyId },
          data: { lastActivity: new Date() },
        });

        if (membership.isLeader) {
          const joinRequests = partyJoinRequests.get(membership.partyId) || [];
          if (joinRequests.length > 0) {
            socket.emit('party:join-request-list', { requests: joinRequests });
          }
        }
      }
    } catch (error) {
      console.error('Error restoring party state:', error);
    }
  });
  
  // Create party
  socket.on('party:create', async (data: { userId: string; name?: string; isPublic: boolean; maxSize?: number }) => {
    const { userId, name, isPublic, maxSize } = data;
    
    try {
      // Check if user is already in a party
      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (existingMembership) {
        socket.emit('party:error', { message: 'You are already in a party' });
        return;
      }
      
      // Get creator's username for default party name
      const creator = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });

      // Create party with user as leader
      const party = await prisma.party.create({
        data: {
          name: name || `${creator?.username || 'Unknown'}'s party`,
          isPublic,
          maxSize: Math.min(maxSize || 8, 16), // Default 8, max 16
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
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });
      
      // Join socket room for party
      socket.join(`party:${party.id}`);

      // Log party creation
      logParty('party_create', userId, creator?.username || undefined, {
        partyId: party.id,
        partyName: party.name,
        isPublic,
        maxSize: party.maxSize,
      });

      socket.emit('party:created', {
        party: {
          id: party.id,
          name: party.name,
          isPublic: party.isPublic,
          maxSize: party.maxSize,
        },
        members: party.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          isLeader: m.isLeader,
        })),
      });
    } catch (error) {
      console.error('Create party error:', error);
      socket.emit('party:error', { message: 'Failed to create party' });
    }
  });
  
  // Join party
  socket.on('party:join', async (data: { userId: string; partyId: string }) => {
    const { userId, partyId } = data;
    
    try {
      // Check if user is already in a party
      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (existingMembership) {
        socket.emit('party:error', { message: 'You are already in a party' });
        return;
      }
      
      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });
      
      if (!party) {
        socket.emit('party:error', { message: 'Party not found' });
        return;
      }
      
      if (!party.isPublic) {
        // Check for invite
        const invites = partyInvites.get(userId) || [];
        const hasInvite = invites.some((i) => i.partyId === partyId);
        if (!hasInvite) {
          socket.emit('party:error', { message: 'This party is private' });
          return;
        }
      }
      
      if (party.members.length >= party.maxSize) {
        socket.emit('party:error', { message: 'Party is full' });
        return;
      }
      
      // Add member
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, usernameColor: true },
      });
      
      await prisma.partyMember.create({
        data: {
          partyId,
          userId,
        },
      });
      
      // Update party activity
      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });
      
      // Join socket room
      socket.join(`party:${partyId}`);
      
      // Get updated party
      const updatedParty = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });

      logParty('party_join', targetUserId, request.username, {
        partyId,
        partyName: updatedParty!.name,
        source: 'join_request',
      });
      
      // Notify the joining user
      socket.emit('party:joined', serializePartyPayload(updatedParty!));
      
      // Log party join
      logParty('party_join', userId, user!.username, {
        partyId,
        partyName: updatedParty!.name,
      });

      // Notify other members
      socket.to(`party:${partyId}`).emit('party:member-joined', {
        userId,
        username: user!.username,
        usernameColor: user!.usernameColor,
      });

      // Clear invite
      const invites = partyInvites.get(userId) || [];
      partyInvites.set(
        userId,
        invites.filter((i) => i.partyId !== partyId)
      );

      removeJoinRequest(partyId, userId);
      clearJoinRequestsForUser(userId);
    } catch (error) {
      console.error('Join party error:', error);
      socket.emit('party:error', { message: 'Failed to join party' });
    }
  });

  // Request to join a private party
  socket.on('party:request-join', async (data: { userId: string; partyId: string }) => {
    const { userId, partyId } = data;

    try {
      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId },
      });

      if (existingMembership) {
        socket.emit('party:error', { message: 'You are already in a party' });
        return;
      }

      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: true,
        },
      });

      if (!party) {
        socket.emit('party:error', { message: 'Party not found' });
        return;
      }

      if (party.isPublic) {
        socket.emit('party:error', { message: 'This party is public' });
        return;
      }

      if (party.members.length >= party.maxSize) {
        socket.emit('party:error', { message: 'Party is full' });
        return;
      }

      const requests = partyJoinRequests.get(partyId) || [];
      if (requests.some((request) => request.userId === userId)) {
        socket.emit('party:error', { message: 'Join request already sent' });
        return;
      }

      const requester = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, usernameColor: true },
      });

      if (!requester) {
        socket.emit('party:error', { message: 'User not found' });
        return;
      }

      const joinRequest: PartyJoinRequest = {
        partyId,
        partyName: party.name,
        userId,
        username: requester.username,
        usernameColor: requester.usernameColor,
        requestedAt: Date.now(),
      };

      requests.push(joinRequest);
      partyJoinRequests.set(partyId, requests);

      const { leaderId } = await getPartyMembers(partyId);
      if (leaderId) {
        const leaderSocketId = userSockets.get(leaderId);
        if (leaderSocketId) {
          io.to(leaderSocketId).emit('party:join-request', joinRequest);
        }
      }

      socket.emit('party:join-requested', { partyId });
    } catch (error) {
      console.error('Join request error:', error);
      socket.emit('party:error', { message: 'Failed to request join' });
    }
  });

  // Respond to join request (leader only)
  socket.on('party:join-request-response', async (data: { userId: string; targetUserId: string; accepted: boolean }) => {
    const { userId, targetUserId, accepted } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: { party: true },
      });

      if (!membership || !membership.isLeader) {
        socket.emit('party:error', { message: 'Only the leader can respond to join requests' });
        return;
      }

      const partyId = membership.partyId;
      const requests = partyJoinRequests.get(partyId) || [];
      const request = requests.find((entry) => entry.userId === targetUserId);

      if (!request) {
        socket.emit('party:error', { message: 'Join request not found' });
        return;
      }

      removeJoinRequest(partyId, targetUserId);

      const targetSocketId = userSockets.get(targetUserId);
      if (!accepted) {
        if (targetSocketId) {
          io.to(targetSocketId).emit('party:join-request-resolved', {
            partyId,
            accepted: false,
          });
        }
        return;
      }

      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId: targetUserId },
      });

      if (existingMembership) {
        socket.emit('party:error', { message: 'User is already in a party' });
        return;
      }

      const party = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });

      if (!party) {
        socket.emit('party:error', { message: 'Party not found' });
        return;
      }

      if (party.members.length >= party.maxSize) {
        socket.emit('party:error', { message: 'Party is full' });
        return;
      }

      await prisma.partyMember.create({
        data: {
          partyId,
          userId: targetUserId,
        },
      });

      await prisma.party.update({
        where: { id: partyId },
        data: { lastActivity: new Date() },
      });

      const updatedParty = await prisma.party.findUnique({
        where: { id: partyId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, usernameColor: true },
              },
            },
          },
        },
      });

      const targetSocket = targetSocketId ? io.sockets.sockets.get(targetSocketId) : undefined;
      if (targetSocket) {
        targetSocket.join(`party:${partyId}`);
        targetSocket.emit('party:joined', serializePartyPayload(updatedParty!));
        targetSocket.emit('party:join-request-resolved', {
          partyId,
          accepted: true,
        });
      }

      if (targetSocket) {
        targetSocket.to(`party:${partyId}`).emit('party:member-joined', {
          userId: targetUserId,
          username: request.username,
          usernameColor: request.usernameColor,
        });
      } else {
        io.to(`party:${partyId}`).emit('party:member-joined', {
          userId: targetUserId,
          username: request.username,
          usernameColor: request.usernameColor,
        });
      }

      clearJoinRequestsForUser(targetUserId);
    } catch (error) {
      console.error('Join request response error:', error);
      socket.emit('party:error', { message: 'Failed to respond to join request' });
    }
  });
  
  // Leave party
  socket.on('party:leave', async (data: { userId: string }) => {
    const { userId } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: true,
            },
          },
          user: {
            select: { username: true },
          },
        },
      });
      
      if (!membership) {
        socket.emit('party:error', { message: 'You are not in a party' });
        return;
      }
      
      const partyId = membership.partyId;
      const wasLeader = membership.isLeader;
      const memberCount = membership.party.members.length;
      
      // Remove member
      await prisma.partyMember.delete({
        where: { userId },
      });
      
      // Leave socket room
      socket.leave(`party:${partyId}`);
      
      // Log party leave
      logParty('party_leave', userId, membership.user.username, {
        partyId,
        wasLeader,
      });

      if (memberCount <= 1) {
        // Disband party if last member
        await prisma.party.delete({
          where: { id: partyId },
        });

        // Log party disband
        logParty('party_disband', userId, membership.user.username, {
          partyId,
          reason: 'last_member_left',
        });

        const requests = partyJoinRequests.get(partyId) || [];
        for (const request of requests) {
          const requesterSocketId = userSockets.get(request.userId);
          if (requesterSocketId) {
            io.to(requesterSocketId).emit('party:join-request-resolved', {
              partyId,
              accepted: false,
            });
          }
        }
        partyJoinRequests.delete(partyId);

        socket.emit('party:disbanded');
      } else {
        // Notify others
        io.to(`party:${partyId}`).emit('party:member-left', {
          userId,
          username: membership.user.username,
        });
        
        // Transfer leadership if leader left
        if (wasLeader) {
          const newLeader = await prisma.partyMember.findFirst({
            where: { partyId },
            orderBy: { joinedAt: 'asc' },
          });
          
          if (newLeader) {
            await prisma.partyMember.update({
              where: { id: newLeader.id },
              data: { isLeader: true },
            });
            
            io.to(`party:${partyId}`).emit('party:leader-changed', {
              newLeaderId: newLeader.userId,
            });

            const joinRequests = partyJoinRequests.get(partyId) || [];
            const newLeaderSocketId = userSockets.get(newLeader.userId);
            if (newLeaderSocketId && joinRequests.length > 0) {
              io.to(newLeaderSocketId).emit('party:join-request-list', {
                requests: joinRequests,
              });
            }
          }
        }
        
        socket.emit('party:left');
      }
    } catch (error) {
      console.error('Leave party error:', error);
      socket.emit('party:error', { message: 'Failed to leave party' });
    }
  });

  // Delete party (leader only)
  socket.on('party:delete', async (data: { userId: string }) => {
    const { userId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: true,
            },
          },
        },
      });

      if (!membership) {
        socket.emit('party:error', { message: 'You are not in a party' });
        return;
      }

      if (!membership.isLeader) {
        socket.emit('party:error', { message: 'Only the leader can delete the party' });
        return;
      }

      const partyId = membership.partyId;
      const roomId = getPartyRoomId(partyId);

      // Log party disband by leader
      logParty('party_disband', userId, undefined, {
        partyId,
        partyName: membership.party.name,
        memberCount: membership.party.members.length,
        reason: 'leader_deleted',
      });

      io.to(roomId).emit('party:disbanded');

      for (const member of membership.party.members) {
        const memberSocketId = userSockets.get(member.userId);
        if (memberSocketId) {
          const memberSocket = io.sockets.sockets.get(memberSocketId);
          memberSocket?.leave(roomId);
        }
      }

      await prisma.party.delete({
        where: { id: partyId },
      });

      const requests = partyJoinRequests.get(partyId) || [];
      for (const request of requests) {
        const requesterSocketId = userSockets.get(request.userId);
        if (requesterSocketId) {
          io.to(requesterSocketId).emit('party:join-request-resolved', {
            partyId,
            accepted: false,
          });
        }
      }
      partyJoinRequests.delete(partyId);

      for (const [targetUserId, invites] of partyInvites.entries()) {
        const filteredInvites = invites.filter((invite) => invite.partyId !== partyId);
        if (filteredInvites.length === 0) {
          partyInvites.delete(targetUserId);
        } else if (filteredInvites.length !== invites.length) {
          partyInvites.set(targetUserId, filteredInvites);
        }
      }
    } catch (error) {
      console.error('Delete party error:', error);
      socket.emit('party:error', { message: 'Failed to delete party' });
    }
  });
  
  // Invite to party
  socket.on('party:invite', async (data: { userId: string; targetUserId: string }) => {
    const { userId, targetUserId } = data;

    try {
      // Check for active cooldown
      const cooldownKey = `${userId}:${targetUserId}`;
      const cooldown = inviteCooldowns.get(cooldownKey);
      if (cooldown && Date.now() < cooldown.expiresAt) {
        const remainingMinutes = Math.ceil((cooldown.expiresAt - Date.now()) / 60000);
        socket.emit('party:error', {
          message: `Tu dois attendre ${remainingMinutes} minute(s) avant de réinviter ce joueur`
        });
        return;
      }

      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          user: { select: { username: true } },
          party: true,
        },
      });

      if (!membership) {
        socket.emit('party:error', { message: 'You are not in a party' });
        return;
      }

      // Store invite
      const invites = partyInvites.get(targetUserId) || [];
      invites.push({
        partyId: membership.partyId,
        inviterId: userId,
        inviterUsername: membership.user.username,
      });
      partyInvites.set(targetUserId, invites);

      // Log party invite
      logParty('party_invite', userId, membership.user.username, {
        partyId: membership.partyId,
        targetUserId,
      });

      // Notify target user
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('party:invite', {
          partyId: membership.partyId,
          partyName: membership.party.name,
          inviterId: userId,
          inviterUsername: membership.user.username,
        });
      }

      socket.emit('party:invite-sent', { targetUserId });
    } catch (error) {
      console.error('Invite error:', error);
      socket.emit('party:error', { message: 'Failed to send invite' });
    }
  });
  
  // Kick from party
  socket.on('party:kick', async (data: { userId: string; targetUserId: string }) => {
    const { userId, targetUserId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
      });

      if (!membership || !membership.isLeader) {
        socket.emit('party:error', { message: 'Only the leader can kick members' });
        return;
      }

      const targetMembership = await prisma.partyMember.findUnique({
        where: { userId: targetUserId },
        include: { user: { select: { username: true } } },
      });

      if (!targetMembership || targetMembership.partyId !== membership.partyId) {
        socket.emit('party:error', { message: 'User is not in your party' });
        return;
      }

      // Remove member
      await prisma.partyMember.delete({
        where: { userId: targetUserId },
      });

      // Log kick
      logParty('party_kick', userId, undefined, {
        partyId: membership.partyId,
        kickedUserId: targetUserId,
        kickedUsername: targetMembership.user.username,
      });

      // Notify kicked user
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(`party:${membership.partyId}`);
          targetSocket.emit('party:kicked');
        }
      }

      // Notify others
      io.to(`party:${membership.partyId}`).emit('party:member-left', {
        userId: targetUserId,
        username: targetMembership.user.username,
        wasKicked: true,
      });
    } catch (error) {
      console.error('Kick error:', error);
      socket.emit('party:error', { message: 'Failed to kick member' });
    }
  });

  // Reject party invite
  socket.on('party:reject-invite', async (data: { userId: string; partyId: string }) => {
    const { userId, partyId } = data;

    try {
      // Find and remove the invite
      const invites = partyInvites.get(userId) || [];
      const invite = invites.find((inv) => inv.partyId === partyId);

      if (invite) {
        // Set cooldown for the inviter
        const cooldownKey = `${invite.inviterId}:${userId}`;
        inviteCooldowns.set(cooldownKey, {
          inviterId: invite.inviterId,
          targetUserId: userId,
          expiresAt: Date.now() + INVITE_COOLDOWN,
        });

        // Remove the invite
        partyInvites.set(
          userId,
          invites.filter((inv) => inv.partyId !== partyId)
        );
      }
    } catch (error) {
      console.error('Reject invite error:', error);
    }
  });
  
  // Force sync party state - clears ghost state
  socket.on('party:sync', async (data: { userId: string }) => {
    const { userId } = data;

    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, username: true, usernameColor: true },
                  },
                },
              },
            },
          },
        },
      });

      if (membership) {
        // User is in a party - send full state
        socket.join(`party:${membership.partyId}`);
        socket.emit('party:restored', {
          party: {
            id: membership.party.id,
            name: membership.party.name,
            isPublic: membership.party.isPublic,
            maxSize: membership.party.maxSize,
          },
          members: membership.party.members.map((m) => ({
            userId: m.userId,
            username: m.user.username,
            usernameColor: m.user.usernameColor,
            isLeader: m.isLeader,
          })),
        });

        if (membership.isLeader) {
          const joinRequests = partyJoinRequests.get(membership.partyId) || [];
          if (joinRequests.length > 0) {
            socket.emit('party:join-request-list', { requests: joinRequests });
          }
        }
      } else {
        // User is NOT in a party - clear any ghost state
        socket.emit('party:not-in-party');
      }
    } catch (error) {
      console.error('Sync party error:', error);
    }
  });

  // Get party list (public parties)
  socket.on('party:list', async () => {
    try {
      const parties = await prisma.party.findMany({
        include: {
          members: {
            select: { id: true },
          },
        },
        orderBy: { lastActivity: 'desc' },
        take: 20,
      });
      
      socket.emit('party:list', {
        parties: parties.map((p) => ({
          id: p.id,
          name: p.name,
          isPublic: p.isPublic,
          memberCount: p.members.length,
          maxSize: p.maxSize,
        })),
      });
    } catch (error) {
      console.error('List parties error:', error);
      socket.emit('party:error', { message: 'Failed to get party list' });
    }
  });
  
  // Handle disconnect - clean up user from parties
  socket.on('disconnect', async () => {
    // Remove socket mapping
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        break;
      }
    }
  });

  // Sync current party membership on reconnect/refresh
  socket.on('party:sync', async (data: { userId: string }) => {
    const { userId } = data;
    
    try {
      const membership = await prisma.partyMember.findUnique({
        where: { userId },
        include: {
          party: {
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, username: true, usernameColor: true },
                  },
                },
              },
            },
          },
        },
      });
      
      if (!membership) {
        return;
      }
      
      const party = membership.party;
      socket.join(getPartyRoomId(party.id));
      
      socket.emit('party:joined', {
        party: {
          id: party.id,
          name: party.name,
          isPublic: party.isPublic,
          maxSize: party.maxSize,
        },
        members: party.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          usernameColor: m.user.usernameColor,
          isLeader: m.isLeader,
        })),
      });
    } catch (error) {
      console.error('Party sync error:', error);
      socket.emit('party:error', { message: 'Failed to sync party' });
    }
  });

};

// Cleanup inactive parties periodically
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - INACTIVITY_TIMEOUT);

    const inactiveParties = await prisma.party.findMany({
      where: {
        lastActivity: { lt: cutoff },
      },
      select: { id: true },
    });

    for (const party of inactiveParties) {
      await prisma.party.delete({
        where: { id: party.id },
      });
    }
  } catch (error) {
    console.error('Party cleanup error:', error);
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Cleanup expired invite cooldowns periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, cooldown] of inviteCooldowns.entries()) {
    if (now >= cooldown.expiresAt) {
      inviteCooldowns.delete(key);
    }
  }
}, 60 * 1000); // Run every minute
