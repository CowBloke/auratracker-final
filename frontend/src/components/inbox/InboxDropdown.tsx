import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Inbox,
  Star,
  Gift,
  Package,
  Users,
  Trophy,
  Zap,
  DollarSign,
  Megaphone,
  TrendingUp,
  TrendingDown,
  Sword,
  Info,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';
import { type Notification } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Icon map keyed by notification type ──────────────────────────────────────
const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  AURA_RECEIVED: ({ className }) => <Star className={className} />,
  MONEY_RECEIVED: ({ className }) => <DollarSign className={className} />,
  GIFT_RECEIVED: ({ className }) => <Gift className={className} />,
  ITEM_RECEIVED: ({ className }) => <Package className={className} />,
  CLAN_INVITE: ({ className }) => <Users className={className} />,
  CLAN_JOIN_REQUEST: ({ className }) => <Users className={className} />,
  CLAN_JOIN_ACCEPTED: ({ className }) => <Users className={className} />,
  CLAN_JOIN_REJECTED: ({ className }) => <Users className={className} />,
  BADGE_EARNED: ({ className }) => <Trophy className={className} />,
  QUEST_COMPLETED: ({ className }) => <Zap className={className} />,
  POLYMARKET_WIN: ({ className }) => <TrendingUp className={className} />,
  POLYMARKET_LOSS: ({ className }) => <TrendingDown className={className} />,
  PARTY_INVITE: ({ className }) => <Sword className={className} />,
  ADMIN: ({ className }) => <Megaphone className={className} />,
  SYSTEM: ({ className }) => <Info className={className} />,
};

const TYPE_COLOR: Record<string, string> = {
  AURA_RECEIVED: 'text-muted-foreground',
  MONEY_RECEIVED: 'text-muted-foreground',
  GIFT_RECEIVED: 'text-muted-foreground',
  ITEM_RECEIVED: 'text-muted-foreground',
  CLAN_INVITE: 'text-muted-foreground',
  CLAN_JOIN_REQUEST: 'text-muted-foreground',
  CLAN_JOIN_ACCEPTED: 'text-muted-foreground',
  CLAN_JOIN_REJECTED: 'text-muted-foreground',
  BADGE_EARNED: 'text-muted-foreground',
  QUEST_COMPLETED: 'text-muted-foreground',
  POLYMARKET_WIN: 'text-muted-foreground',
  POLYMARKET_LOSS: 'text-muted-foreground',
  PARTY_INVITE: 'text-muted-foreground',
  ADMIN: 'text-muted-foreground',
  SYSTEM: 'text-muted-foreground',
};

function NotificationIcon({ type }: { type: string }) {
  const IconComp = TYPE_ICON[type] ?? (({ className }) => <Bell className={className} />);
  const color = TYPE_COLOR[type] ?? 'text-muted-foreground';
  return (
    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted', color)}>
      <IconComp className="h-4 w-4" />
    </div>
  );
}

function NotificationRow({
  notification,
  onRead,
  onDelete,
  onClose,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const ago = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr });

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
    if (notification.link) {
      onClose();
      navigate(notification.link);
    }
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
        !notification.isRead && 'bg-primary/5',
        notification.link && 'cursor-pointer hover:bg-muted/60'
      )}
      onClick={handleClick}
    >
      <NotificationIcon type={notification.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-xs font-medium leading-tight', !notification.isRead && 'text-foreground', notification.isRead && 'text-muted-foreground')}>
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-2">
          {notification.body}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">{ago}</p>
      </div>

      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="absolute right-2 top-2 hidden rounded p-0.5 text-muted-foreground/40 hover:text-destructive group-hover:flex"
        title="Supprimer"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function InboxDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, markRead, markAllRead, deleteNotification } = useNotifications();

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const recent = notifications.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        title="Boîte de réception"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border/60 bg-background/95 shadow-xl backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Boîte de réception</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="h-3 w-3" />
                Tout lire
              </Button>
            )}
          </div>

          {/* Notification list */}
          <ScrollArea className="max-h-80">
            {loading && recent.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                Chargement…
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted-foreground">
                <Bell className="h-6 w-6 opacity-30" />
                Aucune notification
              </div>
            ) : (
              <div className="py-1">
                {recent.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onRead={markRead}
                    onDelete={deleteNotification}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-border/30 px-3 py-2">
            <Link
              to="/inbox"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
