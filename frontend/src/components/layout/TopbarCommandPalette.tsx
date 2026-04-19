import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  Flag,
  Gamepad2,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  Trophy,
  UserCircle2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveImageUrl } from '@/lib/images';
import { getSearchablePageEntries } from '@/lib/page-meta';
import { cn } from '@/lib/utils';
import { clansApi, usersApi, type ClanSummary } from '@/services/api';

type SearchUser = {
  id: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
};

type CommandEntry = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  value: string;
  keywords: string[];
  icon?: LucideIcon;
  imageUrl?: string | null;
  fallback: string;
  path: string;
};

type TopbarCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string | null;
};

const PAGE_ICON_BY_PATH: Array<{ match: (path: string) => boolean; icon: LucideIcon }> = [
  { match: (path) => path.startsWith('/games'), icon: Gamepad2 },
  { match: (path) => path.startsWith('/profile'), icon: UserCircle2 },
  { match: (path) => path.startsWith('/leaderboards'), icon: Trophy },
  { match: (path) => path.startsWith('/messages'), icon: MessageSquare },
  { match: (path) => path.startsWith('/inbox'), icon: Inbox },
  { match: (path) => path.startsWith('/settings'), icon: Settings },
  { match: (path) => path.startsWith('/clans'), icon: Flag },
  { match: (path) => path.startsWith('/party'), icon: Sparkles },
  { match: () => true, icon: Compass },
];

function getPageIcon(path: string) {
  return PAGE_ICON_BY_PATH.find((entry) => entry.match(path))?.icon ?? Compass;
}

