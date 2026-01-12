import { NavLink, useLocation } from 'react-router-dom';
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
  { to: '/', label: 'Dashboard' },
  { to: '/games', label: 'Jeux' },
  { to: '/games/clash', label: 'Clash' },
  { to: '/leaderboards', label: 'Classement' },
  { to: '/marketplace', label: 'Marché' },
  { to: '/party', label: 'Party' },
  { to: '/inventory', label: 'Inventaire' },
];

export default function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <Sidebar variant="inset" className="border-r border-border/40">
      <SidebarHeader className="py-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/" className="flex items-center gap-3">
                <span className="text-lg font-light tracking-tight">aura</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-3 py-4">
          <SidebarMenu className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || 
                (item.to !== '/' && location.pathname.startsWith(item.to));
              
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive}
                    className={cn(
                      "h-9 px-3 text-sm font-normal",
                      isActive 
                        ? "text-foreground bg-muted/50" 
                        : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                    )}
                  >
                    <NavLink to={item.to} end={item.to === '/'}>
                      <span>{item.label}</span>
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
            }}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
