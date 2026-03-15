import { Server } from 'socket.io';
import { prisma } from '../server.js';

// Party IDs created by the duel system — deleted automatically after the game ends
export const duelPartyIds = new Set<string>();

export async function deleteDuelParty(partyId: string, io: Server): Promise<void> {
  duelPartyIds.delete(partyId);
  try {
    io.to(`party:${partyId}`).emit('party:disbanded');
    await prisma.party.delete({ where: { id: partyId } });
  } catch (error) {
    console.error('deleteDuelParty error:', error);
  }
}
