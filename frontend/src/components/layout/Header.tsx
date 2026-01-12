import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { Sparkles, Coins, User, LogOut, Wifi, WifiOff } from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-gray-700/50 z-50">
      <div className="flex items-center justify-between h-full px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-aura to-aura-glow flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="font-display text-xl font-bold text-gradient-aura">
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
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-xs text-gray-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Aura */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aura/10 border border-aura/30">
            <Sparkles className="w-5 h-5 text-aura-light" />
            <span className="font-mono text-lg font-semibold text-aura-light">
              {user?.aura.toLocaleString()}
            </span>
          </div>

          {/* Money */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-money/10 border border-money/30">
            <Coins className="w-5 h-5 text-money-light" />
            <span className="font-mono text-lg font-semibold text-money-light">
              ${user?.money.toLocaleString()}
            </span>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <Link
              to={`/profile/${user?.id}`}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <span className="font-medium">{user?.username}</span>
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
