import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY } from '@/lib/design-system';
import { markChangelogSeen } from '@/lib/changelog';
import { changelogApi, type ChangelogEntry } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Bug, Sparkles, Rocket, Plus, X, Check, Bold } from 'lucide-react';

type UpdateCategory = 'BIG_FEATURE' | 'SMALL_FEATURE' | 'BUG_FIX';

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

function applyBold(
  textarea: HTMLTextAreaElement,
  value: string,
  setValue: (v: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);

  let newValue: string;
  let newStart: number;
  let newEnd: number;

  if (selected) {
    // Wrap selection
    newValue = value.slice(0, start) + `**${selected}**` + value.slice(end);
    newStart = start;
    newEnd = end + 4;
  } else {
    // Insert empty markers and place cursor between them
    newValue = value.slice(0, start) + '****' + value.slice(start);
    newStart = start + 2;
    newEnd = start + 2;
  }

  setValue(newValue);
  // Restore selection after React re-render
  requestAnimationFrame(() => {
    textarea.setSelectionRange(newStart, newEnd);
  });
}

interface AddItemFormProps {
  entryId: string;
  category: UpdateCategory;
  onAdded: (item: { id: string; text: string; category: string }) => void;
  onCancel: () => void;
}

function AddItemForm({ entryId, category, onAdded, onCancel }: AddItemFormProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      if (textareaRef.current) applyBold(textareaRef.current, text, setText);
    }
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { data } = await changelogApi.addItem(entryId, { category, text: trimmed });
      onAdded(data);
      setText('');
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Texte… Ctrl+B pour mettre en gras"
          rows={2}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => {
          if (textareaRef.current) applyBold(textareaRef.current, text, setText);
        }}>
          <Bold className="h-3 w-3" /> Gras
        </Button>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
        <Button size="sm" className="h-7 px-2" onClick={handleSave} disabled={!text.trim() || saving}><Check className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

interface AddEntryFormProps {
  onAdded: (entry: ChangelogEntry) => void;
  onCancel: () => void;
}

function AddEntryForm({ onAdded, onCancel }: AddEntryFormProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!date || !title.trim() || !summary.trim()) return;
    setSaving(true);
    try {
      const { data } = await changelogApi.createEntry({ date, title: title.trim(), summary: summary.trim() });
      onAdded(data);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border/60 rounded-lg p-4 space-y-3 bg-card">
      <p className="text-sm font-semibold">Nouvelle entrée</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Titre</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre…" className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Résumé</label>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Résumé court…" className="h-8 text-sm" />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button size="sm" onClick={handleSave} disabled={!date || !title.trim() || !summary.trim() || saving}>
          Créer
        </Button>
      </div>
    </div>
  );
}

