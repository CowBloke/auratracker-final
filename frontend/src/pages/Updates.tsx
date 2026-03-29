  import { useEffect, type ComponentType } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY } from '@/lib/design-system';
import { UPDATE_ENTRIES, type UpdateCategory, markUpdatesSeen } from '@/lib/updates';
import { Bug, Sparkles, Rocket } from 'lucide-react';

const categoryMeta: Record<UpdateCategory, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  stripClass: string;
  badgeClass: string;
}> = {
  BIG_FEATURE: {
    label: 'Grandes fonctionnalités',
    icon: Rocket,
    iconClass: 'text-chart-3',
    stripClass: 'border-l-2 border-chart-3/60 pl-4',
    badgeClass: 'border-chart-3/40 text-chart-3 bg-chart-3/10',
  },
  SMALL_FEATURE: {
    label: 'Petites fonctionnalités',
    icon: Sparkles,
    iconClass: 'text-chart-1',
    stripClass: 'border-l-2 border-chart-1/50 pl-4',
    badgeClass: 'border-chart-1/40 text-chart-1 bg-chart-1/10',
  },
  BUG_FIX: {
    label: 'Correctifs',
    icon: Bug,
    iconClass: 'text-muted-foreground',
    stripClass: 'border-l-2 border-border/70 pl-4',
    badgeClass: 'border-border text-muted-foreground',
  },
};

function renderItem(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-foreground">{part}</strong>
      : part
  );
}

export default function Updates() {
  useEffect(() => {
    markUpdatesSeen();
  }, []);

  return (
    <PageShell size="default" className="space-y-6">
      <Card className="border-border/60 bg-card">
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={UPDATE_ENTRIES[0] ? [UPDATE_ENTRIES[0].id] : []}>
            {UPDATE_ENTRIES.map((entry) => {
              const counts: Record<UpdateCategory, number> = {
                BIG_FEATURE: 0,
                SMALL_FEATURE: 0,
                BUG_FIX: 0,
              };

              entry.sections.forEach((section) => {
                counts[section.category] += section.items.length;
              });

              const parsedDate = new Date(entry.date);
              const dateLabel = Number.isNaN(parsedDate.getTime())
                ? entry.date
                : parsedDate.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });

              return (
                <AccordionItem key={entry.id} value={entry.id} className="px-5 py-1 sm:px-6">
                  <AccordionTrigger className="py-5 text-left hover:no-underline">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xl font-semibold tracking-tight capitalize">
                          {dateLabel}
                        </span>
                        {counts.BIG_FEATURE > 0 && (
                          <Badge variant="outline" className={`gap-1.5 text-xs ${categoryMeta.BIG_FEATURE.badgeClass}`}>
                            <Rocket className="h-3 w-3" />
                            {counts.BIG_FEATURE}
                          </Badge>
                        )}
                        {counts.SMALL_FEATURE > 0 && (
                          <Badge variant="outline" className={`gap-1.5 text-xs ${categoryMeta.SMALL_FEATURE.badgeClass}`}>
                            <Sparkles className="h-3 w-3" />
                            {counts.SMALL_FEATURE}
                          </Badge>
                        )}
                        {counts.BUG_FIX > 0 && (
                          <Badge variant="outline" className={`gap-1.5 text-xs ${categoryMeta.BUG_FIX.badgeClass}`}>
                            <Bug className="h-3 w-3" />
                            {counts.BUG_FIX}
                          </Badge>
                        )}
                      </div>
                      <p className={TYPOGRAPHY.PAGE_DESCRIPTION}>{entry.summary}</p>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="pb-6 space-y-5">
                      {entry.sections.map((section) => {
                        const meta = categoryMeta[section.category];
                        const CategoryIcon = meta.icon;

                        return (
                          <div key={`${entry.id}-${section.category}`} className={meta.stripClass}>
                            <div className="flex items-center gap-2 mb-2">
                              <CategoryIcon className={`h-3.5 w-3.5 ${meta.iconClass}`} />
                              <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                                {meta.label}
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {section.items.map((item, index) => (
                                <li
                                  key={`${entry.id}-${section.category}-${index}`}
                                  className="flex gap-2 text-sm text-foreground/80 leading-relaxed"
                                >
                                  <span className="mt-[3px] shrink-0 text-muted-foreground/40 select-none">–</span>
                                  <span>{renderItem(item)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </PageShell>
  );
}
