import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, CalendarDays, ChevronLeft, ChevronRight,
  ExternalLink, GraduationCap, HandCoins, Landmark, LayoutGrid,
  List as ListIcon, MapPin, Search, Star, TrendingUp, Users, X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { type YouBusiness } from '@/services/api';
import {
  BankAccountModal, BuyoutOfferModal, FormationCatalogModal,
  InvestModal, LoanModal, ShareholderProposalModal,
} from './modals';
import { getBusinessPinColor, TYPE_EMOJI } from '../mapConstants';

const CONSTRUCTION_STRIPES = 'repeating-linear-gradient(135deg, #facc15 0 8px, #111827 8px 16px)';

function fmt(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

type SortMode = 'default' | 'treasury_desc' | 'date_desc' | 'date_asc' | 'rating_desc' | 'name_asc';
type ViewMode = 'grid' | 'list';

const SORT_OPTIONS: Array<{ key: SortMode; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'default',       label: 'Par type',  Icon: LayoutGrid   },
  { key: 'treasury_desc', label: 'Richesse',  Icon: TrendingUp   },
  { key: 'date_desc',     label: 'Récent',    Icon: CalendarDays },
  { key: 'date_asc',      label: 'Ancien',    Icon: CalendarDays },
  { key: 'rating_desc',   label: 'Note',      Icon: Star         },
];

function sortBusinesses(businesses: YouBusiness[], mode: SortMode): YouBusiness[] {
  const arr = [...businesses];
  if (mode === 'treasury_desc') return arr.sort((a, b) => b.treasuryMoney - a.treasuryMoney);
  if (mode === 'date_desc')     return arr.sort((a, b) => Date.parse(b.foundedAt) - Date.parse(a.foundedAt));
  if (mode === 'date_asc')      return arr.sort((a, b) => Date.parse(a.foundedAt) - Date.parse(b.foundedAt));
  if (mode === 'rating_desc')   return arr.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1));
  if (mode === 'name_asc')      return arr.sort((a, b) => a.name.localeCompare(b.name));
  return arr; // default: keep insertion order (grouped externally)
}

// ── Business grid card ────────────────────────────────────────────────────────

