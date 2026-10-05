import { useState, type ComponentType, type UIEvent } from 'react';
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
  BellRing,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useNotifications } from '@/contexts/NotificationContext';
import { youApi, type Notification } from '@/services/api';
import { t } from '@/lib/i18n';

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

function getBusinessInvitationId(notification: Notification) {
  const invitationId = notification.data?.invitationId;
  return typeof invitationId === 'string' && invitationId.length > 0 ? invitationId : null;
}

function isBusinessInvitation(notification: Notification) {
  const actionType = notification.data?.actionType;
  return actionType === 'BUSINESS_INVITATION' || Boolean(getBusinessInvitationId(notification));
}

function isBusinessInvitationActionable(notification: Notification) {
  if (!isBusinessInvitation(notification)) return false;

  const invitationStatus = typeof notification.data?.invitationStatus === 'string'
    ? notification.data.invitationStatus
    : null;
  const invitationNeedsViewerAcceptance = typeof notification.data?.invitationNeedsViewerAcceptance === 'boolean'
    ? notification.data.invitationNeedsViewerAcceptance
    : null;

  if (invitationStatus !== null && invitationStatus !== 'PENDING') {
    return false;
  }

  if (invitationNeedsViewerAcceptance === false) {
    return false;
  }

  return true;
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
  const isUnread = !notification.isRead;
  const isInviteActionable = isBusinessInvitationActionable(notification);

  return (
    <Item
      size="sm"
      variant={isUnread ? 'muted' : 'default'}
      asChild={Boolean(notification.link)}
    >
      <div
        role={notification.link ? 'button' : undefined}
        tabIndex={notification.link ? 0 : undefined}
        onClick={() => {
          if (notification.link) void onNavigate(notification);
        }}
        onKeyDown={(event) => {
          if (notification.link && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            void onNavigate(notification);
          }
        }}
      >
        <ItemMedia variant="icon">
          <ResolvedIcon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {notification.title}
            {isUnread ? <Badge variant="secondary">Nouveau</Badge> : null}
          </ItemTitle>
          <ItemDescription>{notification.body}</ItemDescription>
          <span className="text-xs text-muted-foreground">{ago}</span>
          {isInviteActionable ? (
            <div className="flex gap-2 pt-1" onClick={(event) => event.stopPropagation()}>
              <Button
                type="button"
                size="xs"
                disabled={actingKey !== null}
                onClick={() => void onAcceptBusinessInvite(notification)}
              >
                <Check />
                {actingKey === `${notification.id}:accept` ? '…' : t('inbox_accept')}
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={actingKey !== null}
                onClick={() => void onDeclineBusinessInvite(notification)}
              >
                <X />
                {actingKey === `${notification.id}:decline` ? '…' : t('inbox_decline')}
              </Button>
            </div>
          ) : null}
        </ItemContent>
        <ItemActions>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t('inbox_dismiss')}
                onClick={(event) => {
                  event.stopPropagation();
                  void onDismiss(notification);
                }}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('inbox_dismiss')}</TooltipContent>
          </Tooltip>
        </ItemActions>
      </div>
    </Item>
  );
}

export function InboxDropdown() {
  const [open, setOpen] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    browserNotificationSupported,
    browserNotificationPermission,
    isIosBrowser,
    loading,
    hasMore,
    requestBrowserNotificationPermission,
    fetchNotifications,
    markRead,
    markAllRead,
    archiveAllRead,
    dismissNotification,
  } = useNotifications();

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
    const element = event.target as HTMLElement;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 120 && hasMore && !loading) {
      void fetchNotifications();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="relative" aria-label={t('inbox_title')}>
              <Bell />
              {unreadCount > 0 ? (
                <Badge className="absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full px-1 tabular-nums">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('inbox_title')}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)] p-0">
        <div className="flex items-center justify-between gap-2 p-3">
          <span className="text-sm font-semibold">{t('inbox_title')}</span>
          <div className="flex items-center gap-1">
            {notifications.length > 0 ? (
              <>
                {unreadCount > 0 ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t('inbox_mark_all_read')} onClick={() => void markAllRead()}>
                        <CheckCheck />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('inbox_mark_all_read')}</TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={t('inbox_archive_read')} onClick={() => void archiveAllRead()}>
                      <Archive />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('inbox_archive_read')}</TooltipContent>
                </Tooltip>
              </>
            ) : null}
            <Button asChild variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <Link to="/inbox">
                {t('inbox_see_all')}
                <ExternalLink />
              </Link>
            </Button>
          </div>
        </div>
        <Separator />
        {browserNotificationSupported && browserNotificationPermission !== 'granted' ? (
          <div className="p-2">
            <Alert>
              <BellRing />
              <AlertTitle>Activer les notifications système</AlertTitle>
              <AlertDescription>
                <p>
                  {isIosBrowser
                    ? "Sur iOS : ajoutez l'app à l'écran d'accueil, puis activez les notifications."
                    : 'Activez les notifications du navigateur pour recevoir les alertes en arrière-plan.'}
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => void requestBrowserNotificationPermission()}>
                  Activer
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        <ScrollArea className="h-[min(28rem,65vh)]" onScrollCapture={handleScroll}>
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner />
              {t('common_loading')}
            </div>
          ) : notifications.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Bell />
                </EmptyMedia>
                <EmptyTitle>{t('inbox_empty_title')}</EmptyTitle>
                <EmptyDescription>{t('inbox_empty_message')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col p-1">
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
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <Spinner />
                  {t('common_loading')}
                </div>
              ) : null}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
