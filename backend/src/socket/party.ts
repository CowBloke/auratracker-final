import { Socket, Server } from 'socket.io';
import { prisma } from '../server.js';

interface PartyInvite {
  partyId: string;
  inviterId: string;
  inviterUsername: string;
}

const partyInvites = new Map<string, PartyInvite[]>(); // userId -> invites
const userSockets = new Map<string, string>(); // oderId -> socketId

// Auto-disband inactive parties (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export const setupPartyHandlers = (socket: Socket, io: Server) => {
  // Track socket to user mapping
  socket.on('party:register', (data: { userId: string }) => {
    userSockets.set(data.userId, socket.id);
  });
  
  // Create party
  socket.on('party:create', async (data: { userId: string; name?: string; isPublic: boolean }) => {
    const { userId, name, isPublic } = data;
    
    try {
      // Check if user is already in a party
      const existingMembership = await prisma.partyMember.findUnique({
        where: { userId },
      });
      
      if (existingMembership) {
        socket.emit('party:error', { message: 'You are already in a party' });
        return;
      }
      
      // Create party with user as leader
      const party = await prisma.party.create({
        data: {
          name: name || null,
          isPublic,
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
                select: { id: true, username: true },
              },
            },
          },
        },
      });
      
      // Join socket room for party
      socket.join(`party:${party.id}`);
      
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
                select: { id: true, username: true },
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
        select: { id: true, username: true },
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
                select: { id: true, username: true },
              },
            },
          },
        },
      });
      
      // Notify the joining user
      socket.emit('party:joined', {
        party: {
          id: updatedParty!.id,
          name: updatedParty!.name,
          isPublic: updatedParty!.isPublic,
          maxSize: updatedParty!.maxSize,
        },
        members: updatedParty!.members.map((m) => ({
          userId: m.userId,
          username: m.user.username,
          isLeader: m.isLeader,
        })),
      });
      
      // Notify other members
      socket.to(`party:${partyId}`).emit('party:member-joined', {
        userId,
        username: user!.username,
      });
      
      // Clear invite
      const invites = partyInvites.get(userId) || [];
      partyInvites.set(
        userId,
        invites.filter((i) => i.partyId !== partyId)
      );
    } catch (error) {
      console.error('Join party error:', error);
      socket.emit('party:error', { message: 'Failed to join party' });
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
      
      if (memberCount <= 1) {
        // Disband party if last member
        await prisma.party.delete({
          where: { id: partyId },
        });
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
          }
        }
        
        socket.emit('party:left');
      }
    } catch (error) {
      console.error('Leave party error:', error);
      socket.emit('party:error', { message: 'Failed to leave party' });
    }
  });
  
  // Invite to party
  socket.on('party:invite', async (data: { userId: string; targetUserId: string }) => {
    const { userId, targetUserId } = data;
    
    try {
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
  
  // Get party list (public parties)
  socket.on('party:list', async () => {
    try {
      const parties = await prisma.party.findMany({
        where: { isPublic: true },
        include: {
          members: {
            include: {
              user: {
                select: { username: true },
              },
            },
          },
        },
        orderBy: { lastActivity: 'desc' },
        take: 20,
      });
      
      socket.emit('party:list', {
        parties: parties.map((p) => ({
          id: p.id,
          name: p.name,
          memberCount: p.members.length,
          maxSize: p.maxSize,
          members: p.members.map((m) => ({
            username: m.user.username,
            isLeader: m.isLeader,
          })),
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
