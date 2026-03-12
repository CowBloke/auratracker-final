import {
  BarChart3,
  Bomb,
  Coins,
  Dice5,
  Gamepad2,
  Home,
  Lightbulb,
  MapPin,
  Package,
  ScrollText,
  Shield,
  Swords,
  Trophy,
  User,
  Users,
  Store,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type PageMeta = {
  label: string;
  icon: LucideIcon;
};

const pageMatchers: Array<{ test: (path: string) => boolean; label: string; icon: LucideIcon }> = [
  { test: (path) => path === '/', label: 'Accueil', icon: Home },
  { test: (path) => path.startsWith('/games/bomb-party'), label: 'Bomb Party', icon: Bomb },
  { test: (path) => path.startsWith('/games/poker'), label: 'Poker', icon: Dice5 },
  { test: (path) => path.startsWith('/games/petit-bac'), label: 'Petit Bac', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/bataille-navale'), label: 'Bataille Navale', icon: Swords },
  { test: (path) => path.startsWith('/games/doodle-jump'), label: 'Doodle Jump', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/logic-lab'), label: 'Logic Lab', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/minesweeper'), label: 'Démineur', icon: Bomb },
  { test: (path) => path.startsWith('/games/2048'), label: '2048', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/flappy-bird'), label: 'Flappy Bird', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/solitaire'), label: 'Solitaire', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/racer'), label: 'Racer', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/tetris'), label: 'Tetris', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/knife-hit'), label: 'Knife Hit', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/echecs'), label: 'Échecs', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/casino'), label: 'Casino', icon: Dice5 },
  { test: (path) => path.startsWith('/market'), label: 'Shop', icon: Store },
  { test: (path) => path.startsWith('/games/aura-coin'), label: 'Aura Coin', icon: Coins },
  { test: (path) => path.startsWith('/polymarket'), label: 'Polymarket', icon: BarChart3 },
  { test: (path) => path.startsWith('/games'), label: 'Jeux', icon: Gamepad2 },
  { test: (path) => path.startsWith('/leaderboards'), label: 'Classements', icon: Trophy },
  { test: (path) => path.startsWith('/party'), label: 'Groupe', icon: Users },
  { test: (path) => path.startsWith('/inventory'), label: 'Inventaire', icon: Package },
  { test: (path) => path.startsWith('/profile'), label: 'Profil', icon: User },
  { test: (path) => path.startsWith('/admin'), label: 'Admin', icon: Shield },
  { test: (path) => path.startsWith('/rules'), label: 'Règlement', icon: ScrollText },
  { test: (path) => path.startsWith('/suggestions'), label: 'Suggestions', icon: Lightbulb },
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
