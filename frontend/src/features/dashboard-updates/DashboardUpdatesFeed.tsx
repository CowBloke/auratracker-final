import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loader2, ChevronDown, ChevronRight, Flame, Heart, Sparkles, Zap, ArrowUpRight, MessagesSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dashboardUpdatesApi, type DashboardUpdateEntry, type DashboardUpdateReaction } from '@/services/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { formatUpdateDateLabel, formatUpdateTimeLabel, renderUpdateRichText } from './shared';
import './dashboard-feed.css';

type FilterTab = 'tout' | 'GAME' | 'PATCH' | 'COMMUNITY' | 'DEV';

type FeedEntry = DashboardUpdateEntry & {
  image: string | null;
  authorAvatar: string;
};

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'tout', label: 'Tout' },
  { id: 'GAME', label: 'Jeux' },
  { id: 'PATCH', label: 'Patchs' },
  { id: 'COMMUNITY', label: 'Communaute' },
  { id: 'DEV', label: 'Equipe' },
];

const CATEGORY_META: Record<DashboardUpdateEntry['feedCategory'], { label: string; className: string }> = {
  GAME: {
    label: 'Jeux',
    className: 'is-game',
  },
  PATCH: {
    label: 'Patch',
    className: 'is-patch',
  },
  COMMUNITY: {
    label: 'Communaute',
    className: 'is-community',
  },
  DEV: {
    label: 'Equipe',
    className: 'is-dev',
  },
};

function ActionLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string | null;
  className: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  if (!href || href === '#') {
    return (
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    );
  }

  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={onClick}>
      {children}
    </a>
  );
}

function mapEntry(entry: DashboardUpdateEntry): FeedEntry {
  return {
    ...entry,
    image: entry.imageUrl ? resolveImageUrl(entry.imageUrl) : null,
    authorAvatar: resolveImageUrl(entry.author.avatarUrl || '/aura-icon.svg'),
  };
}

function getDateParts(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return {
      short: dateValue,
      full: dateValue,
    };
  }

  return {
    short: date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    }),
    full: formatUpdateDateLabel(dateValue),
  };
}

function getReactionMeta(kind: DashboardUpdateReaction['kind']) {
  if (kind === 'fire') {
    return {
      label: 'Flamme',
      Icon: Flame,
    };
  }
  if (kind === 'heart') {
    return {
      label: 'Coeur',
      Icon: Heart,
    };
  }
  return {
    label: 'Boost',
    Icon: Zap,
  };
}

function buildReactionTitle(reaction: DashboardUpdateReaction) {
  if (reaction.sampleUsers.length === 0) {
    return `${reaction.count} reaction${reaction.count > 1 ? 's' : ''}`;
  }

  const users = reaction.sampleUsers.map((user) => user.username).join(', ');
  return `${users}${reaction.count > reaction.sampleUsers.length ? ` et ${reaction.count - reaction.sampleUsers.length} autre(s)` : ''}`;
}

function applyOptimisticReaction(
  entries: DashboardUpdateEntry[],
  entryId: string,
  kind: DashboardUpdateReaction['kind'],
  nextReacted: boolean
) {
  return entries.map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }

    return {
      ...entry,
      reactions: entry.reactions.map((reaction) => {
        if (reaction.kind !== kind) {
          return reaction;
        }

        return {
          ...reaction,
          reacted: nextReacted,
          count: Math.max(0, reaction.count + (nextReacted ? 1 : -1)),
        };
      }),
    };
  });
}

function Welcome({
  welcomeName,
  showWelcome,
  heading,
  subheading,
  action,
}: {
  welcomeName?: string | null;
  showWelcome: boolean;
  heading: string;
  subheading: string;
  action?: ReactNode;
}) {
  return (
    <div className="db-welcome">
      <div className="db-welcome__copy">
        <h1>{showWelcome ? <>Yo <em>{welcomeName || 'toi'}</em>, y&apos;a du neuf.</> : heading}</h1>
        {subheading ? <p>{subheading}</p> : null}
      </div>
      {action ? <div className="db-welcome__action">{action}</div> : null}
    </div>
  );
}

