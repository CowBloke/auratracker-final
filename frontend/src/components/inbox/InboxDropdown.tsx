import { useEffect, useRef, useState, type ComponentType, type UIEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  BadgeCheck,
  BadgeX,
  Bell,
  Building2,
  Check,
  CheckCheck,
  Coins,
  Crown,
  DollarSign,
  ExternalLink,
  Gamepad2,
  Info,
  Megaphone,
  MessageSquare,
  Package,
  Shield,
  ShieldCheck,
  ShieldX,
  ShoppingBag,
  Star,
  Sword,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserMinus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/contexts/NotificationContext';
import { youApi, type Notification } from '@/services/api';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  AURA_RECEIVED: Star,
  MONEY_RECEIVED: DollarSign,
  ITEM_RECEIVED: Package,
  CLAN_JOIN_REQUEST: Users,
  CLAN_JOIN_ACCEPTED: Users,
  CLAN_JOIN_REJECTED: Users,
  CLAN_WAR_DECLARED: Sword,
  CLAN_WAR_COMPLETED: Shield,
  CLAN_WAR_WON: Trophy,
  CLAN_WAR_LOST: ShieldX,
  QUEST_COMPLETED: Zap,
  POLYMARKET_WIN: TrendingUp,
  POLYMARKET_LOSS: TrendingDown,
  PARTY_INVITE: Sword,
  ADMIN: Megaphone,
  SYSTEM: Info,
};

const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  AURA_RECEIVED:      { bg: 'bg-amber-500/15',   text: 'text-amber-500' },
  MONEY_RECEIVED:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-500' },
  ITEM_RECEIVED:      { bg: 'bg-blue-500/15',     text: 'text-blue-500' },
  CLAN_JOIN_REQUEST:  { bg: 'bg-violet-500/15',   text: 'text-violet-500' },
  CLAN_JOIN_ACCEPTED: { bg: 'bg-emerald-500/15',  text: 'text-emerald-500' },
  CLAN_JOIN_REJECTED: { bg: 'bg-red-500/15',      text: 'text-red-500' },
  CLAN_WAR_DECLARED:  { bg: 'bg-orange-500/15',   text: 'text-orange-500' },
  CLAN_WAR_COMPLETED: { bg: 'bg-blue-500/15',     text: 'text-blue-500' },
  CLAN_WAR_WON:       { bg: 'bg-amber-500/15',    text: 'text-amber-500' },
  CLAN_WAR_LOST:      { bg: 'bg-red-500/15',      text: 'text-red-500' },
  QUEST_COMPLETED:    { bg: 'bg-purple-500/15',   text: 'text-purple-500' },
  POLYMARKET_WIN:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-500' },
  POLYMARKET_LOSS:    { bg: 'bg-red-500/15',      text: 'text-red-500' },
  PARTY_INVITE:       { bg: 'bg-orange-500/15',   text: 'text-orange-500' },
  ADMIN:              { bg: 'bg-rose-500/15',      text: 'text-rose-500' },
  SYSTEM:             { bg: 'bg-sky-500/15',       text: 'text-sky-500' },
};

const ICON_NAME_MAP: Record<string, ComponentType<{ className?: string }>> = {
  star: Star,
  package: Package,
  users: Users,
  check: Zap,
  megaphone: Megaphone,
  'dollar-sign': DollarSign,
  'shopping-bag': ShoppingBag,
  coins: Coins,
  'gamepad-2': Gamepad2,
  crown: Crown,
  'message-square': MessageSquare,
  'thumbs-up': ThumbsUp,
  'thumbs-down': ThumbsDown,
  trophy: Trophy,
  shield: Shield,
  'shield-check': ShieldCheck,
  'shield-x': ShieldX,
  'triangle-alert': Info,
  'badge-check': BadgeCheck,
  'badge-x': BadgeX,
  'chart-no-axes-column': TrendingUp,
  'chart-candlestick': TrendingUp,
  'chart-no-axes-column-increasing': TrendingUp,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  swords: Sword,
  'user-minus': UserMinus,
  'user-round-pen': Users,
  'briefcase-business': Building2,
  landmark: Building2,
  'credit-card': DollarSign,
};

function getBusinessInvitationId(notification: Notification) {
  const invitationId = notification.data?.invitationId;
  return typeof invitationId === 'string' && invitationId.length > 0 ? invitationId : null;
}

function isBusinessInvitation(notification: Notification) {
  const actionType = notification.data?.actionType;
  return actionType === 'BUSINESS_INVITATION' || Boolean(getBusinessInvitationId(notification));
}

async function withNotificationFallback<T>(fn: () => Promise<T>, errorMessage: string) {
  try {
    return await fn();
  } catch (error: any) {
    const apiMessage = typeof error?.response?.data?.error === 'string' ? error.response.data.error : null;
    toast.error(apiMessage || errorMessage);
    throw error;
  }
}

