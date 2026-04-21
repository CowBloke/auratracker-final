import type { ClanWarState } from '@/services/api';

export const getWarOpponent = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.defenderClan : war.attackerClan;

export const getWarOwnSide = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.attackerClan : war.defenderClan;

export const getWarDefenseSet = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.defenses.attacker : war.defenses.defender;

export const getWarEnemyDefenseSet = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.defenses.defender : war.defenses.attacker;

export const getWarParticipantStats = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.participantStats.attacker : war.participantStats.defender;

export const getWarOpponentParticipantStats = (war: ClanWarState, clanId: string) =>
  war.attackerClan.id === clanId ? war.participantStats.defender : war.participantStats.attacker;

export const getWarResultBadge = (war: ClanWarState, clanId: string) => {
  const isCurrentWar = war.status !== 'COMPLETED';
  if (isCurrentWar) {
    return {
      label: war.status === 'PREPARING' ? 'Préparation' : war.status === 'ACTIVE' ? 'En cours' : war.status,
      variant: war.status === 'ACTIVE' ? 'destructive' as const : 'secondary' as const,
    };
  }

  if (!war.winnerClan) {
    return { label: 'Égalité', variant: 'outline' as const };
  }

  return war.winnerClan.id === clanId
    ? { label: 'Victoire', variant: 'secondary' as const }
    : { label: 'Défaite', variant: 'destructive' as const };
};
