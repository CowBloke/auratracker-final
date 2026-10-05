import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Flame, Heart, Megaphone, MessagesSquare, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardUpdatesApi, type DashboardUpdateEntry, type DashboardUpdateReaction } from '@/services/api';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveImageUrl } from '@/lib/images';
import {
  feedCategoryMeta,
  formatUpdateDateLabel,
  formatUpdateTimeLabel,
  renderUpdateRichText,
  sectionCategoryMeta,
} from './shared';

type FilterTab = 'tout' | DashboardUpdateEntry['feedCategory'];

const REACTION_META = {
  fire: { label: 'Flamme', Icon: Flame },
  heart: { label: 'Cœur', Icon: Heart },
  boost: { label: 'Boost', Icon: Zap },
} as const;

function getReactionMeta(kind: DashboardUpdateReaction['kind']) {
  return REACTION_META[kind as keyof typeof REACTION_META] ?? REACTION_META.boost;
}

function buildReactionTitle(reaction: DashboardUpdateReaction) {
  if (reaction.sampleUsers.length === 0) {
    return `${reaction.count} réaction${reaction.count > 1 ? 's' : ''}`;
  }

  const users = reaction.sampleUsers.map((user) => user.username).join(', ');
  const others = reaction.count - reaction.sampleUsers.length;
  return others > 0 ? `${users} et ${others} autre(s)` : users;
}

function applyOptimisticReaction(
  entries: DashboardUpdateEntry[],
  entryId: string,
  kind: DashboardUpdateReaction['kind'],
  nextReacted: boolean
) {
  return entries.map((entry) =>
    entry.id !== entryId
      ? entry
      : {
          ...entry,
          reactions: entry.reactions.map((reaction) =>
            reaction.kind !== kind
              ? reaction
              : {
                  ...reaction,
                  reacted: nextReacted,
                  count: Math.max(0, reaction.count + (nextReacted ? 1 : -1)),
                }
          ),
        }
  );
}

function CtaButton({ entry }: { entry: DashboardUpdateEntry }) {
  const href = entry.ctaHref;
  if (!href || href === '#') return null;
  const label = entry.ctaLabel || 'Voir plus';

  return (
    <Button asChild size="sm">
      {href.startsWith('/') ? (
        <Link to={href}>
          {label}
          <ArrowUpRight />
        </Link>
      ) : (
        <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
          {label}
          <ArrowUpRight />
        </a>
      )}
    </Button>
  );
}

type UpdateCardProps = {
  entry: DashboardUpdateEntry;
  featured: boolean;
  pendingKey: string | null;
  onOpenDetails: (entryId: string) => void;
  onToggleReaction: (entryId: string, kind: DashboardUpdateReaction['kind'], reacted: boolean) => void;
};