export default function Changelog() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingEntry, setAddingEntry] = useState(false);
  const [addingItem, setAddingItem] = useState<{ entryId: string; category: UpdateCategory } | null>(null);

  useEffect(() => {
    changelogApi.getAll()
      .then(({ data }) => {
        setEntries(data);
        if (data[0]) markChangelogSeen(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleItemAdded = (entryId: string, item: { id: string; text: string; category: string }) => {
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e;
      const sections = [...e.sections];
      const secIdx = sections.findIndex((s) => s.category === item.category);
      if (secIdx >= 0) {
        sections[secIdx] = { ...sections[secIdx], items: [...sections[secIdx].items, { id: item.id, text: item.text }] };
      } else {
        sections.push({ category: item.category, items: [{ id: item.id, text: item.text }] });
      }
      return { ...e, sections };
    }));
    setAddingItem(null);
  };

  const handleItemDeleted = (entryId: string, itemId: string) => {
    changelogApi.deleteItem(entryId, itemId).catch(() => {});
    setEntries((prev) => prev.map((e) => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        sections: e.sections
          .map((s) => ({ ...s, items: s.items.filter((i) => i.id !== itemId) }))
          .filter((s) => s.items.length > 0),
      };
    }));
  };

  const handleEntryDeleted = (entryId: string) => {
    changelogApi.deleteEntry(entryId).catch(() => {});
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  const handleEntryAdded = (entry: ChangelogEntry) => {
    setEntries((prev) => [entry, ...prev]);
    setAddingEntry(false);
  };

  if (loading) {
    return (
      <PageShell size="default" className="space-y-6">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </PageShell>
    );
  }

  return (
    <PageShell size="default" className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          {addingEntry ? (
            <AddEntryForm onAdded={handleEntryAdded} onCancel={() => setAddingEntry(false)} />
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddingEntry(true)}>
              <Plus className="h-3.5 w-3.5" /> Nouvelle entrée
            </Button>
          )}
        </div>
      )}

      <Card className="border-border/60 bg-card">
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={entries[0] ? [entries[0].id] : []}>
            {entries.map((entry) => {
              const counts: Record<UpdateCategory, number> = {
                BIG_FEATURE: 0,
                SMALL_FEATURE: 0,
                BUG_FIX: 0,
              };
              entry.sections.forEach((section) => {
                counts[section.category as UpdateCategory] += section.items.length;
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
                    <div className="space-y-2 flex-1 pr-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xl font-semibold tracking-tight capitalize">
                          {dateLabel}
                        </span>
                        {counts.BIG_FEATURE > 0 && (
                          <Badge variant="outline" className={`gap-1.5 text-xs ${categoryMeta.BIG_FEATURE.badgeClass}`}>
                            <Rocket className="h-3 w-3" />{counts.BIG_FEATURE}
                          </Badge>
                        )}
                        {counts.SMALL_FEATURE > 0 && (
                          <Badge variant="outline" className={`gap-1.5 text-xs ${categoryMeta.SMALL_FEATURE.badgeClass}`}>
                            <Sparkles className="h-3 w-3" />{counts.SMALL_FEATURE}
                          </Badge>
                        )}
                        {counts.BUG_FIX > 0 && (
                          <Badge variant="outline" className={`gap-1.5 text-xs ${categoryMeta.BUG_FIX.badgeClass}`}>
                            <Bug className="h-3 w-3" />{counts.BUG_FIX}
                          </Badge>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEntryDeleted(entry.id); }}
                            className="ml-auto text-muted-foreground/40 hover:text-destructive transition-colors"
                            title="Supprimer cette entrée"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className={TYPOGRAPHY.PAGE_DESCRIPTION}>{entry.summary}</p>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    <div className="pb-6 space-y-5">
                      {(['BIG_FEATURE', 'SMALL_FEATURE', 'BUG_FIX'] as UpdateCategory[]).map((cat) => {
                        const meta = categoryMeta[cat];
                        const CategoryIcon = meta.icon;
                        const section = entry.sections.find((s) => s.category === cat);
                        const items = section?.items ?? [];
                        const isAddingHere = addingItem?.entryId === entry.id && addingItem.category === cat;

                        if (items.length === 0 && !isAdmin) return null;

                        return (
                          <div key={`${entry.id}-${cat}`} className={meta.stripClass}>
                            <div className="flex items-center gap-2 mb-2">
                              <CategoryIcon className={`h-3.5 w-3.5 ${meta.iconClass}`} />
                              <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                                {meta.label}
                              </span>
                            </div>
                            {items.length > 0 && (
                              <ul className="space-y-1">
                                {items.map((item) => (
                                  <li
                                    key={item.id}
                                    className="flex gap-2 text-sm text-foreground/80 leading-relaxed group"
                                  >
                                    <span className="mt-[3px] shrink-0 text-muted-foreground/40 select-none">–</span>
                                    <span className="flex-1">{renderItem(item.text)}</span>
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleItemDeleted(entry.id, item.id)}
                                        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-all mt-[3px]"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {isAdmin && (
                              isAddingHere ? (
                                <AddItemForm
                                  entryId={entry.id}
                                  category={cat}
                                  onAdded={(item) => handleItemAdded(entry.id, item)}
                                  onCancel={() => setAddingItem(null)}
                                />
                              ) : (
                                <button
                                  onClick={() => setAddingItem({ entryId: entry.id, category: cat })}
                                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                >
                                  <Plus className="h-3 w-3" /> Ajouter
                                </button>
                              )
                            )}
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
