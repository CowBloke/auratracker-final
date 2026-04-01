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
  Inbox,
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
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/contexts/NotificationContext';
import { youApi, type Notification } from '@/services/api';
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

const TONE_MAP: Record<string, { shell: string; iconWrap: string; icon: string }> = {
  default: {
    shell: 'border-border/50 bg-background/95 dark:bg-card/95',
    iconWrap: 'border border-border/50 bg-muted/25',
    icon: 'text-muted-foreground',
  },
};

function getNotificationTone(notification: Notification) {
  void notification;
  return TONE_MAP.default;
}

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
  const tone = getNotificationTone(notification);
  const isUnread = !notification.isRead;
  const isInvite = isBusinessInvitation(notification);

  const actionButtonClass = 'h-8 rounded-full border border-border/60 bg-background px-3 text-[11px] font-medium text-muted-foreground shadow-none transition-colors hover:bg-muted/60 hover:text-foreground';
  const primaryButtonClass = 'h-8 rounded-full border border-border/60 bg-foreground px-3 text-[11px] font-medium text-background shadow-none transition-colors hover:opacity-90 dark:bg-foreground dark:text-background';

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 shadow-none transition-colors duration-200',
        tone.shell,
        notification.link && 'cursor-pointer hover:bg-muted/35',
        isUnread && 'bg-muted/[0.32]'
      )}
      onClick={() => {
        if (!notification.link) return;
        void onNavigate(notification);
      }}
    >
      <div className="relative flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', tone.iconWrap)}>
          <ResolvedIcon className={cn('h-5 w-5', tone.icon)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight text-foreground">{notification.title}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{notification.body}</p>
            </div>

            <div className="flex items-center gap-2 pl-1">
              {isUnread ? <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" /> : null}
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground/70">{ago}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
            {isInvite ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className={primaryButtonClass}
                  disabled={actingKey !== null}
                  onClick={() => void onAcceptBusinessInvite(notification)}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  {actingKey === `${notification.id}:accept` ? 'Acceptation…' : 'Accepter'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={actionButtonClass}
                  disabled={actingKey !== null}
                  onClick={() => void onDeclineBusinessInvite(notification)}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  {actingKey === `${notification.id}:decline` ? 'Refus…' : 'Refuser'}
                </Button>
                {notification.link ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={actionButtonClass}
                    disabled={actingKey !== null}
                    onClick={() => void onNavigate(notification)}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Voir
                  </Button>
                ) : null}
              </>
            ) : notification.link ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className={primaryButtonClass}
                  disabled={actingKey !== null}
                  onClick={() => void onNavigate(notification)}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Ouvrir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={actionButtonClass}
                  disabled={actingKey !== null}
                  onClick={() => void onDismiss(notification)}
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" />
                  {actingKey === `${notification.id}:dismiss` ? 'Retrait…' : 'Lu et retirer'}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={actionButtonClass}
                disabled={actingKey !== null}
                onClick={() => void onDismiss(notification)}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                {actingKey === `${notification.id}:dismiss` ? 'Retrait…' : 'Lu et retirer'}
              </Button>
            )}
          </div>
        </div>
      </div>
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
      if (!notification.isRead) {
        await markRead(notification.id);
      }
      await dismissNotification(notification.id);
    } finally {
      setActingKey(null);
    }
  };

  const handleNavigate = async (notification: Notification) => {
    if (!notification.isRead) {
      await markRead(notification.id);
    }
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  const handleBusinessInvitationDecision = async (notification: Notification, decision: 'accept' | 'reject') => {
    const invitationId = getBusinessInvitationId(notification);
    if (!invitationId) {
      toast.error("Cette invitation n'a pas les informations necessaires.");
      return;
    }

    const actionKey = `${notification.id}:${decision === 'accept' ? 'accept' : 'decline'}`;
    setActingKey(actionKey);
    try {
      await withNotificationFallback(
        () => youApi.respondToBusinessInvitation(invitationId, decision),
        "Impossible de repondre a l'invitation."
      );

      if (!notification.isRead) {
        await markRead(notification.id);
      }
      await dismissNotification(notification.id);

      toast.success(
        decision === 'accept'
          ? 'Invitation acceptee.'
          : 'Invitation refusee.'
      );
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
        title="Boîte de réception"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[25rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[1.5rem] border border-border/60 bg-background/95 shadow-xl backdrop-blur-xl dark:bg-card/95">
          <div className="border-b border-border/50 px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-foreground">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Boîte de réception</p>
                    <p className="text-[11px] text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} à traiter` : 'Tout est lu'}
                    </p>
                  </div>
                </div>
              </div>

              {unreadCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void markAllRead()}
                  className="h-8 rounded-full border border-border/60 bg-background px-3 text-[11px] font-medium text-muted-foreground shadow-none hover:bg-muted/60 hover:text-foreground"
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Tout lire
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[min(32rem,70vh)] overflow-y-auto px-3 py-3" onScroll={handleScroll}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                Chargement…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-xs text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/50 bg-muted/20">
                  <Bell className="h-6 w-6 opacity-40" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Aucune notification</p>
                  <p className="mt-1">Les nouvelles alertes apparaîtront ici.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
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
                  <div className="pb-2 text-center text-[11px] text-muted-foreground">Chargement des notifications…</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-border/50 px-4 py-3">
            <Link
              to="/inbox"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-background px-4 py-2 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
