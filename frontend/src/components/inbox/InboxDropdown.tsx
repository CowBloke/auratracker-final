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
  money: {
    shell: 'border-emerald-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(236,253,245,0.92))] dark:border-emerald-500/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(6,95,70,0.24))]',
    iconWrap: 'bg-emerald-500/12 dark:bg-emerald-400/12',
    icon: 'text-emerald-600 dark:text-emerald-300',
  },
  violet: {
    shell: 'border-violet-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(245,243,255,0.92))] dark:border-violet-500/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(76,29,149,0.24))]',
    iconWrap: 'bg-violet-500/12 dark:bg-violet-400/12',
    icon: 'text-violet-600 dark:text-violet-300',
  },
  amber: {
    shell: 'border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,251,235,0.94))] dark:border-amber-500/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(146,64,14,0.24))]',
    iconWrap: 'bg-amber-500/12 dark:bg-amber-400/12',
    icon: 'text-amber-600 dark:text-amber-300',
  },
  blue: {
    shell: 'border-sky-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(240,249,255,0.94))] dark:border-sky-500/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(12,74,110,0.24))]',
    iconWrap: 'bg-sky-500/12 dark:bg-sky-400/12',
    icon: 'text-sky-600 dark:text-sky-300',
  },
  rose: {
    shell: 'border-rose-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,241,242,0.94))] dark:border-rose-500/20 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(159,18,57,0.24))]',
    iconWrap: 'bg-rose-500/12 dark:bg-rose-400/12',
    icon: 'text-rose-600 dark:text-rose-300',
  },
  slate: {
    shell: 'border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.97),rgba(30,41,59,0.94))]',
    iconWrap: 'bg-slate-500/10 dark:bg-slate-400/10',
    icon: 'text-slate-600 dark:text-slate-300',
  },
};

function getNotificationTone(notification: Notification) {
  if (notification.type === 'MONEY_RECEIVED' || notification.icon === 'dollar-sign' || notification.icon === 'coins') return TONE_MAP.money;
  if (notification.type === 'AURA_RECEIVED' || notification.icon === 'star' || notification.icon === 'crown') return TONE_MAP.violet;
  if (notification.icon === 'briefcase-business' || notification.icon === 'landmark' || notification.title.toLowerCase().includes('business')) return TONE_MAP.amber;
  if (notification.type === 'POLYMARKET_WIN' || notification.type === 'POLYMARKET_LOSS') return TONE_MAP.blue;
  if (notification.type === 'ADMIN') return TONE_MAP.rose;
  return TONE_MAP.slate;
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

  const actionButtonClass = 'h-8 rounded-full border border-white/60 bg-white/70 px-3 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10';
  const primaryButtonClass = 'h-8 rounded-full bg-slate-900 px-3 text-[11px] font-medium text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200';

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[1.35rem] border p-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)] transition-transform duration-200',
        tone.shell,
        notification.link && 'cursor-pointer hover:-translate-y-0.5',
        isUnread && 'ring-1 ring-white/40 dark:ring-white/8'
      )}
      onClick={() => {
        if (!notification.link) return;
        void onNavigate(notification);
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_70%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_70%)]" />

      <div className="relative flex items-start gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tone.iconWrap)}>
          <ResolvedIcon className={cn('h-5 w-5', tone.icon)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">{notification.title}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-300">{notification.body}</p>
            </div>

            <div className="flex items-center gap-2 pl-1">
              {isUnread ? <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.12)]" /> : null}
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{ago}</span>
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
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[25rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[1.9rem] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,247,251,0.94))] shadow-[0_28px_100px_-32px_rgba(15,23,42,0.7)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
          <div className="border-b border-slate-200/70 px-4 pb-3 pt-4 dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                    <Inbox className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Boîte de réception</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
                  className="h-8 rounded-full border border-white/60 bg-white/70 px-3 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Tout lire
                </Button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[min(32rem,70vh)] overflow-y-auto px-3 py-3" onScroll={handleScroll}>
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-500 dark:text-slate-400">
                Chargement…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/5 dark:bg-white/5">
                  <Bell className="h-6 w-6 opacity-40" />
                </div>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">Aucune notification</p>
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
                  <div className="pb-2 text-center text-[11px] text-slate-500 dark:text-slate-400">Chargement des notifications…</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
            <Link
              to="/inbox"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
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
