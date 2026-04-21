import type { ClanActiveEffect, ClanEventView, ClanWarState } from '@/services/api';

export const formatAura = (value: number | string) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString('fr-FR');
};

export const formatMoney = (value: number | string) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString('fr-FR');
};

export const formatSignedValue = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('fr-FR')}`;

export const formatDate = (value: string | null | undefined) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCountdown = (value: string | null | undefined) => {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return 'maintenant';

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} min`;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
};

export const formatEffectCooldown = (effect: ClanActiveEffect) => {
  return `Actif encore ${formatCountdown(effect.activeUntil)}`;
};

export const getStatusLabel = (status: ClanWarState['status']) => {
  switch (status) {
    case 'PREPARING':
      return 'Préparation';
    case 'ACTIVE':
      return 'En cours';
    case 'COMPLETED':
      return 'Terminée';
    default:
      return status;
  }
};

export const getClanEventStatusLabel = (status: ClanEventView['status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'En cours';
    case 'SCHEDULED':
      return 'Bientôt';
    case 'COMPLETED':
      return 'Terminée';
    case 'DRAFT':
      return 'Brouillon';
    default:
      return 'Annulée';
  }
};

export const getClanEventActivityLabel = (activityType: string) => {
  switch (activityType) {
    case 'PLAY_ANY_GAME':
      return 'Parties jouées';
    case 'WIN_ANY_GAME':
      return 'Victoires';
    case 'CLAN_CHAT_MESSAGE':
      return 'Messages clan';
    case 'CLAN_BANK_DEPOSIT':
      return 'Money déposée';
    case 'CLAN_WAR_ATTACK':
      return "Actions d'attaque";
    case 'CLAN_WAR_SUPPORT':
      return 'Actions de support';
    case 'EVENT_MINIGAME_PLAY':
      return 'Mini-jeux joués';
    case 'EVENT_MINIGAME_POINTS':
      return 'Points mini-jeux';
    default:
      return activityType.replace(/_/g, ' ').toLowerCase();
  }
};

export const getStatusVariant = (status: ClanWarState['status']) => {
  switch (status) {
    case 'ACTIVE':
      return 'destructive' as const;
    case 'PREPARING':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

export const getAvatarFallback = (value: string) => value.trim().slice(0, 2);