function getFallback(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || '?';
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenizeSearchValue(value: string) {
  const normalized = normalizeSearchValue(value);
  return normalized.split(/[^a-z0-9]+/).filter(Boolean);
}

function strictCommandFilter(value: string, search: string, keywords: string[]) {
  const normalizedSearch = normalizeSearchValue(search);
  if (!normalizedSearch) return 1;

  const normalizedValue = normalizeSearchValue(value);
  const allTokenList = [
    ...tokenizeSearchValue(value),
    ...keywords.flatMap((keyword) => tokenizeSearchValue(keyword)),
  ];
  const allTokens = new Set(allTokenList);
  const searchTokens = tokenizeSearchValue(search);

  if (!searchTokens.length) return 0;

  const exactValueMatch = normalizedValue === normalizedSearch;
  if (exactValueMatch) return 100;

  const exactSingleTokenMatch = searchTokens.length === 1 && allTokens.has(searchTokens[0]);
  if (exactSingleTokenMatch) return 90;

  const allTermsMatchExactly = searchTokens.every((token) => allTokens.has(token));
  if (allTermsMatchExactly) return 70;

  const singleTerm = searchTokens.length === 1;
  if (singleTerm) {
    const [term] = searchTokens;
    const startsWithToken = allTokenList.some((token) => token.startsWith(term));
    if (startsWithToken) return 50;
  }

  const everyTermStartsWithToken = searchTokens.every((term) =>
    allTokenList.some((token) => token.startsWith(term))
  );
  if (everyTermStartsWithToken) return 40;

  if (normalizedValue.includes(normalizedSearch)) return 30;

  const keywordIncludesSearch = keywords
    .map((keyword) => normalizeSearchValue(keyword))
    .some((keyword) => keyword.includes(normalizedSearch));
  if (keywordIncludesSearch) return 20;

  return 0;
}

export function TopbarCommandPalette({ open, onOpenChange, currentUserId }: TopbarCommandPaletteProps) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open || hasFetched) return;

    let active = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const [usersResponse, clansResponse] = await Promise.all([
          usersApi.getAll(),
          clansApi.list(),
        ]);

        if (!active) return;
        setUsers(usersResponse.data.users ?? []);
        setClans(clansResponse.data.clans ?? []);
        setHasFetched(true);
      } catch (error) {
        if (!active) return;
        console.error('Failed to load command palette data:', error);
        setLoadError('Impossible de charger la recherche globale.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      active = false;
    };
  }, [hasFetched, open]);

  const quickAccessEntries = useMemo<CommandEntry[]>(() => {
    const entries: CommandEntry[] = [
      {
        id: 'quick-dashboard',
        title: 'Tableau de bord',
        subtitle: "Revenir à l'accueil principal",
        badge: 'Raccourci',
        value: 'Tableau de bord',
        keywords: ['dashboard', 'accueil', 'home'],
        icon: LayoutDashboard,
        fallback: 'TD',
        path: '/dashboard',
      },
      {
        id: 'quick-messages',
        title: 'Messages',
        subtitle: 'Ouvrir les conversations et le chat privé',
        badge: 'Raccourci',
        value: 'Messages',
        keywords: ['chat', 'conversation', 'dm', 'support'],
        icon: MessageSquare,
        fallback: 'MS',
        path: '/messages',
      },
      {
        id: 'quick-inbox',
        title: 'Notifications',
        subtitle: 'Voir la boîte de réception complète',
        badge: 'Raccourci',
        value: 'Notifications',
        keywords: ['inbox', 'boite', 'reception', 'alertes'],
        icon: Inbox,
        fallback: 'IN',
        path: '/inbox',
      },
      {
        id: 'quick-clans',
        title: 'Clans',
        subtitle: 'Parcourir les clans, événements et guerres',
        badge: 'Raccourci',
        value: 'Clans',
        keywords: ['guerre', 'evenement', 'communaute', 'equipe'],
        icon: Flag,
        fallback: 'CL',
        path: '/clans',
      },
      {
        id: 'quick-games',
        title: 'Catalogue jeux',
        subtitle: 'Parcourir tous les jeux disponibles',
        badge: 'Raccourci',
        value: 'Catalogue jeux',
        keywords: ['jeux', 'games', 'arcade', 'multijoueur', 'catalogue'],
        icon: Gamepad2,
        fallback: 'JE',
        path: '/games',
      },
      {
        id: 'quick-settings',
        title: 'Paramètres',
        subtitle: "Régler l'interface et le compte",
        badge: 'Raccourci',
        value: 'Paramètres',
        keywords: ['parametres', 'reglages', 'settings', 'theme', 'compte'],
        icon: Settings,
        fallback: 'PA',
        path: '/settings',
      },
    ];

    if (currentUserId) {
      entries.splice(1, 0, {
        id: 'quick-profile',
        title: 'Mon profil',
        subtitle: 'Ouvrir mon profil joueur',
        badge: 'Raccourci',
        value: 'Mon profil',
        keywords: ['profil', 'joueur', 'badges', 'stats', 'profile'],
        icon: UserCircle2,
        fallback: 'MP',
        path: `/profile/${currentUserId}`,
      });
    }

    return entries;
  }, [currentUserId]);

  const pageEntries = useMemo<CommandEntry[]>(() => {
    const seenPaths = new Set<string>();

    return getSearchablePageEntries()
      .filter((entry) => entry.path !== '/' && entry.path !== '/dashboard')
      .filter((entry) => entry.path !== '/admin')
      .filter((entry) => {
        if (seenPaths.has(entry.path)) return false;
        seenPaths.add(entry.path);
        return true;
      })
      .filter((entry) => !entry.path.startsWith('/games'))
      .map((entry) => ({
        id: `page-${entry.path}`,
        title: entry.title,
        subtitle: entry.description ?? 'Page AuraTracker',
        badge: 'Page',
        value: entry.title,
        keywords: [entry.description ?? '', entry.path, 'page'],
        icon: getPageIcon(entry.path),
        fallback: getFallback(entry.title),
        path: entry.path,
      }))
      .sort((left, right) => left.title.localeCompare(right.title, 'fr'));
  }, []);

  const gameEntries = useMemo<CommandEntry[]>(() => {
    const seenPaths = new Set<string>();

    return getSearchablePageEntries()
      .filter((entry) => entry.path.startsWith('/games'))
      .filter((entry) => {
        if (seenPaths.has(entry.path)) return false;
        seenPaths.add(entry.path);
        return true;
      })
      .map((entry) => ({
        id: `game-${entry.path}`,
        title: entry.title,
        subtitle: entry.description ?? 'Jeu AuraTracker',
        badge: 'Jeu',
        value: entry.title,
        keywords: [entry.description ?? '', entry.path, 'jeu', 'game'],
        icon: Gamepad2,
        fallback: getFallback(entry.title),
        path: entry.path,
      }))
      .sort((left, right) => left.title.localeCompare(right.title, 'fr'));
  }, []);

  const profileEntries = useMemo<CommandEntry[]>(() => (
    users.map((entry) => ({
      id: `profile-${entry.id}`,
      title: entry.username,
      subtitle: entry.bio?.trim() || entry.firstName?.trim() || 'Profil joueur',
      badge: 'Profil',
      value: entry.username,
      keywords: [entry.firstName ?? '', entry.bio ?? '', 'profil', 'joueur', 'user', entry.id],
      imageUrl: entry.profilePicture,
      fallback: getFallback(entry.username),
      path: `/profile/${entry.id}`,
    })).sort((left, right) => left.title.localeCompare(right.title, 'fr'))
  ), [users]);

  const clanEntries = useMemo<CommandEntry[]>(() => (
    clans.map((entry) => ({
      id: `clan-${entry.id}`,
      title: entry.name,
      subtitle: entry.description?.trim() || `Clan de ${entry.leader.username} · ${entry.memberCount}/${entry.maxMembers} membres`,
      badge: 'Clan',
      value: entry.name,
      keywords: [entry.description ?? '', entry.leader.username, 'clan', 'guerre', 'event'],
      imageUrl: entry.imageUrl,
      fallback: getFallback(entry.name),
      path: `/clans?clan=${entry.id}`,
    })).sort((left, right) => left.title.localeCompare(right.title, 'fr'))
  ), [clans]);

  const handleSelect = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'top-[14vh] max-h-[70vh] max-w-[min(42rem,calc(100vw-1.5rem))] translate-y-0 overflow-hidden rounded-[1.35rem] border border-border/70 bg-background/95 p-0 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl [&>button]:hidden'
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Recherche globale</DialogTitle>
        </DialogHeader>
        <Command loop filter={strictCommandFilter} className="bg-transparent">
          <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent">
            <CommandInput
              placeholder="Rechercher un profil, une page, un jeu, un clan..."
              className="h-14 text-sm"
            />
          </div>
          <CommandList className="max-h-[calc(70vh-7rem)] px-2 py-2">
            <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
              {loading ? 'Chargement des résultats…' : loadError ?? 'Aucun résultat trouvé.'}
            </CommandEmpty>

            <CommandGroup heading="Accès rapide">
              {quickAccessEntries.map((entry) => (
                <CommandPaletteItem key={entry.id} entry={entry} onSelect={handleSelect} />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Pages">
              {pageEntries.map((entry) => (
                <CommandPaletteItem key={entry.id} entry={entry} onSelect={handleSelect} />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Jeux">
              {gameEntries.map((entry) => (
                <CommandPaletteItem key={entry.id} entry={entry} onSelect={handleSelect} />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Profils">
              {profileEntries.map((entry) => (
                <CommandPaletteItem key={entry.id} entry={entry} onSelect={handleSelect} />
              ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Clans">
              {clanEntries.map((entry) => (
                <CommandPaletteItem key={entry.id} entry={entry} onSelect={handleSelect} />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
            naviguer
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px]">Entrée</kbd>
            ouvrir
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            fermer
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommandPaletteItem({
  entry,
  onSelect,
}: {
  entry: CommandEntry;
  onSelect: (path: string) => void;
}) {
  const Icon = entry.icon ?? Search;

  return (
    <CommandItem
      value={entry.value}
      keywords={entry.keywords}
      onSelect={() => onSelect(entry.path)}
      className="cursor-pointer gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:bg-accent hover:text-accent-foreground data-[selected=true]:border-border/70 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      {entry.imageUrl ? (
        <Avatar className="h-10 w-10 rounded-xl border border-border/60">
          <AvatarImage src={resolveImageUrl(entry.imageUrl)} alt={entry.title} className="object-cover" />
          <AvatarFallback className="rounded-xl bg-muted text-xs font-semibold text-foreground">
            {entry.fallback}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/35 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
        <div className="truncate text-xs text-muted-foreground">{entry.subtitle}</div>
      </div>
      <CommandShortcut className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
        {entry.badge}
      </CommandShortcut>
    </CommandItem>
  );
}
