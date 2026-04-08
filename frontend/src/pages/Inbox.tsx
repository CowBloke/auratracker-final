import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BadgeCheck,
  BadgeX,
  Bell,
  CheckCheck,
  Crown,
  Eye,
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
  Sword,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserMinus,
  UserRoundPlus,
  Users,
  Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/loading-skeletons';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { type Notification } from '@/services/api';

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  AURA_RECEIVED: ({ className }) => <CurrencyIcon type="aura" className={className} />,
  MONEY_RECEIVED: ({ className }) => <CurrencyIcon type="money" className={className} />,
  ITEM_RECEIVED: ({ className }) => <Package className={className} />,
  QUEST_COMPLETED: ({ className }) => <Zap className={className} />,
  CLAN_MESSAGE: ({ className }) => <MessageSquare className={className} />,
  CLAN_JOIN_REQUEST: ({ className }) => <Users className={className} />,
  CLAN_JOIN_ACCEPTED: ({ className }) => <Users className={className} />,
  CLAN_JOIN_REJECTED: ({ className }) => <Users className={className} />,
  CLAN_WAR_DECLARED: ({ className }) => <Sword className={className} />,
  CLAN_WAR_COMPLETED: ({ className }) => <Shield className={className} />,
  CLAN_WAR_WON: ({ className }) => <Trophy className={className} />,
  CLAN_WAR_LOST: ({ className }) => <ShieldX className={className} />,
  POLYMARKET_WIN: ({ className }) => <TrendingUp className={className} />,
  POLYMARKET_LOSS: ({ className }) => <TrendingDown className={className} />,
  PARTY_INVITE: ({ className }) => <Sword className={className} />,
  SOCIAL_FOLLOW: ({ className }) => <UserRoundPlus className={className} />,
  SOCIAL_CONNECTION: ({ className }) => <Users className={className} />,
  DIRECT_MESSAGE: ({ className }) => <MessageSquare className={className} />,
  ADMIN: ({ className }) => <Megaphone className={className} />,
  SYSTEM: ({ className }) => <Info className={className} />,
};

const ICON_NAME_MAP: Record<string, React.FC<{ className?: string }>> = {
  package: ({ className }) => <Package className={className} />,
  users: ({ className }) => <Users className={className} />,
  check: ({ className }) => <Zap className={className} />,
  megaphone: ({ className }) => <Megaphone className={className} />,
  'dollar-sign': ({ className }) => <CurrencyIcon type="money" className={className} />,
  'shopping-bag': ({ className }) => <ShoppingBag className={className} />,
  coins: ({ className }) => <CurrencyIcon type="money" className={className} />,
  'gamepad-2': ({ className }) => <Gamepad2 className={className} />,
  crown: ({ className }) => <Crown className={className} />,
  'message-square': ({ className }) => <MessageSquare className={className} />,
  'thumbs-up': ({ className }) => <ThumbsUp className={className} />,
  'thumbs-down': ({ className }) => <ThumbsDown className={className} />,
  trophy: ({ className }) => <Trophy className={className} />,
  shield: ({ className }) => <Shield className={className} />,
  'shield-check': ({ className }) => <ShieldCheck className={className} />,
  'shield-x': ({ className }) => <ShieldX className={className} />,
  'triangle-alert': ({ className }) => <Info className={className} />,
  'badge-check': ({ className }) => <BadgeCheck className={className} />,
  'badge-x': ({ className }) => <BadgeX className={className} />,
  'chart-no-axes-column': ({ className }) => <TrendingUp className={className} />,
  'chart-candlestick': ({ className }) => <TrendingUp className={className} />,
  'chart-no-axes-column-increasing': ({ className }) => <TrendingUp className={className} />,
  'trending-up': ({ className }) => <TrendingUp className={className} />,
  'trending-down': ({ className }) => <TrendingDown className={className} />,
  swords: ({ className }) => <Sword className={className} />,
  'user-minus': ({ className }) => <UserMinus className={className} />,
  'user-round-pen': ({ className }) => <Users className={className} />,
};

