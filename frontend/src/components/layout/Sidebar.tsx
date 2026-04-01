import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronRight,
  LayoutDashboard,
  Gamepad2,
  Trophy,
  Users,
  Flag,
  Backpack,
  Lightbulb,
  BookOpen,
  Shield,
  Store,
  Search,
  Ticket,
  BarChart3,
  Target,
  Bug,
  MessageCircle,
  Megaphone,
  Briefcase,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { NavUser } from '@/components/nav-user';
import { cn } from '@/lib/utils';
import { usersApi, supportApi, changelogApi } from '@/services/api';
import { useSocketBase } from '@/contexts/SocketContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { resolveImageUrl } from '@/lib/images';
import { getGameImage } from '@/lib/game-images';
import BugReportPanel from '@/components/layout/BugReportPanel';
import { UsernameDisplay } from '@/components/ui/username-display';
import { useFeatures } from '@/contexts/FeaturesContext';
import { BLOCKABLE_PAGES } from '@/config/blockedPages';
import { computeNewChangelogCount, markChangelogSeen } from '@/lib/changelog';
import { useTheme } from '@/contexts/ThemeContext';
import { FeatureHint } from '@/components/ui/feature-hint';

interface SearchUser {
  id: string;
  username: string;
  firstName?: string | null;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
}

const navItems = [
  { to: '/leaderboards', label: 'Classement', icon: Trophy },
  { to: '/party', label: 'Groupe', icon: Users },
  { to: '/clans', label: 'Clans', icon: Flag },
  { to: '/market', label: 'Boutique', icon: Store },
  { to: '/inventory', label: 'Inventaire', icon: Backpack },
  { to: '/pass', label: 'Pass', icon: Ticket },
  { to: '/quests', label: 'Quêtes', icon: Target },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/rules', label: 'Infos', icon: BookOpen },
];

