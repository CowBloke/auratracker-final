import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Gamepad2,
  Swords,
  Trophy,
  ShoppingBag,
  Users,
  Package,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { NavUser } from '@/components/nav-user';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/games', icon: Gamepad2, label: 'Games' },
  { to: '/games/clash', icon: Swords, label: 'Clash', highlight: true },
  { to: '/leaderboards', icon: Trophy, label: 'Leaderboards' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/party', icon: Users, label: 'Party' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
];

export default function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <Sidebar variant="inset" className="border-t">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-aura to-aura-glow text-white">
                  <Sparkles className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">AURA TRACKER</span>
                  <span className="truncate text-xs">Gaming Platform</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 py-2">
          <div className="mb-2 px-2 text-xs font-semibold text-sidebar-foreground/70">
            Navigation
          </div>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || 
                (item.to !== '/' && location.pathname.startsWith(item.to));
              
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive}
                    tooltip={item.label}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <item.icon className={cn(
                        "size-4",
                        item.highlight && "text-accent-orange"
                      )} />
                      <span>{item.label}</span>
                      {item.highlight && (
                        <span className="ml-auto rounded-full bg-accent-orange/20 px-2 py-0.5 text-[10px] font-semibold text-accent-orange">
                          NEW
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              name: user.username,
              email: user.email || '',
              avatar: '',
            }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
