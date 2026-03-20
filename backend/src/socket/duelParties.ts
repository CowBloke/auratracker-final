import { Server } from 'socket.io';
import { prisma } from '../server.js';

// Party IDs created by the duel system — deleted automatically after the game ends
export const duelPartyIds = new Set<string>();
const duelPartyDeletedListeners = new Set<(partyId: string) => void | Promise<void>>();

export function onDuelPartyDeleted(listener: (partyId: string) => void | Promise<void>): () => void {
  duelPartyDeletedListeners.add(listener);
  return () => {
    duelPartyDeletedListeners.delete(listener);
  };
}

export async function deleteDuelParty(partyId: string, io: Server): Promise<void> {
  duelPartyIds.delete(partyId);
  for (const listener of duelPartyDeletedListeners) {
    try {
      await listener(partyId);
    } catch (error) {
      console.error('onDuelPartyDeleted listener error:', error);
    }
  }
  try {
    io.to(`party:${partyId}`).emit('party:disbanded');
    await prisma.party.delete({ where: { id: partyId } });
  } catch (error) {
    console.error('deleteDuelParty error:', error);
  }
}
