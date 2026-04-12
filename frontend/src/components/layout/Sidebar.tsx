import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronRight,
  Bug,
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
  Coins,
  Camera,
  Sparkles,
  Info,
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
import BugReportPanel from './BugReportPanel';
import { t } from '@/lib/i18n';

type SidebarRouteItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const economyItems: SidebarRouteItem[] = [
  { to: '/market', label: t('sidebar_nav_shop'), icon: Store },
  { to: '/inventory', label: t('sidebar_nav_inventory'), icon: Backpack },
  { to: '/marketplace', label: t('sidebar_nav_marketplace'), icon: BadgeDollarSign },
  { to: '/polymarket', label: t('sidebar_polymarket'), icon: BarChart3 },
  { to: '/pass', label: t('sidebar_nav_pass'), icon: Ticket },
  { to: '/quests', label: t('sidebar_nav_quests'), icon: Target },
];

const communityItems: SidebarRouteItem[] = [
  { to: '/leaderboards', label: t('sidebar_nav_leaderboard'), icon: Trophy },
  { to: '/party', label: t('sidebar_nav_party'), icon: Users },
  { to: '/clans', label: t('sidebar_nav_clans'), icon: Flag },
  { to: '/loto', label: 'Loto', icon: Ticket },
  { to: '/auravision', label: t('sidebar_nav_auravision'), icon: Camera },
  { to: '/suggestions', label: t('sidebar_nav_suggestions'), icon: Lightbulb },
];

const infoItems: SidebarRouteItem[] = [
  { to: '/aura-scroll', label: 'Aura Scroll', icon: Sparkles },
  { to: '/rules', label: t('sidebar_nav_info'), icon: BookOpen },
  { to: '/tutoriels', label: 'Tutoriels', icon: Info },
];

const gameItems = [
  { to: '/games/russian-roulette', label: t('sidebar_game_russian_roulette'), image: getGameImage('russian-roulette') },
  { to: '/games/bomb-party', label: t('sidebar_game_bomb_party'), image: getGameImage('bomb-party') },
  { to: '/games/poker', label: 'Poker', image: getGameImage('poker') },
  { to: '/games/petit-bac', label: t('sidebar_game_petit_bac'), image: getGameImage('petit-bac') },
  { to: '/games/uno', label: 'UNO', image: getGameImage('uno') },
  { to: '/games/bataille-navale', label: t('sidebar_game_bataille_navale'), image: getGameImage('bataille-navale') },
  { to: '/games/doodle-jump', label: 'Doodle Jump', image: getGameImage('doodle-jump') },
  { to: '/games/logic-lab', label: 'Sudoku', image: getGameImage('logic-lab') },
  { to: '/games/minesweeper', label: t('sidebar_game_minesweeper'), image: getGameImage('minesweeper') },
  { to: '/games/2048', label: '2048', image: getGameImage('game-2048') },
  { to: '/games/flappy-bird', label: 'Flappy Bird', image: getGameImage('flappy-bird') },
  { to: '/games/chrome-dino', label: 'Chrome Dino', image: getGameImage('chrome-dino') },
  { to: '/games/snake', label: 'Snake', image: getGameImage('snake') },
  { to: '/games/fruit-ninja', label: 'Fruit Ninja', image: getGameImage('fruit-ninja') },
  { to: '/games/qs-watermelon', label: 'QS Watermelon', image: getGameImage('qs-watermelon') },
  { to: '/games/stack-tower', label: t('sidebar_game_stack_tower'), image: getGameImage('stack-tower') },
  { to: '/games/geometry-dash', label: 'Geometry Dash', image: getGameImage('geometry-dash') },
  { to: '/games/casino', label: 'Casino', image: getGameImage('casino') },
  { to: '/games/salle-de-marche', label: t('sidebar_game_market_room'), image: getGameImage('market-room') },
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
  { to: '/games/puissance-quatre', label: t('sidebar_game_puissance_quatre'), image: getGameImage('puissance-quatre') },
  { to: '/games/echecs', label: t('sidebar_game_echecs'), image: getGameImage('echecs') },
  { to: '/games/ball-arena', label: t('sidebar_game_ball_arena'), image: getGameImage('ball-arena') },
  { to: '/games/morpion', label: 'Morpion', image: getGameImage('morpion') },
];

