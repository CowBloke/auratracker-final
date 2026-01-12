import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { Sparkles, Coins, User, LogOut, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

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