function NotificationCard({
  notification,
  actingKey,
  onDismiss,
  onNavigate,
  onAcceptBusinessInvite,
  onDeclineBusinessInvite,
}: {
  notification: Notification;
  actingKey: string | null;
  onDismiss: (notification: Notification) => Promise<void>;
  onNavigate: (notification: Notification) => Promise<void>;
  onAcceptBusinessInvite: (notification: Notification) => Promise<void>;
  onDeclineBusinessInvite: (notification: Notification) => Promise<void>;
}) {
  const ago = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr });
  const ResolvedIcon = (notification.icon && ICON_NAME_MAP[notification.icon]) || TYPE_ICON[notification.type] || Bell;
  const color = TYPE_COLOR[notification.type] ?? { bg: 'bg-muted/30', text: 'text-muted-foreground' };
  const isUnread = !notification.isRead;
  const isInvite = isBusinessInvitation(notification);

  return (
    <article
      className={cn(
        'group relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors duration-150',
        isUnread ? 'bg-muted/30' : 'hover:bg-muted/15',
        notification.link && 'cursor-pointer',
      )}
      onClick={() => {
        if (!notification.link) return;
        void onNavigate(notification);
      }}
    >
      {/* Colorful icon */}
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', color.bg)}>
        <ResolvedIcon className={cn('h-4 w-4', color.text)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pr-5">
        <div className="flex items-center gap-1.5">
          {isUnread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />}
          <p className="truncate text-[12px] font-semibold leading-tight text-foreground">{notification.title}</p>
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">{ago}</span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground">{notification.body}</p>

        {isInvite && (
          <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              disabled={actingKey !== null}
              onClick={() => void onAcceptBusinessInvite(notification)}
              className="h-6 rounded-full px-2.5 text-[10px] font-medium"
            >
              <Check className="mr-1 h-3 w-3" />
              {actingKey === `${notification.id}:accept` ? '…' : t('inbox_accept')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actingKey !== null}
              onClick={() => void onDeclineBusinessInvite(notification)}
              className="h-6 rounded-full px-2.5 text-[10px] font-medium"
            >
              <X className="mr-1 h-3 w-3" />
              {actingKey === `${notification.id}:decline` ? '…' : t('inbox_decline')}
            </Button>
          </div>
        )}
      </div>

      {/* Dismiss button (visible on hover) */}
      <button
        type="button"
        className="absolute right-2 top-2.5 rounded-full p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          void onDismiss(notification);
        }}
        title={t('inbox_dismiss')}
      >
        <X className="h-3 w-3" />
      </button>
    </article>
  );
}

export function InboxDropdown() {
  const [open, setOpen] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchNotifications,
    markRead,
    markAllRead,
    archiveAllRead,
    dismissNotification,
  } = useNotifications();

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDismiss = async (notification: Notification) => {
    const actionKey = `${notification.id}:dismiss`;
    setActingKey(actionKey);
    try {
      if (!notification.isRead) await markRead(notification.id);
      await dismissNotification(notification.id);
    } finally {
      setActingKey(null);
    }
  };

  const handleNavigate = async (notification: Notification) => {
    if (!notification.isRead) await markRead(notification.id);
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const handleBusinessInvitationDecision = async (notification: Notification, decision: 'accept' | 'reject') => {
    const invitationId = getBusinessInvitationId(notification);
    if (!invitationId) {
      toast.error(t('inbox_invitation_missing_info'));
      return;
    }

    const actionKey = `${notification.id}:${decision === 'accept' ? 'accept' : 'decline'}`;
    setActingKey(actionKey);
    try {
      await withNotificationFallback(
        () => youApi.respondToBusinessInvitation(invitationId, decision),
        t('inbox_invitation_response_error')
      );
      if (!notification.isRead) await markRead(notification.id);
      await dismissNotification(notification.id);
      toast.success(decision === 'accept' ? t('inbox_invitation_accepted') : t('inbox_invitation_declined'));
    } finally {
      setActingKey(null);
    }
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 120 && hasMore && !loading) {
      void fetchNotifications();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen((value) => !value)}
        className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        title={t('inbox_title')}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-xl dark:bg-card/95">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{t('inbox_title')}</span>
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      title={t('inbox_mark_all_read')}
                      onClick={() => void markAllRead()}
                      className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title={t('inbox_archive_read')}
                    onClick={() => void archiveAllRead()}
                    className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <Link
                to="/inbox"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                {t('inbox_see_all')}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[min(28rem,65vh)] overflow-y-auto px-2 py-2" onScroll={handleScroll}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                {t('common_loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30">
                  <Bell className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground">{t('inbox_empty_title')}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t('inbox_empty_message')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {notifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    actingKey={actingKey}
                    onDismiss={handleDismiss}
                    onNavigate={handleNavigate}
                    onAcceptBusinessInvite={(entry) => handleBusinessInvitationDecision(entry, 'accept')}
                    onDeclineBusinessInvite={(entry) => handleBusinessInvitationDecision(entry, 'reject')}
                  />
                ))}
                {loading && notifications.length > 0 ? (
                  <p className="pb-1 pt-2 text-center text-[10px] text-muted-foreground">{t('common_loading')}</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
