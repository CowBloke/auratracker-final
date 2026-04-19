import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  Edit2,
  Eye,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ImagePicker } from '@/components/ui/image-picker';
import {
  feedCategoryMeta,
  formatUpdateDateLabel,
  formatUpdateTimeLabel,
  getEntrySummaryCounts,
  renderUpdateRichText,
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

  const previewEntry = useMemo<DashboardUpdateEntry>(() => ({
    id: editingId ?? 'preview',
    date: form.date,
    title: form.title || 'Titre de mise à jour',
    summary: form.summary || 'Résumé court qui introduit la mise à jour.',
    body: form.body || 'Le contenu détaillé apparaît ici. Utilise les sections ci-dessous pour structurer les changements.',
    feedCategory: form.feedCategory,
    imageUrl: form.imageUrl || null,
    accentColor: form.accentColor || null,
    isFeatured: form.isFeatured,
    ctaLabel: form.ctaLabel || 'Voir plus',
    ctaHref: form.ctaHref || '/dashboard',
    author: {
      name: form.authorName || 'Equipe AuraTracker',
      role: form.authorRole || null,
      avatarUrl: form.authorAvatarUrl || null,
    },
    isPublished: form.isPublished,
    publishedAt: new Date(form.publishedAt || form.date).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reactions: [
      { kind: 'fire', count: 0, reacted: false, sampleUsers: [] },
      { kind: 'heart', count: 0, reacted: false, sampleUsers: [] },
      { kind: 'zap', count: 0, reacted: false, sampleUsers: [] },
    ],
    sections: SECTION_ORDER
      .map((category) => ({
        category,
        items: form.sections[category]
          .map((text, index) => ({ id: `${category}-${index}`, text: text.trim() }))
          .filter((item) => item.text.length > 0),
      }))
      .filter((section) => section.items.length > 0),
  }), [editingId, form]);

  const resetForm = () => {
    setEditingId(null);
    setForm(createDefaultState());
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(1200px,96vw)] overflow-hidden border-border/60 bg-background p-0">
        <DialogHeader className="border-b border-border/50 px-6 pb-4 pt-6">
          <DialogTitle className="text-xl">Centre des mises à jour</DialogTitle>
          <DialogDescription>
            Une seule source pilote le dashboard et la page changelog. Les brouillons restent invisibles jusqu’à publication.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[84vh] gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-y-auto border-b border-border/40 p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Éditeur</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Compose la mise à jour, choisis son ton et son état de publication.
                </p>
              </div>
              {editingId ? (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="mr-1.5 h-4 w-4" />
                  Réinitialiser
                </Button>
              ) : null}
            </div>

            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date éditoriale</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Publication</label>
                  <Input
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Catégorie dashboard</label>
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
                  <label className="text-sm font-medium">Couleur d’accent</label>
                  <Input
                    value={form.accentColor}
                    onChange={(event) => setForm((current) => ({ ...current, accentColor: event.target.value }))}
                    placeholder="#f59e0b"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">Visible aux joueurs</div>
                    <p className="text-xs text-muted-foreground">Masque l’entrée sans la supprimer.</p>
                  </div>
                  <Switch
                    checked={form.isPublished}
                    onCheckedChange={(value) => setForm((current) => ({ ...current, isPublished: value }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">Mise en avant</div>
                    <p className="text-xs text-muted-foreground">Peut devenir la carte hero du dashboard.</p>
                  </div>
                  <Switch
                    checked={form.isFeatured}
                    onCheckedChange={(value) => setForm((current) => ({ ...current, isFeatured: value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Titre</label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex: Patch 4.12 - équilibrage poker"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Résumé</label>
                <Textarea
                  value={form.summary}
                  onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                  rows={3}
                  placeholder="Phrase d’accroche visible sur les cartes du dashboard."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Détail</label>
                <Textarea
                  value={form.body}
                  onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                  rows={5}
                  placeholder="Texte plus long affiché dans la fiche détaillée."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Libellé du bouton</label>
                  <Input
                    value={form.ctaLabel}
                    onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                    placeholder="Ex: Lire l’article"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Lien du bouton</label>
                  <Input
                    value={form.ctaHref}
                    onChange={(event) => setForm((current) => ({ ...current, ctaHref: event.target.value }))}
                    placeholder="/changelog ou https://..."
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Auteur</label>
                  <Input
                    value={form.authorName}
                    onChange={(event) => setForm((current) => ({ ...current, authorName: event.target.value }))}
                    placeholder="Equipe AuraTracker"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rôle auteur</label>
                  <Input
                    value={form.authorRole}
                    onChange={(event) => setForm((current) => ({ ...current, authorRole: event.target.value }))}
                    placeholder="Lead dev"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image de couverture</label>
                  <ImagePicker
                    value={form.imageUrl}
                    onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
                    uploadFn={uploadImage}
                    placeholder="/api/uploads/updates/... ou https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Avatar auteur</label>
                  <ImagePicker
                    value={form.authorAvatarUrl}
                    onChange={(url) => setForm((current) => ({ ...current, authorAvatarUrl: url }))}
                    uploadFn={uploadImage}
                    placeholder="/api/uploads/updates/... ou /aura-icon.svg"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sections</h4>
                    <p className="text-sm text-muted-foreground">Chaque ligne alimente le changelog détaillé.</p>
                  </div>
                </div>

                {SECTION_ORDER.map((category) => {
                  const meta = sectionCategoryMeta[category];
                  const Icon = meta.icon;
                  return (
                    <Card key={category} className="border-border/60 bg-muted/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Badge variant="outline" className={meta.badgeClass}>
                            <Icon className="mr-1 h-3.5 w-3.5" />
                            {meta.label}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {form.sections[category].map((item, index) => (
                          <div key={`${category}-${index}`} className="flex gap-2">
                            <Textarea
                              value={item}
                              onChange={(event) => updateSectionItem(category, index, event.target.value)}
                              rows={2}
                              placeholder="Utilise **gras** pour mettre en avant un mot-clé."
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-1 shrink-0"
                              onClick={() => removeSectionItem(category, index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => addSectionItem(category)}>
                          <Plus className="mr-1.5 h-4 w-4" />
                          Ajouter une ligne
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="overflow-y-auto bg-muted/10 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Aperçu</h3>
                <p className="mt-1 text-sm text-muted-foreground">Le rendu ci-dessous reprend la nouvelle interface du dashboard.</p>
              </div>
              <Badge variant="outline" className={previewEntry.isPublished ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'border-border/70 bg-muted text-muted-foreground'}>
                {previewEntry.isPublished ? 'Publié' : 'Brouillon'}
              </Badge>
            </div>

            <div className="mt-5 space-y-5">
              <div
                className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card p-5 shadow-[0_20px_60px_-34px_rgba(15,23,42,0.55)]"
                style={{ boxShadow: `0 18px 70px -42px ${previewEntry.accentColor ?? '#f59e0b'}` }}
              >
                <div
                  className="absolute inset-x-0 top-0 h-32 opacity-80"
                  style={{
                    background: `radial-gradient(circle at top left, ${previewEntry.accentColor ?? '#f59e0b'}33, transparent 60%)`,
                  }}
                />
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={feedCategoryMeta[previewEntry.feedCategory].badgeClass}>
                      {feedCategoryMeta[previewEntry.feedCategory].label}
                    </Badge>
                    {previewEntry.isFeatured ? (
                      <Badge variant="outline" className="border-foreground/10 bg-foreground/[0.04] text-foreground">
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        À la une
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{formatUpdateTimeLabel(previewEntry.publishedAt)}</span>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[22px] border border-border/50 bg-background/70">
                    {previewEntry.imageUrl ? (
                      <img
                        src={resolveImageUrl(previewEntry.imageUrl)}
                        alt={previewEntry.title}
                        className="h-48 w-full object-cover"
                      />
                    ) : (
                      <div
                        className={cn(
                          'flex h-48 items-end bg-gradient-to-br p-6',
                          previewEntry.feedCategory === 'GAME' && 'from-sky-500/20 via-sky-500/5 to-transparent',
                          previewEntry.feedCategory === 'PATCH' && 'from-emerald-500/20 via-emerald-500/5 to-transparent',
                          previewEntry.feedCategory === 'COMMUNITY' && 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
                          previewEntry.feedCategory === 'DEV' && 'from-amber-500/20 via-amber-500/5 to-transparent'
                        )}
                      >
                        <div className="rounded-full border border-border/60 bg-background/80 p-3">
                          {(() => {
                            const Icon = feedCategoryMeta[previewEntry.feedCategory].icon;
                            return <Icon className="h-6 w-6 text-foreground" />;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    <h4 className="text-2xl font-semibold tracking-tight">{previewEntry.title}</h4>
                    <p className="text-sm leading-7 text-muted-foreground">{previewEntry.summary}</p>
                    <div className="flex items-center gap-3">
                      <img
                        src={previewEntry.author.avatarUrl ? resolveImageUrl(previewEntry.author.avatarUrl) : '/aura-icon.svg'}
                        alt={previewEntry.author.name}
                        className="h-10 w-10 rounded-full border border-border/60 object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium">{previewEntry.author.name}</p>
                        <p className="text-xs text-muted-foreground">{previewEntry.author.role || formatUpdateDateLabel(previewEntry.date)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    Fiche détaillée
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{previewEntry.body}</p>
                  {previewEntry.sections.map((section) => {
                    const meta = sectionCategoryMeta[section.category];
                    const Icon = meta.icon;
                    return (
                      <div key={section.category} className="space-y-2">
                        <Badge variant="outline" className={meta.badgeClass}>
                          <Icon className="mr-1 h-3.5 w-3.5" />
                          {meta.label}
                        </Badge>
                        <div className="space-y-2">
                          {section.items.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-6">
                              {renderUpdateRichText(item.text)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Historique</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Édite, republie ou supprime une entrée existante.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void loadEntries()} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
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
                      return (
                        <div key={entry.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
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
                                onClick={() => {
                                  setEditingId(entry.id);
                                  setForm(mapEntryToState(entry));
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
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
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border/50 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={() => void saveEntry()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {editingId ? 'Mettre à jour' : 'Publier la mise à jour'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
