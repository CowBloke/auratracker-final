import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { Sparkles, Coins, User, LogOut, Wifi, WifiOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usersApi } from '@/services/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { resolveImageUrl } from '@/lib/images';

interface SearchUser {
  id: string;
  username: string;
  usernameColor?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
}

export default function Header() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
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

  const getBioPreview = (bio?: string | null, maxLength = 80) => {
    const trimmed = bio?.trim();
    if (!trimmed) return 'Aucune description.';
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b z-50">
      <div className="flex items-center justify-between h-full px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-aura to-aura-glow flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient-aura">
            AURA TRACKER
          </span>
        </Link>

        {/* Currency Display */}
        <div className="flex items-center gap-6">
          <Sheet open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Search className="h-4 w-4" />
                Rechercher un joueur
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Rechercher un joueur</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pseudo, ID..."
                  autoFocus
                  className="h-12 border-border/50"
                />
                <ScrollArea className="max-h-[60vh]">
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
                            {u.username.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <span
                            className="block text-sm font-medium"
                            style={u.usernameColor ? { color: u.usernameColor } : undefined}
                          >
                            {u.username}
                          </span>
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

          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="w-4 h-4 text-accent-green" />
            ) : (
              <WifiOff className="w-4 h-4 text-destructive" />
            )}
            <span className="text-xs text-muted-foreground">
              {connected ? 'Connecté' : 'Déconnecté'}
            </span>
          </div>

          {/* Aura */}
          <Badge variant="outline" className="gap-2 px-4 py-2 bg-aura/10 border-aura/30">
            <Sparkles className="w-4 h-4 text-aura-light" />
            <span className="text-lg font-semibold text-aura-light">
              {user?.aura.toLocaleString()}
            </span>
          </Badge>

          {/* Money */}
          <Badge variant="outline" className="gap-2 px-4 py-2 bg-money/10 border-money/30">
            <Coins className="w-4 h-4 text-money-light" />
            <span className="text-lg font-semibold text-money-light">
              ${user?.money.toLocaleString()}
            </span>
          </Badge>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary">
                      <User className="w-5 h-5 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user?.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/profile/${user?.id}`} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
