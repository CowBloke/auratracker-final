import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeftRight, Building2, CalendarDays, ChevronLeft, ChevronRight,
  GraduationCap, HandCoins, Landmark, LayoutGrid,
  List as ListIcon, MapPin, Search, ShoppingCart,
  Star, TrendingUp, UserCheck, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouPlayer, youApi } from '@/services/api';
import {
  BankAccountModal, BuyoutOfferModal, FormationCatalogModal,
  InvestModal, LoanModal, ShareholderProposalModal, TransferBusinessModal,
} from './modals';
import { FieldRow, ModalWrap } from './ui';
import { getBusinessPinColor, TYPE_LABELS_FR } from '../mapConstants';
import { BUSINESS_ICON_MAP } from '../constants';
import { withRouteError } from '../utils';

const CONSTRUCTION_STRIPES = 'repeating-linear-gradient(135deg, #facc15 0 8px, #111827 8px 16px)';

const PURCHASE_TYPES = ['lemonade', 'epicerie', 'restaurant', 'agency', 'illegal_market'];

const ITEMS_CONFIG: Record<string, Array<{ key: string; label: string; price: number; emoji?: string; xpHint?: string }>> = {
  lemonade: [
    { key: 'citronnade', label: 'Citronnade', price: 10, emoji: '🍋' },
    { key: 'limonade_fraise', label: 'Limonade fraise', price: 15, emoji: '🍓' },
    { key: 'eau_petillante', label: 'Eau petillante', price: 8, emoji: '💧' },
  ],
  epicerie: [
    { key: 'baguette', label: 'Baguette', price: 5, emoji: '🥖' },
    { key: 'fromage', label: 'Fromage', price: 20, emoji: '🧀' },
    { key: 'vin', label: 'Vin', price: 35, emoji: '🍷' },
    { key: 'confiture', label: 'Confiture', price: 12, emoji: '🫙' },
  ],
  restaurant: [
    { key: 'burger', label: 'Burger', price: 15, emoji: '🍔' },
    { key: 'pizza', label: 'Pizza', price: 18, emoji: '🍕' },
    { key: 'fried_chicken', label: 'Poulet Frit', price: 12, emoji: '🍗' },
    { key: 'soda', label: 'Soda', price: 5, emoji: '🥤' },
  ],
  agency: [
    { key: 'studio', label: 'Studio 20m²', price: 800, emoji: '🏠', xpHint: '+5 XP Social' },
    { key: 'appartement', label: 'Appartement T3', price: 3000, emoji: '🏢', xpHint: '+6 XP Social' },
    { key: 'maison', label: 'Maison avec jardin', price: 8000, emoji: '🏡', xpHint: '+16 XP Social' },
    { key: 'villa', label: 'Villa de luxe', price: 25000, emoji: '🏰', xpHint: '+50 XP Social' },
  ],
  illegal_market: [
    { key: 'puff', label: 'Puff', price: 45, emoji: '🚬', xpHint: '+XP Illegalite' },
    { key: 'weed_pack', label: 'Pack de weed', price: 110, emoji: '🌿', xpHint: '+XP Illegalite' },
    { key: 'resine', label: 'Resine', price: 160, emoji: '🧪', xpHint: '+XP Illegalite' },
    { key: 'pilules', label: 'Pilules', price: 220, emoji: '💊', xpHint: '+XP Illegalite' },
  ],
};

