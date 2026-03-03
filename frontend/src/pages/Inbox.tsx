import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
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
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { useNotifications } from '@/contexts/NotificationContext';
import { type Notification } from '@/services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import GiftDialog from '@/components/gifts/GiftDialog';

// ── Icon / colour maps ─────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  AURA_RECEIVED:      ({ className }) => <Star className={className} />,
  MONEY_RECEIVED:     ({ className }) => <DollarSign className={className} />,
  GIFT_RECEIVED:      ({ className }) => <Gift className={className} />,
  ITEM_RECEIVED:      ({ className }) => <Package className={className} />,
  CLAN_INVITE:        ({ className }) => <Users className={className} />,
  CLAN_JOIN_REQUEST:  ({ className }) => <Users className={className} />,
  CLAN_JOIN_ACCEPTED: ({ className }) => <Users className={className} />,
  CLAN_JOIN_REJECTED: ({ className }) => <Users className={className} />,
  BADGE_EARNED:       ({ className }) => <Trophy className={className} />,
  QUEST_COMPLETED:    ({ className }) => <Zap className={className} />,
  POLYMARKET_WIN:     ({ className }) => <TrendingUp className={className} />,
  POLYMARKET_LOSS:    ({ className }) => <TrendingDown className={className} />,
  PARTY_INVITE:       ({ className }) => <Sword className={className} />,
  ADMIN:              ({ className }) => <Megaphone className={className} />,
  SYSTEM:             ({ className }) => <Info className={className} />,
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

const FILTERS = [
  { key: 'all',                                                                 label: 'Tout' },
  { key: 'unread',                                                              label: 'Non lus' },
  { key: 'AURA_RECEIVED',                                                       label: 'Aura' },
  { key: 'GIFT_RECEIVED',                                                       label: 'Cadeaux' },
  { key: 'CLAN_INVITE,CLAN_JOIN_REQUEST,CLAN_JOIN_ACCEPTED,CLAN_JOIN_REJECTED', label: 'Clans' },
  { key: 'BADGE_EARNED',                                                        label: 'Badges' },
  { key: 'QUEST_COMPLETED',                                                     label: 'Quêtes' },
  { key: 'POLYMARKET_WIN,POLYMARKET_LOSS',                                      label: 'Polymarket' },
  { key: 'ADMIN,SYSTEM',                                                        label: 'Système' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function NotificationRow({
  n,
  onRead,
  onDelete,
  onGiftClick,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onGiftClick: () => void;
}) {
  const navigate = useNavigate();
  const IconComp = TYPE_ICON[n.type] ?? (({ className }) => <Bell className={className} />);
  const color = TYPE_COLOR[n.type] ?? 'text-muted-foreground';

  const date = new Date(n.createdAt);
  const isToday = Date.now() - date.getTime() < 24 * 60 * 60 * 1000;
  const dateStr = isToday
    ? formatDistanceToNow(date, { addSuffix: false, locale: fr })
    : format(date, 'dd MMM', { locale: fr });

  const isGift = n.type === 'GIFT_RECEIVED';

  const handleClick = () => {
    if (!n.isRead) onRead(n.id);
    if (isGift) { onGiftClick(); return; }
    if (n.link) navigate(n.link);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-3 border-b border-border/30 px-3 py-2.5 transition-colors last:border-b-0',
        !n.isRead && 'bg-primary/[0.04]',
        (n.link || isGift) && 'cursor-pointer hover:bg-muted/50'
      )}
    >
      {/* Unread dot */}
      <div className="flex w-2 shrink-0 justify-center">
        {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary" />}
      </div>

      {/* Type icon */}
      <IconComp className={cn('h-4 w-4 shrink-0', color)} />

      {/* Title · body — single truncated line */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <span
          className={cn(
            'text-sm',
            !n.isRead ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'
          )}
        >
          {n.title}
        </span>
        <span className="mx-1.5 text-sm text-muted-foreground/40">·</span>
        <span className="truncate text-sm text-muted-foreground">{n.body}</span>
      </div>

      {/* Date */}
      <span className="shrink-0 text-xs text-muted-foreground/60 tabular-nums">{dateStr}</span>

      {/* Hover actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!n.isRead && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Marquer comme lu"
            onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
          >
            <CheckCheck className="h-3 w-3" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          title="Supprimer"
          onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function Inbox() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications();

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
    return filter.split(',').includes(n.type);
  });

  return (
    <div className={cn('w-full', SPACING.PAGE_BODY_PADDING, SPACING.PAGE_SPACING)}>
      {/* Actions row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={TYPOGRAPHY.PAGE_DESCRIPTION}>
          {unreadCount > 0
            ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
            : 'Tout est à jour'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              Tout marquer comme lu
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={deleteAllRead}
            className="gap-1.5 text-muted-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer les lus
          </Button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {loading && filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-10">
            <p className={TYPOGRAPHY.MUTED}>Chargement…</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10">
            <Bell className="h-8 w-8 text-muted-foreground/30" />
            <p className={TYPOGRAPHY.MUTED}>Aucune notification</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          {filtered.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onRead={markRead}
              onDelete={deleteNotification}
              onGiftClick={() => setGiftDialogOpen(true)}
            />
          ))}
        </Card>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => fetchNotifications()}>
            Charger plus
          </Button>
        </div>
      )}

      {/* Gift dialog — opened when a GIFT_RECEIVED notification is clicked */}
      <GiftDialog
        open={giftDialogOpen}
        onOpenChange={setGiftDialogOpen}
        onGiftOpened={() => {}}
        initialTab="inbox"
      />
    </div>
  );
}
