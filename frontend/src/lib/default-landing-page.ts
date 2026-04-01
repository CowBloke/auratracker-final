export const DEFAULT_LANDING_PAGE_KEY = 'default_landing_page';

export const DEFAULT_LANDING_PAGE = '/dashboard';

export const DEFAULT_LANDING_PAGE_OPTIONS = [
  { value: '/dashboard', label: 'Tableau de bord' },
  { value: '/games', label: 'Jeux' },
  { value: '/market', label: 'Boutique' },
  { value: '/party', label: 'Groupe' },
  { value: '/clans', label: 'Clans' },
  { value: '/polymarket', label: 'Polymarket' },
  { value: '/leaderboards', label: 'Classements' },
  { value: '/inbox', label: 'Boîte de réception' },
  { value: '/quests', label: 'Quêtes' },
  { value: '/support', label: 'Support' },
] as const;

const allowedLandingPages = new Set<string>(
  DEFAULT_LANDING_PAGE_OPTIONS.map((option) => option.value)
);

export function isAllowedDefaultLandingPage(value: string): boolean {
  return allowedLandingPages.has(value);
}

export function normalizeDefaultLandingPage(value?: string | null): string {
  if (!value) {
    return DEFAULT_LANDING_PAGE;
  }

  return isAllowedDefaultLandingPage(value) ? value : DEFAULT_LANDING_PAGE;
}
