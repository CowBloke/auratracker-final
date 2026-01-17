"use client"

import { Link } from "react-router-dom"
import {
  User,
  ChevronsUpDown,
  LogOut,
  Moon,
  Sun,
  Settings,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { resolveImageUrl } from "@/lib/images"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
    usernameColor?: string | null
    profilePicture?: string | null
  }
}) {
  const { isMobile } = useSidebar()
  const { logout, user: authUser } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={user.name}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
            >
              <Avatar className="h-8 w-8 rounded-full">
                {user.profilePicture && (
                  <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.name} className="rounded-full object-cover" />
                )}
                <AvatarFallback className="rounded-full bg-primary">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span 
                  className="truncate font-semibold"
                  style={user.usernameColor ? { color: user.usernameColor } : undefined}
                >
                  {user.name}
                </span>
                <span className="truncate text-xs">{user.email || 'Utilisateur'}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  {user.profilePicture && (
                    <AvatarImage src={resolveImageUrl(user.profilePicture)} alt={user.name} className="rounded-full object-cover" />
                  )}
                  <AvatarFallback className="rounded-full bg-primary">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span 
                    className="truncate font-semibold"
                    style={user.usernameColor ? { color: user.usernameColor } : undefined}
                  >
                    {user.name}
                  </span>
                  <span className="truncate text-xs">{user.email || 'Utilisateur'}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to={`/profile/${authUser?.id}`}>
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
            <DropdownMenuItem onClick={logout}>
              <LogOut />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