function UpdateCard({ entry, featured, pendingKey, onOpenDetails, onToggleReaction }: UpdateCardProps) {
  const category = feedCategoryMeta[entry.feedCategory];
  const image = entry.imageUrl ? resolveImageUrl(entry.imageUrl) : null;

  return (
    <Card className={featured ? 'overflow-hidden pt-0 lg:col-span-2 lg:grid lg:grid-cols-2 lg:py-0' : 'overflow-hidden pt-0'}>
      {image ? (
        <AspectRatio ratio={featured ? 4 / 3 : 16 / 9} className="lg:h-full">
          <img src={image} alt="" className="size-full object-cover" />
        </AspectRatio>
      ) : null}
      <div className="flex flex-col gap-6 lg:justify-center lg:py-6">
        <CardHeader>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Badge variant={featured ? 'default' : 'secondary'}>
              <category.icon />
              {featured ? `À la une · ${category.label}` : category.label}
            </Badge>
            {entry.isFeatured && !featured ? <Badge variant="outline">Épinglé</Badge> : null}
            <span>{formatUpdateTimeLabel(entry.publishedAt)}</span>
          </CardDescription>
          <CardTitle className={featured ? 'text-2xl' : 'text-lg'}>{entry.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{entry.summary}</p>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src={resolveImageUrl(entry.author.avatarUrl || '/aura-icon.svg')} alt="" />
              <AvatarFallback>{entry.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col text-sm leading-tight">
              <span className="truncate font-medium">{entry.author.name}</span>
              <span className="truncate text-xs text-muted-foreground">{entry.author.role || category.label}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {entry.reactions.map((reaction) => {
              const { Icon, label } = getReactionMeta(reaction.kind);
              return (
                <Tooltip key={reaction.kind}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant={reaction.reacted ? 'secondary' : 'outline'}
                      disabled={pendingKey === `${entry.id}:${reaction.kind}`}
                      aria-pressed={reaction.reacted}
                      aria-label={label}
                      onClick={() => onToggleReaction(entry.id, reaction.kind, reaction.reacted)}
                    >
                      <Icon />
                      <span className="tabular-nums">{reaction.count}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{buildReactionTitle(reaction)}</TooltipContent>
                </Tooltip>
              );
            })}
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenDetails(entry.id)}>
              <MessagesSquare />
              Détails
            </Button>
            <CtaButton entry={entry} />
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}

function EntryDetails({ entry }: { entry: DashboardUpdateEntry }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">{entry.body || entry.summary}</p>
      {entry.sections.map((section) => {
        const meta = sectionCategoryMeta[section.category];
        return (
          <section key={`${entry.id}-${section.category}`} className="flex flex-col gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <meta.icon className="size-4" />
              {meta.label}
            </h4>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              {section.items.map((item) => (
                <li key={item.id}>{renderUpdateRichText(item.text)}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function DashboardUpdatesFeed({ entries, loading }: { entries: DashboardUpdateEntry[]; loading?: boolean }) {
  const [tab, setTab] = useState<FilterTab>('tout');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [feedEntries, setFeedEntries] = useState<DashboardUpdateEntry[]>(entries);

  useEffect(() => {
    setFeedEntries(entries);
  }, [entries]);

  const filteredEntries = useMemo(
    () => (tab === 'tout' ? feedEntries : feedEntries.filter((entry) => entry.feedCategory === tab)),
    [feedEntries, tab]
  );

  const featuredEntry = useMemo(
    () => filteredEntries.find((entry) => entry.isFeatured) ?? filteredEntries[0] ?? null,
    [filteredEntries]
  );
  const otherEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.id !== featuredEntry?.id),
    [filteredEntries, featuredEntry?.id]
  );
  const expandedEntry = expandedId ? feedEntries.find((entry) => entry.id === expandedId) ?? null : null;

  const handleToggleReaction = async (entryId: string, kind: DashboardUpdateReaction['kind'], reacted: boolean) => {
    const nextReacted = !reacted;
    const reactionKey = `${entryId}:${kind}`;

    setPendingReactionKey(reactionKey);
    setFeedEntries((current) => applyOptimisticReaction(current, entryId, kind, nextReacted));

    try {
      const response = nextReacted
        ? await dashboardUpdatesApi.addReaction(entryId, kind)
        : await dashboardUpdatesApi.removeReaction(entryId, kind);
      const updated = response.data.entry;
      if (updated) {
        setFeedEntries((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      }
    } catch {
      setFeedEntries((current) => applyOptimisticReaction(current, entryId, kind, reacted));
      toast.error("Impossible d'enregistrer la réaction.");
    } finally {
      setPendingReactionKey((current) => (current === reactionKey ? null : current));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={tab} onValueChange={(value) => setTab(value as FilterTab)}>
        <TabsList>
          <TabsTrigger value="tout">Tout</TabsTrigger>
          {(Object.keys(feedCategoryMeta) as DashboardUpdateEntry['feedCategory'][]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {feedCategoryMeta[key].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : featuredEntry ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <UpdateCard
            entry={featuredEntry}
            featured
            pendingKey={pendingReactionKey}
            onOpenDetails={setExpandedId}
            onToggleReaction={handleToggleReaction}
          />
          {otherEntries.map((entry) => (
            <UpdateCard
              key={entry.id}
              entry={entry}
              featured={false}
              pendingKey={pendingReactionKey}
              onOpenDetails={setExpandedId}
              onToggleReaction={handleToggleReaction}
            />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone />
            </EmptyMedia>
            <EmptyTitle>Aucune mise à jour</EmptyTitle>
            <EmptyDescription>Les nouveautés de la plateforme apparaîtront ici.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <Dialog open={Boolean(expandedEntry)} onOpenChange={(open) => !open && setExpandedId(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{expandedEntry?.title ?? 'Détails de la mise à jour'}</DialogTitle>
            <DialogDescription>
              {expandedEntry
                ? `${feedCategoryMeta[expandedEntry.feedCategory].label} · ${formatUpdateDateLabel(expandedEntry.date)} · ${formatUpdateTimeLabel(expandedEntry.publishedAt)}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">{expandedEntry ? <EntryDetails entry={expandedEntry} /> : null}</ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
