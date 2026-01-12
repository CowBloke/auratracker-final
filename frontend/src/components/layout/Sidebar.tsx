import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Gamepad2,
  Swords,
  Trophy,
  ShoppingBag,
  Users,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-card border-r p-4">
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200",
              isActive
                ? 'bg-primary/20 text-primary-foreground border border-primary/30'
                : item.highlight
                  ? 'text-accent-orange hover:text-white hover:bg-accent-orange/20 border border-accent-orange/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <item.icon className={cn("w-5 h-5", item.highlight && 'text-accent-orange')} />
            <span>{item.label}</span>
            {item.highlight && (
              <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0.5 bg-accent-orange/20 text-accent-orange border-accent-orange/30">
                NEW
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Quick Stats */}
      <div className="absolute bottom-4 left-4 right-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wide">
              Community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-2xl text-gradient-aura">
              40 Players
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Private Gaming Platform
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </aside>
  );
}
