import { Bug, Rocket, Sparkles, Wrench, Gamepad2, Users, Megaphone, type LucideIcon } from 'lucide-react';
import type { DashboardUpdateEntry, DashboardUpdateSection } from '@/services/api';

export const feedCategoryMeta: Record<DashboardUpdateEntry['feedCategory'], {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badgeClass: string;
  glowClass: string;
}> = {
  GAME: {
    label: 'Jeux',
    shortLabel: 'Jeux',
    icon: Gamepad2,
    badgeClass: 'border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300',
    glowClass: 'from-sky-500/30 via-sky-500/10 to-transparent',
  },
  PATCH: {
    label: 'Patch',
    shortLabel: 'Patch',
    icon: Wrench,
    badgeClass: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    glowClass: 'from-emerald-500/30 via-emerald-500/10 to-transparent',
  },
  COMMUNITY: {
    label: 'Communauté',
    shortLabel: 'Communaute',
    icon: Users,
    badgeClass: 'border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300',
    glowClass: 'from-fuchsia-500/30 via-fuchsia-500/10 to-transparent',
  },
  DEV: {
    label: 'Équipe',
    shortLabel: 'Equipe',
    icon: Megaphone,
    badgeClass: 'border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300',
    glowClass: 'from-amber-500/30 via-amber-500/10 to-transparent',
  },
};

export const sectionCategoryMeta: Record<DashboardUpdateSection['category'], {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}> = {
  BIG_FEATURE: {
    label: 'Grandes fonctionnalités',
    icon: Rocket,
    badgeClass: 'border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300',
  },
  SMALL_FEATURE: {
    label: 'Améliorations',
    icon: Sparkles,
    badgeClass: 'border-sky-500/30 bg-sky-500/12 text-sky-700 dark:text-sky-300',
  },
  BUG_FIX: {
    label: 'Correctifs',
    icon: Bug,
    badgeClass: 'border-border/70 bg-muted/50 text-muted-foreground',
  },
};

export function renderUpdateRichText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, index) =>
    index % 2 === 1
      ? <strong key={index} className="font-semibold text-foreground">{part}</strong>
      : <span key={index}>{part}</span>
  );
}

export function formatUpdateDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatUpdateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);

  if (Math.abs(diffMinutes) < 60) {
    if (diffMinutes >= 0) {
      return diffMinutes <= 1 ? 'dans 1 min' : `dans ${diffMinutes} min`;
    }
    const abs = Math.abs(diffMinutes);
    return abs <= 1 ? 'il y a 1 min' : `il y a ${abs} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    if (diffHours >= 0) {
      return diffHours === 1 ? 'dans 1 h' : `dans ${diffHours} h`;
    }
    const abs = Math.abs(diffHours);
    return abs === 1 ? 'il y a 1 h' : `il y a ${abs} h`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    if (diffDays >= 0) {
      return diffDays === 1 ? 'demain' : `dans ${diffDays} jours`;
    }
    const abs = Math.abs(diffDays);
    return abs === 1 ? 'hier' : `il y a ${abs} jours`;
  }

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getEntrySummaryCounts(entry: DashboardUpdateEntry) {
  return entry.sections.reduce<Record<DashboardUpdateSection['category'], number>>((acc, section) => {
    acc[section.category] += section.items.length;
    return acc;
  }, {
    BIG_FEATURE: 0,
    SMALL_FEATURE: 0,
    BUG_FIX: 0,
  });
}
