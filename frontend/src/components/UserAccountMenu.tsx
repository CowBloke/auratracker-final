import { Link } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Moon, Settings, Shield, Sun, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UsernameDisplay } from '@/components/ui/username-display';

type UserAccountMenuProps = {
  className?: string;
  showLabel?: boolean;
};

export function UserAccountMenu({ className, showLabel = true }: UserAccountMenuProps) {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (!user) return null;

  const initials = user.username
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            showLabel
              ? 'h-9 gap-2 rounded-full border border-border/50 bg-background/70 px-2 hover:bg-muted/70'
              : 'h-8 w-8 rounded-full border-0 bg-transparent p-0 hover:bg-transparent',
            className
          )}
        >
          <Avatar className="h-7 w-7 rounded-full">
            {user.profilePicture ? (
              <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.username} className="rounded-full object-cover" />
            ) : null}
            <AvatarFallback className="rounded-full bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {showLabel ? (
            <>
              <UsernameDisplay
                username={user.username}
                firstName={user.firstName}
                usernameColor={user.usernameColor}
                className="hidden max-w-32 truncate sm:block"
                usernameClassName="font-medium"
              />
              <ChevronsUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
            </>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-lg">
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-full">
              {user.profilePicture ? (
                <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.username} className="rounded-full object-cover" />
              ) : null}
              <AvatarFallback className="rounded-full bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <UsernameDisplay
                username={user.username}
                firstName={user.firstName}
                usernameColor={user.usernameColor}
                usernameClassName="font-semibold"
              />
              <span className="truncate text-xs">{user.email || 'Utilisateur'}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to={`/profile/${user.id}`}>
              <User />
              Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings />
              Reglages
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {(user.isAdmin || user.isSuperAdmin || user.isFiscalInspector || user.isJudge) && (
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <Shield className={user.isAdmin || user.isSuperAdmin ? 'text-amber-500' : 'text-emerald-500'} />
                <span className={user.isAdmin || user.isSuperAdmin ? 'text-amber-500' : 'text-emerald-500'}>
                  {user.isAdmin || user.isSuperAdmin ? 'Administration' : 'Inspection fiscale'}
                </span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Deconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  );
}