function fmt(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

function getBizIcon(typeKey: string) {
  return BUSINESS_ICON_MAP[typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
}

function getBizLabel(b: YouBusiness) {
  return b.type?.label ?? TYPE_LABELS_FR[b.typeKey] ?? b.typeKey;
}

type SortMode = 'default' | 'treasury_desc' | 'date_desc' | 'date_asc' | 'rating_desc' | 'name_asc';
type ViewMode = 'grid' | 'list';
type ActionType = 'bank' | 'loan' | 'invest' | 'formation' | 'buyout' | 'shareholder' | 'transfer' | 'apply' | 'purchase';

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
  return arr;
}

// ── Apply modal ───────────────────────────────────────────────────────────────

function ApplyBusinessModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [role, setRole] = useState('employee');
  const [salary, setSalary] = useState('0');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setRole('employee'); setSalary('0'); setMessage(''); }
  }, [open]);

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await withRouteError(() => youApi.applyToBusiness(business.id, { role, salary: Number(salary), message: message.trim() }), 'Impossible d envoyer cette candidature.');
      toast.success('Candidature envoyee');
      await onSubmitted();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business ? `Postuler · ${business.name}` : 'Postuler'} desc="Le proprietaire doit valider le contrat pour l activer.">
      <FieldRow label="Role vise"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="employee" /></FieldRow>
      <FieldRow label="Salaire demande / jour"><Input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} /></FieldRow>
      <FieldRow label="Message">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={240} placeholder="Explique ce que tu peux apporter a cette entreprise." />
      </FieldRow>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button>
        <Button size="sm" onClick={submit} disabled={submitting || !business || !role.trim()}>Envoyer</Button>
      </div>
    </ModalWrap>
  );
}

// ── Purchase items modal ──────────────────────────────────────────────────────

