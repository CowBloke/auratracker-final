import {
  BarChart3,
  Bomb,
  Briefcase,
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
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Landmark,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type PageMeta = {
  label: string;
  icon: LucideIcon;
};

const pageMatchers: Array<{ test: (path: string) => boolean; label: string; icon: LucideIcon }> = [
  { test: (path) => path === '/', label: 'Accueil', icon: Home },
  { test: (path) => path.startsWith('/dashboard'), label: 'Tableau de bord', icon: Home },
  { test: (path) => path.startsWith('/login'), label: 'Connexion', icon: User },
  { test: (path) => path.startsWith('/register'), label: 'Inscription', icon: User },
  { test: (path) => path.startsWith('/banned'), label: 'Banni', icon: Shield },
  { test: (path) => path === '/you' || path === '/you?tab=overview', label: 'Moi - Vue d\'ensemble', icon: LayoutDashboard },
  { test: (path) => path.startsWith('/you?tab=travail'), label: 'Moi - Travail', icon: Briefcase },
  { test: (path) => path.startsWith('/you?tab=social'), label: 'Moi - Relations', icon: Users },
  { test: (path) => path.startsWith('/you?tab=explore'), label: 'Moi - Explore business', icon: BarChart3 },
  { test: (path) => path.startsWith('/you?tab=banques'), label: 'Moi - Banques', icon: Landmark },
  { test: (path) => path.startsWith('/you'), label: 'Moi', icon: User },
  { test: (path) => path.startsWith('/games/bomb-party'), label: 'Bombe de mots', icon: Bomb },
  { test: (path) => path.startsWith('/games/poker'), label: 'Poker', icon: Dice5 },
  { test: (path) => path.startsWith('/games/petit-bac'), label: 'Petit Bac', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/bataille-navale'), label: 'Bataille Navale', icon: Swords },
  { test: (path) => path.startsWith('/games/doodle-jump'), label: 'Doodle Jump', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/fruit-ninja'), label: 'Fruit Ninja', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/stack-tower'), label: 'Tour empilée', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/geometry-dash'), label: 'Geometry Dash', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/qs-watermelon'), label: 'QS Watermelon', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/logic-lab'), label: 'Sudoku', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/minesweeper'), label: 'Démineur', icon: Bomb },
  { test: (path) => path.startsWith('/games/2048'), label: '2048', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/flappy-bird'), label: 'Flappy Bird', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/chrome-dino'), label: 'Chrome Dino', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/snake'), label: 'Snake', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/blockblast'), label: 'Block Blast', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/solitaire'), label: 'Solitaire', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/racer'), label: 'Racer', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/tetris'), label: 'Tetris', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/knife-hit'), label: 'Knife Hit', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/opengd'), label: 'OpenGD', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/polytrack'), label: 'PolyTrack', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/eaglercraft'), label: 'Eaglercraft', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/subway-surfers'), label: 'Subway Surfers Clone', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/hexgl'), label: 'HexGL', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/crossy-road'), label: 'Crossy Road', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/echecs'), label: 'Échecs', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/goyave-empire'), label: 'Goyave Empire', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/clash-village'), label: 'Clash Village', icon: Swords },
  { test: (path) => path.startsWith('/games/puissance-quatre'), label: 'Puissance 4', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/ball-arena'), label: 'Arène des balles', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/russian-roulette'), label: 'Roulette russe', icon: Dice5 },
  { test: (path) => path.startsWith('/games/uno'), label: 'Uno', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/morpion'), label: 'Morpion', icon: Gamepad2 },
  { test: (path) => path.startsWith('/games/casino'), label: 'Casino', icon: Dice5 },
  { test: (path) => path.startsWith('/market'), label: 'Boutique', icon: Store },
  { test: (path) => path.startsWith('/marketplace'), label: 'Marketplace', icon: Store },
  { test: (path) => path.startsWith('/games/salle-de-marche'), label: 'Salle de marché', icon: Coins },
  { test: (path) => path.startsWith('/games/aura-coin'), label: 'Aura Coin', icon: Coins },
  { test: (path) => path.startsWith('/games/stable-coin'), label: 'Aura Stable', icon: Coins },
  { test: (path) => path.startsWith('/games/chaos-coin'), label: 'Chaos Coin', icon: Coins },
  { test: (path) => path.startsWith('/polymarket'), label: 'Polymarket', icon: BarChart3 },
  { test: (path) => path.startsWith('/games'), label: 'Jeux', icon: Gamepad2 },
  { test: (path) => path.startsWith('/leaderboards/nombres'), label: 'Nombres', icon: Trophy },
  { test: (path) => path.startsWith('/leaderboards'), label: 'Classements', icon: Trophy },
  { test: (path) => path.startsWith('/party'), label: 'Groupe', icon: Users },
  { test: (path) => path.startsWith('/clans'), label: 'Clans', icon: Users },
  { test: (path) => path.startsWith('/inventory'), label: 'Inventaire', icon: Package },
  { test: (path) => path.startsWith('/profile'), label: 'Profil', icon: User },
  { test: (path) => path.startsWith('/settings'), label: 'Paramètres', icon: Shield },
  { test: (path) => path.startsWith('/inbox'), label: 'Boîte de réception', icon: ScrollText },
  { test: (path) => path.startsWith('/messages'), label: 'Messages', icon: MessageSquare },
  { test: (path) => path.startsWith('/support'), label: 'Support', icon: Lightbulb },
  { test: (path) => path.startsWith('/changelog'), label: 'Mises à jour', icon: Sparkles },
  { test: (path) => path.startsWith('/admin'), label: 'Admin', icon: Shield },
  { test: (path) => path.startsWith('/pass'), label: 'Pass', icon: Coins },
  { test: (path) => path.startsWith('/quests'), label: 'Quêtes', icon: Trophy },
  { test: (path) => path.startsWith('/rules'), label: 'Règlement', icon: ScrollText },
  { test: (path) => path.startsWith('/suggestions'), label: 'Suggestions', icon: Lightbulb },
];

export function getPageMeta(path?: string | null): PageMeta {
  if (!path) {
    return { label: 'Navigation', icon: MapPin };
  }

  const cleanPath = path.split('#')[0] ?? path;
  const match = pageMatchers.find((entry) => entry.test(cleanPath));
  if (match) {
    return { label: match.label, icon: match.icon };
  }

  return { label: 'Navigation', icon: MapPin };
}