const youNavItems = [
  { tab: 'carte',    label: t('sidebar_you_map'),      icon: Map            },
  { tab: 'overview', label: t('sidebar_you_overview'), icon: LayoutDashboard },
  { tab: 'travail',  label: t('sidebar_you_work'),     icon: Briefcase      },
  { tab: 'social',   label: t('sidebar_you_social'),   icon: Users          },
  { tab: 'explore',  label: t('sidebar_you_explore'),  icon: BarChart3      },
  { tab: 'finance',  label: t('sidebar_you_finance'),  icon: Landmark       },
  { tab: 'marche-actions', label: t('sidebar_you_share_market'), icon: Coins },
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
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [gamesExpanded, setGamesExpanded] = useState(false);
  const [economyExpanded, setEconomyExpanded] = useState(false);
  const [communityExpanded, setCommunityExpanded] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
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

  const isPathActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));

  const enabledGameItems = gameItems.filter((game) => !isDisabled(game.to));
  const enabledEconomyItems = economyItems.filter((item) => !isDisabled(item.to));
  const enabledCommunityItems = communityItems.filter((item) => !isDisabled(item.to));
  const enabledInfoItems = infoItems.filter((item) => !isDisabled(item.to));

  const isGamesSectionActive = isOnGames;
  const isEconomySectionActive = enabledEconomyItems.some((item) => isPathActive(item.to));
  const isCommunitySectionActive = enabledCommunityItems.some((item) => isPathActive(item.to));
  const isInfoSectionActive = enabledInfoItems.some((item) => isPathActive(item.to));

  const canOpenYouFromLogo = !maintenanceStatus.youLogoAdminOnly || canBypassMaintenance;
  const shouldNudgeYouLogo = !isOnYou && canOpenYouFromLogo;

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
      className={cn(
        'mb-4 flex h-9 w-full items-center gap-2 rounded-md px-3 text-sidebar-foreground transition-all hover:bg-sidebar-accent/50 active:scale-95 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2',
        shouldNudgeYouLogo && 'shadow-[0_0_0_rgba(99,102,241,0)] hover:shadow-[0_0_10px_rgba(99,102,241,0.25)]'
      )}
      aria-label={isOnYou ? t('sidebar_logo_back_to_dashboard') : (canOpenYouFromLogo ? t('sidebar_logo_go_to_you') : t('sidebar_logo_go_to_dashboard'))}
    >
      <img
        src={theme === 'dark' ? '/aura-icon-white.svg' : '/aura-icon.svg'}
        alt="AuraTracker"
        className={cn(
          'h-5 w-5 shrink-0 transition-transform group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4',
          isOnYou && 'scale-110 drop-shadow-[0_0_6px_rgba(139,92,246,0.6)]',
          shouldNudgeYouLogo && 'motion-safe:animate-[bounce_2.8s_ease-in-out_infinite]'
        )}
      />
      <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
        {isOnYou ? t('sidebar_logo_you') : t('sidebar_logo_aura_tracker')}
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
              const href = `/you?tab=${tab}`;
              const params = new URLSearchParams(location.search);
              const currentTab = params.get('tab') ?? 'carte';
              const isActive = currentTab === tab;
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
                  tooltip={t('sidebar_dashboard')}
                  className={cn(
                    'h-9 px-3 text-sm font-normal',
                    location.pathname === '/' || location.pathname === '/dashboard'
                      ? 'text-foreground bg-muted/50'
                      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                  )}
                >
                  <NavLink to="/dashboard" end>
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{t('sidebar_dashboard')}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {!isOnYou && (<>

            {/* Games */}
            {(!isDisabled('/games') || enabledGameItems.length > 0) && (
              <Collapsible asChild open={gamesExpanded} onOpenChange={setGamesExpanded} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      type="button"
                      isActive={isGamesSectionActive}
                      tooltip={t('sidebar_games')}
                      className={cn(
                        'h-9 px-3 text-sm font-normal',
                        isGamesSectionActive
                          ? 'text-foreground bg-muted/50'
                          : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                      )}
                    >
                      <>
                        <Gamepad2 className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">{t('sidebar_games')}</span>
                        <ChevronRight className={cn(
                          'ml-auto h-4 w-4 transition-transform duration-200',
                          gamesExpanded && 'rotate-90',
                          'group-data-[collapsible=icon]:hidden'
                        )} />
                      </>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {!isDisabled('/games') && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === '/games'}
                            className={cn(
                              'text-sm font-normal',
                              location.pathname === '/games'
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <NavLink to="/games">
                              <Gamepad2 className="h-4 w-4" />
                              <span>Hub jeux</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
                      {enabledGameItems.map((game) => {
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

            {/* Economy */}
            {enabledEconomyItems.length > 0 && (
              <Collapsible asChild open={economyExpanded} onOpenChange={setEconomyExpanded} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      type="button"
                      isActive={isEconomySectionActive}
                      tooltip="Economie"
                      className={cn(
                        'h-9 px-3 text-sm font-normal',
                        isEconomySectionActive
                          ? 'text-foreground bg-muted/50'
                          : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                      )}
                    >
                      <>
                        <Landmark className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Economie</span>
                        <ChevronRight className={cn(
                          'ml-auto h-4 w-4 transition-transform duration-200',
                          economyExpanded && 'rotate-90',
                          'group-data-[collapsible=icon]:hidden'
                        )} />
                      </>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {enabledEconomyItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = isPathActive(item.to);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isItemActive}
                              className={cn(
                                'text-sm font-normal',
                                isItemActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <NavLink to={item.to} end={item.to === '/'}>
                                <ItemIcon className="h-4 w-4" />
                                <span>{item.label}</span>
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

            {/* Community */}
            {enabledCommunityItems.length > 0 && (
              <Collapsible asChild open={communityExpanded} onOpenChange={setCommunityExpanded} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      type="button"
                      isActive={isCommunitySectionActive}
                      tooltip="Communaute"
                      className={cn(
                        'h-9 px-3 text-sm font-normal',
                        isCommunitySectionActive
                          ? 'text-foreground bg-muted/50'
                          : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                      )}
                    >
                      <>
                        <Users className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Communaute</span>
                        <ChevronRight className={cn(
                          'ml-auto h-4 w-4 transition-transform duration-200',
                          communityExpanded && 'rotate-90',
                          'group-data-[collapsible=icon]:hidden'
                        )} />
                      </>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {enabledCommunityItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = isPathActive(item.to);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isItemActive}
                              className={cn(
                                'text-sm font-normal',
                                isItemActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <NavLink to={item.to} end={item.to === '/'}>
                                <ItemIcon className="h-4 w-4" />
                                <span>{item.label}</span>
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

            {/* Infos */}
            {
              <Collapsible asChild open={infoExpanded} onOpenChange={setInfoExpanded} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      type="button"
                      isActive={isInfoSectionActive}
                      tooltip="Infos"
                      className={cn(
                        'h-9 px-3 text-sm font-normal',
                        isInfoSectionActive
                          ? 'text-foreground bg-muted/50'
                          : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                      )}
                    >
                      <>
                        <Info className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">Infos</span>
                        <ChevronRight className={cn(
                          'ml-auto h-4 w-4 transition-transform duration-200',
                          infoExpanded && 'rotate-90',
                          'group-data-[collapsible=icon]:hidden'
                        )} />
                      </>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {enabledInfoItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = isPathActive(item.to);
                        return (
                          <SidebarMenuSubItem key={item.to}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isItemActive}
                              className={cn(
                                'text-sm font-normal',
                                isItemActive
                                  ? 'text-foreground'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <NavLink to={item.to} end={item.to === '/'}>
                                <ItemIcon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          onClick={() => setIsBugReportOpen(true)}
                          className="text-sm font-normal text-muted-foreground hover:text-foreground"
                        >
                          <Bug className="h-4 w-4" />
                          <span>{t('sidebar_report_bug')}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            }
            </>)}

          </SidebarMenu>
        </div>
      </SidebarContent>
      <BugReportPanel
        open={isBugReportOpen}
        onOpenChange={setIsBugReportOpen}
        trigger={<button type="button" className="sr-only" tabIndex={-1} />}
      />
    </Sidebar>
  );
}
