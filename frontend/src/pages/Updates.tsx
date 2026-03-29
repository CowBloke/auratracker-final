import { useEffect, type ComponentType } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY } from '@/lib/design-system';
import { UPDATE_ENTRIES, type UpdateCategory, markUpdatesSeen } from '@/lib/updates';
import { Bug, Sparkles, Rocket } from 'lucide-react';

const categoryMeta: Record<UpdateCategory, {
  label: string;
  icon: ComponentType<{ className?: string }>;
  chipClassName: string;
  blockClassName: string;
  iconToneClassName: string;
}> = {
  BIG_FEATURE: {
    label: 'Grandes fonctionnalites',
    icon: Rocket,
    chipClassName: 'border-border bg-muted/70 text-foreground',
    blockClassName: 'border-border bg-muted/65',
    iconToneClassName: 'text-foreground',
  },
  SMALL_FEATURE: {
    label: 'Petites fonctionnalites',
    icon: Sparkles,
    chipClassName: 'border-border/80 bg-muted/50 text-foreground/90',
    blockClassName: 'border-border/80 bg-muted/45',
    iconToneClassName: 'text-foreground/85',
  },
  BUG_FIX: {
    label: 'Correctifs',
    icon: Bug,
    chipClassName: 'border-border/70 bg-muted/35 text-foreground/80',
    blockClassName: 'border-border/70 bg-muted/30',
    iconToneClassName: 'text-foreground/75',
  },
};

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
                      <div className="flex flex-wrap items-center gap-3">
                        <CardTitle className="text-xl tracking-tight capitalize">
                          {dateLabel}
                        </CardTitle>
                        <Badge variant="outline" className={`gap-1.5 ${categoryMeta.BIG_FEATURE.chipClassName}`}>
                          <Rocket className="h-3.5 w-3.5" />
                          <span>{counts.BIG_FEATURE}</span>
                        </Badge>
                        <Badge variant="outline" className={`gap-1.5 ${categoryMeta.SMALL_FEATURE.chipClassName}`}>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{counts.SMALL_FEATURE}</span>
                        </Badge>
                        <Badge variant="outline" className={`gap-1.5 ${categoryMeta.BUG_FIX.chipClassName}`}>
                          <Bug className="h-3.5 w-3.5" />
                          <span>{counts.BUG_FIX}</span>
                        </Badge>
                      </div>
                      <p className={TYPOGRAPHY.PAGE_DESCRIPTION}>{entry.summary}</p>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="pb-5">
                      <div className="space-y-3.5">
                        {entry.sections.map((section) => {
                          const meta = categoryMeta[section.category];
                          const CategoryIcon = meta.icon;

                          return (
                            <div
                              key={`${entry.id}-${section.category}`}
                              className={`rounded-xl border p-3.5 sm:p-4 ${meta.blockClassName}`}
                            >
                              <div className="mb-3 flex items-center gap-2">
                                <CategoryIcon className={`h-4 w-4 ${meta.iconToneClassName}`} />
                                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                                  {meta.label}
                                </h3>
                              </div>

                              <ul className="space-y-2 pl-1">
                                {section.items.map((item, index) => (
                                  <li
                                    key={`${entry.id}-${section.category}-${index}`}
                                    className="list-none rounded-lg border border-border/55 bg-background/80 px-3 py-2.5 text-sm leading-relaxed text-foreground"
                                  >
                                    <span className="mr-2 font-semibold text-muted-foreground">•</span>
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
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
