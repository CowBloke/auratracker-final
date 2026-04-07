import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronRight,
  LayoutDashboard,
  Gamepad2,
  Map,
  Trophy,
  Users,
  Flag,
  Backpack,
  Lightbulb,
  BookOpen,
  Store,
  BadgeDollarSign,
  Ticket,
  BarChart3,
  Target,
  Briefcase,
  Landmark,
  Camera,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useFeatures } from '@/contexts/FeaturesContext';
import { BLOCKABLE_PAGES } from '@/config/blockedPages';
import { useTheme } from '@/contexts/ThemeContext';
import { getGameImage } from '@/lib/game-images';

const navItems = [
  { to: '/leaderboards', label: 'Classement', icon: Trophy },
  { to: '/party', label: 'Groupe', icon: Users },
  { to: '/clans', label: 'Clans', icon: Flag },
  { to: '/market', label: 'Boutique', icon: Store },
  { to: '/inventory', label: 'Inventaire', icon: Backpack },
  { to: '/marketplace', label: 'Marché', icon: BadgeDollarSign },
  { to: '/auravision', label: 'AuraVision', icon: Camera },
  { to: '/pass', label: 'Pass', icon: Ticket },
  { to: '/quests', label: 'Quêtes', icon: Target },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/rules', label: 'Infos', icon: BookOpen },
];

const gameItems = [
  { to: '/games/russian-roulette', label: 'Roulette russe', image: getGameImage('russian-roulette') },
  { to: '/games/bomb-party', label: 'Bombe de mots', image: getGameImage('bomb-party') },
  { to: '/games/poker', label: 'Poker', image: getGameImage('poker') },
  { to: '/games/petit-bac', label: 'Petit Bac', image: getGameImage('petit-bac') },
  { to: '/games/uno', label: 'UNO', image: getGameImage('uno') },
  { to: '/games/bataille-navale', label: 'Bataille Navale', image: getGameImage('bataille-navale') },
  { to: '/games/doodle-jump', label: 'Doodle Jump', image: getGameImage('doodle-jump') },
  { to: '/games/logic-lab', label: 'Sudoku', image: getGameImage('logic-lab') },
  { to: '/games/minesweeper', label: 'Démineur', image: getGameImage('minesweeper') },
  { to: '/games/2048', label: '2048', image: getGameImage('game-2048') },
  { to: '/games/flappy-bird', label: 'Flappy Bird', image: getGameImage('flappy-bird') },
  { to: '/games/chrome-dino', label: 'Chrome Dino', image: getGameImage('chrome-dino') },
  { to: '/games/snake', label: 'Snake', image: getGameImage('snake') },
  { to: '/games/fruit-ninja', label: 'Fruit Ninja', image: getGameImage('fruit-ninja') },
  { to: '/games/qs-watermelon', label: 'QS Watermelon', image: getGameImage('qs-watermelon') },
  { to: '/games/stack-tower', label: 'Tour empilée', image: getGameImage('stack-tower') },
  { to: '/games/geometry-dash', label: 'Geometry Dash', image: getGameImage('geometry-dash') },
  { to: '/games/casino', label: 'Casino', image: getGameImage('casino') },
  { to: '/games/salle-de-marche', label: 'Salle de marché', image: getGameImage('market-room') },
  { to: '/games/solitaire', label: 'Solitaire', image: getGameImage('solitaire') },
  { to: '/games/racer', label: 'Racer', image: getGameImage('racer') },
  { to: '/games/tetris', label: 'Tetris', image: getGameImage('tetris') },
  { to: '/games/knife-hit', label: 'Knife Hit', image: getGameImage('knife-hit') },
  { to: '/games/clash-village', label: 'Clash Village', image: getGameImage('clash-village') },
  { to: '/games/goyave-empire', label: 'Goyave Empire', image: getGameImage('goyave-empire') },
  { to: '/games/polytrack', label: 'PolyTrack', image: getGameImage('polytrack') },
  { to: '/games/eaglercraft', label: 'Eaglercraft', image: getGameImage('eaglercraft') },
  { to: '/games/hexgl', label: 'HexGL', image: getGameImage('hexgl') },
  { to: '/games/opengd', label: 'OpenGD', image: getGameImage('opengd') },
  { to: '/games/puissance-quatre', label: 'Puissance 4', image: getGameImage('puissance-quatre') },
  { to: '/games/echecs', label: 'Échecs', image: getGameImage('echecs') },
  { to: '/games/ball-arena', label: 'Arène des balles', image: getGameImage('ball-arena') },
  { to: '/games/morpion', label: 'Morpion', image: getGameImage('morpion') },
];

const youNavItems = [
  { tab: null,       label: "Vue d'ensemble", icon: LayoutDashboard },
  { tab: 'travail',  label: 'Travail',         icon: Briefcase      },
  { tab: 'social',   label: 'Social',          icon: Users          },
  { tab: 'explore',  label: 'Explore',         icon: BarChart3      },
  { tab: 'carte',    label: 'Carte',            icon: Map            },
  { tab: 'finance',  label: 'Finance',          icon: Landmark       },
];

function GameSidebarIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-4 w-4 rounded-[4px] object-cover shrink-0"
      loading="lazy"
    />
  );
}

export default function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { maintenanceStatus } = useFeatures();
  const { theme } = useTheme();
  const disabledPages = maintenanceStatus.disabledPages;
  const canBypassMaintenance = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.isBetaTester);

  const isDisabled = (path: string) => {
    if (canBypassMaintenance) return false;
    const page = BLOCKABLE_PAGES.find((p) => p.path === path);
    return page ? disabledPages.includes(page.key) : false;
  };

  const isOnGames = location.pathname.startsWith('/games');
  const isOnYou = location.pathname.startsWith('/you');
  const canOpenYouFromLogo = !maintenanceStatus.youLogoAdminOnly || canBypassMaintenance;

  const handleLogoClick = () => {
    if (isOnYou) {
      navigate('/dashboard');
      return;
    }
    navigate(canOpenYouFromLogo ? '/you' : '/dashboard');
  };

  const logoButton = (
    <button
      type="button"
      onClick={handleLogoClick}
      className="mb-4 flex h-9 w-full items-center gap-2 rounded-md px-3 text-sidebar-foreground transition-all hover:bg-sidebar-accent/50 active:scale-95 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
      aria-label={isOnYou ? 'Retour au tableau de bord' : (canOpenYouFromLogo ? 'Accéder à Moi' : 'Accéder au tableau de bord')}
    >
      <img
        src={theme === 'dark' ? '/aura-icon-white.svg' : '/aura-icon.svg'}
        alt="AuraTracker"
        className={cn('h-5 w-5 shrink-0 transition-transform group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4', isOnYou && 'scale-110 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]')}
      />
      <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
        {isOnYou ? 'Moi' : 'AuraTracker'}
      </span>
    </button>
  );

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarContent>
        <div className="px-3 py-4">
          {logoButton}
          <SidebarMenu className="space-y-1">

            {/* You section nav */}
            {isOnYou && youNavItems.map(({ tab, label, icon: Icon }) => {
              const href = tab ? `/you?tab=${tab}` : '/you';
              const params = new URLSearchParams(location.search);
              const currentTab = params.get('tab') ?? 'overview';
              const isActive = tab === null
                ? currentTab === 'overview' && location.pathname === '/you'
                : currentTab === tab;
              return (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={label}
                    className={cn(
                      'h-9 px-3 text-sm font-normal',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={href}>
                      <Icon className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}

            {/* Dashboard */}
            {!isOnYou && !isDisabled('/') && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                  tooltip="Tableau de bord"
                  className={cn(
                    'h-9 px-3 text-sm font-normal',
                    location.pathname === '/' || location.pathname === '/dashboard'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/dashboard" end>
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Tableau de bord</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {!isOnYou && (<>

            {/* Games with accordion */}
            {!isDisabled('/games') && (
              <Collapsible asChild open={isOnGames} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      asChild
                      isActive={isOnGames}
                      tooltip="Jeux"
                      className={cn(
                        'h-9 px-3 text-sm font-normal',
                        isOnGames
                          ? 'text-foreground bg-muted/50'
                          : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                      )}
                    >
                      <NavLink to="/games">
                        <Gamepad2 className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Jeux</span>
                        <ChevronRight className={cn(
                          'ml-auto h-4 w-4 transition-transform duration-200',
                          isOnGames && 'rotate-90',
                          'group-data-[collapsible=icon]:hidden'
                        )} />
                      </NavLink>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {gameItems.filter((game) => !isDisabled(game.to)).map((game) => {
                        const isGameActive = location.pathname === game.to;
                        return (
                          <SidebarMenuSubItem key={game.to}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isGameActive}
                              className={cn(
                                'text-sm font-normal',
                                isGameActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <NavLink to={game.to}>
                                <GameSidebarIcon src={game.image} alt={game.label} />
                                <span>{game.label}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}

            {/* Polymarket */}
            {!isDisabled('/polymarket') && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === '/polymarket' || location.pathname.startsWith('/polymarket')}
                  tooltip="Polymarket"
                  className={cn(
                    'h-9 px-3 text-sm font-normal',
                    location.pathname === '/polymarket' || location.pathname.startsWith('/polymarket')
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/polymarket">
                    <BarChart3 className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Polymarket</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {/* Other nav items */}
            {navItems.filter((item) => !isDisabled(item.to)).map((item) => {
              const isActive = location.pathname === item.to ||
                (item.to !== '/' && location.pathname.startsWith(`${item.to}/`));
              const ItemIcon = item.icon;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      'h-9 px-3 text-sm font-normal',
                      isActive
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                    )}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <ItemIcon className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
            </>)}

          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
