import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Star,
  Gift,
  Package,
  Users,
  Zap,
  DollarSign,
  Megaphone,
  TrendingUp,
  TrendingDown,
  Sword,
  Info,
  Archive,
  Inbox,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { useNotifications } from '@/contexts/NotificationContext';
import { type Notification } from '@/services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import GiftDialog from '@/components/gifts/GiftDialog';

// ── Icon / colour maps ──────────────────────────────────────────────────────
const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  AURA_RECEIVED:      ({ className }) => <Star className={className} />,
  MONEY_RECEIVED:     ({ className }) => <DollarSign className={className} />,
  GIFT_RECEIVED:      ({ className }) => <Gift className={className} />,
  ITEM_RECEIVED:      ({ className }) => <Package className={className} />,
  CLAN_INVITE:        ({ className }) => <Users className={className} />,
  CLAN_JOIN_REQUEST:  ({ className }) => <Users className={className} />,
  CLAN_JOIN_ACCEPTED: ({ className }) => <Users className={className} />,
  CLAN_JOIN_REJECTED: ({ className }) => <Users className={className} />,
  QUEST_COMPLETED:    ({ className }) => <Zap className={className} />,
  POLYMARKET_WIN:     ({ className }) => <TrendingUp className={className} />,
  POLYMARKET_LOSS:    ({ className }) => <TrendingDown className={className} />,
  PARTY_INVITE:       ({ className }) => <Sword className={className} />,
  ADMIN:              ({ className }) => <Megaphone className={className} />,
  SYSTEM:             ({ className }) => <Info className={className} />,
};

// ── Sidebar categories ──────────────────────────────────────────────────────
const CLAN_TYPES = ['CLAN_INVITE', 'CLAN_JOIN_REQUEST', 'CLAN_JOIN_ACCEPTED', 'CLAN_JOIN_REJECTED'];
const POLY_TYPES = ['POLYMARKET_WIN', 'POLYMARKET_LOSS'];
const SYS_TYPES  = ['ADMIN', 'SYSTEM'];

const CATEGORIES = [
  { id: 'all',        label: 'Tout',       Icon: Inbox,      types: null },
  { id: 'unread',     label: 'Non lus',    Icon: Eye,        types: null },
  { id: 'aura',       label: 'Aura',       Icon: Star,       types: ['AURA_RECEIVED'] },
  { id: 'cadeaux',    label: 'Cadeaux',    Icon: Gift,       types: ['GIFT_RECEIVED'] },
  { id: 'clans',      label: 'Clans',      Icon: Users,      types: CLAN_TYPES },
  { id: 'quetes',     label: 'Quêtes',     Icon: Zap,        types: ['QUEST_COMPLETED'] },
  { id: 'polymarket', label: 'Polymarket', Icon: TrendingUp, types: POLY_TYPES },
  { id: 'systeme',    label: 'Système',    Icon: Info,       types: SYS_TYPES },
  { id: 'archived',   label: 'Archivé',    Icon: Archive,    types: null },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

function filterNotifications(notifications: Notification[], id: CategoryId): Notification[] {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat || id === 'all') return notifications;
  if (id === 'unread') return notifications.filter((n) => !n.isRead);
  if (cat.types) return notifications.filter((n) => (cat.types as readonly string[]).includes(n.type));
  return notifications;
}

