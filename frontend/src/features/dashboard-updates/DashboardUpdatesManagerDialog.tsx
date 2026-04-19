import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from 'react';
import {
  CalendarRange,
  Edit2,
  History,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { dashboardUpdatesApi, type DashboardUpdateEntry, type DashboardUpdatePayload, type DashboardUpdateSection } from '@/services/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ImagePicker } from '@/components/ui/image-picker';
import {
  feedCategoryMeta,
  formatUpdateDateLabel,
  formatUpdateTimeLabel,
  getEntrySummaryCounts,
  sectionCategoryMeta,
} from './shared';
import { prepareImageUploadPayload } from '@/lib/image-upload';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type SectionCategory = DashboardUpdateSection['category'];

type EditorState = {
  date: string;
  title: string;
  summary: string;
  body: string;
  feedCategory: DashboardUpdateEntry['feedCategory'];
  imageUrl: string;
  accentColor: string;
  isFeatured: boolean;
  ctaLabel: string;
  ctaHref: string;
  authorName: string;
  authorRole: string;
  authorAvatarUrl: string;
  isPublished: boolean;
  publishedAt: string;
  sections: Record<SectionCategory, string[]>;
};

const SECTION_ORDER: SectionCategory[] = ['BIG_FEATURE', 'SMALL_FEATURE', 'BUG_FIX'];

const createEmptySections = (): EditorState['sections'] => ({
  BIG_FEATURE: [''],
  SMALL_FEATURE: [''],
  BUG_FIX: [''],
});

const toDateInputValue = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateTimeInputValue = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const createDefaultState = (): EditorState => ({
  date: toDateInputValue(new Date().toISOString()),
  title: '',
  summary: '',
  body: '',
  feedCategory: 'DEV',
  imageUrl: '',
  accentColor: '#f59e0b',
  isFeatured: false,
  ctaLabel: '',
  ctaHref: '',
  authorName: 'Equipe AuraTracker',
  authorRole: '',
  authorAvatarUrl: '',
  isPublished: true,
  publishedAt: toDateTimeInputValue(new Date().toISOString()),
  sections: createEmptySections(),
});

const mapEntryToState = (entry: DashboardUpdateEntry): EditorState => {
  const sections = createEmptySections();
  for (const section of entry.sections) {
    sections[section.category] = section.items.length > 0
      ? section.items.map((item) => item.text)
      : [''];
  }

  return {
    date: entry.date,
    title: entry.title,
    summary: entry.summary,
    body: entry.body ?? '',
    feedCategory: entry.feedCategory,
    imageUrl: entry.imageUrl ?? '',
    accentColor: entry.accentColor ?? '',
    isFeatured: entry.isFeatured,
    ctaLabel: entry.ctaLabel ?? '',
    ctaHref: entry.ctaHref ?? '',
    authorName: entry.author.name,
    authorRole: entry.author.role ?? '',
    authorAvatarUrl: entry.author.avatarUrl ?? '',
    isPublished: entry.isPublished,
    publishedAt: toDateTimeInputValue(entry.publishedAt),
    sections,
  };
};

const buildPayload = (state: EditorState): DashboardUpdatePayload => ({
  date: state.date,
  title: state.title.trim(),
  summary: state.summary.trim(),
  body: state.body.trim() || null,
  feedCategory: state.feedCategory,
  imageUrl: state.imageUrl.trim() || null,
  accentColor: state.accentColor.trim() || null,
  isFeatured: state.isFeatured,
  ctaLabel: state.ctaLabel.trim() || null,
  ctaHref: state.ctaHref.trim() || null,
  authorName: state.authorName.trim(),
  authorRole: state.authorRole.trim() || null,
  authorAvatarUrl: state.authorAvatarUrl.trim() || null,
  isPublished: state.isPublished,
  publishedAt: new Date(state.publishedAt || state.date).toISOString(),
  sections: SECTION_ORDER.map((category) => ({
    category,
    items: state.sections[category].map((text) => text.trim()).filter(Boolean),
  })).filter((section) => section.items.length > 0),
});

const inlineFieldClass =
  'w-full bg-transparent outline-none border-0 placeholder:text-muted-foreground/50 rounded-md -mx-1 px-1 transition-colors hover:bg-muted/40 focus:bg-muted/60';

const InlineInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<'input'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} {...props} className={cn(inlineFieldClass, className)} />
  ),
);
InlineInput.displayName = 'InlineInput';

const AutoTextarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<'textarea'>>(
  ({ className, value, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);
    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
      <textarea
        ref={innerRef}
        value={value}
        rows={1}
        {...props}
        className={cn(inlineFieldClass, 'resize-none overflow-hidden', className)}
      />
    );
  },
);
AutoTextarea.displayName = 'AutoTextarea';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

export function DashboardUpdatesManagerDialog({
  open,
  onOpenChange,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}) {
  const [entries, setEntries] = useState<DashboardUpdateEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'apercu' | 'fiche'>('apercu');
  const [form, setForm] = useState<EditorState>(createDefaultState);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const { data } = await dashboardUpdatesApi.getAdminAll();
      setEntries(data.entries);
    } catch {
      toast.error('Impossible de charger les mises à jour.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadEntries();
  }, [open]);

  const accentColor = form.accentColor || '#f59e0b';
  const publishedAtIso = useMemo(() => {
    const d = new Date(form.publishedAt || form.date);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }, [form.publishedAt, form.date]);

  const categoryMeta = feedCategoryMeta[form.feedCategory];

  const resetForm = () => {
    setEditingId(null);
    setForm(createDefaultState());
    setActiveTab('apercu');
  };

  const loadEntryIntoForm = (entry: DashboardUpdateEntry) => {
    setEditingId(entry.id);
    setForm(mapEntryToState(entry));
    setHistoryOpen(false);
    setActiveTab('apercu');
  };

  const updateSectionItem = (category: SectionCategory, index: number, value: string) => {
    setForm((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [category]: current.sections[category].map((item, itemIndex) => itemIndex === index ? value : item),
      },
    }));
  };

  const addSectionItem = (category: SectionCategory) => {
    setForm((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [category]: [...current.sections[category], ''],
      },
    }));
  };

  const removeSectionItem = (category: SectionCategory, index: number) => {
    setForm((current) => {
      const nextItems = current.sections[category].filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        sections: {
          ...current.sections,
          [category]: nextItems.length > 0 ? nextItems : [''],
        },
      };
    });
  };

  const uploadImage = async (file: File) => {
    const { base64Data, mimeType } = await prepareImageUploadPayload(file);
    const { data } = await dashboardUpdatesApi.uploadImage({ base64Data, mimeType });
    return data.imageUrl;
  };

  const saveEntry = async () => {
    try {
      setSaving(true);
      const payload = buildPayload(form);

      if (editingId) {
        await dashboardUpdatesApi.updateEntry(editingId, payload);
        toast.success('Mise à jour enregistrée.');
      } else {
        await dashboardUpdatesApi.createEntry(payload);
        toast.success('Mise à jour créée.');
      }

      resetForm();
      await loadEntries();
      onUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de sauvegarder cette mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      setDeletingId(id);
      await dashboardUpdatesApi.deleteEntry(id);
      toast.success('Mise à jour supprimée.');
      if (editingId === id) {
        resetForm();
      }
      await loadEntries();
      onUpdated?.();
    } catch {
      toast.error('Impossible de supprimer cette mise à jour.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(900px,94vh)] max-w-[min(1120px,96vw)] flex-col overflow-hidden border-border/60 bg-background p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 px-6 py-3">
            <DialogTitle className="text-base font-semibold">
              {editingId ? 'Modifier la mise à jour' : 'Nouvelle mise à jour'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Clique sur n’importe quel élément de la carte pour l’éditer directement.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'apercu' | 'fiche')}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/50 px-6 py-2">
              <TabsList>
                <TabsTrigger value="apercu">Aperçu</TabsTrigger>
                <TabsTrigger value="fiche">Fiche détaillée</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                {editingId ? (
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    <X className="mr-1.5 h-4 w-4" />
                    Nouvelle
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                  className="gap-1.5"
                >
                  <History className="h-4 w-4" />
                  Historique
                  {entries.length > 0 ? (
                    <Badge variant="outline" className="ml-1 h-5 border-border/60 bg-muted/40 px-1.5 text-[10px]">
                      {entries.length}
                    </Badge>
                  ) : null}
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[260px_1fr]">
              {/* Left sidebar: meta options */}
              <aside className="space-y-5 overflow-y-auto border-b border-border/50 px-5 py-5 md:border-b-0 md:border-r">
                <div className="space-y-2">
                  <FieldLabel>Statut</FieldLabel>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium">
                        {form.isPublished ? 'Publié' : 'Brouillon'}
                      </div>
                      <p className="text-xs text-muted-foreground">Masque l’entrée sans la supprimer.</p>
                    </div>
                    <Switch
                      checked={form.isPublished}
                      onCheckedChange={(value) => setForm((current) => ({ ...current, isPublished: value }))}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Mise en avant</FieldLabel>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">À la une</div>
                        <p className="text-xs text-muted-foreground">Carte hero du dashboard.</p>
                      </div>
                    </div>
                    <Switch
                      checked={form.isFeatured}
                      onCheckedChange={(value) => setForm((current) => ({ ...current, isFeatured: value }))}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Catégorie</FieldLabel>
                  <Select
                    value={form.feedCategory}
                    onValueChange={(value: DashboardUpdateEntry['feedCategory']) => setForm((current) => ({ ...current, feedCategory: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(feedCategoryMeta).map(([key, meta]) => (
                        <SelectItem key={key} value={key}>{meta.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Date éditoriale</FieldLabel>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Publication</FieldLabel>
                  <Input
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Couleur d’accent</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border/60 bg-transparent"
                    />
                    <Input
                      value={form.accentColor}
                      onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))}
                      placeholder="#f59e0b"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Bouton d’action</FieldLabel>
                  <Input
                    value={form.ctaLabel}
                    onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                    placeholder="Libellé (ex: Lire l’article)"
                  />
                  <Input
                    value={form.ctaHref}
                    onChange={(event) => setForm((current) => ({ ...current, ctaHref: event.target.value }))}
                    placeholder="/dashboard ou https://..."
                  />
                </div>
              </aside>

              {/* Main content */}
              <div className="overflow-y-auto px-6 py-4">
                <TabsContent value="apercu" className="mt-0 space-y-0">
                  <div
                    className="relative overflow-hidden rounded-[24px] border border-border/60 bg-card p-5"
                    style={{ boxShadow: `0 18px 70px -42px ${accentColor}` }}
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-80"
                      style={{ background: `radial-gradient(circle at top left, ${accentColor}33, transparent 60%)` }}
                    />

                    <div className="relative z-10 space-y-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={categoryMeta.badgeClass}>
                          {categoryMeta.label}
                        </Badge>
                        {form.isFeatured ? (
                          <Badge variant="outline" className="border-foreground/10 bg-foreground/[0.04] text-foreground">
                            <Sparkles className="mr-1 h-3.5 w-3.5" />
                            À la une
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">{formatUpdateTimeLabel(publishedAtIso)}</span>
                      </div>

                      {/* Cover image */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="group relative block w-full overflow-hidden rounded-[22px] border border-border/50 bg-background/70 text-left transition-colors hover:border-primary/60"
                          >
                            {form.imageUrl ? (
                              <>
                                <img
                                  src={resolveImageUrl(form.imageUrl)}
                                  alt=""
                                  className="h-44 w-full object-cover"
                                />
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/0 opacity-0 transition-opacity group-hover:bg-background/40 group-hover:opacity-100">
                                  <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow">
                                    <ImagePlus className="h-4 w-4" />
                                    Changer l’image
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className={cn(
                                'flex h-44 flex-col items-center justify-center gap-2 bg-gradient-to-br text-sm text-muted-foreground',
                                form.feedCategory === 'GAME' && 'from-sky-500/20 via-sky-500/5 to-transparent',
                                form.feedCategory === 'PATCH' && 'from-emerald-500/20 via-emerald-500/5 to-transparent',
                                form.feedCategory === 'COMMUNITY' && 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
                                form.feedCategory === 'DEV' && 'from-amber-500/20 via-amber-500/5 to-transparent',
                              )}>
                                <ImagePlus className="h-6 w-6" />
                                Cliquer pour ajouter une image
                              </div>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[360px]">
                          <ImagePicker
                            value={form.imageUrl}
                            onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
                            uploadFn={uploadImage}
                            placeholder="/api/uploads/updates/... ou https://..."
                          />
                        </PopoverContent>
                      </Popover>

                      <InlineInput
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Titre de la mise à jour"
                        className="text-2xl font-semibold tracking-tight"
                      />

                      <AutoTextarea
                        value={form.summary}
                        onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                        placeholder="Résumé court qui introduit la mise à jour."
                        className="text-sm leading-7 text-muted-foreground"
                      />

                      <div className="flex items-center gap-3 pt-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 transition hover:border-primary/60"
                            >
                              <img
                                src={form.authorAvatarUrl ? resolveImageUrl(form.authorAvatarUrl) : '/aura-icon.svg'}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                                <ImagePlus className="h-4 w-4" />
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="start" className="w-[360px]">
                            <ImagePicker
                              value={form.authorAvatarUrl}
                              onChange={(url) => setForm((current) => ({ ...current, authorAvatarUrl: url }))}
                              uploadFn={uploadImage}
                              placeholder="/api/uploads/updates/... ou /aura-icon.svg"
                            />
                          </PopoverContent>
                        </Popover>
                        <div className="min-w-0 flex-1">
                          <InlineInput
                            value={form.authorName}
                            onChange={(event) => setForm((current) => ({ ...current, authorName: event.target.value }))}
                            placeholder="Equipe AuraTracker"
                            className="text-sm font-medium"
                          />
                          <InlineInput
                            value={form.authorRole}
                            onChange={(event) => setForm((current) => ({ ...current, authorRole: event.target.value }))}
                            placeholder={formatUpdateDateLabel(form.date)}
                            className="text-xs text-muted-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="fiche" className="mt-0">
                  <div className="space-y-5 rounded-[22px] border border-border/60 bg-card p-5">
                    <div className="space-y-2">
                      <FieldLabel>Contenu détaillé</FieldLabel>
                      <AutoTextarea
                        value={form.body}
                        onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                        placeholder="Texte plus long affiché dans la fiche détaillée."
                        className="text-sm leading-7 text-muted-foreground"
                      />
                    </div>

                    {SECTION_ORDER.map((category) => {
                      const meta = sectionCategoryMeta[category];
                      const Icon = meta.icon;
                      const items = form.sections[category];
                      return (
                        <div key={category} className="space-y-2">
                          <Badge variant="outline" className={meta.badgeClass}>
                            <Icon className="mr-1 h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                          <div className="space-y-2">
                            {items.map((item, index) => (
                              <div
                                key={`${category}-${index}`}
                                className="group relative rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-6 transition-colors focus-within:border-border"
                              >
                                <AutoTextarea
                                  value={item}
                                  onChange={(event) => updateSectionItem(category, index, event.target.value)}
                                  placeholder="Décris ce changement. Utilise **gras** pour un mot-clé."
                                  className="pr-8 hover:bg-transparent focus:bg-transparent"
                                />
                                {(items.length > 1 || item.trim().length > 0) ? (
                                  <button
                                    type="button"
                                    onClick={() => removeSectionItem(category, index)}
                                    className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                                    aria-label="Retirer cette ligne"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addSectionItem(category)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/60 px-4 py-2 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Ajouter une ligne
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>

          <DialogFooter className="shrink-0 border-t border-border/50 px-6 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            <Button onClick={() => void saveEntry()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingId ? 'Mettre à jour' : 'Publier la mise à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-[min(720px,96vw)] border-border/60 bg-background p-0">
          <DialogHeader className="border-b border-border/50 px-6 pb-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Historique
                </DialogTitle>
                <DialogDescription>Édite ou supprime une mise à jour existante.</DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadEntries()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
              </Button>
            </div>
          </DialogHeader>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6">
            {loading ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune mise à jour enregistrée.
              </div>
            ) : (
              entries.map((entry) => {
                const counts = getEntrySummaryCounts(entry);
                const isEditing = editingId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-2xl border bg-muted/20 p-4 transition',
                      isEditing ? 'border-primary/60 bg-primary/5' : 'border-border/60',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{entry.title}</p>
                          <Badge variant="outline" className={feedCategoryMeta[entry.feedCategory].badgeClass}>
                            {feedCategoryMeta[entry.feedCategory].shortLabel}
                          </Badge>
                          <Badge variant="outline" className={entry.isPublished ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'border-border/70 bg-muted text-muted-foreground'}>
                            {entry.isPublished ? 'Publié' : 'Brouillon'}
                          </Badge>
                          {isEditing ? (
                            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                              En édition
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatUpdateDateLabel(entry.date)} · {formatUpdateTimeLabel(entry.publishedAt)}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{entry.summary}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadEntryIntoForm(entry)}
                        >
                          <Edit2 className="mr-1.5 h-4 w-4" />
                          Éditer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/30 text-destructive hover:bg-destructive/10"
                          onClick={() => void deleteEntry(entry.id)}
                          disabled={deletingId === entry.id}
                        >
                          {deletingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SECTION_ORDER.filter((category) => counts[category] > 0).map((category) => (
                        <Badge key={category} variant="outline" className={sectionCategoryMeta[category].badgeClass}>
                          {sectionCategoryMeta[category].label} · {counts[category]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