const adminItems = [
  { to: '/admin', label: 'Administration', icon: Shield },
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
  { to: '/games/aura-coin', label: 'Aura Coin', image: getGameImage('aura-coin') },
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
  { tab: null,         label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { tab: 'travail',   label: 'Travail',          icon: Briefcase       },
  { tab: 'social',    label: 'Social',           icon: Users           },
  { tab: 'explore',   label: 'Explore',          icon: BarChart3       },
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
  const { socket } = useSocketBase();
  const { theme } = useTheme();
  const disabledPages = maintenanceStatus.disabledPages;

  const isDisabled = (path: string) => {
    const page = BLOCKABLE_PAGES.find((p) => p.path === path);
    return page ? disabledPages.includes(page.key) : false;
  };

  const isOnGames = location.pathname.startsWith('/games');
  const isOnYou = location.pathname.startsWith('/you');
  const isOnDashboard = location.pathname === '/' || location.pathname === '/dashboard';
  const canOpenYouFromLogo = !maintenanceStatus.youLogoAdminOnly || !!user?.isAdmin;
  const [supportUnread, setSupportUnread] = useState(0);
  const [updatesUnread, setUpdatesUnread] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasFetchedUsers, setHasFetchedUsers] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);

  // Support unread count
  useEffect(() => {
    if (!user) return;
    supportApi.getUnreadCount().then(({ data }) => setSupportUnread(data.count)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: { message: { fromAdmin: boolean; userId?: string } }) => {
      if (!data.message.fromAdmin) return;
      if (location.pathname !== '/support') {
        setSupportUnread((c) => c + 1);
      }
    };
    socket.on('support:message', handler);
    return () => { socket.off('support:message', handler); };
  }, [socket, location.pathname]);

  // Reset unread when visiting /support
  useEffect(() => {
    if (location.pathname === '/support') {
      setSupportUnread(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    const syncUnread = () => {
      changelogApi.getIds()
        .then(({ data }) => setUpdatesUnread(computeNewChangelogCount(data.ids)))
        .catch(() => {});
    };

    if (location.pathname === '/changelog') {
      changelogApi.getIds()
        .then(({ data }) => {
          if (data.ids[0]) markChangelogSeen(data.ids[0]);
          setUpdatesUnread(0);
        })
        .catch(() => {});
    } else {
      syncUnread();
    }

    window.addEventListener('focus', syncUnread);
    window.addEventListener('storage', syncUnread);

    return () => {
      window.removeEventListener('focus', syncUnread);
      window.removeEventListener('storage', syncUnread);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isSearchOpen || hasFetchedUsers) return;

    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        setLoadError(null);
        const response = await usersApi.getAll();
        setUsers(response.data.users || []);
        setHasFetchedUsers(true);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setLoadError('Impossible de charger les joueurs.');
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isSearchOpen, hasFetchedUsers]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => u.username.toLowerCase().includes(term));
  }, [searchTerm, users]);

  const handleUserSelect = (userId: string) => {
    setIsSearchOpen(false);
    setSearchTerm('');
    navigate(`/profile/${userId}`);
  };

  const getBioPreview = (bio?: string | null, maxLength = 80) => {
    const trimmed = bio?.trim();
    if (!trimmed) return 'Aucune description.';
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
  };

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
          {isOnDashboard && canOpenYouFromLogo ? (
            <FeatureHint
              id="dashboard-you-logo-entrepreneur-relations"
              label="Nouveau: clique sur le logo pour ouvrir le centre Entrepreneur & Relations"
              side="bottom"
              className="w-full"
            >
              {logoButton}
            </FeatureHint>
          ) : logoButton}
          <SidebarMenu className="space-y-1">
            <SidebarMenuItem>
              <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                <SheetTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Rechercher un joueur"
                    className="h-9 px-3 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent"
                  >
                    <Search className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Rechercher</span>
                  </SidebarMenuButton>
                </SheetTrigger>
                <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Rechercher un joueur</SheetTitle>
                  </SheetHeader>
                  <div className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
                    <Input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Pseudo, identifiant..."
                      autoFocus
                      className="h-12 shrink-0 border-border/50"
                    />
                    <ScrollArea className="flex-1">
                      <div className="space-y-0 pr-4">
                      {isLoadingUsers ? (
                        <p className="text-sm text-muted-foreground py-4">Chargement des joueurs...</p>
                      ) : loadError ? (
                        <p className="text-sm text-muted-foreground py-4">{loadError}</p>
                      ) : filteredUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">Aucun joueur trouvé.</p>
                      ) : (
                        filteredUsers.map((u) => (
                          <Button
                            key={u.id}
                            type="button"
                            onClick={() => handleUserSelect(u.id)}
                            variant="ghost"
                            className="h-auto w-full justify-start gap-3 rounded-none border-b border-border/30 px-3 py-4 text-left last:border-0"
                          >
                            <Avatar className="h-9 w-9">
                              {u.profilePicture ? (
                                <AvatarImage src={resolveImageUrl(u.profilePicture)} alt={u.username} />
                              ) : null}
                              <AvatarFallback className="bg-muted text-foreground">
                                {u.username.slice(0, 1)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <UsernameDisplay
                                username={u.username}
                                firstName={u.firstName}
                                usernameColor={u.usernameColor}
                                className="block"
                                usernameClassName="text-sm font-medium"
                              />
                              <span className="block text-xs text-muted-foreground">
                                {getBioPreview(u.bio)}
                              </span>
                            </div>
                          </Button>
                        ))
                      )}
                      </div>
                    </ScrollArea>
                  </div>
                </SheetContent>
              </Sheet>
            </SidebarMenuItem>

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
            {!isOnYou && !isDisabled('/') && <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/' || location.pathname === '/dashboard'}
                tooltip="Tableau de bord"
                className={cn(
                  "h-9 px-3 text-sm font-normal",
                  location.pathname === '/' || location.pathname === '/dashboard'
                    ? "text-foreground bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                )}
              >
                <NavLink to="/dashboard" end>
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Tableau de bord</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>}

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
                      "h-9 px-3 text-sm font-normal",
                      isOnGames
                        ? "text-foreground bg-muted/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                    )}
                  >
                    <NavLink to="/games">
                      <Gamepad2 className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">Jeux</span>
                      <ChevronRight className={cn(
                        "ml-auto h-4 w-4 transition-transform duration-200",
                        isOnGames && "rotate-90",
                        "group-data-[collapsible=icon]:hidden"
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
                              "text-sm font-normal",
                              isGameActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground"
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
                  "h-9 px-3 text-sm font-normal",
                  location.pathname === '/polymarket' || location.pathname.startsWith('/polymarket')
                    ? "text-foreground bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-transparent"
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
                (item.to !== '/' && location.pathname.startsWith(item.to));
              const ItemIcon = item.icon;

              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      "h-9 px-3 text-sm font-normal",
                      isActive
                        ? "text-foreground bg-muted/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-transparent"
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

            <SidebarMenuItem>
              <BugReportPanel
                open={isBugReportOpen}
                onOpenChange={setIsBugReportOpen}
                trigger={(
                  <SidebarMenuButton
                    tooltip="Reporter un bug"
                    className="h-9 px-3 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    <Bug className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Reporter un bug</span>
                  </SidebarMenuButton>
                )}
              />
            </SidebarMenuItem>

            {/* Changelog */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/changelog'}
                tooltip="Changelog"
                className={cn(
                  'h-9 px-3 text-sm font-normal',
                  location.pathname === '/changelog'
                    ? 'text-foreground bg-muted/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                )}
              >
                <NavLink to="/changelog">
                  <Megaphone className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Changelog</span>
                  {updatesUnread > 0 && (
                    <span className="ml-auto inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold group-data-[collapsible=icon]:hidden">
                      {updatesUnread > 99 ? '99+' : updatesUnread}
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Support */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/support'}
                tooltip="Support"
                className={cn(
                  'h-9 px-3 text-sm font-normal',
                  location.pathname === '/support'
                    ? 'text-foreground bg-muted/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                )}
              >
                <NavLink to="/support">
                  <MessageCircle className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Support</span>
                  {supportUnread > 0 && (
                    <span className="ml-auto inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold group-data-[collapsible=icon]:hidden">
                      {supportUnread > 99 ? '99+' : supportUnread}
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Admin items (only for admins) */}
            {user?.isAdmin && adminItems.map((item) => {
              const isActive = location.pathname === item.to ||
                (item.to !== '/admin' && location.pathname.startsWith(item.to));
              const AdminIcon = item.icon;

              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.label}
                    className={cn(
                      "h-9 px-3 text-sm font-normal",
                      isActive
                        ? "text-amber-500 bg-amber-500/10"
                        : "text-amber-500/70 hover:text-amber-500 hover:bg-transparent"
                    )}
                  >
                    <NavLink to={item.to}>
                      <AdminIcon className="h-4 w-4" />
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
      <SidebarFooter className="border-t border-border/40">
        {user && (
          <NavUser
            user={{
              name: user.username,
              firstName: user.firstName,
              email: user.email || '',
              avatar: '',
              usernameColor: user.usernameColor,
              profilePicture: user.profilePicture,
            }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