function PurchaseItemModal({ open, onClose, business, onSubmitted }: { open: boolean; onClose: () => void; business: YouBusiness | null; onSubmitted: () => Promise<void> }) {
  const [buying, setBuying] = useState<string | null>(null);
  if (!business) return null;

  const items = business.customData ?? ITEMS_CONFIG[business.typeKey] ?? [];
  const isAgency = business.typeKey === 'agency';

  const groupedItems = items.reduce((acc: Record<string, typeof items>, item) => {
    const section = (item as any).section ?? 'Général';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const buy = async (itemKey: string) => {
    setBuying(itemKey);
    try {
      await withRouteError(() => youApi.purchaseItem(business.id, itemKey), "Impossible d'acheter cet article.");
      const item = items.find((i) => i.key === itemKey);
      toast.success(`${item?.label ?? 'Article'} acheté !`);
      await onSubmitted();
    } finally {
      setBuying(null);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title={business.name} desc={isAgency ? 'Acheter un bien immobilier. Gagne du XP Social.' : 'Parcourir les articles disponibles.'}>
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <div key={section} className="space-y-2">
            {(section !== 'Général' || Object.keys(groupedItems).length > 1) && (
              <h3 className="px-1 text-sm font-semibold text-muted-foreground">{section}</h3>
            )}
            {sectionItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-yellow-400/15 text-lg">
                    {(item as any).imageUrl
                      ? <img src={(item as any).imageUrl} className="h-9 w-9 object-cover" alt={item.label} />
                      : (item.emoji ?? <ShoppingCart className="h-4 w-4 text-yellow-400" />)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.price.toLocaleString('fr-FR')} €</p>
                    {item.xpHint && <p className="text-[10px] text-purple-400/80">{item.xpHint}</p>}
                  </div>
                </div>
                <Button size="sm" onClick={() => void buy(item.key)} disabled={buying !== null}>Acheter</Button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ModalWrap>
  );
}

// ── Business grid card ────────────────────────────────────────────────────────

function GridCard({ business, onClick }: { business: YouBusiness; onClick: () => void }) {
  const pinColor = getBusinessPinColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-0 overflow-hidden rounded-lg border border-border/60 bg-card text-left shadow-sm transition-all hover:border-border hover:shadow-md active:scale-[0.99]"
      style={{ borderTopColor: pinColor + '60' }}
    >
      {underConstruction && <div className="h-1.5 w-full shrink-0" style={{ background: CONSTRUCTION_STRIPES }} />}
      <div className="flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-105"
            style={{ backgroundColor: pinColor + '20', border: `1.5px solid ${pinColor}40` }}
          >
            <BizIcon className="h-5 w-5" style={{ color: pinColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{business.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{getBizLabel(business)}</p>
            <p className="truncate text-[10px] text-muted-foreground/70">@{business.owner.username}</p>
          </div>
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/20 transition-colors group-hover:text-muted-foreground" />
        </div>

        {/* Color-coded pastilles */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
            style={{ backgroundColor: pinColor + '25', color: pinColor }}
          >
            {fmt(business.treasuryMoney)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Users className="h-2.5 w-2.5" />{business.memberCount}
          </span>
          {business.avgRating != null && business.ratingCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              <Star className="h-2.5 w-2.5 fill-amber-400/40" />{business.avgRating.toFixed(1)}
            </span>
          )}
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
            business.satisfaction >= 70 ? 'bg-emerald-500/15 text-emerald-400'
            : business.satisfaction >= 40 ? 'bg-amber-500/15 text-amber-400'
            : 'bg-red-500/15 text-red-400',
          )}>
            {business.satisfaction}%
          </span>
          {underConstruction && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
              🏗 {business.constructionProject?.progress.percent ?? 0}%
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Business list row ─────────────────────────────────────────────────────────

function ListRow({ business, onClick }: { business: YouBusiness; onClick: () => void }) {
  const pinColor = getBusinessPinColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);
  const net = business.monthlyRevenue - business.monthlyExpenses;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 border-b border-border/30 bg-card px-3 py-3 text-left transition-all hover:bg-muted/10 active:scale-[0.99]"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: pinColor + '20', border: `1.5px solid ${pinColor}40` }}
      >
        <BizIcon className="h-[18px] w-[18px]" style={{ color: pinColor }} />
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold text-foreground">{business.name}</p>
          {underConstruction && <span className="shrink-0 text-[10px] text-amber-500">🏗</span>}
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          @{business.owner.username}
          <span className="mx-1 text-muted-foreground/40">·</span>
          {getBizLabel(business)}
        </p>
      </div>

      {/* Pastilles */}
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{ backgroundColor: pinColor + '25', color: pinColor }}
        >
          {fmt(business.treasuryMoney)}
        </span>
        {net !== 0 && (
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
            net >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
          )}>
            {net >= 0 ? '+' : ''}{fmt(net)}/mois
          </span>
        )}
        {business.avgRating != null && business.ratingCount > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            <Star className="h-2.5 w-2.5 fill-amber-400/40" />{business.avgRating.toFixed(1)}
          </span>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
    </button>
  );
}

// ── Type section header ───────────────────────────────────────────────────────

function TypeSectionHeader({ typeKey, label, count }: { typeKey: string; label: string; count: number }) {
  const color = getBusinessPinColor(typeKey);
  const BizIcon = getBizIcon(typeKey);
  return (
    <div className="col-span-full flex items-center gap-2.5 pb-2 pt-5 first:pt-0">
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: color + '25', border: `1px solid ${color}50` }}
      >
        <BizIcon className="h-3.5 w-3.5" style={{ color }} />
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
}: {
  business: YouBusiness;
  userId: string;
  onBack: () => void;
  onAction: (id: string, action: ActionType) => void;
  onSelectOnMap?: (b: YouBusiness) => void;
}) {
  const pinColor = getBusinessPinColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);
  const isPlaced = business.mapX != null && business.mapY != null;
  const isOwned = business.ownerId === userId;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);
  const net = business.monthlyRevenue - business.monthlyExpenses;

  const isEmployee = business.members.some((m) => m.user.id === userId);
  const hasPendingApplication = business.pendingInvitations.some((inv) => inv.employee.id === userId);
  const canApply = !isOwned && !isEmployee && !hasPendingApplication && business.hiring;
  const canPurchase = !isOwned && PURCHASE_TYPES.includes(business.typeKey);

  const primaryAction = (() => {
    const b = business;
    if (b.typeKey === 'bank')      return { label: 'Gérer mes comptes',       sub: `Taux d'emprunt : ${b.loanInterestRate ?? 4}%`,                              key: 'bank' as const,     Icon: Landmark,      tone: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' };
    if (b.typeKey === 'transfer')  return { label: "Envoyer de l'argent",     sub: `Frais de service : ${b.transferFeeRate ?? 2}%`,                             key: 'transfer' as const, Icon: ArrowLeftRight, tone: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400' };
    if (b.typeKey === 'formation') return { label: 'Accéder aux formations',  sub: `${b.formationProducts?.length ?? 0} formation(s) disponible(s)`,           key: 'formation' as const, Icon: GraduationCap, tone: 'border-amber-500/20 bg-amber-500/10 text-amber-400' };
    return { label: 'Investir', sub: 'Le rendement dépend du niveau de risque choisi.', key: 'invest' as const, Icon: TrendingUp, tone: 'border-sky-500/20 bg-sky-500/10 text-sky-400' };
  })();

  const stats = [
    { label: 'Trésorerie',   value: fmt(business.treasuryMoney),              bg: pinColor + '18', border: pinColor + '35', textStyle: { color: pinColor } },
    { label: 'Rev. mensuel', value: fmt(business.monthlyRevenue),              bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.25)', textStyle: { color: '#4ade80' } },
    { label: 'Net /mois',    value: (net >= 0 ? '+' : '') + fmt(net),         bg: net >= 0 ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', border: net >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)', textStyle: { color: net >= 0 ? '#4ade80' : '#f87171' } },
    { label: 'Membres',      value: String(business.memberCount),             bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.25)', textStyle: { color: '#a78bfa' } },
  ];

  return (
    <>
      <DialogTitle className="sr-only">{business.name}</DialogTitle>
      {underConstruction && <div className="h-2 shrink-0" style={{ background: CONSTRUCTION_STRIPES }} />}

      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="truncate text-[12px] text-muted-foreground">{getBizLabel(business)}</p>
        {business.verified && (
          <span className="ml-auto shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">✓ Vérifié</span>
        )}
      </div>

      {/* Hero section */}
      <div className="shrink-0 flex flex-col items-center gap-3 px-6 py-6" style={{ background: `linear-gradient(to bottom, ${pinColor}08, transparent)` }}>
        <div
          className="flex h-16 w-16 items-center justify-center rounded-xl shadow-md"
          style={{ backgroundColor: pinColor + '22', border: `2px solid ${pinColor}50` }}
        >
          <BizIcon className="h-8 w-8" style={{ color: pinColor }} />
        </div>
        <div className="text-center">
          <p className="text-[18px] font-bold leading-tight text-foreground">{business.name}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">@{business.owner.username}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {underConstruction && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-500">
              🏗 {business.constructionProject?.progress.percent ?? 0}%
            </span>
          )}
          {business.avgRating != null && business.ratingCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
              <Star className="h-3 w-3 fill-amber-400/40" />{business.avgRating.toFixed(1)}
              <span className="font-normal text-amber-400/60 ml-0.5">({business.ratingCount})</span>
            </span>
          )}
          <span className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold',
            business.satisfaction >= 70 ? 'bg-emerald-500/15 text-emerald-400'
            : business.satisfaction >= 40 ? 'bg-amber-500/15 text-amber-400'
            : 'bg-red-500/15 text-red-400',
          )}>
            <Activity className="mr-1 h-2.5 w-2.5" />{business.satisfaction}%
          </span>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-5 pb-6">
          {business.description && (
            <p className="border-l-2 pl-3 text-sm italic text-muted-foreground" style={{ borderColor: pinColor + '60' }}>
              "{business.description}"
            </p>
          )}

          {/* Stats as color-coded pastilles */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map(({ label, value, bg, border, textStyle }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-xl px-3 py-3"
                style={{ backgroundColor: bg, border: `1px solid ${border}` }}
              >
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-[13px] font-bold tabular-nums" style={textStyle}>{value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Services disponibles</p>

            {/* Primary action */}
            <button
              type="button"
              disabled={primaryAction.key === 'formation' && (business.formationProducts?.length ?? 0) === 0}
              onClick={() => onAction(business.id, primaryAction.key)}
              className={cn('flex w-full items-center gap-3 rounded-lg border px-4 py-4 text-left transition-all disabled:opacity-40 hover:opacity-90 active:scale-[0.99]', primaryAction.tone)}
            >
              <primaryAction.Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{primaryAction.label}</p>
                <p className="text-[11px] opacity-70">{primaryAction.sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
            </button>

            {/* Purchase action for shop-type businesses */}
            {canPurchase && (
              <button type="button" onClick={() => onAction(business.id, 'purchase')}
                className="flex w-full items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-4 text-left text-yellow-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">Acheter</p>
                  <p className="text-[11px] opacity-70">Parcourir les articles disponibles</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}

            {/* Bank loan */}
            {business.typeKey === 'bank' && (
              <button type="button" onClick={() => onAction(business.id, 'loan')}
                className="flex w-full items-center gap-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-4 text-left text-violet-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <HandCoins className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">Prendre un prêt</p>
                  <p className="text-[11px] opacity-70">Emprunt avec remboursement mensuel</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}

            {/* Shareholder */}
            {business.isShared && !isOwned && (
              <button type="button" onClick={() => onAction(business.id, 'shareholder')}
                className="flex w-full items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-left text-amber-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <TrendingUp className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{business.viewerSharePercent > 0 ? 'Augmenter ma participation' : 'Devenir actionnaire'}</p>
                  <p className="text-[11px] opacity-70">Proposer un pourcentage et une somme au propriétaire</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}

            {/* Apply */}
            {canApply && (
              <button type="button" onClick={() => onAction(business.id, 'apply')}
                className="flex w-full items-center gap-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-4 py-4 text-left text-violet-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <UserCheck className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">Postuler</p>
                  <p className="text-[11px] opacity-70">Envoyer une proposition de rôle et de salaire</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}
            {!isOwned && hasPendingApplication && (
              <div className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-4 py-3 text-xs text-muted-foreground">
                Une candidature est déjà en attente pour toi dans ce business.
              </div>
            )}

            {/* Buyout */}
            {!isOwned && !business.isStateOwned && !['supreme_court', 'law_firm'].includes(business.typeKey) && (
              <button type="button" onClick={() => onAction(business.id, 'buyout')}
                className="flex w-full items-center gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-left text-rose-400 transition-all hover:opacity-90 active:scale-[0.99]">
                <HandCoins className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">Faire une offre de rachat</p>
                  <p className="text-[11px] opacity-70">Le montant est bloqué jusqu'à la décision du propriétaire</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
              </button>
            )}
          </div>

          {/* Map link */}
          {isPlaced && onSelectOnMap && (
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onSelectOnMap(business)}>
              <MapPin className="mr-1.5 h-3 w-3" />Voir sur la carte
            </Button>
          )}
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
  players = [],
  onReload,
  onSelectOnMap,
}: {
  open: boolean;
  onClose: () => void;
  businesses: YouBusiness[];
  userId: string;
  players?: YouPlayer[];
  onReload: () => Promise<void>;
  onSelectOnMap?: (business: YouBusiness) => void;
}) {
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
  const [transferBusinessId, setTransferBusinessId] = useState<string | null>(null);
  const [applyBusinessId, setApplyBusinessId] = useState<string | null>(null);
  const [purchaseBusinessId, setPurchaseBusinessId] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setSearch('');
    setTypeFilters([]);
    setDetailBusinessId(null);
  }

  function handleAction(businessId: string, action: ActionType) {
    onClose();
    setDetailBusinessId(null);
    setTimeout(() => {
      if (action === 'bank')         setBankBusinessId(businessId);
      else if (action === 'loan')    setLoanBusinessId(businessId);
      else if (action === 'invest')  setInvestBusinessId(businessId);
      else if (action === 'formation') setFormationBusinessId(businessId);
      else if (action === 'buyout')  setBuyoutBusinessId(businessId);
      else if (action === 'shareholder') setShareholderBusinessId(businessId);
      else if (action === 'transfer') setTransferBusinessId(businessId);
      else if (action === 'apply')   setApplyBusinessId(businessId);
      else if (action === 'purchase') setPurchaseBusinessId(businessId);
    }, 150);
  }

  const typeChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: Array<{ key: string; label: string }> = [];
    businesses.forEach((b) => {
      if (!seen.has(b.typeKey)) {
        seen.add(b.typeKey);
        chips.push({ key: b.typeKey, label: b.type?.label ?? TYPE_LABELS_FR[b.typeKey] ?? b.typeKey });
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

  const grouped = useMemo(() => {
    if (sortMode !== 'default') return null;
    const groups = new Map<string, { typeKey: string; label: string; businesses: YouBusiness[] }>();
    sorted.forEach((b) => {
      if (!groups.has(b.typeKey)) {
        groups.set(b.typeKey, {
          typeKey: b.typeKey,
          label: b.type?.label ?? TYPE_LABELS_FR[b.typeKey] ?? b.typeKey,
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
  const transferBusiness = transferBusinessId ? businesses.find((b) => b.id === transferBusinessId) ?? null : null;
  const applyBusiness = applyBusinessId ? businesses.find((b) => b.id === applyBusinessId) ?? null : null;
  const purchaseBusiness = purchaseBusinessId ? businesses.find((b) => b.id === purchaseBusinessId) ?? null : null;

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
            />
          ) : (
            <>
              {/* ── Header ── */}
              <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
                {/* Row 1: title + search */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold">Entreprises</DialogTitle>
                    <p className="text-[12px] text-muted-foreground">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</p>
                  </div>
                  <label className="ml-auto flex items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2">
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
                <div className="mt-2 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex shrink-0 items-center rounded-md border border-border/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={cn('flex h-6 w-6 items-center justify-center rounded transition-all',
                        viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    >
                      <LayoutGrid className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={cn('flex h-6 w-6 items-center justify-center rounded transition-all',
                        viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    >
                      <ListIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="h-4 w-px shrink-0 bg-border/40" />
                  {SORT_OPTIONS.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSortMode(key)}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all',
                        sortMode === key
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{label}{key === 'date_asc' ? ' ↑' : key === 'date_desc' ? ' ↓' : ''}</span>
                    </button>
                  ))}
                </div>

                {/* Row 3: type filter chips */}
                {typeChips.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {typeChips.map((chip) => {
                      const active = typeSet.has(chip.key);
                      const color = getBusinessPinColor(chip.key);
                      const ChipIcon = getBizIcon(chip.key);
                      return (
                        <button
                          key={chip.key}
                          type="button"
                          title={chip.label}
                          onClick={() => setTypeFilters((prev) => active ? prev.filter((k) => k !== chip.key) : [...prev, chip.key])}
                          className={cn(
                            'flex shrink-0 items-center gap-1 rounded-full border transition-all',
                            active
                              ? 'px-2 py-0.5 text-[11px] font-medium'
                              : 'h-6 w-6 justify-center',
                            !active && 'border-border/40 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground',
                          )}
                          style={active ? { borderColor: color + '60', backgroundColor: color + '25', color } : {}}
                        >
                          <ChipIcon className="h-3 w-3 shrink-0" style={active ? { color } : {}} />
                          {active && <><span className="whitespace-nowrap">{chip.label}</span><X className="ml-0.5 h-2.5 w-2.5 shrink-0" /></>}
                        </button>
                      );
                    })}
                    {typeFilters.length > 0 && (
                      <button type="button" onClick={() => setTypeFilters([])}
                        className="shrink-0 rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">
                        ×
                      </button>
                    )}
                  </div>
                )}
              </DialogHeader>

              {/* ── Content ── */}
              <ScrollArea className="min-h-0 flex-1">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Aucune entreprise ne correspond à tes filtres.</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="p-5">
                    {grouped ? (
                      grouped.map((group) => (
                        <div key={group.typeKey} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <TypeSectionHeader typeKey={group.typeKey} label={group.label} count={group.businesses.length} />
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
                  <div className="p-4">
                    {grouped ? (
                      grouped.map((group) => (
                        <div key={group.typeKey}>
                          <div className="flex items-center gap-2 pb-2 pt-4 first:pt-0">
                            {(() => { const G = getBizIcon(group.typeKey); return <G className="h-3.5 w-3.5 shrink-0" style={{ color: getBusinessPinColor(group.typeKey) }} />; })()}
                            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: getBusinessPinColor(group.typeKey) }}>{group.label}</span>
                            <span className="text-[10px] text-muted-foreground">{group.businesses.length}</span>
                            <div className="ml-1 flex-1 border-t border-border/30" />
                          </div>
                          <div>
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
      <TransferBusinessModal open={Boolean(transferBusiness)} onClose={() => setTransferBusinessId(null)} business={transferBusiness} players={players} currentUserId={userId} onSubmitted={onReload} />
      <ApplyBusinessModal open={Boolean(applyBusiness)} onClose={() => setApplyBusinessId(null)} business={applyBusiness} onSubmitted={onReload} />
      <PurchaseItemModal open={Boolean(purchaseBusiness)} onClose={() => setPurchaseBusinessId(null)} business={purchaseBusiness} onSubmitted={onReload} />
    </>
  );
}
