import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import {
  polymarketApi, PolymarketEvent, PolymarketSuggestion, PolymarketBet,
  uploadUserImage,
} from '../services/api';
import { prepareImageUploadPayload } from '@/lib/image-upload';

interface PolymarketOption {
  key: string;
  label: string;
  color: string;
  odds: number;
}
import { ImagePicker } from '@/components/ui/image-picker';
import {
  Loader2, Plus, Calendar,
  CheckCircle2, XCircle, Pencil, Trash2, Eye,
  Check, X, LayoutGrid, List,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

// ─── Option helpers ───────────────────────────────────────────────────────────

const DEFAULT_OPTION_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b'];
type PolymarketViewMode = 'list' | 'grid';
const POLYMARKET_VIEW_STORAGE_KEY = 'auratracker:polymarket-view-mode';

interface DraftOption {
  key: string;
  label: string;
  color: string;
  odds: string; // string for controlled input
}

/** Returns the options for an event, using optionsConfig when present, falling back to YES/NO. */
function getEventOptions(event: Pick<PolymarketEvent, 'yesOdds' | 'noOdds' | 'optionsConfig'>): PolymarketOption[] {
  if (event.optionsConfig) {
    try {
      const parsed = JSON.parse(event.optionsConfig) as PolymarketOption[];
      if (Array.isArray(parsed) && parsed.length >= 2) return parsed;
    } catch { /* fall through */ }
  }
  return [
    { key: 'YES', label: 'Oui', color: '#22c55e', odds: event.yesOdds },
    { key: 'NO',  label: 'Non', color: '#ef4444', odds: event.noOdds  },
  ];
}

function getOptionByKey(event: Pick<PolymarketEvent, 'yesOdds' | 'noOdds' | 'optionsConfig'>, key: string): PolymarketOption | undefined {
  return getEventOptions(event).find((o) => o.key === key);
}

function makeDraftOption(i: number, existing?: PolymarketOption): DraftOption {
  const defaultKeys = ['YES', 'NO', 'OPTION_3', 'OPTION_4'];
  return {
    key: existing?.key ?? defaultKeys[i] ?? `OPTION_${i + 1}`,
    label: existing?.label ?? '',
    color: existing?.color ?? DEFAULT_OPTION_COLORS[i] ?? '#888888',
    odds: existing?.odds?.toString() ?? '',
  };
}

function buildOptionsFromBinary(yes: string, no: string): PolymarketOption[] | null {
  const y = parseFloat(yes), n = parseFloat(no);
  if (!Number.isFinite(y) || y <= 1 || !Number.isFinite(n) || n <= 1) return null;
  return [
    { key: 'YES', label: 'Oui', color: '#22c55e', odds: y },
    { key: 'NO',  label: 'Non', color: '#ef4444', odds: n },
  ];
}

function buildOptionsFromDrafts(drafts: DraftOption[]): PolymarketOption[] | null {
  const options: PolymarketOption[] = [];
  for (const d of drafts) {
    if (!d.label.trim()) return null;
    const odds = parseFloat(d.odds);
    if (!Number.isFinite(odds) || odds <= 1) return null;
    options.push({ key: d.key || d.label.toUpperCase().replace(/\s+/g, '_'), label: d.label.trim(), color: d.color, odds });
  }
  return options.length >= 2 ? options : null;
}

// ─── OptionsEditor ─────────────────────────────────────────────────────────────

interface OptionsEditorProps {
  mode: 'binary' | 'custom';
  onModeChange: (m: 'binary' | 'custom') => void;
  binaryYes: string;
  onBinaryYesChange: (v: string) => void;
  binaryNo: string;
  onBinaryNoChange: (v: string) => void;
  customDrafts: DraftOption[];
  onCustomDraftsChange: (d: DraftOption[]) => void;
  oddsLabel?: string; // label suffix, e.g. '' or ' (requis)'
}

function OptionsEditor({
  mode, onModeChange,
  binaryYes, onBinaryYesChange,
  binaryNo, onBinaryNoChange,
  customDrafts, onCustomDraftsChange,
  oddsLabel = '',
}: OptionsEditorProps) {
  const previewColors = mode === 'binary'
    ? DEFAULT_OPTION_COLORS.slice(0, 2)
    : customDrafts.map((d) => d.color || '#888888');
  const previewLabels = mode === 'binary'
    ? ['Oui', 'Non']
    : customDrafts.map((d, i) => d.label || `Option ${i + 1}`);

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onModeChange('binary')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
            mode === 'binary'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted',
          )}
        >
          Oui / Non
        </button>
        <button
          type="button"
          onClick={() => onModeChange('custom')}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium border transition-colors',
            mode === 'custom'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted',
          )}
        >
          Options personnalisées
        </button>
      </div>

      {/* Inputs */}
      {mode === 'binary' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#22c55e' }} />
              Oui — cote{oddsLabel}
            </label>
            <Input
              type="number"
              value={binaryYes}
              onChange={(e) => onBinaryYesChange(e.target.value)}
              placeholder="ex: 1.5"
              step="any"
              min="1.001"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#ef4444' }} />
              Non — cote{oddsLabel}
            </label>
            <Input
              type="number"
              value={binaryNo}
              onChange={(e) => onBinaryNoChange(e.target.value)}
              placeholder="ex: 2.0"
              step="any"
              min="1.001"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {customDrafts.map((draft, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={draft.color}
                onChange={(e) => {
                  const next = [...customDrafts];
                  next[i] = { ...next[i], color: e.target.value };
                  onCustomDraftsChange(next);
                }}
                className="w-8 h-8 rounded cursor-pointer border border-input flex-shrink-0"
                style={{ padding: '1px' }}
                title="Couleur"
              />
              <Input
                value={draft.label}
                onChange={(e) => {
                  const next = [...customDrafts];
                  next[i] = { ...next[i], label: e.target.value };
                  onCustomDraftsChange(next);
                }}
                placeholder={`Libellé option ${i + 1}`}
                className="flex-1"
              />
              <Input
                type="number"
                value={draft.odds}
                onChange={(e) => {
                  const next = [...customDrafts];
                  next[i] = { ...next[i], odds: e.target.value };
                  onCustomDraftsChange(next);
                }}
                placeholder={`Cote${oddsLabel}`}
                step="any"
                min="1.001"
                className="w-24"
              />
              {customDrafts.length > 2 && (
                <button
                  type="button"
                  onClick={() => onCustomDraftsChange(customDrafts.filter((_, j) => j !== i))}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors flex-shrink-0"
                  title="Supprimer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {customDrafts.length < 4 && (
            <button
              type="button"
              onClick={() =>
                onCustomDraftsChange([
                  ...customDrafts,
                  makeDraftOption(customDrafts.length),
                ])
              }
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Ajouter une option
            </button>
          )}
        </div>
      )}

      {/* Live preview bar */}
      <div>
        <div className="text-xs text-muted-foreground mb-1">Aperçu</div>
        <div className="h-6 w-full rounded overflow-hidden flex">
          {previewColors.map((color, i) => (
            <div key={i} className="h-full flex-1" style={{ background: color }} />
          ))}
        </div>
        <div className="flex mt-1">
          {previewLabels.map((label, i) => (
            <div key={i} className="flex-1 text-center text-xs text-muted-foreground px-1 truncate">
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Polymarket() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PolymarketEvent[]>([]);
  const [suggestions, setSuggestions] = useState<PolymarketSuggestion[]>([]);
  const [bets, setBets] = useState<PolymarketBet[]>([]);
  const [allBets, setAllBets] = useState<PolymarketBet[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'history' | 'admin'>('events');
  const [betHistoryTab, setBetHistoryTab] = useState<'my' | 'all'>('my');
  const [sortOrder, setSortOrder] = useState<'recent' | 'ends_soon' | 'popular' | 'best_odds'>('recent');
  const [viewMode, setViewMode] = useState<PolymarketViewMode>(() => {
    if (typeof window === 'undefined') return 'list';
    const stored = window.localStorage.getItem(POLYMARKET_VIEW_STORAGE_KEY);
    return stored === 'grid' ? 'grid' : 'list';
  });

  // Suggestion dialog
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [suggestionMode, setSuggestionMode] = useState<'binary' | 'custom'>('binary');
  const [suggestionBinaryYes, setSuggestionBinaryYes] = useState('');
  const [suggestionBinaryNo, setSuggestionBinaryNo] = useState('');
  const [suggestionCustomDrafts, setSuggestionCustomDrafts] = useState<DraftOption[]>([
    makeDraftOption(0), makeDraftOption(1),
  ]);

  // Bet dialog
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PolymarketEvent | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [betPrediction, setBetPrediction] = useState<string>('YES');
  const [betSubmitting, setBetSubmitting] = useState(false);

  // Admin — approve suggestion
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PolymarketSuggestion | null>(null);
  const [approveMode, setApproveMode] = useState<'binary' | 'custom'>('binary');
  const [approveBinaryYes, setApproveBinaryYes] = useState('');
  const [approveBinaryNo, setApproveBinaryNo] = useState('');
  const [approveCustomDrafts, setApproveCustomDrafts] = useState<DraftOption[]>([
    makeDraftOption(0), makeDraftOption(1),
  ]);
  const [approveEventDate, setApproveEventDate] = useState('');

  // Admin — resolve event
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedEventForResolve, setSelectedEventForResolve] = useState<PolymarketEvent | null>(null);
  const [resolution, setResolution] = useState<string>('YES');

  // Admin — create event
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [createEventImageUrl, setCreateEventImageUrl] = useState('');
  const [createMode, setCreateMode] = useState<'binary' | 'custom'>('binary');
  const [createBinaryYes, setCreateBinaryYes] = useState('');
  const [createBinaryNo, setCreateBinaryNo] = useState('');
  const [createCustomDrafts, setCreateCustomDrafts] = useState<DraftOption[]>([
    makeDraftOption(0), makeDraftOption(1),
  ]);

  // Admin — edit event
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<PolymarketEvent | null>(null);
  const [editEventImageUrl, setEditEventImageUrl] = useState('');
  const [editMode, setEditMode] = useState<'binary' | 'custom'>('binary');
  const [editBinaryYes, setEditBinaryYes] = useState('');
  const [editBinaryNo, setEditBinaryNo] = useState('');
  const [editCustomDrafts, setEditCustomDrafts] = useState<DraftOption[]>([
    makeDraftOption(0), makeDraftOption(1),
  ]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Detail view dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<PolymarketEvent | null>(null);
  const [detailBets, setDetailBets] = useState<PolymarketBet[]>([]);
  const [loadingDetailBets, setLoadingDetailBets] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEventForDelete, setSelectedEventForDelete] = useState<PolymarketEvent | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const openDetailDialog = async (event: PolymarketEvent) => {
    setSelectedEventForDetail(event);
    setDetailDialogOpen(true);
    setDetailBets([]);
    setLoadingDetailBets(true);
    try {
      const res = await polymarketApi.getEvent(event.id);
      setDetailBets(res.data.event.bets || []);
    } catch {
      setDetailBets([]);
    } finally {
      setLoadingDetailBets(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEventForDelete) return;
    setDeleteSubmitting(true);
    try {
      await polymarketApi.deleteEvent(selectedEventForDelete.id);
      toast({ title: 'Événement supprimé' });
      setDeleteDialogOpen(false);
      setSelectedEventForDelete(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de supprimer l\'événement', variant: 'destructive' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const uploadPolymarketImageFile = async (file: File): Promise<string> => {
    const { base64Data, mimeType } = await prepareImageUploadPayload(file);
    const res = await uploadUserImage({ base64Data, mimeType });
    return res.data.imageUrl;
  };

  const formatDateTimeLocal = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 16);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(POLYMARKET_VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsRes, suggestionsRes, betsRes, allBetsRes] = await Promise.all([
        polymarketApi.getEvents(),
        polymarketApi.getSuggestions(),
        polymarketApi.getBets(),
        polymarketApi.getAllBets(50),
      ]);
      setEvents(eventsRes.data.events);
      setSuggestions(suggestionsRes.data.suggestions);
      setBets(betsRes.data.bets);
      setAllBets(allBetsRes.data.bets);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Suggestion submit ──────────────────────────────────────────────────────

  const handleCreateSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    let optionsPayload: PolymarketOption[] | undefined;

    if (suggestionMode === 'custom') {
      const opts = buildOptionsFromDrafts(suggestionCustomDrafts);
      if (!opts) {
        toast({ title: 'Erreur', description: 'Veuillez renseigner un libellé et une cote valide (> 1) pour chaque option.', variant: 'destructive' });
        return;
      }
      optionsPayload = opts;
    } else {
      // Binary — odds are optional
      const hasYes = suggestionBinaryYes.trim() !== '';
      const hasNo = suggestionBinaryNo.trim() !== '';
      if (hasYes !== hasNo) {
        toast({ title: 'Erreur', description: 'Veuillez renseigner les deux cotes ou laisser les deux vides.', variant: 'destructive' });
        return;
      }
      if (hasYes && hasNo) {
        const opts = buildOptionsFromBinary(suggestionBinaryYes, suggestionBinaryNo);
        if (!opts) {
          toast({ title: 'Erreur', description: 'Les cotes doivent être des nombres supérieurs à 1.', variant: 'destructive' });
          return;
        }
        optionsPayload = opts;
      }
    }

    setSuggestionSubmitting(true);
    try {
      const payload: Parameters<typeof polymarketApi.createSuggestion>[0] = {
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim() || undefined,
      };
      if (eventDate.trim()) payload.eventDate = eventDate;
      if (optionsPayload) {
        if (suggestionMode === 'custom') {
          payload.optionsConfig = optionsPayload;
        } else {
          const yesOpt = optionsPayload.find(o => o.key === 'YES') ?? optionsPayload[0];
          const noOpt = optionsPayload.find(o => o.key === 'NO') ?? optionsPayload[1];
          if (yesOpt && noOpt) {
            payload.suggestedYesOdds = yesOpt.odds;
            payload.suggestedNoOdds = noOpt.odds;
          }
        }
      }

      await polymarketApi.createSuggestion(payload);
      toast({ title: 'Suggestion créée', description: 'Votre suggestion a été soumise avec succès' });

      setTitle(''); setDescription(''); setImageUrl(''); setEventDate('');
      setSuggestionMode('binary');
      setSuggestionBinaryYes(''); setSuggestionBinaryNo('');
      setSuggestionCustomDrafts([makeDraftOption(0), makeDraftOption(1)]);
      setSuggestionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de créer la suggestion', variant: 'destructive' });
    } finally {
      setSuggestionSubmitting(false);
    }
  };

  // ── Bet submit ─────────────────────────────────────────────────────────────

  const handlePlaceBet = async () => {
    if (!selectedEvent || !betAmount || parseInt(betAmount) <= 0) return;

    setBetSubmitting(true);
    try {
      await polymarketApi.placeBet({ eventId: selectedEvent.id, prediction: betPrediction as 'YES' | 'NO', amount: parseInt(betAmount) });
      const label = getOptionByKey(selectedEvent, betPrediction)?.label || betPrediction;
      toast({ title: 'Pari placé', description: `Vous avez parié ${betAmount} sur ${label}` });
      setBetDialogOpen(false);
      setSelectedEvent(null);
      setBetAmount('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de placer le pari', variant: 'destructive' });
    } finally {
      setBetSubmitting(false);
    }
  };

  // ── Approve suggestion ─────────────────────────────────────────────────────

  const handleApproveSuggestion = async () => {
    if (!selectedSuggestion) return;
    if (!selectedSuggestion.eventDate && !approveEventDate) {
      toast({ title: 'Erreur', description: 'Merci de renseigner une date de réalisation.', variant: 'destructive' });
      return;
    }

    let optionsPayload: PolymarketOption[] | null = null;
    if (approveMode === 'custom') {
      optionsPayload = buildOptionsFromDrafts(approveCustomDrafts);
    } else {
      optionsPayload = buildOptionsFromBinary(approveBinaryYes, approveBinaryNo);
    }

    if (!optionsPayload) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner des cotes valides (> 1) pour toutes les options.', variant: 'destructive' });
      return;
    }

    try {
      const yesOdds = optionsPayload.find(o => o.key === 'YES')?.odds ?? optionsPayload[0]?.odds;
      const noOdds = optionsPayload.find(o => o.key === 'NO')?.odds ?? optionsPayload[1]?.odds;
      await polymarketApi.approveSuggestion(selectedSuggestion.id, {
        yesOdds,
        noOdds,
        eventDate: approveEventDate || undefined,
        ...(approveMode === 'custom' ? { optionsConfig: optionsPayload } : {}),
      });
      toast({ title: 'Suggestion approuvée', description: 'L\'événement a été créé avec succès' });
      setApproveDialogOpen(false);
      setSelectedSuggestion(null);
      setApproveBinaryYes(''); setApproveBinaryNo('');
      setApproveEventDate('');
      setApproveMode('binary');
      setApproveCustomDrafts([makeDraftOption(0), makeDraftOption(1)]);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible d\'approuver la suggestion', variant: 'destructive' });
    }
  };

  // ── Reject suggestion ──────────────────────────────────────────────────────

  const handleRejectSuggestion = async (id: string) => {
    try {
      await polymarketApi.rejectSuggestion(id);
      toast({ title: 'Suggestion rejetée' });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de rejeter la suggestion', variant: 'destructive' });
    }
  };

  // ── Resolve event ──────────────────────────────────────────────────────────

  const handleResolveEvent = async () => {
    if (!selectedEventForResolve) return;
    try {
      await polymarketApi.resolveEvent(selectedEventForResolve.id, resolution as 'YES' | 'NO');
      const label = getOptionByKey(selectedEventForResolve, resolution)?.label || resolution;
      toast({ title: 'Événement résolu', description: `Résolution: ${label}` });
      setResolveDialogOpen(false);
      setSelectedEventForResolve(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de résoudre l\'événement', variant: 'destructive' });
    }
  };

  // ── Open edit event dialog ─────────────────────────────────────────────────

  const openEditEventDialog = (event: PolymarketEvent) => {
    setSelectedEventForEdit(event);
    setEditEventImageUrl(event.imageUrl || '');
    setEditMode('binary');
    setEditBinaryYes(event.yesOdds.toString());
    setEditBinaryNo(event.noOdds.toString());
    setEditEventDialogOpen(true);
  };

  // ── Update event ───────────────────────────────────────────────────────────

  const handleUpdateEvent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEventForEdit) return;

    const formData = new FormData(e.currentTarget);
    const titleValue = (formData.get('title') as string)?.trim();
    const descriptionValue = (formData.get('description') as string)?.trim();
    const eventDateValue = formData.get('eventDate') as string;
    const statusValue = formData.get('status') as PolymarketEvent['status'];

    let optionsPayload: PolymarketOption[] | null = null;
    if (editMode === 'custom') {
      optionsPayload = buildOptionsFromDrafts(editCustomDrafts);
    } else {
      optionsPayload = buildOptionsFromBinary(editBinaryYes, editBinaryNo);
    }

    if (!optionsPayload) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner des cotes valides (> 1) pour toutes les options.', variant: 'destructive' });
      return;
    }

    if (!titleValue || !descriptionValue || !eventDateValue) {
      toast({ title: 'Erreur', description: 'Tous les champs requis doivent être renseignés.', variant: 'destructive' });
      return;
    }

    const yesOdds = optionsPayload.find(o => o.key === 'YES')?.odds ?? optionsPayload[0]?.odds;
    const noOdds = optionsPayload.find(o => o.key === 'NO')?.odds ?? optionsPayload[1]?.odds;

    setEditSubmitting(true);
    try {
      await polymarketApi.updateEvent(selectedEventForEdit.id, {
        title: titleValue,
        description: descriptionValue,
        eventDate: eventDateValue,
        imageUrl: editEventImageUrl.trim() || null,
        yesOdds,
        noOdds,
        status: statusValue,
        ...(editMode === 'custom' ? { optionsConfig: optionsPayload } : { optionsConfig: null }),
      });
      toast({ title: 'Événement modifié', description: 'Les changements ont été enregistrés.' });
      setEditEventDialogOpen(false);
      setSelectedEventForEdit(null);
      setEditEventImageUrl('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de modifier l\'événement', variant: 'destructive' });
    } finally {
      setEditSubmitting(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const openEvents = events.filter((e) => e.status === 'OPEN');
  const sortedOpenEvents = [...openEvents].sort((a, b) => {
    switch (sortOrder) {
      case 'ends_soon':
        return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
      case 'popular':
        return (b.totalVolume || 0) - (a.totalVolume || 0);
      case 'best_odds': {
        const maxA = Math.max(...getEventOptions(a).map((o) => o.odds));
        const maxB = Math.max(...getEventOptions(b).map((o) => o.odds));
        return maxB - maxA;
      }
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
  const resolvedEvents = events.filter((e) => e.status === 'RESOLVED');
  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');

  // Bet stats for "Mes paris"
  const resolvedBets = bets.filter((b) => b.event?.status === 'RESOLVED');
  const wonBets = resolvedBets.filter((b) => b.event?.resolution === b.prediction);
  const lostBets = resolvedBets.filter((b) => b.event?.resolution !== b.prediction);
  const pendingBets = bets.filter((b) => b.event?.status !== 'RESOLVED');
  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalGained = wonBets.reduce((s, b) => s + (Number(b.payout) || 0), 0);
  const resolvedWagered = resolvedBets.reduce((s, b) => s + b.amount, 0);
  const netPnL = totalGained - resolvedWagered;
  const betWinRate = resolvedBets.length > 0 ? (wonBets.length / resolvedBets.length * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between gap-3">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="events">Événements</TabsTrigger>
              <TabsTrigger value="history">Mes paris</TabsTrigger>
              {user?.isAdmin && (
                <TabsTrigger value="admin">Paris admin</TabsTrigger>
              )}
            </TabsList>
            <div className="flex items-center gap-2">
              {activeTab === 'events' && openEvents.length > 1 && (
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                  <SelectTrigger className="h-11 w-44">
                    <SelectValue placeholder="Trier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Plus récents</SelectItem>
                    <SelectItem value="ends_soon">Fin proche</SelectItem>
                    <SelectItem value="popular">Plus populaires</SelectItem>
                    <SelectItem value="best_odds">Meilleures cotes</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {(activeTab === 'events' || activeTab === 'admin') && (
                <div className="inline-flex rounded-md border border-border/60 p-0.5">
                  <Button
                    type="button"
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('list')}
                    className="h-8 w-8"
                    aria-label="Vue liste"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    className="h-8 w-8"
                    aria-label="Vue grille"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button className="h-11 px-5" onClick={() => setSuggestionDialogOpen(true)}>
                <Plus className="h-5 w-5 mr-2" />
                Suggérer
              </Button>
              {user?.isAdmin && activeTab === 'events' && (
                <Button className="h-11 px-5" variant="outline" onClick={() => setCreateEventDialogOpen(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Créer un événement
                </Button>
              )}
            </div>
          </div>

          {/* ── Events tab ── */}
          <TabsContent value="events" className={SPACING.SECTION_SPACING}>
            {openEvents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Aucun événement ouvert pour le moment
                </CardContent>
              </Card>
            ) : (
              <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'space-y-4')}>
                {sortedOpenEvents.map((event) => {
                  const userBet = bets.find((b) => b.eventId === event.id);
                  const canBet = !userBet && event.status === 'OPEN' && new Date(event.eventDate) > new Date();
                  const options = getEventOptions(event);
                  const totalVolume = event.totalVolume || 0;

                  return (
                    <Card key={event.id} className="overflow-hidden">
                      <div className={cn('min-h-[160px]', viewMode === 'grid' ? 'flex h-full flex-col' : 'flex')}>
                        {/* ── Image: full card height, rounded inside with margin ── */}
                        <div className={cn(
                          'shrink-0 overflow-hidden rounded-xl',
                          viewMode === 'grid' ? 'm-3 mb-0 h-44 w-auto' : 'm-3 mr-0 w-36'
                        )}>
                          {event.imageUrl ? (
                            <img
                              src={resolveImageUrl(event.imageUrl)}
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted/50" />
                          )}
                        </div>

                        {/* ── Right side: title + content ── */}
                        <div className="flex flex-1 flex-col gap-3 p-4 min-w-0">
                          {/* Title row */}
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-base font-bold leading-snug">{event.title}</CardTitle>
                                <Badge variant={event.status === 'OPEN' ? 'default' : 'secondary'} className="text-xs shrink-0">
                                  {event.status === 'OPEN' ? 'Ouvert' : event.status}
                                </Badge>
                              </div>
                            </div>
                            {user?.isAdmin && (
                              <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEventDialog(event)} title="Modifier">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {event.status === 'OPEN' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedEventForResolve(event); setResolution(options[0]?.key || 'YES'); setResolveDialogOpen(true); }} title="Résoudre">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setSelectedEventForDelete(event); setDeleteDialogOpen(true); }} title="Supprimer">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Content: description 30% · options 70% */}
                          <div className={cn('flex flex-1 min-h-0 gap-3', viewMode === 'grid' && 'flex-col')}>
                            {/* Description column */}
                            <div
                              className="flex min-w-0 flex-col justify-between gap-2"
                              style={viewMode === 'grid' ? undefined : { flex: '0 0 28%' }}
                            >
                              <div>
                                <CardDescription className="line-clamp-3 text-xs leading-relaxed">{event.description}</CardDescription>
                                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{new Date(event.eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                {userBet && (() => {
                                  const betOpt = getOptionByKey(event, userBet.prediction);
                                  return (
                                    <span className="text-xs text-muted-foreground">
                                      <span className="font-semibold" style={{ color: betOpt?.color }}>{betOpt?.label}</span>
                                      {' · '}{userBet.amount} misé
                                    </span>
                                  );
                                })()}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 w-full"
                                  onClick={() => openDetailDialog(event)}
                                >
                                  <Eye className="h-3 w-3" />
                                  Voir plus
                                </Button>
                              </div>
                            </div>

                            {/* Option boxes column */}
                            <div className="flex flex-1 gap-2 min-w-0">
                              {options.map((opt) => {
                                const optVol = (event.optionStats ?? {})[opt.key]
                                  ?? (opt.key === 'YES' ? (event.totalYes || 0) : opt.key === 'NO' ? (event.totalNo || 0) : 0);
                                const pct = totalVolume > 0 ? (optVol / totalVolume * 100) : (100 / options.length);
                                const isMyBet = userBet?.prediction === opt.key;
                                return (
                                  <div
                                    key={opt.key}
                                    className="flex-1 rounded-xl border p-3 space-y-2 min-w-0"
                                    style={{
                                      borderColor: isMyBet ? opt.color + '80' : opt.color + '35',
                                      background: isMyBet ? opt.color + '18' : opt.color + '0c',
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{opt.label}</span>
                                      <span
                                        className="text-sm font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: opt.color + '20', color: opt.color }}
                                      >
                                        {opt.odds.toFixed(2)}x
                                      </span>
                                    </div>
                                    <div className="text-4xl font-bold tabular-nums leading-none" style={{ color: opt.color }}>
                                      {pct.toFixed(1)}%
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums">
                                      {((event.optionStats ?? {})[opt.key] ?? (opt.key === 'YES' ? (event.totalYes || 0) : opt.key === 'NO' ? (event.totalNo || 0) : 0)).toLocaleString('fr-FR')} misés
                                    </div>
                                    {canBet ? (
                                      <button
                                        className="w-full rounded-lg py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-85 active:scale-95 mt-1"
                                        style={{ background: opt.color }}
                                        onClick={() => { setSelectedEvent(event); setBetPrediction(opt.key); setBetAmount(''); setBetDialogOpen(true); }}
                                      >
                                        Parier
                                      </button>
                                    ) : isMyBet ? (
                                      <div className="w-full rounded-lg py-1.5 text-xs font-bold text-center text-white mt-1" style={{ background: opt.color + 'cc' }}>
                                        ✓ Mon pari
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Resolved events */}
            {resolvedEvents.length > 0 && (
              <div className={SPACING.CARD_SPACING}>
                <h2 className={TYPOGRAPHY.H2}>Événements résolus</h2>
                <div className="grid grid-cols-1 gap-4">
                  {resolvedEvents.slice(0, 6).map((event) => {
                    const resOpt = event.resolution ? getOptionByKey(event, event.resolution) : undefined;
                    return (
                      <Card key={event.id} className="opacity-75">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg">{event.title}</CardTitle>
                            <Badge
                              variant="secondary"
                              style={resOpt ? { borderColor: resOpt.color + '66', color: resOpt.color } : undefined}
                            >
                              {event.resolution === 'YES' ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : event.resolution === 'NO' ? (
                                <XCircle className="h-3 w-3 mr-1" />
                              ) : null}
                              {resOpt?.label || event.resolution}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-muted-foreground">
                            Résolu le {new Date(event.resolvedAt!).toLocaleDateString('fr-FR')}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── History tab ── */}
          <TabsContent value="history" className={SPACING.SECTION_SPACING}>
            <Tabs value={betHistoryTab} onValueChange={(v) => setBetHistoryTab(v as 'my' | 'all')}>
              <TabsList>
                <TabsTrigger value="my">Mes paris</TabsTrigger>
                <TabsTrigger value="all">Tous les paris</TabsTrigger>
              </TabsList>

              {/* ── Mes paris ── */}
              <TabsContent value="my" className="mt-4">
                {bets.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Vous n'avez pas encore de paris
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Stats summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl border p-3 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paris</div>
                        <div className="text-2xl font-bold tabular-nums">{bets.length}</div>
                        <div className="text-xs text-muted-foreground">{pendingBets.length} en cours</div>
                      </div>
                      <div className="rounded-xl border p-3 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Résultats</div>
                        <div className="text-2xl font-bold tabular-nums">
                          <span className="text-green-500">{wonBets.length}W</span>
                          <span className="text-muted-foreground mx-1 text-lg">·</span>
                          <span className="text-red-500">{lostBets.length}L</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {resolvedBets.length > 0 ? `${betWinRate.toFixed(0)}% réussite` : 'Aucun résolu'}
                        </div>
                      </div>
                      <div className="rounded-xl border p-3 space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total misé</div>
                        <div className="text-2xl font-bold tabular-nums">{totalWagered.toLocaleString('fr-FR')}</div>
                        <div className="text-xs text-muted-foreground">sur {bets.length} paris</div>
                      </div>
                      <div className="rounded-xl border p-3 space-y-1"
                        style={netPnL !== 0 ? {
                          borderColor: (netPnL > 0 ? '#22c55e' : '#ef4444') + '40',
                          background: (netPnL > 0 ? '#22c55e' : '#ef4444') + '08',
                        } : undefined}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Résultat net</div>
                        <div className={cn('text-2xl font-bold tabular-nums', netPnL > 0 ? 'text-green-500' : netPnL < 0 ? 'text-red-500' : '')}>
                          {netPnL > 0 ? '+' : ''}{netPnL.toLocaleString('fr-FR')}
                        </div>
                        <div className="text-xs text-muted-foreground">sur paris résolus</div>
                      </div>
                    </div>

                    {/* Bet cards */}
                    <div className="space-y-2">
                      {bets.map((bet) => {
                        const isResolved = bet.event?.status === 'RESOLVED';
                        const isWinner = bet.event?.resolution === bet.prediction;
                        const predOpt = bet.event ? getOptionByKey(bet.event as any, bet.prediction) : undefined;
                        const predLabel = predOpt?.label || bet.prediction;
                        const predColor = predOpt?.color || (bet.prediction === 'YES' ? '#22c55e' : bet.prediction === 'NO' ? '#ef4444' : '#888888');
                        const betOdds = predOpt?.odds || (bet.prediction === 'YES' ? (bet.event?.yesOdds || 1) : (bet.event?.noOdds || 1));
                        const payoutAmount = Number(bet.payout) || 0;
                        const potentialPayout = Math.floor(bet.amount * betOdds);
                        const netResult = isWinner ? payoutAmount - bet.amount : -bet.amount;

                        return (
                          <Card key={bet.id} className="overflow-hidden">
                            <div className="flex items-stretch min-h-[72px]">
                              {/* Color accent strip */}
                              <div className="w-1 shrink-0" style={{ background: predColor }} />

                              {/* Event image */}
                              <div className="w-14 h-14 shrink-0 m-2.5 mr-0 rounded-lg overflow-hidden self-center">
                                {bet.event?.imageUrl ? (
                                  <img
                                    src={resolveImageUrl(bet.event.imageUrl)}
                                    alt={bet.event?.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full" style={{ background: predColor + '18' }} />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex flex-1 items-center gap-3 px-3 py-2.5 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold leading-snug truncate">
                                    {bet.event?.title || 'Événement supprimé'}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span
                                      className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
                                      style={{ background: predColor }}
                                    >
                                      {predLabel}
                                    </span>
                                    <span className="text-xs font-semibold tabular-nums" style={{ color: predColor }}>
                                      {betOdds.toFixed(2)}x
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(bet.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                </div>

                                {/* Right: amount + result */}
                                <div className="text-right shrink-0">
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    {bet.amount.toLocaleString('fr-FR')} misé
                                  </div>
                                  {isResolved ? (
                                    <>
                                      <div className={cn('text-lg font-bold tabular-nums leading-tight', isWinner ? 'text-green-500' : 'text-red-500')}>
                                        {netResult > 0 ? '+' : ''}{netResult.toLocaleString('fr-FR')}
                                      </div>
                                      <div
                                        className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                        style={{
                                          background: isWinner ? '#22c55e18' : '#ef444418',
                                          color: isWinner ? '#22c55e' : '#ef4444',
                                        }}
                                      >
                                        {isWinner ? 'Gagné' : 'Perdu'}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="text-sm font-semibold tabular-nums" style={{ color: predColor }}>
                                        +{(potentialPayout - bet.amount).toLocaleString('fr-FR')}
                                      </div>
                                      <div className="text-xs text-muted-foreground">potentiel</div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── Tous les paris ── */}
              <TabsContent value="all" className="mt-4">
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {allBets.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">Aucun pari</CardContent>
                    </Card>
                  ) : (
                    allBets.map((bet) => {
                      const isResolved = bet.event?.status === 'RESOLVED';
                      const isWinner = bet.event?.resolution === bet.prediction;
                      const predOpt = bet.event ? getOptionByKey(bet.event as any, bet.prediction) : undefined;
                      const predLabel = predOpt?.label || bet.prediction;
                      const predColor = predOpt?.color || (bet.prediction === 'YES' ? '#22c55e' : bet.prediction === 'NO' ? '#ef4444' : '#888888');
                      const betOdds = predOpt?.odds || (bet.prediction === 'YES' ? (bet.event?.yesOdds || 1) : (bet.event?.noOdds || 1));
                      const potentialPayout = Math.floor(bet.amount * betOdds);
                      return (
                        <div key={bet.id} className="flex items-center justify-between py-3 border-b border-border/10">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 flex items-center justify-center border rounded" style={{ borderColor: predColor + '50', color: predColor }}>
                              {bet.prediction === 'YES' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : bet.prediction === 'NO' ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <span className="text-xs font-bold">{predLabel.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {bet.user && (
                                  <span className="text-sm font-medium" style={{ color: bet.user.usernameColor || undefined }}>
                                    {bet.user.username}
                                  </span>
                                )}
                                <span className="text-xs" style={{ color: predColor }}>{predLabel}</span>
                                <span className="text-sm text-muted-foreground truncate">{bet.event?.title || 'Événement supprimé'}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{new Date(bet.createdAt).toLocaleString('fr-FR')}</p>
                              {isResolved && (
                                <p className={cn('text-xs font-medium mt-1', isWinner ? 'text-green-500' : 'text-red-500')}>
                                  {isWinner ? <>Gain: {bet.payout} reçu</> : <>Perte: {bet.amount} perdu</>}
                                </p>
                              )}
                              {!isResolved && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Gain potentiel: {potentialPayout} ({potentialPayout - bet.amount} de profit)
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm tabular-nums font-medium">{bet.amount}</p>
                            {bet.event && <p className="text-xs text-muted-foreground tabular-nums">@ {betOdds.toFixed(2)}x</p>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ── Admin tab ── */}
          {user?.isAdmin && (
            <TabsContent value="admin" className={SPACING.SECTION_SPACING}>
              <div className={SPACING.SECTION_SPACING}>
                {/* Pending suggestions */}
                <div>
                  <h3 className={TYPOGRAPHY.H4}>Suggestions en attente</h3>
                  {pendingSuggestions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">Aucune suggestion en attente</CardContent>
                    </Card>
                  ) : (
                <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'space-y-4')}>
                      {pendingSuggestions.map((suggestion) => {
                        return (
                          <Card key={suggestion.id}>
                            <CardHeader>
                              <CardTitle>{suggestion.title}</CardTitle>
                              <CardDescription>{suggestion.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {suggestion.imageUrl && (
                                <img src={resolveImageUrl(suggestion.imageUrl)} alt={suggestion.title} className="w-full h-48 object-cover rounded-md" />
                              )}
                              <div className="text-sm text-muted-foreground">
                                Date: {suggestion.eventDate ? new Date(suggestion.eventDate).toLocaleDateString('fr-FR') : 'Non renseignée'}
                              </div>
                              {suggestion.optionsConfig ? (
                                (() => {
                                  try {
                                    const opts = JSON.parse(suggestion.optionsConfig) as PolymarketOption[];
                                    return (
                                      <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                                        <span>Options proposées:</span>
                                        {opts.map((opt) => (
                                          <span key={opt.key} className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: opt.color }} />
                                            {opt.label} {opt.odds.toFixed(2)}x
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  } catch { return null; }
                                })()
                              ) : suggestion.suggestedYesOdds && suggestion.suggestedNoOdds ? (
                                <div className="text-sm text-muted-foreground">
                                  Cotes proposées: Oui {suggestion.suggestedYesOdds.toFixed(2)}x / Non {suggestion.suggestedNoOdds.toFixed(2)}x
                                </div>
                              ) : null}
                              <div className="text-sm text-muted-foreground">Par: {suggestion.user.username}</div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSuggestion(suggestion);
                                    let prefilled = false;
                                    if (suggestion.optionsConfig) {
                                      try {
                                        const opts = JSON.parse(suggestion.optionsConfig) as PolymarketOption[];
                                        if (Array.isArray(opts) && opts.length >= 2) {
                                          setApproveMode('custom');
                                          setApproveCustomDrafts(opts.map((opt, i) => makeDraftOption(i, opt)));
                                          setApproveBinaryYes('');
                                          setApproveBinaryNo('');
                                          prefilled = true;
                                        }
                                      } catch { /* fall through */ }
                                    }
                                    if (!prefilled) {
                                      setApproveMode('binary');
                                      setApproveBinaryYes(suggestion.suggestedYesOdds?.toString() || '');
                                      setApproveBinaryNo(suggestion.suggestedNoOdds?.toString() || '');
                                      setApproveCustomDrafts([makeDraftOption(0), makeDraftOption(1)]);
                                    }
                                    setApproveEventDate(formatDateTimeLocal(suggestion.eventDate));
                                    setApproveDialogOpen(true);
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-2" />
                                  Approuver
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleRejectSuggestion(suggestion.id)}>
                                  <X className="h-4 w-4 mr-2" />
                                  Rejeter
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Events list */}
                <div>
                  <h3 className={TYPOGRAPHY.H4}>Événements</h3>
                  {events.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">Aucun événement disponible</CardContent>
                    </Card>
                  ) : (
                <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'space-y-3')}>
                      {events.map((event) => {
                        const options = getEventOptions(event);
                        return (
                          <Card key={event.id}>
                            <CardContent className="py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{event.title}</span>
                                  <Badge variant={event.status === 'OPEN' ? 'default' : 'secondary'}>{event.status}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(event.eventDate).toLocaleString('fr-FR')}
                                </div>
                                <div className="text-sm text-muted-foreground flex flex-wrap gap-2">
                                  {options.map((opt) => (
                                    <span key={opt.key} className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                                      {opt.label} {opt.odds.toFixed(2)}x
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button variant="outline" size="sm" onClick={() => openEditEventDialog(event)}>
                                  Modifier
                                </Button>
                                {event.status === 'OPEN' && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedEventForResolve(event);
                                      setResolution(options[0]?.key || 'YES');
                                      setResolveDialogOpen(true);
                                    }}
                                  >
                                    Résoudre
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ── Suggestion Dialog ── */}
      <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle suggestion</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSuggestion} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Le Bitcoin atteindra 100k$ en 2024" maxLength={200} required />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décrivez l'événement..." maxLength={2000} rows={4} required />
            </div>
            <div>
              <label className="text-sm font-medium">Date de réalisation (optionnel)</label>
              <Input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Type de pari & cotes (optionnel)</label>
              <div className="mt-2">
                <OptionsEditor
                  mode={suggestionMode}
                  onModeChange={(m) => {
                    setSuggestionMode(m);
                    if (m === 'custom') setSuggestionCustomDrafts([makeDraftOption(0), makeDraftOption(1)]);
                  }}
                  binaryYes={suggestionBinaryYes}
                  onBinaryYesChange={setSuggestionBinaryYes}
                  binaryNo={suggestionBinaryNo}
                  onBinaryNoChange={setSuggestionBinaryNo}
                  customDrafts={suggestionCustomDrafts}
                  onCustomDraftsChange={setSuggestionCustomDrafts}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Les cotes et options restent suggestives — l'admin peut les modifier.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Image (optionnel)</label>
              <ImagePicker value={imageUrl} onChange={setImageUrl} uploadFn={uploadPolymarketImageFile} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSuggestionDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={suggestionSubmitting}>
                {suggestionSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</> : 'Soumettre'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Bet Dialog ── */}
      <Dialog open={betDialogOpen} onOpenChange={setBetDialogOpen}>
        <DialogContent className="max-w-md">
          {selectedEvent && (() => {
            const options = getEventOptions(selectedEvent);
            const selectedOpt = options.find((o) => o.key === betPrediction) || options[0];
            const parsedAmount = parseInt(betAmount);
            const potentialPayout = parsedAmount > 0 ? Math.floor(parsedAmount * (selectedOpt?.odds || 1)) : 0;
            return (
              <div className="space-y-5">
                {/* Event info */}
                <div className="space-y-1 pr-6">
                  <h3 className="font-bold text-base leading-snug">{selectedEvent.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{selectedEvent.description}</p>
                </div>

                {/* Option selector */}
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
                  {options.map((opt) => {
                    const isSelected = betPrediction === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        className="rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-all focus:outline-none"
                        style={
                          isSelected
                            ? { background: opt.color, borderColor: opt.color }
                            : { background: 'transparent', borderColor: opt.color, color: opt.color }
                        }
                        onClick={() => setBetPrediction(opt.key)}
                      >
                        <span className={cn('text-sm font-bold', isSelected ? 'text-white' : '')}>{opt.label}</span>
                        <span className={cn('text-2xl font-extrabold tabular-nums leading-none', isSelected ? 'text-white' : '')}>
                          {opt.odds.toFixed(2)}x
                        </span>
                        {isSelected && (
                          <span className="text-xs text-white/75 font-medium">Sélectionné ✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Mise</label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Montant à miser"
                    min={1}
                    max={user?.money || 0}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Solde : {(user?.money || 0).toLocaleString('fr-FR')}</span>
                    {potentialPayout > 0 && (
                      <span className="font-bold" style={{ color: selectedOpt?.color }}>
                        Gain potentiel : {potentialPayout.toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setBetDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    className="flex-1 text-white font-bold"
                    onClick={handlePlaceBet}
                    disabled={betSubmitting || !betAmount || parseInt(betAmount) <= 0}
                    style={selectedOpt ? { background: selectedOpt.color, borderColor: selectedOpt.color } : undefined}
                  >
                    {betSubmitting
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</>
                      : `Parier · ${selectedOpt?.label || betPrediction}`}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Approve Suggestion Dialog ── */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approuver la suggestion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Options & cotes *</label>
              <div className="mt-2">
                <OptionsEditor
                  mode={approveMode}
                  onModeChange={setApproveMode}
                  binaryYes={approveBinaryYes}
                  onBinaryYesChange={setApproveBinaryYes}
                  binaryNo={approveBinaryNo}
                  onBinaryNoChange={setApproveBinaryNo}
                  customDrafts={approveCustomDrafts}
                  onCustomDraftsChange={setApproveCustomDrafts}
                  oddsLabel=" *"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Date de réalisation</label>
              <Input type="datetime-local" value={approveEventDate} onChange={(e) => setApproveEventDate(e.target.value)} />
              {!selectedSuggestion?.eventDate && (
                <p className="text-xs text-muted-foreground mt-1">Requis si la suggestion n'a pas de date.</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setApproveDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleApproveSuggestion} disabled={!selectedSuggestion?.eventDate && !approveEventDate}>
                Approuver
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Resolve Event Dialog ── */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Résoudre l'événement</DialogTitle>
          </DialogHeader>
          {selectedEventForResolve && (() => {
            const options = getEventOptions(selectedEventForResolve);
            return (
              <div className="space-y-4">
                <div className="font-semibold">{selectedEventForResolve.title}</div>
                <div>
                  <label className="text-sm font-medium">Résolution</label>
                  <div
                    className="grid gap-2 mt-2"
                    style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
                  >
                    {options.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={cn(
                          'rounded-md px-3 py-2 text-sm font-medium border-2 transition-all',
                          resolution === opt.key ? 'text-white border-transparent' : 'bg-background border-border',
                        )}
                        style={
                          resolution === opt.key
                            ? { background: opt.color }
                            : { color: opt.color, borderColor: opt.color + '60' }
                        }
                        onClick={() => setResolution(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setResolveDialogOpen(false)}>Annuler</Button>
                  <Button onClick={handleResolveEvent}>Résoudre</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Edit Event Dialog ── */}
      <Dialog
        open={editEventDialogOpen}
        onOpenChange={(open) => {
          setEditEventDialogOpen(open);
          if (!open) setSelectedEventForEdit(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier un événement</DialogTitle>
          </DialogHeader>
          {selectedEventForEdit && (
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Titre</label>
                <Input name="title" defaultValue={selectedEventForEdit.title} required maxLength={200} />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea name="description" defaultValue={selectedEventForEdit.description} required maxLength={2000} rows={4} />
              </div>
              <div>
                <label className="text-sm font-medium">Date de réalisation</label>
                <Input name="eventDate" type="datetime-local" defaultValue={formatDateTimeLocal(selectedEventForEdit.eventDate)} required />
              </div>
              <div>
                <label className="text-sm font-medium">Image (optionnel)</label>
                <ImagePicker value={editEventImageUrl} onChange={setEditEventImageUrl} uploadFn={uploadPolymarketImageFile} />
              </div>
              <div>
                <label className="text-sm font-medium">Options & cotes *</label>
                <div className="mt-2">
                  <OptionsEditor
                    mode={editMode}
                    onModeChange={setEditMode}
                    binaryYes={editBinaryYes}
                    onBinaryYesChange={setEditBinaryYes}
                    binaryNo={editBinaryNo}
                    onBinaryNoChange={setEditBinaryNo}
                    customDrafts={editCustomDrafts}
                    onCustomDraftsChange={setEditCustomDrafts}
                    oddsLabel=" *"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Statut</label>
                <select
                  name="status"
                  defaultValue={selectedEventForEdit.status}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="OPEN">Ouvert</option>
                  <option value="CLOSED">Fermé</option>
                  <option value="RESOLVED">Résolu</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditEventDialogOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={editSubmitting}>
                  {editSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : 'Enregistrer'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Event Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer l'événement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer{' '}
              <span className="font-semibold text-foreground">"{selectedEventForDelete?.title}"</span> ?
            </p>
            {(selectedEventForDelete?.betCount || 0) > 0 && (
              <p className="text-sm text-amber-500">
                ⚠ {selectedEventForDelete?.betCount} pari{(selectedEventForDelete?.betCount || 0) > 1 ? 's' : ''} seront remboursés.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleDeleteEvent} disabled={deleteSubmitting}>
                {deleteSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suppression...</> : 'Supprimer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail View Dialog ── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[92vh] overflow-y-auto p-0 gap-0">
          {selectedEventForDetail && (() => {
            const options = getEventOptions(selectedEventForDetail);
            const optStats: Record<string, number> = {};
            for (const opt of options) {
              optStats[opt.key] = detailBets.filter(b => b.prediction === opt.key).reduce((s, b) => s + b.amount, 0);
            }
            const totalVol = Object.values(optStats).reduce((s, v) => s + v, 0);
            const sortedBets = [...detailBets].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            // Running totals for graph + list
            const running: Record<string, number> = {};
            for (const opt of options) running[opt.key] = 0;
            const runningSnapshots: Array<{ bet: PolymarketBet; snapshot: Record<string, number>; total: number }> = [];
            for (const bet of sortedBets) {
              running[bet.prediction] = (running[bet.prediction] || 0) + bet.amount;
              const total = Object.values(running).reduce((s, v) => s + v, 0);
              runningSnapshots.push({ bet, snapshot: { ...running }, total });
            }

            // Graph data: cumulative money per option at each bet point
            const graphData = runningSnapshots.map(({ snapshot, bet }, idx) => {
              const point: Record<string, number | string> = {
                name: `#${idx + 1}`,
                time: new Date(bet.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
              };
              for (const opt of options) {
                point[opt.label] = snapshot[opt.key] || 0;
              }
              return point;
            });

            const isClosed = selectedEventForDetail.status !== 'OPEN';

            return (
              <div className="flex flex-col">
                {/* ── Header ── */}
                <div className="flex items-start gap-4 p-5 pb-4 border-b border-border/50">
                  {selectedEventForDetail.imageUrl ? (
                    <img
                      src={resolveImageUrl(selectedEventForDetail.imageUrl)}
                      alt={selectedEventForDetail.title}
                      className="w-14 h-14 rounded-lg object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted shrink-0 mt-0.5 flex items-center justify-center">
                      <Eye className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold leading-snug">{selectedEventForDetail.title}</h2>
                      <Badge
                        variant={isClosed ? 'secondary' : 'default'}
                        className="shrink-0 text-xs"
                      >
                        {selectedEventForDetail.status === 'OPEN' ? 'Ouvert' : selectedEventForDetail.status === 'RESOLVED' ? 'Résolu' : 'Fermé'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {selectedEventForDetail.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>Clôture le {new Date(selectedEventForDetail.eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* ── Option cards ── */}
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
                    {options.map((opt) => {
                      const vol = optStats[opt.key] || 0;
                      const pct = totalVol > 0 ? (vol / totalVol * 100) : (100 / options.length);
                      return (
                        <div
                          key={opt.key}
                          className="rounded-xl border p-4 space-y-1.5"
                          style={{ borderColor: opt.color + '35', background: opt.color + '0c' }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{opt.label}</span>
                            <span
                              className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: opt.color + '20', color: opt.color }}
                            >
                              {opt.odds.toFixed(2)}x
                            </span>
                          </div>
                          <div className="text-3xl font-bold tabular-nums" style={{ color: opt.color }}>
                            {pct.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {vol.toLocaleString('fr-FR')} misés
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Thin distribution bar ── */}
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted flex">
                    {options.map((opt) => {
                      const vol = optStats[opt.key] || 0;
                      return (
                        <div
                          key={opt.key}
                          className="h-full transition-all"
                          style={{
                            width: totalVol === 0 ? `${100 / options.length}%` : `${(vol / totalVol) * 100}%`,
                            background: totalVol === 0 ? opt.color + '66' : opt.color,
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* ── Stats row ── */}
                  <div className="grid grid-cols-3 gap-4 py-4 border-y border-border/40">
                    <div className="text-center space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Volume</div>
                      <div className="text-base font-bold tabular-nums">{totalVol.toLocaleString('fr-FR')}</div>
                    </div>
                    <div className="text-center space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Paris</div>
                      <div className="text-base font-bold tabular-nums">{detailBets.length}</div>
                    </div>
                    <div className="text-center space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Clôture</div>
                      <div className="text-sm font-bold">
                        {new Date(selectedEventForDetail.eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* ── Loading ── */}
                  {loadingDetailBets ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* ── Evolution chart ── */}
                      {graphData.length >= 2 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Évolution des mises</h4>
                            <div className="flex items-center gap-3">
                              {options.map((opt) => (
                                <div key={opt.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="w-3 h-0.5 rounded inline-block" style={{ background: opt.color }} />
                                  {opt.label}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={graphData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
                                <XAxis
                                  dataKey="name"
                                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                                  tickLine={false}
                                  axisLine={false}
                                  interval="preserveStartEnd"
                                />
                                <YAxis
                                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.4 }}
                                  tickLine={false}
                                  axisLine={false}
                                  width={36}
                                />
                                <Tooltip
                                  contentStyle={{
                                    background: 'hsl(var(--popover))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: 'hsl(var(--popover-foreground))',
                                    padding: '8px 12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                  }}
                                  labelStyle={{ opacity: 0.5, marginBottom: '4px' }}
                                  formatter={(value: number, name: string) => [
                                    value.toLocaleString('fr-FR'),
                                    name,
                                  ]}
                                  labelFormatter={(label, payload) => {
                                    const time = payload?.[0]?.payload?.time;
                                    return time ?? label;
                                  }}
                                />
                                {options.map((opt) => (
                                  <Line
                                    key={opt.key}
                                    type="monotone"
                                    dataKey={opt.label}
                                    stroke={opt.color}
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* ── Bet list ── */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">
                          Paris{sortedBets.length > 0 ? ` · ${sortedBets.length}` : ''}
                        </h4>
                        {sortedBets.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">Aucun pari pour le moment</p>
                        ) : (
                          <div className="rounded-lg border border-border/50 overflow-hidden">
                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_80px_60px_48px] gap-3 px-4 py-2 bg-muted/40 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/50">
                              <span>Joueur</span>
                              <span>Option</span>
                              <span className="text-right">Mise</span>
                              <span className="text-right">Heure</span>
                            </div>
                            {runningSnapshots.map(({ bet }, idx) => {
                              const betOpt = getOptionByKey(selectedEventForDetail, bet.prediction);
                              return (
                                <div
                                  key={bet.id}
                                  className={cn(
                                    'grid grid-cols-[1fr_80px_60px_48px] gap-3 px-4 py-2.5 items-center text-sm',
                                    idx % 2 === 1 && 'bg-muted/20',
                                  )}
                                >
                                  <span className="font-medium truncate" style={{ color: bet.user?.usernameColor || undefined }}>
                                    {bet.user?.username || '?'}
                                  </span>
                                  <span>
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold text-white"
                                      style={{ background: betOpt?.color || '#888' }}
                                    >
                                      {betOpt?.label || bet.prediction}
                                    </span>
                                  </span>
                                  <span className="text-right tabular-nums font-semibold">{bet.amount}</span>
                                  <span className="text-right text-xs text-muted-foreground tabular-nums">
                                    {new Date(bet.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Create Event Dialog ── */}
      <Dialog open={createEventDialogOpen} onOpenChange={setCreateEventDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un événement</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              let optionsPayload: PolymarketOption[] | null = null;
              if (createMode === 'custom') {
                optionsPayload = buildOptionsFromDrafts(createCustomDrafts);
              } else {
                optionsPayload = buildOptionsFromBinary(createBinaryYes, createBinaryNo);
              }

              if (!optionsPayload) {
                toast({ title: 'Erreur', description: 'Veuillez renseigner des cotes valides pour toutes les options.', variant: 'destructive' });
                return;
              }

              try {
                const yesOdds = optionsPayload.find(o => o.key === 'YES')?.odds ?? optionsPayload[0]?.odds;
                const noOdds = optionsPayload.find(o => o.key === 'NO')?.odds ?? optionsPayload[1]?.odds;
                await polymarketApi.createEvent({
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  imageUrl: createEventImageUrl.trim() || undefined,
                  eventDate: formData.get('eventDate') as string,
                  yesOdds,
                  noOdds,
                  ...(createMode === 'custom' ? { optionsConfig: optionsPayload } : {}),
                });
                toast({ title: 'Événement créé', description: 'L\'événement a été créé avec succès' });
                setCreateEventDialogOpen(false);
                setCreateEventImageUrl('');
                setCreateBinaryYes(''); setCreateBinaryNo('');
                setCreateMode('binary');
                setCreateCustomDrafts([makeDraftOption(0), makeDraftOption(1)]);
                fetchData();
              } catch (error: any) {
                toast({ title: 'Erreur', description: error.response?.data?.error || 'Impossible de créer l\'événement', variant: 'destructive' });
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input name="title" required maxLength={200} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea name="description" required maxLength={2000} rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium">Date de réalisation</label>
              <Input name="eventDate" type="datetime-local" required />
            </div>
            <div>
              <label className="text-sm font-medium">Image (optionnel)</label>
              <ImagePicker value={createEventImageUrl} onChange={setCreateEventImageUrl} uploadFn={uploadPolymarketImageFile} />
            </div>
            <div>
              <label className="text-sm font-medium">Options & cotes *</label>
              <div className="mt-2">
                <OptionsEditor
                  mode={createMode}
                  onModeChange={(m) => {
                    setCreateMode(m);
                    if (m === 'custom') setCreateCustomDrafts([makeDraftOption(0), makeDraftOption(1)]);
                  }}
                  binaryYes={createBinaryYes}
                  onBinaryYesChange={setCreateBinaryYes}
                  binaryNo={createBinaryNo}
                  onBinaryNoChange={setCreateBinaryNo}
                  customDrafts={createCustomDrafts}
                  onCustomDraftsChange={setCreateCustomDrafts}
                  oddsLabel=" *"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateEventDialogOpen(false)}>Annuler</Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