function GridCard({ business, onClick }: { business: YouBusiness; onClick: () => void }) {
  const pinColor = getBusinessPinColor(business.typeKey);
  const emoji = TYPE_EMOJI[business.typeKey] ?? '📍';
  const isPlaced = business.mapX != null && business.mapY != null;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-0 overflow-hidden rounded-xl border border-border/60 bg-card text-left shadow-sm transition-all hover:border-border hover:shadow-md active:scale-[0.99]"
    >
      {underConstruction && <div className="h-1.5 w-full shrink-0" style={{ background: CONSTRUCTION_STRIPES }} />}
      <div className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm transition-transform group-hover:scale-105"
            style={{ backgroundColor: pinColor + '22', border: `1.5px solid ${pinColor}50` }}
          >
            {emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground leading-tight">{business.name}</p>
            <p className="truncate text-[11px] text-muted-foreground mt-0.5">{business.type?.label ?? business.typeKey}</p>
            <p className="truncate text-[10px] text-muted-foreground/70">@{business.owner.username}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors mt-0.5" />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          {business.verified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
              ✓ Vérifié
            </span>
          )}
          {isPlaced ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Placé
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Non placé
            </span>
          )}
          {underConstruction && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
              🏗 {business.constructionProject?.progress.percent ?? 0}%
            </span>
          )}
          {business.avgRating != null && business.ratingCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-400 font-medium">★ {business.avgRating.toFixed(1)}</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Tréso.</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{fmt(business.treasuryMoney)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Membres</p>
            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-foreground">{business.memberCount}</p>
          </div>
          <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Sat.</p>
            <p className={cn('mt-0.5 text-[11px] font-bold tabular-nums', business.satisfaction >= 70 ? 'text-emerald-400' : business.satisfaction >= 40 ? 'text-amber-400' : 'text-red-400')}>
              {business.satisfaction}%
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Business list row ─────────────────────────────────────────────────────────

function ListRow({ business, onClick }: { business: YouBusiness; onClick: () => void }) {
  const pinColor = getBusinessPinColor(business.typeKey);
  const emoji = TYPE_EMOJI[business.typeKey] ?? '📍';
  const isPlaced = business.mapX != null && business.mapY != null;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);
  const net = business.monthlyRevenue - business.monthlyExpenses;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-3 text-left transition-all hover:border-border hover:bg-muted/10 active:scale-[0.99]"
    >
      {/* Emoji */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm"
        style={{ backgroundColor: pinColor + '22', border: `1.5px solid ${pinColor}50` }}
      >
        {emoji}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{business.name}</p>
          {business.verified && <span className="shrink-0 text-[10px] font-medium text-emerald-500">✓</span>}
          {underConstruction && <span className="shrink-0 text-[10px] text-amber-500">🏗</span>}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          @{business.owner.username}
          <span className="mx-1 text-muted-foreground/40">·</span>
          {business.type?.label ?? business.typeKey}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <div className="text-right">
          <p className="text-[11px] font-semibold tabular-nums text-foreground">{fmt(business.treasuryMoney)}</p>
          <p className={cn('text-[10px] tabular-nums', net >= 0 ? 'text-emerald-500' : 'text-red-400')}>
            {net >= 0 ? '+' : ''}{fmt(net)}/mois
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold tabular-nums">{business.memberCount}</p>
          <p className="text-[10px] text-muted-foreground">membres</p>
        </div>
        {business.avgRating != null && business.ratingCount > 0 && (
          <span className="text-[12px] font-semibold text-amber-400">★ {business.avgRating.toFixed(1)}</span>
        )}
      </div>

      {/* Placed badge */}
      <div className="shrink-0">
        {isPlaced ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Placé
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Non placé
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

// ── Type section header ───────────────────────────────────────────────────────

function TypeSectionHeader({ typeKey, label, emoji, count }: { typeKey: string; label: string; emoji: string; count: number }) {
  const color = getBusinessPinColor(typeKey);
  return (
    <div className="col-span-full flex items-center gap-2.5 pt-5 first:pt-0 pb-2">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm"
        style={{ backgroundColor: color + '25', border: `1px solid ${color}50` }}
      >
        {emoji}
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
      <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{count}</span>
      <div className="ml-1 flex-1 border-t border-border/30" />
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  business,
  userId,
  onBack,
  onAction,
  onSelectOnMap,
  onNavigate,
}: {
  business: YouBusiness;
  userId: string;
  onBack: () => void;
  onAction: (id: string, action: 'bank' | 'loan' | 'invest' | 'formation' | 'buyout' | 'shareholder') => void;
  onSelectOnMap?: (b: YouBusiness) => void;
  onNavigate: (id: string) => void;
}) {
  const pinColor = getBusinessPinColor(business.typeKey);
  const emoji = TYPE_EMOJI[business.typeKey] ?? '📍';
  const isPlaced = business.mapX != null && business.mapY != null;
  const isOwned = business.ownerId === userId;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);

  const primary = (() => {
    const b = business;
    if (b.typeKey === 'bank')     return { label: 'Gérer mes comptes',    sub: `Taux d'emprunt : ${b.loanInterestRate ?? 4}%`,       key: 'bank' as const,     exploreOnly: false, Icon: Landmark,      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' };
    if (b.typeKey === 'transfer') return { label: "Envoyer de l'argent",  sub: `Frais de service : ${b.transferFeeRate ?? 2}%`,       key: 'invest' as const,   exploreOnly: true,  Icon: ArrowLeftRight, tone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400' };
    if (b.typeKey === 'formation') return { label: 'Accéder aux formations', sub: `${b.formationProducts?.length ?? 0} formation(s) disponible(s)`, key: 'formation' as const, exploreOnly: false, Icon: GraduationCap, tone: 'border-amber-500/20 bg-amber-500/10 text-amber-400' };
    return { label: 'Investir', sub: 'Le rendement dépend du niveau de risque choisi.', key: 'invest' as const, exploreOnly: false, Icon: TrendingUp, tone: 'border-sky-500/20 bg-sky-500/10 text-sky-400' };
  })();

  const hasPurchaseOrApply = !isOwned && !['bank', 'transfer', 'formation', 'supreme_court', 'law_firm'].includes(business.typeKey);
  const net = business.monthlyRevenue - business.monthlyExpenses;

  return (
    <>
      <DialogTitle className="sr-only">{business.name}</DialogTitle>
      {underConstruction && <div className="h-2 shrink-0" style={{ background: CONSTRUCTION_STRIPES }} />}
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl shadow-sm"
          style={{ backgroundColor: pinColor + '22', border: `1.5px solid ${pinColor}50` }}
        >
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-foreground">{business.name}</p>
          <p className="truncate text-[12px] text-muted-foreground">{business.type?.label ?? business.typeKey} · @{business.owner.username}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {business.verified && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-500">✓ Vérifié</Badge>}
          {underConstruction && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">🏗 {business.constructionProject?.progress.percent ?? 0}%</span>}
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-6">
          {business.description && (
            <p className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-sm text-muted-foreground italic">
              "{business.description}"
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Trésorerie', value: fmt(business.treasuryMoney), color: 'text-foreground' },
              { label: 'Membres',    value: String(business.memberCount), color: 'text-foreground' },
              { label: 'Rev. mensuel', value: fmt(business.monthlyRevenue), color: 'text-emerald-500' },
              { label: 'Net /mois',  value: (net >= 0 ? '+' : '') + fmt(net), color: net >= 0 ? 'text-emerald-500' : 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn('mt-1 text-[13px] font-bold tabular-nums', color)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Rating + satisfaction */}
          <div className="grid grid-cols-2 gap-2">
            {business.avgRating != null && business.ratingCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <p className="text-[15px] font-bold text-amber-400">{business.avgRating.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">{business.ratingCount} avis</p>
                </div>
              </div>
            )}
            <div className={cn('flex items-center gap-3 rounded-xl border px-4 py-3',
              business.satisfaction >= 70 ? 'border-emerald-500/20 bg-emerald-500/8'
              : business.satisfaction >= 40 ? 'border-amber-500/20 bg-amber-500/8'
              : 'border-red-500/20 bg-red-500/8')}>
              <span className="text-2xl">{business.satisfaction >= 70 ? '😊' : business.satisfaction >= 40 ? '😐' : '😟'}</span>
              <div>
                <p className={cn('text-[15px] font-bold', business.satisfaction >= 70 ? 'text-emerald-400' : business.satisfaction >= 40 ? 'text-amber-400' : 'text-red-400')}>
                  {business.satisfaction}%
                </p>
                <p className="text-[10px] text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Services disponibles</p>

            <button
              type="button"
              disabled={!primary.exploreOnly && primary.key === 'formation' && (business.formationProducts?.length ?? 0) === 0}
              onClick={() => primary.exploreOnly ? onNavigate(business.id) : onAction(business.id, primary.key)}
              className={cn('flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-left transition-all disabled:opacity-40 hover:opacity-90 active:scale-[0.99]', primary.tone)}
            >
              <primary.Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{primary.label}</p>
                <p className="text-[11px] opacity-70">{primary.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
            </button>

            {business.typeKey === 'bank' && (
              <button type="button" onClick={() => onAction(business.id, 'loan')}
                className="flex w-full items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-4 text-left text-violet-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <HandCoins className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">Prendre un prêt</p>
                  <p className="text-[11px] opacity-70">Emprunt avec remboursement mensuel</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}

            {business.isShared && !isOwned && (
              <button type="button" onClick={() => onAction(business.id, 'shareholder')}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-left text-amber-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <TrendingUp className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">Proposition actionnaire</p>
                  <p className="text-[11px] opacity-70">Proposer un accord de partage de capital</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}

            {hasPurchaseOrApply && (
              <button type="button" onClick={() => onNavigate(business.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-4 text-left text-muted-foreground transition-all hover:bg-muted/40 active:scale-[0.99]">
                <Users className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">Postuler / Acheter</p>
                  <p className="text-[11px]">Rejoindre l'équipe ou acheter des produits</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}
          </div>

          {/* Footer nav */}
          <div className="flex gap-2 pt-1">
            {isPlaced && onSelectOnMap && (
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onSelectOnMap(business)}>
                <MapPin className="mr-1.5 h-3 w-3" />Voir sur la carte
              </Button>
            )}
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onNavigate(business.id)}>
              <ExternalLink className="mr-1.5 h-3 w-3" />Profil complet
            </Button>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BusinessBrowserModal({
  open,
  onClose,
  businesses,
  userId,
  onReload,
  onSelectOnMap,
}: {
  open: boolean;
  onClose: () => void;
  businesses: YouBusiness[];
  userId: string;
  onReload: () => Promise<void>;
  onSelectOnMap?: (business: YouBusiness) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [detailBusinessId, setDetailBusinessId] = useState<string | null>(null);
  const [bankBusinessId, setBankBusinessId] = useState<string | null>(null);
  const [loanBusinessId, setLoanBusinessId] = useState<string | null>(null);
  const [investBusinessId, setInvestBusinessId] = useState<string | null>(null);
  const [formationBusinessId, setFormationBusinessId] = useState<string | null>(null);
  const [buyoutBusinessId, setBuyoutBusinessId] = useState<string | null>(null);
  const [shareholderBusinessId, setShareholderBusinessId] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setSearch('');
    setTypeFilters([]);
    setDetailBusinessId(null);
  }

  function handleAction(businessId: string, action: 'bank' | 'loan' | 'invest' | 'formation' | 'buyout' | 'shareholder') {
    onClose();
    setDetailBusinessId(null);
    setTimeout(() => {
      if (action === 'bank')        setBankBusinessId(businessId);
      else if (action === 'loan')   setLoanBusinessId(businessId);
      else if (action === 'invest') setInvestBusinessId(businessId);
      else if (action === 'formation') setFormationBusinessId(businessId);
      else if (action === 'buyout') setBuyoutBusinessId(businessId);
      else if (action === 'shareholder') setShareholderBusinessId(businessId);
    }, 150);
  }

  function handleNavigate(businessId: string) {
    navigate(`/you?tab=explore&business=${businessId}`);
    handleClose();
  }

  const typeChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: Array<{ key: string; emoji: string; label: string }> = [];
    businesses.forEach((b) => {
      if (!seen.has(b.typeKey)) {
        seen.add(b.typeKey);
        chips.push({ key: b.typeKey, emoji: TYPE_EMOJI[b.typeKey] ?? '📍', label: b.type?.label ?? b.typeKey });
      }
    });
    return chips;
  }, [businesses]);

  const typeSet = useMemo(() => new Set(typeFilters), [typeFilters]);

  const filtered = useMemo(() => {
    let result = businesses;
    if (typeSet.size > 0) result = result.filter((b) => typeSet.has(b.typeKey));
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((b) =>
      [b.name, b.owner.username, b.type?.label ?? b.typeKey, b.location ?? ''].join(' ').toLowerCase().includes(q),
    );
    return result;
  }, [businesses, search, typeSet]);

  const sorted = useMemo(() => sortBusinesses(filtered, sortMode), [filtered, sortMode]);

  // Group by type for default sort mode
  const grouped = useMemo(() => {
    if (sortMode !== 'default') return null;
    const groups = new Map<string, { typeKey: string; emoji: string; label: string; businesses: YouBusiness[] }>();
    sorted.forEach((b) => {
      if (!groups.has(b.typeKey)) {
        groups.set(b.typeKey, {
          typeKey: b.typeKey,
          emoji: TYPE_EMOJI[b.typeKey] ?? '📍',
          label: b.type?.label ?? b.typeKey,
          businesses: [],
        });
      }
      groups.get(b.typeKey)!.businesses.push(b);
    });
    return Array.from(groups.values()).sort((a, b) => b.businesses.length - a.businesses.length);
  }, [sorted, sortMode]);

  const detailBusiness = detailBusinessId ? businesses.find((b) => b.id === detailBusinessId) ?? null : null;
  const bankBusiness = bankBusinessId ? businesses.find((b) => b.id === bankBusinessId) ?? null : null;
  const loanBusiness = loanBusinessId ? businesses.find((b) => b.id === loanBusinessId) ?? null : null;
  const investBusiness = investBusinessId ? businesses.find((b) => b.id === investBusinessId) ?? null : null;
  const formationBusiness = formationBusinessId ? businesses.find((b) => b.id === formationBusinessId) ?? null : null;
  const buyoutBusiness = buyoutBusinessId ? businesses.find((b) => b.id === buyoutBusinessId) ?? null : null;
  const shareholderBusiness = shareholderBusinessId ? businesses.find((b) => b.id === shareholderBusinessId) ?? null : null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="flex h-[90vh] max-h-[900px] w-full max-w-5xl flex-col gap-0 overflow-hidden p-0">
          {detailBusiness ? (
            <DetailPanel
              business={detailBusiness}
              userId={userId}
              onBack={() => setDetailBusinessId(null)}
              onAction={handleAction}
              onSelectOnMap={onSelectOnMap ? (b) => { onSelectOnMap(b); handleClose(); } : undefined}
              onNavigate={handleNavigate}
            />
          ) : (
            <>
              {/* ── Header ── */}
              <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                {/* Row 1: title + search */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <span className="text-lg">🏢</span>
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold">Entreprises</DialogTitle>
                    <p className="text-[12px] text-muted-foreground">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</p>
                  </div>
                  <label className="ml-auto flex items-center gap-2 rounded-xl border border-input bg-muted/30 px-3 py-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher par nom, propriétaire…"
                      className="h-5 w-52 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </label>
                </div>

                {/* Row 2: view toggle + sort */}
                <div className="mt-3 flex items-center gap-3">
                  {/* View toggle */}
                  <div className="flex items-center rounded-lg border border-border/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-all',
                        viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={cn('flex h-7 w-7 items-center justify-center rounded-md transition-all',
                        viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    >
                      <ListIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Sort pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 shrink-0">Trier:</span>
                    {SORT_OPTIONS.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSortMode(key)}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all',
                          sortMode === key
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground',
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{label}</span>
                        {key === 'date_asc' && <span className="ml-0.5 opacity-60">↑</span>}
                        {key === 'date_desc' && <span className="ml-0.5 opacity-60">↓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 3: type filter chips */}
                {typeChips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {typeChips.map((chip) => {
                      const active = typeSet.has(chip.key);
                      const color = getBusinessPinColor(chip.key);
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={() => setTypeFilters((prev) => active ? prev.filter((k) => k !== chip.key) : [...prev, chip.key])}
                          className={cn(
                            'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all',
                            active
                              ? 'text-white'
                              : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground',
                          )}
                          style={active ? { borderColor: color + '60', backgroundColor: color + '25', color } : {}}
                        >
                          <span>{chip.emoji}</span>
                          <span>{chip.label}</span>
                          {active && <X className="ml-0.5 h-2.5 w-2.5" />}
                        </button>
                      );
                    })}
                    {typeFilters.length > 0 && (
                      <button type="button" onClick={() => setTypeFilters([])}
                        className="rounded-full border border-border/40 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                        Tout effacer
                      </button>
                    )}
                  </div>
                )}
              </DialogHeader>

              {/* ── Content ── */}
              <ScrollArea className="min-h-0 flex-1">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <span className="mb-3 text-4xl">🔍</span>
                    <p className="text-sm text-muted-foreground">Aucune entreprise ne correspond à tes filtres.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="p-5">
                    {grouped ? (
                      grouped.map((group) => (
                        <div key={group.typeKey} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <TypeSectionHeader typeKey={group.typeKey} emoji={group.emoji} label={group.label} count={group.businesses.length} />
                          {group.businesses.map((b) => (
                            <GridCard key={b.id} business={b} onClick={() => setDetailBusinessId(b.id)} />
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {sorted.map((b) => (
                          <GridCard key={b.id} business={b} onClick={() => setDetailBusinessId(b.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 p-4">
                    {grouped ? (
                      grouped.map((group) => (
                        <div key={group.typeKey}>
                          <div className="flex items-center gap-2 pb-2 pt-4 first:pt-0">
                            <span className="text-base">{group.emoji}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: getBusinessPinColor(group.typeKey) }}>{group.label}</span>
                            <span className="text-[10px] text-muted-foreground">{group.businesses.length}</span>
                            <div className="ml-1 flex-1 border-t border-border/30" />
                          </div>
                          <div className="space-y-1.5">
                            {group.businesses.map((b) => (
                              <ListRow key={b.id} business={b} onClick={() => setDetailBusinessId(b.id)} />
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      sorted.map((b) => (
                        <ListRow key={b.id} business={b} onClick={() => setDetailBusinessId(b.id)} />
                      ))
                    )}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action modals */}
      <BankAccountModal open={Boolean(bankBusiness)} onClose={() => setBankBusinessId(null)} business={bankBusiness} onSubmitted={onReload} />
      <LoanModal open={Boolean(loanBusiness)} onClose={() => setLoanBusinessId(null)} business={loanBusiness} onSubmitted={onReload} />
      <InvestModal open={Boolean(investBusiness)} onClose={() => setInvestBusinessId(null)} business={investBusiness} onSubmitted={onReload} />
      <FormationCatalogModal open={Boolean(formationBusiness)} onClose={() => setFormationBusinessId(null)} business={formationBusiness} onSubmitted={onReload} />
      <BuyoutOfferModal open={Boolean(buyoutBusiness)} onClose={() => setBuyoutBusinessId(null)} business={buyoutBusiness} onSubmitted={onReload} />
      <ShareholderProposalModal open={Boolean(shareholderBusiness)} onClose={() => setShareholderBusinessId(null)} business={shareholderBusiness} onSubmitted={onReload} />
    </>
  );
}
