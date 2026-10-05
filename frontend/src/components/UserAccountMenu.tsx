import { Link } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Moon, Settings, Shield, Sun, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { resolveImageUrl } from '@/lib/images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { UsernameDisplay } from '@/components/ui/username-display';

export function UserAccountMenu() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isMobile } = useSidebar();

  if (!user) return null;

  const initials = user.username
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const canAccessAdmin = user.isAdmin || user.isSuperAdmin || user.isFiscalInspector || user.isJudge;
  const isAdmin = user.isAdmin || user.isSuperAdmin;

  const identity = (
    <>
      <Avatar className="size-8 rounded-lg">
        {user.profilePicture ? <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.username} /> : null}
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <UsernameDisplay
          username={user.username}
          firstName={user.firstName}
          usernameColor={user.usernameColor}
          usernameClassName="font-medium"
        />
        <span className="truncate text-xs text-muted-foreground">{user.email || 'Utilisateur'}</span>
      </div>
    </>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          {identity}
          <ChevronsUpDown className="ml-auto size-4" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side={isMobile ? 'bottom' : 'right'}
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">{identity}</div>
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
              Réglages
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </DropdownMenuItem>
          {canAccessAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <Shield />
                {isAdmin ? 'Administration' : 'Inspection fiscale'}
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
