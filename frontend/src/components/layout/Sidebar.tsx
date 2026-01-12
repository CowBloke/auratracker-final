import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Gamepad2,
  Trophy,
  ShoppingBag,
  Users,
  Package,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/games', icon: Gamepad2, label: 'Games' },
  { to: '/leaderboards', icon: Trophy, label: 'Leaderboards' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/party', icon: Users, label: 'Party' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-surface border-r border-gray-700/50 p-4">
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary/20 text-primary-light border border-primary/30'
                  : 'text-gray-400 hover:text-white hover:bg-surface-hover'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Quick Stats */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="p-4 rounded-lg bg-background/50 border border-gray-700/50">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Community
          </p>
          <p className="text-2xl font-bold font-display text-gradient-aura">
            40 Players
          </p>
          <p className="text-sm text-gray-400 mt-1">Private Gaming Platform</p>
        </div>
      </div>
    </aside>
  );
}
