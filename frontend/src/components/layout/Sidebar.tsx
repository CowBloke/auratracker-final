import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronRight,
  LayoutDashboard,
  Gamepad2,
  Trophy,
  Store,
  Users,
  Backpack,
  Lightbulb,
  BookOpen,
  Bug,
  Shield,
  Coins,
  Swords,
  ArrowUp,
  Spade,
  Dices,
  Search
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
import { usersApi } from '@/services/api';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface SearchUser {
  id: string;
  username: string;
  usernameColor?: string | null;
}

const navItems = [
  { to: '/leaderboards', label: 'Classement', icon: Trophy },
  { to: '/marketplace', label: 'Marché', icon: Store },
  { to: '/party', label: 'Party', icon: Users },
  { to: '/inventory', label: 'Inventaire', icon: Backpack },
  { to: '/suggestions', label: 'Suggestions', icon: Lightbulb },
  { to: '/rules', label: 'Règlement', icon: BookOpen },
];

const adminItems = [
  { to: '/admin', label: 'Administration', icon: Shield },
];

const gameItems = [
  { to: '/games/aura-coin', label: 'Aura Coin', icon: Coins },
  { to: '/games/clash', label: 'Clash', icon: Swords },
  { to: '/games/doodle-jump', label: 'Doodle Jump', icon: ArrowUp },
  { to: '/games/solitaire', label: 'Solitaire', icon: Spade },
  { to: '/games/casino', label: 'Casino', icon: Dices },
];

export default function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isOnGames = location.pathname.startsWith('/games');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasFetchedUsers, setHasFetchedUsers] = useState(false);

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

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-4">
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
                <SheetContent side="right" className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Rechercher un joueur</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-4">
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Pseudo, ID..."
                      autoFocus
                    />
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-2">
                      {isLoadingUsers ? (
                        <p className="text-sm text-muted-foreground">Chargement des joueurs...</p>
                      ) : loadError ? (
                        <p className="text-sm text-destructive">{loadError}</p>
                      ) : filteredUsers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun joueur trouvé.</p>
                      ) : (
                        filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleUserSelect(u.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-left transition hover:border-aura/60 hover:bg-aura/10"
                            )}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
                              {u.username.slice(0, 1).toUpperCase()}
                            </div>
                            <span
                              className="font-medium"
                              style={u.usernameColor ? { color: u.usernameColor } : undefined}
                            >
                              {u.username}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </SidebarMenuItem>

            {/* Dashboard */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/'}
                tooltip="Tableau de bord"
                className={cn(
                  "h-9 px-3 text-sm font-normal",
                  location.pathname === '/'
                    ? "text-foreground bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                )}
              >
                <NavLink to="/" end>
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Tableau de bord</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Games with accordion */}
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
                    {gameItems.map((game) => {
                      const isGameActive = location.pathname === game.to;
                      const GameIcon = game.icon;
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
                              <GameIcon className="h-4 w-4" />
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

            {/* Other nav items */}
            {navItems.map((item) => {
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

            {/* Bug Report Link */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === '/report-bug'}
                tooltip="Reporter un bug"
                className={cn(
                  "h-9 px-3 text-sm font-normal",
                  location.pathname === '/report-bug'
                    ? "text-foreground bg-muted/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                )}
              >
                <NavLink to="/report-bug">
                  <Bug className="h-4 w-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Reporter un bug</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Admin items (only for admins) */}
            {user?.isAdmin && adminItems.map((item) => {
              const isActive = location.pathname === item.to;
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
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40">
        {user && (
          <NavUser
            user={{
              name: user.username,
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