const CLAN_TYPES = [
  'CLAN_MESSAGE',
  'CLAN_JOIN_REQUEST',
  'CLAN_JOIN_ACCEPTED',
  'CLAN_JOIN_REJECTED',
  'CLAN_WAR_DECLARED',
  'CLAN_WAR_COMPLETED',
  'CLAN_WAR_WON',
  'CLAN_WAR_LOST',
];
const POLY_TYPES = ['POLYMARKET_WIN', 'POLYMARKET_LOSS'];
const SYS_TYPES = ['ADMIN', 'SYSTEM'];

const CATEGORIES = [
  { id: 'all', label: 'Tout', Icon: Inbox, types: null },
  { id: 'unread', label: 'Non lus', Icon: Eye, types: null },
  { id: 'aura', label: 'Aura', Icon: ({ className }: { className?: string }) => <CurrencyIcon type="aura" className={className} />, types: ['AURA_RECEIVED'] },
  { id: 'clans', label: 'Clans', Icon: Users, types: CLAN_TYPES },
  { id: 'social', label: 'Social', Icon: MessageSquare, types: ['SOCIAL_FOLLOW', 'SOCIAL_CONNECTION', 'DIRECT_MESSAGE'] },
  { id: 'quetes', label: 'Quetes', Icon: Zap, types: ['QUEST_COMPLETED'] },
  { id: 'polymarket', label: 'Polymarket', Icon: TrendingUp, types: POLY_TYPES },
  { id: 'systeme', label: 'Systeme', Icon: Info, types: SYS_TYPES },
  { id: 'archived', label: 'Archive', Icon: Archive, types: null },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

function filterNotifications(notifications: Notification[], id: CategoryId): Notification[] {
  const cat = CATEGORIES.find((category) => category.id === id);
  if (!cat || id === 'all') return notifications;
  if (id === 'unread') return notifications.filter((notification) => !notification.isRead);
  if (id === 'polymarket') {
    return notifications.filter((notification) =>
      POLY_TYPES.includes(notification.type)
      || notification.link === '/polymarket'
      || notification.link === '/games/polymarket'
      || (
        notification.icon !== null
        && [
          'chart-no-axes-column',
          'chart-candlestick',
          'chart-no-axes-column-increasing',
          'trending-up',
          'trending-down',
          'badge-check',
          'badge-x',
        ].includes(notification.icon)
      )
    );
  }
  if (cat.types) return notifications.filter((notification) => (cat.types as readonly string[]).includes(notification.type));
  return notifications;
}

function NotificationRow({
  notification,
  onRead,
  onArchive,
  onUnarchive,
  isArchiveView,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  isArchiveView: boolean;
}) {
  const navigate = useNavigate();
  const IconComp = (
    (notification.icon && ICON_NAME_MAP[notification.icon])
    || TYPE_ICON[notification.type]
    || (({ className }: { className?: string }) => <Bell className={className} />)
  );

  const date = new Date(notification.createdAt);
  const isToday = Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
  const dateLabel = isToday
    ? formatDistanceToNow(date, { addSuffix: false, locale: fr })
    : format(date, 'dd MMM', { locale: fr });

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-3 border-b border-border/40 px-4 py-3 transition-colors last:border-b-0 sm:px-5',
        !notification.isRead && !isArchiveView && 'bg-muted/[0.32]',
        notification.link && 'cursor-pointer hover:bg-muted/45'
      )}
    >
      <div className="flex w-2 shrink-0 justify-center pt-1.5">
        {!notification.isRead && !isArchiveView ? <span className="h-1.5 w-1.5 rounded-full bg-foreground/70" /> : null}
      </div>

      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted/20 text-muted-foreground">
        <IconComp className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('text-sm leading-5', !notification.isRead && !isArchiveView ? 'font-medium text-foreground' : 'text-foreground/88')}>
            {notification.title}
          </span>
          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground/70">{dateLabel}</span>
        </div>
        <p className="truncate text-sm leading-5 text-muted-foreground">{notification.body}</p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!notification.isRead && !isArchiveView ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Marquer comme lu"
            onClick={(event) => {
              event.stopPropagation();
              onRead(notification.id);
            }}
          >
            <CheckCheck className="h-3 w-3" />
          </Button>
        ) : null}

        {isArchiveView ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Desarchiver"
            onClick={(event) => {
              event.stopPropagation();
              onUnarchive(notification.id);
            }}
          >
            <Inbox className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Archiver"
            onClick={(event) => {
              event.stopPropagation();
              onArchive(notification.id);
            }}
          >
            <Archive className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');

  const {
    notifications,
    archivedNotifications,
    unreadCount,
    loading,
    loadingArchived,
    hasMore,
    hasMoreArchived,
    fetchNotifications,
    fetchArchived,
    markRead,
    markAllRead,
    archiveNotification,
    unarchiveNotification,
    archiveAllRead,
  } = useNotifications();

  const isArchiveView = activeCategory === 'archived';

  useEffect(() => {
    if (isArchiveView) fetchArchived({ reset: true });
  }, [fetchArchived, isArchiveView]);

  const filteredNotifications = useMemo(() => {
    if (isArchiveView) return archivedNotifications;
    return filterNotifications(notifications, activeCategory);
  }, [activeCategory, archivedNotifications, isArchiveView, notifications]);

  const categoryCounts = useMemo(() => {
    const unreadNotifications = notifications.filter((notification) => !notification.isRead);

    return {
      all: unreadNotifications.length,
      unread: unreadNotifications.length,
      aura: unreadNotifications.filter((notification) => notification.type === 'AURA_RECEIVED').length,
      clans: unreadNotifications.filter((notification) => CLAN_TYPES.includes(notification.type)).length,
      social: unreadNotifications.filter((notification) => ['SOCIAL_FOLLOW', 'SOCIAL_CONNECTION'].includes(notification.type)).length,
      quetes: unreadNotifications.filter((notification) => notification.type === 'QUEST_COMPLETED').length,
      polymarket: unreadNotifications.filter((notification) => POLY_TYPES.includes(notification.type)).length,
      systeme: unreadNotifications.filter((notification) => SYS_TYPES.includes(notification.type)).length,
      archived: 0,
    } as Record<CategoryId, number>;
  }, [notifications]);

  const description = isArchiveView
    ? `${archivedNotifications.length} message${archivedNotifications.length !== 1 ? 's' : ''} archive${archivedNotifications.length !== 1 ? 's' : ''}`
    : unreadCount > 0
      ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
      : 'Tout est a jour';

  return (
    <PageShell className="w-full">
      <PageHeader
        title="Inbox"
        description={description}
        actions={!isArchiveView ? (
          <>
            {unreadCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                className="gap-1.5 border-border/60 bg-background shadow-none"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout marquer comme lu
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={archiveAllRead}
              className="gap-1.5 border-border/60 bg-background text-muted-foreground shadow-none hover:text-foreground"
            >
              <Archive className="h-3.5 w-3.5" />
              Archiver les lus
            </Button>
          </>
        ) : undefined}
      />

      <Card className="overflow-hidden border-border/50 bg-background p-0 shadow-none">
        <div className="flex min-h-[420px] flex-col md:flex-row">
          <div className="shrink-0 border-b border-border/40 bg-muted/10 p-2 md:w-48 md:border-b-0 md:border-r">
            {CATEGORIES.map((category) => {
              const count = categoryCounts[category.id] ?? 0;
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-background text-foreground'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                  )}
                >
                  <category.Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{category.label}</span>
                  {count > 0 ? (
                    <span className="shrink-0 rounded-full bg-foreground/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {(isArchiveView ? loadingArchived : loading) && filteredNotifications.length === 0 ? (
              <div className="flex-1 p-4">
                <ListSkeleton rows={5} showAvatar={false} showActions />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
                {isArchiveView ? <Archive className="h-8 w-8 text-muted-foreground/30" /> : <Bell className="h-8 w-8 text-muted-foreground/30" />}
                <p className="text-sm text-muted-foreground">
                  {isArchiveView ? 'Aucun message archive' : 'Aucune notification'}
                </p>
              </div>
            ) : (
              <>
                {filteredNotifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onRead={markRead}
                    onArchive={archiveNotification}
                    onUnarchive={unarchiveNotification}
                    isArchiveView={isArchiveView}
                  />
                ))}

                {(isArchiveView ? hasMoreArchived : hasMore) ? (
                  <div className="flex justify-center border-t border-border/40 p-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/60 bg-background shadow-none"
                      onClick={() => {
                        if (isArchiveView) {
                          fetchArchived();
                          return;
                        }
                        fetchNotifications();
                      }}
                    >
                      Charger plus
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
