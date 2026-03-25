import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  polymarketApi, PolymarketEvent, PolymarketSuggestion, PolymarketBet,
  PolymarketOption, uploadUserImage,
} from '../services/api';
import { ImagePicker } from '@/components/ui/image-picker';
import {
  Loader2, Plus, Calendar,
  CheckCircle2, XCircle, DollarSign, Users,
  Check, X, ChevronDown, Shield,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

// ─── Option helpers ───────────────────────────────────────────────────────────

const DEFAULT_OPTION_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b'];

interface DraftOption {
  key: string;
  label: string;
  color: string;
  odds: string; // string for controlled input
}

/** Returns the options array for any event. Falls back to YES/NO for legacy events. */
function getEventOptions(event: Pick<PolymarketEvent, 'yesOdds' | 'noOdds' | 'optionsConfig' | 'options'>): PolymarketOption[] {
  if (event.options && event.options.length >= 2) return event.options;
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

function getOptionByKey(event: Pick<PolymarketEvent, 'yesOdds' | 'noOdds' | 'optionsConfig' | 'options'>, key: string): PolymarketOption | undefined {
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

  // Expanded event bets
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedEventBets, setExpandedEventBets] = useState<Record<string, PolymarketBet[]>>({});
  const [loadingEventBets, setLoadingEventBets] = useState<Record<string, boolean>>({});

  const toggleEventExpand = async (eventId: string) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      return;
    }
    setExpandedEventId(eventId);
    if (expandedEventBets[eventId] === undefined) {
      setLoadingEventBets((prev) => ({ ...prev, [eventId]: true }));
      try {
        const res = await polymarketApi.getEvent(eventId);
        setExpandedEventBets((prev) => ({ ...prev, [eventId]: res.data.event.bets || [] }));
      } catch {
        setExpandedEventBets((prev) => ({ ...prev, [eventId]: [] }));
      } finally {
        setLoadingEventBets((prev) => ({ ...prev, [eventId]: false }));
      }
    }
  };

  const uploadPolymarketImageFile = async (file: File): Promise<string> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = typeof reader.result === 'string' ? reader.result : '';
        const payload = raw.includes(',') ? raw.split(',')[1] : '';
        if (!payload) reject(new Error('Invalid file'));
        else resolve(payload);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await uploadUserImage({ base64Data, mimeType: file.type });
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
        payload.optionsConfig = optionsPayload;
        if (optionsPayload.length === 2 && optionsPayload[0].key === 'YES') {
          payload.suggestedYesOdds = optionsPayload[0].odds;
          payload.suggestedNoOdds = optionsPayload[1].odds;
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
      await polymarketApi.placeBet({ eventId: selectedEvent.id, prediction: betPrediction, amount: parseInt(betAmount) });
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
      await polymarketApi.approveSuggestion(selectedSuggestion.id, {
        optionsConfig: optionsPayload,
        eventDate: approveEventDate || undefined,
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
      await polymarketApi.resolveEvent(selectedEventForResolve.id, resolution);
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

    const options = getEventOptions(event);
    const isCustom = options.length !== 2 || options[0].key !== 'YES' || options[1].key !== 'NO';
    if (isCustom) {
      setEditMode('custom');
      setEditCustomDrafts(options.map((o, i) => makeDraftOption(i, o)));
    } else {
      setEditMode('binary');
      setEditBinaryYes(options[0].odds.toString());
      setEditBinaryNo(options[1].odds.toString());
    }
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

    setEditSubmitting(true);
    try {
      await polymarketApi.updateEvent(selectedEventForEdit.id, {
        title: titleValue,
        description: descriptionValue,
        eventDate: eventDateValue,
        imageUrl: editEventImageUrl.trim() || null,
        optionsConfig: optionsPayload,
        status: statusValue,
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
  const resolvedEvents = events.filter((e) => e.status === 'RESOLVED');
  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');

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
              <TabsTrigger value="events" className="gap-2">
                <Calendar className="h-4 w-4" />
                Événements
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Mes paris
              </TabsTrigger>
              {user?.isAdmin && (
                <TabsTrigger value="admin" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Paris admin
                </TabsTrigger>
              )}
            </TabsList>
            <div className="flex items-center gap-2">
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
              <div className="space-y-4">
                {openEvents.map((event) => {
                  const userBet = bets.find((b) => b.eventId === event.id);
                  const canBet = !userBet && event.status === 'OPEN' && new Date(event.eventDate) > new Date();
                  const options = getEventOptions(event);
                  const optionStats = event.optionStats || { YES: event.totalYes || 0, NO: event.totalNo || 0 };
                  const totalVolume = event.totalVolume || 0;

                  return (
                    <Card key={event.id} className="overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        <div className="md:w-56 md:shrink-0">
                          {event.imageUrl ? (
                            <img
                              src={resolveImageUrl(event.imageUrl)}
                              alt={event.title}
                              className="w-full h-48 md:h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-48 md:h-full bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
                              Sans image
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-6 flex flex-col gap-4">
                          {/* Top: title + admin buttons */}
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-start gap-3">
                                <CardTitle className="text-xl">{event.title}</CardTitle>
                                <Badge variant={event.status === 'OPEN' ? 'default' : 'secondary'} className="mt-1">
                                  {event.status === 'OPEN' ? 'Ouvert' : event.status}
                                </Badge>
                              </div>
                              <CardDescription className="line-clamp-2">{event.description}</CardDescription>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{new Date(event.eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                              </div>
                              {/* Per-option odds */}
                              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                {options.map((opt) => (
                                  <div key={opt.key} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: opt.color }} />
                                    <span>{opt.label}</span>
                                    <span className="font-semibold text-foreground">{opt.odds.toFixed(2)}x</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <button
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                  onClick={() => toggleEventExpand(event.id)}
                                >
                                  <Users className="h-4 w-4" />
                                  <span>{event.betCount || 0} paris</span>
                                  <ChevronDown className={cn('h-3 w-3 transition-transform', expandedEventId === event.id && 'rotate-180')} />
                                </button>
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-4 w-4" />
                                  <span>{totalVolume} total</span>
                                </div>
                              </div>
                            </div>
                            {/* Admin buttons only */}
                            {user?.isAdmin && event.status === 'OPEN' && (
                              <div className="flex flex-col items-end gap-2 md:min-w-[130px] shrink-0">
                                <Button variant="outline" className="w-full" onClick={() => openEditEventDialog(event)}>
                                  Modifier
                                </Button>
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => {
                                    setSelectedEventForResolve(event);
                                    setResolution(options[0]?.key || 'YES');
                                    setResolveDialogOpen(true);
                                  }}
                                >
                                  Résoudre
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Bottom: volume bar + bet buttons */}
                          <div className="mt-auto space-y-2">
                            {/* Volume labels */}
                            <div className="flex text-xs text-muted-foreground">
                              {options.map((opt, i) => (
                                <div key={opt.key} className={cn('flex-1', i > 0 && 'text-right')}>
                                  <span className="inline-flex items-center gap-1">
                                    {i === 0 && <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />}
                                    {opt.label} {optionStats[opt.key] || 0}
                                    {i > 0 && <span className="w-2 h-2 rounded-full ml-1" style={{ background: opt.color }} />}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Multi-color progress bar */}
                            <div className="h-2 w-full rounded-full overflow-hidden bg-muted flex">
                              {options.map((opt) => {
                                const vol = optionStats[opt.key] || 0;
                                return (
                                  <div
                                    key={opt.key}
                                    className="h-full transition-all"
                                    style={{
                                      width: totalVolume === 0 ? `${100 / options.length}%` : `${(vol / totalVolume) * 100}%`,
                                      background: opt.color + (totalVolume === 0 ? '66' : ''),
                                    }}
                                  />
                                );
                              })}
                            </div>

                            {/* Per-option bet buttons — one per option, below the bar */}
                            {canBet && (
                              <div
                                className="grid gap-2 mt-1"
                                style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
                              >
                                {options.map((opt) => (
                                  <button
                                    key={opt.key}
                                    className="rounded-md px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-85 active:scale-95"
                                    style={{ background: opt.color }}
                                    onClick={() => {
                                      setSelectedEvent(event);
                                      setBetPrediction(opt.key);
                                      setBetAmount('');
                                      setBetDialogOpen(true);
                                    }}
                                  >
                                    {opt.label} ({opt.odds.toFixed(2)}x)
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* User's existing bet */}
                            {userBet && (() => {
                              const betOpt = getOptionByKey(event, userBet.prediction);
                              return (
                                <div className="p-2 bg-muted rounded-md text-sm">
                                  <span className="font-medium">Votre pari: </span>
                                  <span style={{ color: betOpt?.color }}>{betOpt?.label || userBet.prediction}</span>
                                  <span className="text-muted-foreground"> — {userBet.amount} misé</span>
                                </div>
                              );
                            })()}

                            {/* Expanded bet list */}
                            {expandedEventId === event.id && (
                              <div className="pt-1 space-y-1 max-h-36 overflow-y-auto">
                                {loadingEventBets[event.id] ? (
                                  <div className="flex justify-center py-1">
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                  </div>
                                ) : (expandedEventBets[event.id] || []).length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Aucun pari</p>
                                ) : (
                                  (expandedEventBets[event.id] || []).map((bet) => {
                                    const betOpt = getOptionByKey(event, bet.prediction);
                                    return (
                                      <div key={bet.id} className="flex items-center justify-between text-xs py-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium" style={{ color: betOpt?.color || '#888' }}>
                                            {betOpt?.label || bet.prediction}
                                          </span>
                                          <span style={{ color: bet.user?.usernameColor || undefined }}>
                                            {bet.user?.username || '?'}
                                          </span>
                                        </div>
                                        <span className="tabular-nums text-muted-foreground">{bet.amount}</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
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
              <TabsContent value={betHistoryTab} className="mt-4">
                <div className="space-y-1 max-h-[600px] overflow-y-auto">
                  {(betHistoryTab === 'my' ? bets : allBets).length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-muted-foreground">
                        {betHistoryTab === 'my' ? 'Vous n\'avez pas encore de paris' : 'Aucun pari'}
                      </CardContent>
                    </Card>
                  ) : (
                    (betHistoryTab === 'my' ? bets : allBets).map((bet) => {
                      const isResolved = bet.event?.status === 'RESOLVED';
                      const isWinner = bet.event?.resolution === bet.prediction;

                      // Look up option from event's optionsConfig or legacy fields
                      const predOpt = bet.event
                        ? getOptionByKey(bet.event as any, bet.prediction)
                        : undefined;
                      const predLabel = predOpt?.label || bet.prediction;
                      const predColor = predOpt?.color || (bet.prediction === 'YES' ? '#22c55e' : bet.prediction === 'NO' ? '#ef4444' : '#888888');
                      const betOdds = predOpt?.odds || (bet.prediction === 'YES' ? (bet.event?.yesOdds || 1) : (bet.event?.noOdds || 1));
                      const potentialPayout = Math.floor(bet.amount * betOdds);

                      return (
                        <div
                          key={bet.id}
                          className="flex items-center justify-between py-3 border-b border-border/10"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className="w-8 h-8 flex items-center justify-center border rounded"
                              style={{ borderColor: predColor + '50', color: predColor }}
                            >
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
                                {betHistoryTab === 'all' && bet.user && (
                                  <span className="text-sm font-medium" style={{ color: bet.user.usernameColor || undefined }}>
                                    {bet.user.username}
                                  </span>
                                )}
                                <span className="text-xs" style={{ color: predColor }}>{predLabel}</span>
                                <span className="text-sm text-muted-foreground truncate">
                                  {bet.event?.title || 'Événement supprimé'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(bet.createdAt).toLocaleString('fr-FR')}
                              </p>
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
                            {bet.event && (
                              <p className="text-xs text-muted-foreground tabular-nums">@ {betOdds.toFixed(2)}x</p>
                            )}
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
              <h2 className={cn(TYPOGRAPHY.H2, 'flex items-center gap-2')}>
                <Shield className="h-5 w-5" />
                Administration
              </h2>

              <div className={SPACING.SECTION_SPACING}>
                {/* Events list */}
                <div>
                  <h3 className={TYPOGRAPHY.H4}>Événements</h3>
                  {events.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">Aucun événement disponible</CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
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

                {/* Pending suggestions */}
                <div>
                  <h3 className={TYPOGRAPHY.H4}>Suggestions en attente</h3>
                  {pendingSuggestions.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">Aucune suggestion en attente</CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      {pendingSuggestions.map((suggestion) => {
                        let suggestedOptions: PolymarketOption[] | null = null;
                        if (suggestion.optionsConfig) {
                          try { suggestedOptions = JSON.parse(suggestion.optionsConfig); } catch { /* ignore */ }
                        }
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
                              {suggestedOptions ? (
                                <div className="space-y-1">
                                  <div className="text-sm text-muted-foreground">Options suggérées:</div>
                                  <div className="h-5 w-full rounded overflow-hidden flex">
                                    {suggestedOptions.map((opt, i) => (
                                      <div key={i} className="h-full flex-1" style={{ background: opt.color }} />
                                    ))}
                                  </div>
                                  <div className="flex gap-3 flex-wrap">
                                    {suggestedOptions.map((opt) => (
                                      <span key={opt.key} className="flex items-center gap-1 text-sm">
                                        <span className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                                        {opt.label}
                                        {opt.odds > 1 && <span className="text-muted-foreground">{opt.odds.toFixed(2)}x</span>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
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
                                    // Pre-fill options from suggestion
                                    if (suggestedOptions && suggestedOptions.length >= 2) {
                                      const isCustom = suggestedOptions.length > 2 || suggestedOptions[0].key !== 'YES';
                                      if (isCustom) {
                                        setApproveMode('custom');
                                        setApproveCustomDrafts(suggestedOptions.map((o, i) => makeDraftOption(i, o)));
                                      } else {
                                        setApproveMode('binary');
                                        setApproveBinaryYes(suggestedOptions[0].odds > 1 ? suggestedOptions[0].odds.toString() : '');
                                        setApproveBinaryNo(suggestedOptions[1].odds > 1 ? suggestedOptions[1].odds.toString() : '');
                                      }
                                    } else {
                                      setApproveMode('binary');
                                      setApproveBinaryYes(suggestion.suggestedYesOdds?.toString() || '');
                                      setApproveBinaryNo(suggestion.suggestedNoOdds?.toString() || '');
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Placer un pari</DialogTitle>
          </DialogHeader>
          {selectedEvent && (() => {
            const options = getEventOptions(selectedEvent);
            const selectedOpt = options.find((o) => o.key === betPrediction) || options[0];
            const parsedAmount = parseInt(betAmount);
            const potentialPayout = parsedAmount > 0 ? Math.floor(parsedAmount * (selectedOpt?.odds || 1)) : 0;
            return (
              <div className="space-y-4">
                <div>
                  <div className="font-semibold">{selectedEvent.title}</div>
                  <div className="text-sm text-muted-foreground">{selectedEvent.description}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">Prédiction</label>
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
                          betPrediction === opt.key ? 'text-white border-transparent' : 'bg-background border-border',
                        )}
                        style={
                          betPrediction === opt.key
                            ? { background: opt.color }
                            : { color: opt.color, borderColor: opt.color + '60' }
                        }
                        onClick={() => setBetPrediction(opt.key)}
                      >
                        {opt.label} ({opt.odds.toFixed(2)}x)
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Montant</label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    placeholder="Montant à miser"
                    min={1}
                    max={user?.money || 0}
                    required
                  />
                  <div className="text-xs text-muted-foreground mt-1">Solde disponible: {user?.money || 0}</div>
                  {potentialPayout > 0 && (
                    <div className="text-sm mt-2 font-medium" style={{ color: selectedOpt?.color }}>
                      Gain potentiel: {potentialPayout} ({potentialPayout - parsedAmount} de profit)
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setBetDialogOpen(false)}>Annuler</Button>
                  <Button
                    onClick={handlePlaceBet}
                    disabled={betSubmitting || !betAmount || parseInt(betAmount) <= 0}
                    style={selectedOpt ? { background: selectedOpt.color } : undefined}
                    className="text-white"
                  >
                    {betSubmitting
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</>
                      : `Parier sur ${selectedOpt?.label || betPrediction}`}
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
                await polymarketApi.createEvent({
                  title: formData.get('title') as string,
                  description: formData.get('description') as string,
                  imageUrl: createEventImageUrl.trim() || undefined,
                  eventDate: formData.get('eventDate') as string,
                  optionsConfig: optionsPayload,
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
