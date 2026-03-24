import { useState, useEffect } from 'react';
import { customBadgesApi, CustomBadgeRequest } from '@/services/api';
import { BadgeIcon, BadgeData } from './BadgeIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const RARITY_OPTIONS = [
  { value: 'common', label: 'Commun' },
  { value: 'uncommon', label: 'Peu commun' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Épique' },
  { value: 'legendary', label: 'Légendaire' },
];

const BG_PRESETS = [
  '#374151', '#1e3a5f', '#4c1d95', '#7c2d12', '#14532d',
  '#1f2937', '#0f172a', '#3b0764', '#431407', '#052e16',
];

const BORDER_PRESETS = [
  '#6b7280', '#3b82f6', '#a855f7', '#f97316', '#22c55e',
  '#fbbf24', '#ef4444', '#06b6d4', '#ec4899', '#ffffff',
];

const RARITY_BORDER: Record<string, string> = {
  legendary: 'border-yellow-500/60 text-yellow-400',
  epic: 'border-purple-500/60 text-purple-400',
  rare: 'border-blue-500/60 text-blue-400',
  uncommon: 'border-green-500/60 text-green-400',
  common: 'border-border/40 text-muted-foreground',
};

function StatusBadge({ status, adminNote }: { status: string; adminNote?: string | null }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
        <Clock className="w-3 h-3" />
        En attente
      </span>
    );
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
        <CheckCircle2 className="w-3 h-3" />
        Approuvé
      </span>
    );
  }
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400">
        <XCircle className="w-3 h-3" />
        Refusé
      </span>
      {adminNote && (
        <p className="text-xs text-muted-foreground">Raison : {adminNote}</p>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomBadgeRequestDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [backgroundColor, setBackgroundColor] = useState('#374151');
  const [borderColor, setBorderColor] = useState('#6b7280');
  const [rarity, setRarity] = useState('common');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [requests, setRequests] = useState<CustomBadgeRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (open && tab === 'history') fetchHistory();
  }, [open, tab]);

  useEffect(() => {
    if (open && tab === 'new') {
      // Check if there's already a pending request
      fetchHistory();
    }
  }, [open]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await customBadgesApi.getMy();
      setRequests(res.data.requests);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const hasPending = requests.some((r) => r.status === 'pending');

  const previewBadge: BadgeData = {
    id: 'preview',
    name: name || 'Mon Badge',
    description: description || '',
    icon,
    backgroundColor,
    backgroundType: 'solid',
    borderColor,
    iconColor: '#ffffff',
    rarity,
    category: 'custom',
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim() || !description.trim()) {
      setError('Le nom et la description sont requis.');
      return;
    }
    setSubmitting(true);
    try {
      await customBadgesApi.submit({ name: name.trim(), description: description.trim(), icon, backgroundColor, borderColor, rarity });
      setSuccess(true);
      fetchHistory();
      setTab('history');
      // Reset form
      setName(''); setDescription(''); setIcon('⭐');
      setBackgroundColor('#374151'); setBorderColor('#6b7280'); setRarity('common');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Badge personnalisé</DialogTitle>
          <DialogDescription>
            Crée un badge unique pour ton profil. Un admin devra l'approuver avant que tu puisses l'équiper.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/40 -mt-1">
          {(['new', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-2 text-sm transition-colors border-b-2 -mb-px',
                tab === t
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'new' ? 'Nouvelle demande' : `Mes demandes${requests.length > 0 ? ` (${requests.length})` : ''}`}
            </button>
          ))}
        </div>

        {tab === 'new' && (
          <div className="space-y-4">
            {hasPending && (
              <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2">
                Tu as déjà une demande en attente. Attend qu'elle soit traitée avant d'en soumettre une nouvelle.
              </div>
            )}

            {success && (
              <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-md px-3 py-2">
                Demande envoyée ! Un admin la traitera bientôt.
              </div>
            )}

            {/* Preview */}
            <div className="flex items-center gap-4 p-3 rounded-lg border border-border/40 bg-muted/20">
              <BadgeIcon badge={previewBadge} size="xl" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{name || 'Nom du badge'}</p>
                <p className="text-xs text-muted-foreground truncate">{description || 'Description…'}</p>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border mt-1 inline-block', RARITY_BORDER[rarity])}>
                  {RARITY_OPTIONS.find((r) => r.value === rarity)?.label}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nom</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Gamer Pro"
                  maxLength={40}
                  disabled={hasPending}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décris ton badge…"
                  maxLength={120}
                  rows={2}
                  disabled={hasPending}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Emoji</label>
                  <Input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value.slice(-2) || '⭐')}
                    placeholder="⭐"
                    className="text-center text-lg"
                    disabled={hasPending}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Rareté</label>
                  <Select value={rarity} onValueChange={setRarity} disabled={hasPending}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RARITY_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Couleur de fond</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {BG_PRESETS.map((c) => (
                    <button
                      key={c}
                      disabled={hasPending}
                      onClick={() => setBackgroundColor(c)}
                      className={cn(
                        'w-6 h-6 rounded border-2 transition-transform',
                        backgroundColor === c ? 'border-primary scale-110' : 'border-transparent hover:scale-105',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={backgroundColor}
                    disabled={hasPending}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-border/40"
                    title="Couleur personnalisée"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Couleur de bordure</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {BORDER_PRESETS.map((c) => (
                    <button
                      key={c}
                      disabled={hasPending}
                      onClick={() => setBorderColor(c)}
                      className={cn(
                        'w-6 h-6 rounded border-2 transition-transform',
                        borderColor === c ? 'border-primary scale-110' : 'border-transparent hover:scale-105',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={borderColor}
                    disabled={hasPending}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-border/40"
                    title="Couleur personnalisée"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-2 min-h-[120px]">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune demande pour l'instant.</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/10">
                  <BadgeIcon
                    badge={{
                      id: r.id, name: r.name, description: r.description,
                      icon: r.icon, backgroundColor: r.backgroundColor, backgroundType: 'solid',
                      borderColor: r.borderColor, iconColor: '#ffffff',
                      rarity: r.rarity, category: 'custom',
                    }}
                    size="md"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                    <StatusBadge status={r.status} adminNote={r.adminNote} />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          {tab === 'new' && (
            <Button onClick={handleSubmit} disabled={submitting || hasPending} size="sm">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer la demande
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
