import { useMemo, useState } from 'react';
import { ArrowRight, Eye, Loader2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import type { DashboardUpdateEntry } from '@/services/api';
import {
  feedCategoryMeta,
  formatUpdateDateLabel,
  formatUpdateTimeLabel,
  renderUpdateRichText,
  sectionCategoryMeta,
} from './shared';

type FilterTab = 'ALL' | DashboardUpdateEntry['feedCategory'];

const FILTER_ORDER: FilterTab[] = ['ALL', 'GAME', 'PATCH', 'COMMUNITY', 'DEV'];

function UpdateCard({
  entry,
  onOpen,
}: {
  entry: DashboardUpdateEntry;
  onOpen: (entry: DashboardUpdateEntry) => void;
}) {
  const meta = feedCategoryMeta[entry.feedCategory];
  const Icon = meta.icon;

  return (
    <article className="group grid gap-0 overflow-hidden rounded-[26px] border border-border/60 bg-card shadow-[0_18px_70px_-44px_rgba(15,23,42,0.55)] transition-transform duration-200 hover:-translate-y-0.5 lg:grid-cols-[280px_1fr]">
      <div className="relative overflow-hidden border-b border-border/50 bg-muted/20 lg:border-b-0 lg:border-r">
        {entry.imageUrl ? (
          <img
            src={resolveImageUrl(entry.imageUrl)}
            alt={entry.title}
            className="h-60 w-full object-cover transition duration-500 group-hover:scale-[1.03] lg:h-full"
          />
        ) : (
          <div
            className={cn(
              'flex h-60 items-end bg-gradient-to-br p-6 lg:h-full',
              entry.feedCategory === 'GAME' && 'from-sky-500/20 via-sky-500/5 to-transparent',
              entry.feedCategory === 'PATCH' && 'from-emerald-500/20 via-emerald-500/5 to-transparent',
              entry.feedCategory === 'COMMUNITY' && 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
              entry.feedCategory === 'DEV' && 'from-amber-500/20 via-amber-500/5 to-transparent'
            )}
          >
            <div className="rounded-full border border-border/60 bg-background/80 p-4">
              <Icon className="h-7 w-7 text-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={meta.badgeClass}>{meta.label}</Badge>
          {entry.isFeatured ? (
            <Badge variant="outline" className="border-foreground/10 bg-foreground/[0.04] text-foreground">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Épinglé
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">{formatUpdateTimeLabel(entry.publishedAt)}</span>
        </div>

        <h3 className="mt-4 text-2xl font-semibold tracking-tight">{entry.title}</h3>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{entry.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {entry.sections.map((section) => (
            <Badge key={section.category} variant="outline" className={sectionCategoryMeta[section.category].badgeClass}>
              {sectionCategoryMeta[section.category].label} · {section.items.length}
            </Badge>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={entry.author.avatarUrl ? resolveImageUrl(entry.author.avatarUrl) : '/aura-icon.svg'}
              alt={entry.author.name}
              className="h-10 w-10 rounded-full border border-border/60 object-cover"
            />
            <div>
              <p className="text-sm font-medium">{entry.author.name}</p>
              <p className="text-xs text-muted-foreground">{entry.author.role || formatUpdateDateLabel(entry.date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpen(entry)}>
              <Eye className="mr-1.5 h-4 w-4" />
              Détails
            </Button>
            {entry.ctaHref && entry.ctaLabel ? (
              <Button asChild>
                <Link to={entry.ctaHref}>
                  {entry.ctaLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
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
  action?: React.ReactNode;
}) {
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<DashboardUpdateEntry | null>(null);

  const filteredEntries = useMemo(() => (
    tab === 'ALL' ? entries : entries.filter((entry) => entry.feedCategory === tab)
  ), [entries, tab]);

  const heroEntry = useMemo(
    () => filteredEntries.find((entry) => entry.isFeatured) ?? filteredEntries[0] ?? null,
    [filteredEntries]
  );

  const devNote = useMemo(
    () => entries.find((entry) => entry.feedCategory === 'DEV' && entry.id !== heroEntry?.id) ?? null,
    [entries, heroEntry?.id]
  );

  const restEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.id !== heroEntry?.id),
    [filteredEntries, heroEntry?.id]
  );

  return (
    <>
      <section className="relative overflow-hidden rounded-[34px] border border-border/60 bg-card/90 px-5 py-6 shadow-[0_30px_120px_-52px_rgba(15,23,42,0.6)] sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Dashboard updates</p>
              {showWelcome ? (
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Yo <span className="text-amber-500">{welcomeName || 'toi'}</span>, y&apos;a du neuf.
                </h1>
              ) : (
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
              )}
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{subheading}</p>
            </div>
            {action}
          </div>

          {devNote ? (
            <div className="mt-6 rounded-[26px] border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300">
                  Mot de l’équipe
                </Badge>
                <span className="text-xs text-muted-foreground">{formatUpdateTimeLabel(devNote.publishedAt)}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{devNote.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{devNote.summary}</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-border/50 pb-3">
            {FILTER_ORDER.map((filter) => {
              const count = filter === 'ALL'
                ? entries.length
                : entries.filter((entry) => entry.feedCategory === filter).length;
              const label = filter === 'ALL' ? 'Tout' : feedCategoryMeta[filter].label;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTab(filter)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors',
                    tab === filter
                      ? 'border-foreground/15 bg-foreground text-background'
                      : 'border-border/60 bg-background/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{label}</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    tab === filter ? 'bg-background/10 text-background' : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {loading ? (
        <Card className="rounded-[28px] border-border/60">
          <CardContent className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : heroEntry ? (
        <div className="space-y-5">
          <article className="group overflow-hidden rounded-[30px] border border-border/60 bg-card shadow-[0_30px_120px_-52px_rgba(15,23,42,0.6)]">
            <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="relative min-h-[320px] overflow-hidden border-b border-border/50 bg-muted/20 xl:border-b-0 xl:border-r">
                {heroEntry.imageUrl ? (
                  <img
                    src={resolveImageUrl(heroEntry.imageUrl)}
                    alt={heroEntry.title}
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className={cn(
                      'absolute inset-0 bg-gradient-to-br',
                      heroEntry.feedCategory === 'GAME' && 'from-sky-500/25 via-sky-500/10 to-transparent',
                      heroEntry.feedCategory === 'PATCH' && 'from-emerald-500/25 via-emerald-500/10 to-transparent',
                      heroEntry.feedCategory === 'COMMUNITY' && 'from-fuchsia-500/25 via-fuchsia-500/10 to-transparent',
                      heroEntry.feedCategory === 'DEV' && 'from-amber-500/25 via-amber-500/10 to-transparent'
                    )}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent xl:bg-gradient-to-r xl:from-transparent xl:to-background/20" />
              </div>

              <div className="p-6 sm:p-8 xl:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={feedCategoryMeta[heroEntry.feedCategory].badgeClass}>
                    {feedCategoryMeta[heroEntry.feedCategory].label}
                  </Badge>
                  <Badge variant="outline" className="border-foreground/10 bg-foreground/[0.04] text-foreground">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    À la une
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatUpdateTimeLabel(heroEntry.publishedAt)}</span>
                </div>

                <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{heroEntry.title}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{heroEntry.summary}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {heroEntry.sections.map((section) => (
                    <Badge key={section.category} variant="outline" className={sectionCategoryMeta[section.category].badgeClass}>
                      {sectionCategoryMeta[section.category].label} · {section.items.length}
                    </Badge>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={heroEntry.author.avatarUrl ? resolveImageUrl(heroEntry.author.avatarUrl) : '/aura-icon.svg'}
                      alt={heroEntry.author.name}
                      className="h-11 w-11 rounded-full border border-border/60 object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium">{heroEntry.author.name}</p>
                      <p className="text-xs text-muted-foreground">{heroEntry.author.role || formatUpdateDateLabel(heroEntry.date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setSelectedEntry(heroEntry)}>
                      <Eye className="mr-1.5 h-4 w-4" />
                      Détails
                    </Button>
                    {heroEntry.ctaHref && heroEntry.ctaLabel ? (
                      <Button asChild>
                        <Link to={heroEntry.ctaHref}>
                          {heroEntry.ctaLabel}
                          <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </article>

          {restEntries.map((entry) => (
            <UpdateCard key={entry.id} entry={entry} onOpen={setSelectedEntry} />
          ))}
        </div>
      ) : (
        <Card className="rounded-[28px] border-border/60">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">Aucune mise à jour pour le moment.</p>
              <p className="text-sm text-muted-foreground">Le tableau de bord se remplira dès qu’une nouvelle entrée sera publiée.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(selectedEntry)} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-w-3xl overflow-hidden border-border/60 p-0">
          {selectedEntry ? (
            <>
              <DialogHeader className="border-b border-border/50 px-6 pb-4 pt-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={feedCategoryMeta[selectedEntry.feedCategory].badgeClass}>
                    {feedCategoryMeta[selectedEntry.feedCategory].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatUpdateDateLabel(selectedEntry.date)}</span>
                </div>
                <DialogTitle className="mt-3 text-2xl">{selectedEntry.title}</DialogTitle>
                <DialogDescription className="text-sm leading-7">{selectedEntry.summary}</DialogDescription>
              </DialogHeader>

              <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                {selectedEntry.imageUrl ? (
                  <img
                    src={resolveImageUrl(selectedEntry.imageUrl)}
                    alt={selectedEntry.title}
                    className="mb-5 h-64 w-full rounded-[24px] border border-border/60 object-cover"
                  />
                ) : null}

                {selectedEntry.body ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{selectedEntry.body}</p>
                ) : null}

                <div className="mt-6 space-y-5">
                  {selectedEntry.sections.map((section) => (
                    <div key={section.category}>
                      <Badge variant="outline" className={sectionCategoryMeta[section.category].badgeClass}>
                        {sectionCategoryMeta[section.category].label}
                      </Badge>
                      <div className="mt-3 space-y-2">
                        {section.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-7">
                            {renderUpdateRichText(item.text)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
