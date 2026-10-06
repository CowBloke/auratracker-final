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
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNotifications } from '@/contexts/NotificationContext';
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
  const isUnread = !notification.isRead && !isArchiveView;

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id);
    if (notification.link) navigate(notification.link);
  };

  return (
    <Item
      variant={isUnread ? 'muted' : 'default'}
      role={notification.link ? 'button' : undefined}
      tabIndex={notification.link ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (notification.link && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      <ItemMedia variant="icon">
        <IconComp />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {notification.title}
          {isUnread ? <Badge variant="secondary">Nouveau</Badge> : null}
        </ItemTitle>
        <ItemDescription>{notification.body}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="text-xs tabular-nums text-muted-foreground">{dateLabel}</span>
        {!notification.isRead && !isArchiveView ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Marquer comme lu"
                onClick={(event) => {
                  event.stopPropagation();
                  onRead(notification.id);
                }}
              >
                <CheckCheck />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marquer comme lu</TooltipContent>
          </Tooltip>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={isArchiveView ? 'Désarchiver' : 'Archiver'}
              onClick={(event) => {
                event.stopPropagation();
                if (isArchiveView) onUnarchive(notification.id);
                else onArchive(notification.id);
              }}
            >
              {isArchiveView ? <Inbox /> : <Archive />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isArchiveView ? 'Désarchiver' : 'Archiver'}</TooltipContent>
        </Tooltip>
      </ItemActions>
    </Item>
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

  const isLoading = (isArchiveView ? loadingArchived : loading) && filteredNotifications.length === 0;

  return (
    <PageShell>
      <PageHeader
        description={description}
        actions={
          !isArchiveView ? (
            <>
              {unreadCount > 0 ? (
                <Button variant="outline" onClick={markAllRead}>
                  <CheckCheck />
                  Tout marquer comme lu
                </Button>
              ) : null}
              <Button variant="outline" onClick={archiveAllRead}>
                <Archive />
                Archiver les lus
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs
        value={activeCategory}
        onValueChange={(value) => setActiveCategory(value as CategoryId)}
        orientation="vertical"
        className="items-start gap-6 md:flex-row"
      >
        <TabsList className="h-auto w-full flex-row flex-wrap justify-start md:w-52 md:flex-col md:items-stretch">
          {CATEGORIES.map((category) => {
            const count = categoryCounts[category.id] ?? 0;
            return (
              <TabsTrigger key={category.id} value={category.id} className="justify-start">
                <category.Icon />
                <span className="flex-1 text-left">{category.label}</span>
                {count > 0 ? <Badge variant="secondary">{count}</Badge> : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <Card className="min-h-96 w-full min-w-0 flex-1 gap-0 py-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">{isArchiveView ? <Archive /> : <Bell />}</EmptyMedia>
                <EmptyTitle>{isArchiveView ? 'Aucun message archivé' : 'Aucune notification'}</EmptyTitle>
                <EmptyDescription>Les nouveaux éléments apparaîtront ici.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <ItemGroup>
                {filteredNotifications.map((notification, index) => (
                  <div key={notification.id}>
                    {index > 0 ? <ItemSeparator /> : null}
                    <NotificationRow
                      notification={notification}
                      onRead={markRead}
                      onArchive={archiveNotification}
                      onUnarchive={unarchiveNotification}
                      isArchiveView={isArchiveView}
                    />
                  </div>
                ))}
              </ItemGroup>

              {(isArchiveView ? hasMoreArchived : hasMore) ? (
                <div className="flex justify-center p-4">
                  <Button
                    variant="outline"
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
        </Card>
      </Tabs>
    </PageShell>
  );
}