function TeamNote({ entry }: { entry: FeedEntry | null }) {
  if (!entry) {
    return null;
  }

  return (
    <article className="db-notice">
      <div className="db-notice__icon">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="db-notice__body">
        <div className="db-notice__meta">
          <span>Mot d&apos;equipe</span>
          <span>·</span>
          <span>{formatUpdateTimeLabel(entry.publishedAt)}</span>
        </div>
        <h2>{entry.title}</h2>
        <p>{entry.summary}</p>
      </div>
      <ActionLink href={entry.ctaHref} className="db-inline-link">
        Ouvrir
        <ArrowUpRight className="h-3.5 w-3.5" />
      </ActionLink>
    </article>
  );
}

function FeedTabs({
  entries,
  value,
  onChange,
}: {
  entries: FeedEntry[];
  value: FilterTab;
  onChange: (value: FilterTab) => void;
}) {
  return (
    <div className="db-tabs">
      {TABS.map((tab) => {
        const count = tab.id === 'tout' ? entries.length : entries.filter((entry) => entry.feedCategory === tab.id).length;
        return (
          <button
            key={tab.id}
            type="button"
            className={cn('db-tabs__btn', value === tab.id && 'is-active')}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            <span className="db-tabs__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function AuthorRow({ entry }: { entry: FeedEntry }) {
  return (
    <div className="db-author">
      <img src={entry.authorAvatar} alt="" />
      <div>
        <strong>{entry.author.name}</strong>
        <span>{entry.author.role || CATEGORY_META[entry.feedCategory].label}</span>
      </div>
    </div>
  );
}

function ReactionBar({
  entry,
  pendingKey,
  onToggleReaction,
}: {
  entry: FeedEntry;
  pendingKey: string | null;
  onToggleReaction: (entryId: string, kind: DashboardUpdateReaction['kind'], reacted: boolean) => void;
}) {
  return (
    <div className="db-reactions">
      {entry.reactions.map((reaction) => {
        const { Icon, label } = getReactionMeta(reaction.kind);
        const isPending = pendingKey === `${entry.id}:${reaction.kind}`;

        return (
          <button
            key={reaction.kind}
            type="button"
            className={cn('db-reaction', reaction.reacted && 'is-active')}
            title={buildReactionTitle(reaction)}
            disabled={isPending}
            onClick={() => onToggleReaction(entry.id, reaction.kind, reaction.reacted)}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{reaction.count}</span>
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ExpandedEntry({ entry }: { entry: FeedEntry }) {
  return (
    <div className="db-expanded">
      <div className="db-expanded__body">
        <p>{entry.body || entry.summary}</p>
      </div>
      {entry.sections.length > 0 ? (
        <div className="db-expanded__sections">
          {entry.sections.map((section) => (
            <section key={`${entry.id}-${section.category}`} className="db-expanded__section">
              <h4>
                {section.category === 'BIG_FEATURE'
                  ? 'Grandes fonctionnalites'
                  : section.category === 'SMALL_FEATURE'
                    ? 'Ameliorations'
                    : 'Correctifs'}
              </h4>
              <div className="db-expanded__items">
                {section.items.map((item) => (
                  <div key={item.id} className="db-expanded__item">
                    {renderUpdateRichText(item.text)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Hero({
  entry,
  expanded,
  pendingKey,
  onToggleExpand,
  onToggleReaction,
}: {
  entry: FeedEntry;
  expanded: boolean;
  pendingKey: string | null;
  onToggleExpand: (entryId: string) => void;
  onToggleReaction: (entryId: string, kind: DashboardUpdateReaction['kind'], reacted: boolean) => void;
}) {
  return (
    <article className={cn('db-hero', !entry.image && 'db-hero--no-image')}>
      <div className="db-hero__media">
        {entry.image ? <img src={entry.image} alt="" /> : <div className="db-hero__wash" aria-hidden="true" />}
      </div>
      <div className="db-hero__body">
        <div className="db-hero__topline">
          <span className={cn('db-chip', CATEGORY_META[entry.feedCategory].className)}>A la une · {CATEGORY_META[entry.feedCategory].label}</span>
          <span>{formatUpdateTimeLabel(entry.publishedAt)}</span>
        </div>
        <h2>{entry.title}</h2>
        <p>{entry.summary}</p>
        <div className="db-hero__foot">
          <AuthorRow entry={entry} />
          <ReactionBar entry={entry} pendingKey={pendingKey} onToggleReaction={onToggleReaction} />
        </div>
        <div className="db-hero__actions">
          <button type="button" className="db-button db-button--ghost" onClick={() => onToggleExpand(entry.id)}>
            <MessagesSquare className="h-3.5 w-3.5" />
            {expanded ? 'Fermer les details' : 'Voir les details'}
          </button>
          <ActionLink href={entry.ctaHref} className="db-button db-button--primary">
            {entry.ctaLabel || 'Voir plus'}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </ActionLink>
        </div>
      </div>
    </article>
  );
}

function TimelineItem({
  entry,
  expanded,
  pendingKey,
  onToggleExpand,
  onToggleReaction,
}: {
  entry: FeedEntry;
  expanded: boolean;
  pendingKey: string | null;
  onToggleExpand: (entryId: string) => void;
  onToggleReaction: (entryId: string, kind: DashboardUpdateReaction['kind'], reacted: boolean) => void;
}) {
  return (
    <article className="db-timeline__item">
      <div className="db-timeline__body">
        <div className="db-timeline__head">
          <span className={cn('db-chip', CATEGORY_META[entry.feedCategory].className)}>{CATEGORY_META[entry.feedCategory].label}</span>
          {entry.isFeatured ? <span className="db-chip is-featured">Epingle</span> : null}
          <span>{formatUpdateTimeLabel(entry.publishedAt)}</span>
        </div>
        <h3>{entry.title}</h3>
        <p>{entry.summary}</p>
        <div className="db-timeline__foot">
          <AuthorRow entry={entry} />
          <ReactionBar entry={entry} pendingKey={pendingKey} onToggleReaction={onToggleReaction} />
        </div>
        <div className="db-timeline__actions">
          <button type="button" className="db-inline-link" onClick={() => onToggleExpand(entry.id)}>
            {expanded ? 'Fermer les details' : 'Voir les details'}
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {entry.ctaHref ? (
            <ActionLink href={entry.ctaHref} className="db-inline-link">
              {entry.ctaLabel || 'Voir plus'}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </ActionLink>
          ) : null}
        </div>
      </div>
      <div className={cn('db-timeline__media', !entry.image && 'is-empty')}>
        {entry.image ? <img src={entry.image} alt="" /> : <Sparkles className="h-8 w-8" />}
      </div>
    </article>
  );
}

export function DashboardUpdatesFeed({
  entries,
  loading,
  heading,
  subheading,
  welcomeName,
  showWelcome = false,
  action,
}: {
  entries: DashboardUpdateEntry[];
  loading?: boolean;
  heading: string;
  subheading: string;
  welcomeName?: string | null;
  showWelcome?: boolean;
  action?: ReactNode;
}) {
  const [tab, setTab] = useState<FilterTab>('tout');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [feedEntries, setFeedEntries] = useState<DashboardUpdateEntry[]>(entries);

  useEffect(() => {
    setFeedEntries(entries);
  }, [entries]);

  const mappedEntries = useMemo(() => feedEntries.map(mapEntry), [feedEntries]);

  const teamNote = useMemo(
    () => mappedEntries.find((entry) => entry.id === 'mock-dashboard-team-note') ?? null,
    [mappedEntries]
  );

  const regularEntries = useMemo(
    () => mappedEntries.filter((entry) => entry.id !== 'mock-dashboard-team-note'),
    [mappedEntries]
  );

  const filteredEntries = useMemo(() => {
    if (tab === 'tout') {
      return regularEntries;
    }

    return regularEntries.filter((entry) => entry.feedCategory === tab);
  }, [regularEntries, tab]);

  const heroEntry = useMemo(
    () => filteredEntries.find((entry) => entry.isFeatured) ?? filteredEntries[0] ?? null,
    [filteredEntries]
  );

  const timelineEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.id !== heroEntry?.id),
    [filteredEntries, heroEntry?.id]
  );

  const timelineGroups = useMemo(() => {
    const groups = new Map<string, FeedEntry[]>();

    for (const entry of timelineEntries) {
      const list = groups.get(entry.date) ?? [];
      list.push(entry);
      groups.set(entry.date, list);
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [timelineEntries]);

  const expandedEntry = useMemo(
    () => (expandedId ? mappedEntries.find((entry) => entry.id === expandedId) ?? null : null),
    [expandedId, mappedEntries]
  );

  const toggleExpanded = (entryId: string) => {
    setExpandedId((current) => (current === entryId ? null : entryId));
  };

  const replaceEntry = (updatedEntry: DashboardUpdateEntry | null | undefined) => {
    if (!updatedEntry) {
      return;
    }

    setFeedEntries((current) => current.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)));
  };

  const handleToggleReaction = async (
    entryId: string,
    kind: DashboardUpdateReaction['kind'],
    reacted: boolean
  ) => {
    const nextReacted = !reacted;
    const reactionKey = `${entryId}:${kind}`;

    setPendingReactionKey(reactionKey);
    setFeedEntries((current) => applyOptimisticReaction(current, entryId, kind, nextReacted));

    try {
      const response = nextReacted
        ? await dashboardUpdatesApi.addReaction(entryId, kind)
        : await dashboardUpdatesApi.removeReaction(entryId, kind);

      replaceEntry(response.data.entry);
    } catch (error) {
      setFeedEntries((current) => applyOptimisticReaction(current, entryId, kind, reacted));
      toast.error("Impossible d'enregistrer la reaction.");
    } finally {
      setPendingReactionKey((current) => (current === reactionKey ? null : current));
    }
  };

  return (
    <div className="db-page">
      <Welcome
        welcomeName={welcomeName}
        showWelcome={showWelcome}
        heading={heading}
        subheading={subheading}
        action={action}
      />
      <TeamNote entry={tab === 'tout' || tab === 'DEV' ? teamNote : null} />
      <FeedTabs entries={regularEntries} value={tab} onChange={setTab} />

      {loading ? (
        <div className="db-state">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : heroEntry ? (
        <div className="db-feed db-feed--experimental">
          <Hero
            entry={heroEntry}
            expanded={expandedId === heroEntry.id}
            pendingKey={pendingReactionKey}
            onToggleExpand={toggleExpanded}
            onToggleReaction={handleToggleReaction}
          />

          <div className="db-timeline">
            {timelineGroups.map((group) => {
              const parts = getDateParts(group.date);

              return (
                <section key={group.date} className="db-timeline__group">
                  <div className="db-timeline__date">
                    <strong>{parts.short}</strong>
                    <span>{parts.full}</span>
                  </div>
                  <div className="db-timeline__list">
                    {group.items.map((entry) => (
                      <TimelineItem
                        key={entry.id}
                        entry={entry}
                        expanded={expandedId === entry.id}
                        pendingKey={pendingReactionKey}
                        onToggleExpand={toggleExpanded}
                        onToggleReaction={handleToggleReaction}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <Dialog open={Boolean(expandedEntry)} onOpenChange={(open) => { if (!open) setExpandedId(null); }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>{expandedEntry?.title || 'Details de la mise a jour'}</DialogTitle>
                <DialogDescription>
                  {expandedEntry
                    ? `${CATEGORY_META[expandedEntry.feedCategory].label} · ${formatUpdateDateLabel(expandedEntry.date)} · ${formatUpdateTimeLabel(expandedEntry.publishedAt)}`
                    : 'Details de la mise a jour'}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto pr-1">
                {expandedEntry ? <ExpandedEntry entry={expandedEntry} /> : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="db-state">Aucune mise a jour pour le moment.</div>
      )}
    </div>
  );
}