// ── Notification row ────────────────────────────────────────────────────────
function NotificationRow({
  n,
  onRead,
  onArchive,
  onUnarchive,
  onGiftClick,
  isArchiveView,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onGiftClick: () => void;
  isArchiveView: boolean;
}) {
  const navigate = useNavigate();
  const IconComp = TYPE_ICON[n.type] ?? (({ className }) => <Bell className={className} />);

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
        !n.isRead && !isArchiveView && 'bg-primary/[0.04]',
        (n.link || isGift) && 'cursor-pointer hover:bg-muted/50'
      )}
    >
      {/* Unread dot */}
      <div className="flex w-2 shrink-0 justify-center">
        {!n.isRead && !isArchiveView && <span className="h-2 w-2 rounded-full bg-primary" />}
      </div>

      {/* Type icon */}
      <IconComp className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Title · body */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <span className={cn('text-sm', !n.isRead && !isArchiveView ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground')}>
          {n.title}
        </span>
        <span className="mx-1.5 text-sm text-muted-foreground/40">·</span>
        <span className="truncate text-sm text-muted-foreground">{n.body}</span>
      </div>

      {/* Date */}
      <span className="shrink-0 text-xs text-muted-foreground/60 tabular-nums">{dateStr}</span>

      {/* Hover actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {!n.isRead && !isArchiveView && (
          <Button
            type="button" size="icon" variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Marquer comme lu"
            onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
          >
            <CheckCheck className="h-3 w-3" />
          </Button>
        )}
        {isArchiveView ? (
          <Button
            type="button" size="icon" variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Désarchiver"
            onClick={(e) => { e.stopPropagation(); onUnarchive(n.id); }}
          >
            <Inbox className="h-3 w-3" />
          </Button>
        ) : (
          <Button
            type="button" size="icon" variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            title="Archiver"
            onClick={(e) => { e.stopPropagation(); onArchive(n.id); }}
          >
            <Archive className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);

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

  // Load archived on first switch to that tab
  useEffect(() => {
    if (isArchiveView) fetchArchived({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArchiveView]);

  const filtered = useMemo(() => {
    if (isArchiveView) return archivedNotifications;
    return filterNotifications(notifications, activeCategory);
  }, [isArchiveView, notifications, archivedNotifications, activeCategory]);

  // Per-category unread counts for sidebar badges
  const catCounts = useMemo(() => {
    const unread = notifications.filter((n) => !n.isRead);
    return {
      all:        unread.length,
      unread:     unread.length,
      aura:       unread.filter((n) => n.type === 'AURA_RECEIVED').length,
      cadeaux:    unread.filter((n) => n.type === 'GIFT_RECEIVED').length,
      clans:      unread.filter((n) => CLAN_TYPES.includes(n.type)).length,
      quetes:     unread.filter((n) => n.type === 'QUEST_COMPLETED').length,
      polymarket: unread.filter((n) => POLY_TYPES.includes(n.type)).length,
      systeme:    unread.filter((n) => SYS_TYPES.includes(n.type)).length,
      archived:   0,
    } as Record<CategoryId, number>;
  }, [notifications]);

  return (
    <div className={cn('w-full', SPACING.PAGE_BODY_PADDING, SPACING.PAGE_SPACING)}>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={TYPOGRAPHY.PAGE_DESCRIPTION}>
          {isArchiveView
            ? `${archivedNotifications.length} message${archivedNotifications.length !== 1 ? 's' : ''} archivé${archivedNotifications.length !== 1 ? 's' : ''}`
            : unreadCount > 0
              ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
              : 'Tout est à jour'}
        </p>
        {!isArchiveView && (
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
                <CheckCheck className="h-3.5 w-3.5" />
                Tout marquer comme lu
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={archiveAllRead} className="gap-1.5 text-muted-foreground">
              <Archive className="h-3.5 w-3.5" />
              Archiver les lus
            </Button>
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="overflow-hidden p-0">
        <div className="flex min-h-[400px]">

          {/* ── Left sidebar ─────────────────────────────────────────── */}
          <div className="w-40 shrink-0 border-r border-border/40 p-1.5 space-y-0.5">
            {CATEGORIES.map((cat) => {
              const count = catCounts[cat.id] ?? 0;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left',
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <cat.Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{cat.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-semibold bg-primary/15 text-primary rounded px-1 shrink-0">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Content ──────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col">
            {(isArchiveView ? loadingArchived : loading) && filtered.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <p className={TYPOGRAPHY.MUTED}>Chargement…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
                {isArchiveView ? <Archive className="h-8 w-8 text-muted-foreground/30" /> : <Bell className="h-8 w-8 text-muted-foreground/30" />}
                <p className={TYPOGRAPHY.MUTED}>
                  {isArchiveView ? 'Aucun message archivé' : 'Aucune notification'}
                </p>
              </div>
            ) : (
              <>
                {filtered.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onRead={markRead}
                    onArchive={archiveNotification}
                    onUnarchive={unarchiveNotification}
                    onGiftClick={() => setGiftDialogOpen(true)}
                    isArchiveView={isArchiveView}
                  />
                ))}

                {/* Load more */}
                {(isArchiveView ? hasMoreArchived : hasMore) && (
                  <div className="flex justify-center p-4">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => isArchiveView ? fetchArchived() : fetchNotifications()}
                    >
                      Charger plus
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <GiftDialog
        open={giftDialogOpen}
        onOpenChange={setGiftDialogOpen}
        onGiftOpened={() => {}}
        initialTab="inbox"
      />
    </div>
  );
}
