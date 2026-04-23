import { BellRing, Building2, Heart, Landmark, TrendingUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { type Notification, type YouBusiness, type YouRelationship } from '@/services/api';
import { type BusinessAction } from './types';

export function formatMoney(value: number) {
  return value.toLocaleString('fr-FR');
}

export function formatDurationMinutes(value: number) {
  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`;
  }

  return `${value}min`;
}

export function getRelationshipPill(status: YouRelationship['status']) {
  if (status === 'MARRIED') return { label: 'Marie(e)', color: 'bg-red-400/15 text-red-400' };
  if (status === 'DIVORCED') return { label: 'Ex', color: 'bg-slate-400/15 text-slate-300' };
  if (status === 'FRIEND') return { label: 'Ami(e)', color: 'bg-sky-400/15 text-sky-400' };
  if (status === 'MISTRESS') return { label: 'Liaison', color: 'bg-purple-400/15 text-purple-400' };
  return { label: 'En relation', color: 'bg-pink-400/15 text-pink-400' };
}

export function canUseBusinessAction(business: YouBusiness, action: BusinessAction, userId: string) {
  if (action === 'invite' || action === 'deposit' || action === 'withdraw') {
    return business.ownerId === userId;
  }

  if (action === 'loan' || action === 'invest') {
    return business.ownerId !== userId;
  }

  return false;
}

export function isYouNotification(notification: Notification) {
  const link = notification.link?.toLowerCase() ?? '';
  const title = notification.title.toLowerCase();
  const icon = notification.icon?.toLowerCase() ?? '';
  const actionType = String(notification.data?.actionType ?? '').toLowerCase();

  return (
    link.startsWith('/you')
    || actionType.startsWith('business_')
    || icon === 'briefcase-business'
    || icon === 'credit-card'
    || icon === 'landmark'
    || icon === 'trending-up'
    || icon === 'heart'
    || icon === 'heart-crack'
    || title.includes('business')
    || title.includes('pret')
    || title.includes('invest')
    || title.includes('mariage')
    || title.includes('divorce')
    || title.includes('relation')
  );
}

export function getYouNotificationMeta(notification: Notification) {
  const icon = notification.icon?.toLowerCase() ?? '';
  const title = notification.title.toLowerCase();

  if (icon === 'briefcase-business' || title.includes('business')) {
    return { icon: Building2, tone: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/20' };
  }

  if (icon === 'credit-card' || icon === 'landmark' || title.includes('pret')) {
    return { icon: Landmark, tone: 'bg-amber-400/15 text-amber-300 border-amber-400/20' };
  }

  if (icon === 'trending-up' || title.includes('invest')) {
    return { icon: TrendingUp, tone: 'bg-sky-400/15 text-sky-300 border-sky-400/20' };
  }

  if (icon === 'heart' || icon === 'heart-crack' || title.includes('mariage') || title.includes('divorce') || title.includes('relation')) {
    return { icon: Heart, tone: 'bg-pink-400/15 text-pink-300 border-pink-400/20' };
  }

  return { icon: BellRing, tone: 'bg-violet-400/15 text-violet-300 border-violet-400/20' };
}

export function relativeTime(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}j`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}a`;
}

export async function withRouteError<T>(fn: () => Promise<T>, fallback: string) {
  try {
    return await fn();
  } catch (error: any) {
    const message = error?.response?.data?.error || fallback;
    toast.error(message);
    throw error;
  }
}
