import {
  Bomb,
  Bug,
  Coins,
  Dice5,
  Gamepad2,
  Home,
  Lightbulb,
  MapPin,
  Package,
  ScrollText,
  History,
  Shield,
  Spade,
  Swords,
  Trophy,
  ShoppingBag,
  User,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type PageMeta = {
  label: string;
  icon: LucideIcon;
};

const pageMatchers: Array<{ test: (path: string) => boolean; label: string; icon: LucideIcon }> = [
  { test: (path) => path === '/', label: 'Accueil', icon: Home },
  { test: (path) => path.startsWith('/games/bomb-party'), label: 'Bomb Party', icon: Bomb },
  { test: (path) => path.startsWith('/games/doodle-jump'), label: 'Doodle Jump', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/solitaire'), label: 'Solitaire', icon: Spade },
  { test: (path) => path.startsWith('/games/clash'), label: 'Clash', icon: Swords },
  { test: (path) => path.startsWith('/games/casino'), label: 'Casino', icon: Dice5 },
  { test: (path) => path.startsWith('/games/aura-coin'), label: 'Aura Coin', icon: Coins },
  { test: (path) => path.startsWith('/games'), label: 'Jeux', icon: Gamepad2 },
  { test: (path) => path.startsWith('/marketplace'), label: 'Marketplace', icon: ShoppingBag },
  { test: (path) => path.startsWith('/leaderboards'), label: 'Classements', icon: Trophy },
  { test: (path) => path.startsWith('/party'), label: 'Groupe', icon: Users },
  { test: (path) => path.startsWith('/inventory'), label: 'Inventaire', icon: Package },
  { test: (path) => path.startsWith('/profile'), label: 'Profil', icon: User },
  { test: (path) => path.startsWith('/admin'), label: 'Admin', icon: Shield },
  { test: (path) => path.startsWith('/rules'), label: 'Regles', icon: ScrollText },
  { test: (path) => path.startsWith('/changelog'), label: 'Changelog', icon: History },
  { test: (path) => path.startsWith('/suggestions'), label: 'Suggestions', icon: Lightbulb },
  { test: (path) => path.startsWith('/report-bug'), label: 'Signaler un bug', icon: Bug },
];

export function getPageMeta(path?: string | null): PageMeta {
  if (!path) {
    return { label: 'Navigation', icon: MapPin };
  }

  const cleanPath = path.split('?')[0]?.split('#')[0] ?? path;
  const match = pageMatchers.find((entry) => entry.test(cleanPath));
  if (match) {
    return { label: match.label, icon: match.icon };
  }

  return { label: 'Navigation', icon: MapPin };
}
