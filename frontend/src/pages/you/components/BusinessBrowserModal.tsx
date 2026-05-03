import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Building2, CalendarDays, ChevronLeft, ChevronRight,
  GraduationCap, HandCoins, Landmark, LayoutGrid,
  List as ListIcon, MapPin, MessageSquare, Search, ShoppingCart,
  Sparkles, Star, TrendingUp, UserCheck, Users, X, Scale, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouPlayer, youApi, justiceApi } from '@/services/api';
import {
  BankAccountModal, BuyoutOfferModal, FormationCatalogModal,
  InvestModal, LoanModal, ShareholderProposalModal, TeamRosterModal, TransferBusinessModal,
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

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M €`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K €`;
  return `${Math.round(n)} €`;
}

function getBizIcon(typeKey: string) {
  return BUSINESS_ICON_MAP[typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
}

function getBizLabel(b: YouBusiness) {
  return b.type?.label ?? TYPE_LABELS_FR[b.typeKey] ?? b.typeKey;
}

function displayedMemberCount(b: YouBusiness) {
  // memberCount may exclude the owner on the server side. Ensure the owner is counted.
  const base = typeof b.memberCount === 'number' ? b.memberCount : (b.members?.length ?? 0);
  const ownerIncluded = b.members?.some((m) => m.user.id === b.ownerId);
  const count = ownerIncluded ? base : base + 1;
  return Math.max(1, count);
}

type SortMode = 'default' | 'treasury_desc' | 'date_desc' | 'date_asc' | 'rating_desc' | 'name_asc';
type ViewMode = 'grid' | 'list';
type ActionType = 'bank' | 'loan' | 'invest' | 'formation' | 'buyout' | 'shareholder' | 'transfer' | 'apply' | 'purchase' | 'plainte';

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
            {business.isStateOwned && (
              <span className="mt-1 inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">État</span>
            )}
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
            <Users className="h-2.5 w-2.5" />{displayedMemberCount(business)}
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
          {business.isStateOwned ? <span className="ml-1 rounded-full bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">État</span> : null}
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

// ── Finance stats modal ───────────────────────────────────────────────────────

function FinanceModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness }) {
  const net = business.monthlyRevenue - business.monthlyExpenses;
  return (
    <ModalWrap open={open} onClose={onClose} title="Finances" desc={business.name}>
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-500">Trésorerie</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums leading-tight text-emerald-400">{fmt(business.treasuryMoney)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-3">
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">Rev. mensuel</p>
            <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-400">{fmt(business.monthlyRevenue)}</p>
          </div>
          <div className={cn('rounded-xl border px-3 py-3', net >= 0 ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-red-500/8 border-red-500/20')}>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground/70">Net / mois</p>
            <p className={cn('mt-1 text-[13px] font-bold tabular-nums', net >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {net >= 0 ? '+' : ''}{fmt(net)}
            </p>
          </div>
        </div>
      </div>
    </ModalWrap>
  );
}

// ── Reviews modal ─────────────────────────────────────────────────────────────

function ReviewsModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness }) {
  return (
    <ModalWrap open={open} onClose={onClose} title="Avis clients" desc={business.name}>
      {business.avgRating != null && business.ratingCount > 0 ? (
        <div className="flex items-center gap-4 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-4">
          <span className="text-[40px] font-bold text-amber-400 tabular-nums leading-none">{business.avgRating.toFixed(1)}</span>
          <div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={cn('h-4 w-4',
                  i <= Math.floor(business.avgRating!) ? 'fill-amber-400 text-amber-400'
                  : i === Math.ceil(business.avgRating!) && business.avgRating! % 1 >= 0.3 ? 'fill-amber-400/40 text-amber-400'
                  : 'text-amber-400/20',
                )} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{business.ratingCount} avis · sur 5</p>
          </div>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucun avis pour le moment.</p>
      )}
    </ModalWrap>
  );
}

// ── Investments modal ─────────────────────────────────────────────────────────

function InvestmentsModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness }) {
  return (
    <ModalWrap open={open} onClose={onClose} title="Investissements reçus" desc={business.name}>
      {business.recentInvestments.length > 0 ? (
        <div className="space-y-1.5">
          {business.recentInvestments.map((inv) => {
            const riskColor = inv.riskLevel === 'low' ? 'text-emerald-400' : inv.riskLevel === 'high' ? 'text-rose-400' : 'text-amber-400';
            return (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-sky-400/15 bg-muted/10 px-3 py-2 text-xs">
                <span className="font-medium">{inv.investor.username}</span>
                <span className={cn('font-semibold', riskColor)}>{fmt(inv.amount)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucun investissement récent.</p>
      )}
    </ModalWrap>
  );
}

// ── Shareholders modal ────────────────────────────────────────────────────────

function ShareholdersModal({ open, onClose, business, userId }: {
  open: boolean; onClose: () => void; business: YouBusiness | null; userId: string;
}) {
  if (!business) return null;
  return (
    <ModalWrap
      open={open}
      onClose={onClose}
      title={`Capital · ${business.name}`}
      desc={`${business.shareholders.length + 1} actionnaire(s)${business.viewerSharePercent > 0 ? ` · ta part : ${business.viewerSharePercent.toFixed(2)}%` : ''}`}
    >
      <div className="space-y-1.5">
        <div className="rounded-lg border border-amber-400/15 bg-muted/10 px-3 py-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{business.owner.username}{business.ownerId === userId ? ' · toi' : ''}</span>
            <span className="font-bold text-amber-300">{business.ownerSharePercent.toFixed(2)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
            <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${Math.max(0, Math.min(100, business.ownerSharePercent))}%` }} />
          </div>
        </div>
        {business.shareholders.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Aucun actionnaire externe.</p>
        ) : business.shareholders.map((s) => (
          <div key={s.id} className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.user.username}{s.user.id === userId ? ' · toi' : ''}</span>
              <span className="font-bold">{s.sharePercent.toFixed(2)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full bg-amber-300/70" style={{ width: `${Math.max(0, Math.min(100, s.sharePercent))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </ModalWrap>
  );
}

// --- File Plainte Modal (copied/adapted from ExploreTab) ---

function FilePlainteModal({
  business,
  userId,
  players,
  open,
  onClose,
  onSubmitted,
}: {
  business: YouBusiness | null;
  userId: string;
  players: YouPlayer[];
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [defendantId, setDefendantId] = useState('');
  const [defendantSearch, setDefendantSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredPlayers = useMemo(
    () => players.filter((p) => p.id !== userId && p.username.toLowerCase().includes(defendantSearch.toLowerCase())).slice(0, 10),
    [players, userId, defendantSearch],
  );

  const selectedPlayer = players.find((p) => p.id === defendantId);

  const submit = async () => {
    if (!business) return;
    setSubmitting(true);
    try {
      await justiceApi.filePlainte({
        courtId: business.id,
        title: title.trim(),
        description: description.trim(),
        evidence: evidence.trim() || undefined,
        defendantId: defendantId || undefined,
      });
      toast.success('Plainte déposée. Les juges vont l\'examiner.');
      setTitle(''); setDescription(''); setEvidence(''); setDefendantId(''); setDefendantSearch('');
      onSubmitted();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Impossible de déposer la plainte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalWrap open={open} onClose={onClose} title="Déposer une plainte" desc={business ? `Cour suprême · ${business.name}` : 'Cour suprême'}>
      {business ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
              <span>Déposer une plainte contre un joueur ou un business.</span>
            </div>
          </div>

          <FieldRow label="Titre de la plainte *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Ex: Arnaque lors d'un échange de monnaie"
            />
            <p className="mt-1 text-[10px] text-muted-foreground/50">{title.length}/100</p>
          </FieldRow>

          <FieldRow label="Description des faits *">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Décrivez les faits en détail : que s'est-il passé, quand, et pourquoi c'est une violation des règles..."
            />
            <p className="mt-1 text-[10px] text-muted-foreground/50">{description.length}/2000</p>
          </FieldRow>

          <FieldRow label="Coupable (optionnel)">
            {selectedPlayer ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
                <span className="flex-1 text-sm font-medium">{selectedPlayer.username}</span>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setDefendantId(''); setDefendantSearch(''); }}>✕</button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={defendantSearch}
                  onChange={(e) => setDefendantSearch(e.target.value)}
                  placeholder="Rechercher un joueur..."
                />
                {defendantSearch.length > 0 && filteredPlayers.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border/40 bg-background">
                    {filteredPlayers.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setDefendantId(p.id); setDefendantSearch(''); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/20 first:rounded-t-lg last:rounded-b-lg"
                      >
                        <span>{p.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </FieldRow>

          <FieldRow label="Preuves (optionnel)">
            <Textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Captures d'écran, liens, témoignages..."
            />
          </FieldRow>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Annuler</Button>
            <Button
              size="sm"
              onClick={() => void submit()}
              disabled={submitting || title.trim().length < 5 || description.trim().length < 20}
            >
              {submitting ? 'Dépôt...' : 'Déposer'}
            </Button>
          </div>
        </div>
      ) : null}
    </ModalWrap>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  business,
  userId,
  onBack,
  onAction,
  onSelectOnMap,
  onOpenSupport,
  onShowTeam,
  onShowShareholders,
}: {
  business: YouBusiness;
  userId: string;
  onBack: () => void;
  onAction: (id: string, action: ActionType) => void;
  onSelectOnMap?: (b: YouBusiness) => void;
  onOpenSupport?: () => void;
  onShowTeam?: () => void;
  onShowShareholders?: () => void;
}) {
  const [showFinance, setShowFinance] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [showInvestments, setShowInvestments] = useState(false);

  const pinColor = getBusinessPinColor(business.typeKey);
  const BizIcon = getBizIcon(business.typeKey);
  const isPlaced = business.mapX != null && business.mapY != null;
  const isOwned = business.ownerId === userId;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);
  const isEmployee = business.members.some((m) => m.user.id === userId);
  const hasPendingApplication = business.pendingInvitations.some((inv) => inv.employee.id === userId);
  const canApply = !isOwned && !isEmployee && !hasPendingApplication && business.hiring;

  return (
    <>
      <DialogTitle className="sr-only">{business.name}</DialogTitle>
      {underConstruction && <div className="h-2 shrink-0" style={{ background: CONSTRUCTION_STRIPES }} />}

      {/* Nav bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/30 px-4 py-2.5">
        <button type="button" onClick={onBack}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="truncate text-[11px] text-muted-foreground">{getBizLabel(business)}</p>
      </div>

      {/* Hero: icon + info left, action pills right */}
      <div
        className="shrink-0 flex items-start gap-4 px-4 pb-4 pt-3"
        style={{ background: `linear-gradient(to bottom, ${pinColor}0a, transparent)` }}
      >
        {/* Icon */}
        <div
          className="mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-md"
          style={{ backgroundColor: pinColor + '22', border: `2px solid ${pinColor}50` }}
        >
          <BizIcon className="h-7 w-7" style={{ color: pinColor }} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-bold leading-tight text-foreground">{business.name}</p>
          <p className="text-[12px] text-muted-foreground">@{business.owner.username}</p>
          {business.description && (
            <p className="mt-1.5 line-clamp-2 text-[11px] italic text-muted-foreground/70">{business.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setShowFinance(true)}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/25">
              <TrendingUp className="h-2.5 w-2.5" />{fmtCompact(business.treasuryMoney)}
            </button>
            {business.avgRating != null && business.ratingCount > 0 && (
              <button type="button" onClick={() => setShowReviews(true)}
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400 transition-colors hover:bg-amber-400/25">
                <Star className="h-2.5 w-2.5 fill-amber-400/40" />{business.avgRating.toFixed(1)}
              </button>
            )}
            {onShowTeam && (
              <button type="button" onClick={onShowTeam}
                className="inline-flex items-center gap-1 rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] font-medium text-violet-400 transition-colors hover:bg-violet-400/25">
                <Users className="h-2.5 w-2.5" />{displayedMemberCount(business)}
              </button>
            )}
            {business.isShared && onShowShareholders && (
              <button type="button" onClick={onShowShareholders}
                className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-400/25">
                <Crown className="h-2.5 w-2.5" />{business.shareholders.length + 1}
              </button>
            )}
            {business.recentInvestments.length > 0 && (
              <button type="button" onClick={() => setShowInvestments(true)}
                className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-medium text-sky-400 transition-colors hover:bg-sky-400/25">
                <TrendingUp className="h-2.5 w-2.5" />{business.recentInvestments.length}
              </button>
            )}
            {underConstruction && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                🏗 {business.constructionProject?.progress.percent ?? 0}%
              </span>
            )}
          </div>
        </div>

        {/* Right: action pills */}
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          {!isOwned && business.supportEnabled && onOpenSupport && (
            <button type="button" onClick={onOpenSupport}
              className="flex items-center gap-1.5 rounded-lg border border-teal-500/25 bg-teal-500/10 px-2.5 py-1.5 text-[11px] font-medium text-teal-400 transition-colors hover:bg-teal-500/20">
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span>Support</span>
            </button>
          )}
          {canApply ? (
            <button type="button" onClick={() => onAction(business.id, 'apply')}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-violet-300 transition-colors hover:bg-violet-500/25">
              <UserCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Postuler</span>
            </button>
          ) : !isOwned && hasPendingApplication ? (
            <span className="rounded-lg border border-violet-400/20 bg-violet-400/5 px-2.5 py-1.5 text-[10px] text-muted-foreground">
              Candidature en attente
            </span>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-5 pb-6">


          {/* Livret épargne */}
          {business.typeKey === 'bank' && business.livretEpargneUnlocked && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2 text-xs text-amber-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Livret épargne disponible</span>
            </div>
          )}

          {/* Startup products */}
          {business.typeKey === 'startup' && business.startupProducts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Produits</p>
              {business.startupProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-medium">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground">Niv. {product.deployedLevel}/10</p>
                    </div>
                    <p className="text-[11px] font-semibold text-sky-300">+{product.currentRevenue.toLocaleString('fr-FR')} €</p>
                  </div>
                  {(product.isResearchActive || product.canDeploy) && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-sky-400" style={{ width: `${product.progressPercent}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Primary actions */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Services disponibles</p>

            {(() => {
              if (business.typeKey === 'bank') return (
                <button type="button" onClick={() => onAction(business.id, 'bank')}
                  className="flex w-full items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-left text-emerald-400 transition-all hover:opacity-90 active:scale-[0.99]">
                  <Landmark className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Gérer mes comptes</p>
                    <p className="text-[11px] opacity-70">Taux d'emprunt : {business.loanInterestRate ?? 4}%</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              );
              if (business.typeKey === 'transfer') return (
                <button type="button" onClick={() => onAction(business.id, 'transfer')}
                  className="flex w-full items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-4 text-left text-cyan-400 transition-all hover:opacity-90 active:scale-[0.99]">
                  <ArrowLeftRight className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Envoyer de l'argent</p>
                    <p className="text-[11px] opacity-70">Frais de service : {business.transferFeeRate ?? 2}%</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              );
              if (business.typeKey === 'formation') return (
                <button type="button"
                  disabled={(business.formationProducts?.length ?? 0) === 0}
                  onClick={() => onAction(business.id, 'formation')}
                  className="flex w-full items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-left text-amber-400 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40">
                  <GraduationCap className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Accéder aux formations</p>
                    <p className="text-[11px] opacity-70">{business.formationProducts?.length ?? 0} formation(s) disponible(s)</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              );
              if (PURCHASE_TYPES.includes(business.typeKey)) return (
                <button type="button"
                  disabled={isOwned}
                  onClick={() => { if (!isOwned) onAction(business.id, 'purchase'); }}
                  className="flex w-full items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-4 text-left text-yellow-400 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40">
                  <ShoppingCart className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">{isOwned ? 'Achat indisponible' : 'Acheter'}</p>
                    <p className="text-[11px] opacity-70">{isOwned ? 'Tu ne peux pas acheter tes propres articles.' : 'Parcourir les articles disponibles'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              );
              if (business.typeKey === 'supreme_court') return (
                <button type="button" onClick={() => onAction(business.id, 'plainte')}
                  className="flex w-full items-center gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-4 py-4 text-left text-indigo-400 transition-all hover:opacity-90 active:scale-[0.99]">
                  <Scale className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Déposer une plainte</p>
                    <p className="text-[11px] opacity-70">Soumettre une plainte formelle aux juges</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              );
              if (!business.isStateOwned) return (
                <button type="button" onClick={() => onAction(business.id, 'invest')}
                  className="flex w-full items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-4 text-left text-sky-400 transition-all hover:opacity-90 active:scale-[0.99]">
                  <TrendingUp className="h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Investir</p>
                    <p className="text-[11px] opacity-70">Le rendement dépend du niveau de risque choisi.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />
                </button>
              );
              return null;
            })()}

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
          </div>

          {/* Always-available actions — subdued, at the bottom */}
          {!business.isStateOwned && !isOwned && (
            <div className="space-y-1.5 border-t border-border/20 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50">Autres options</p>
              <button type="button" onClick={() => onAction(business.id, 'shareholder')}
                className="flex w-full items-center gap-2 rounded-lg border border-border/30 bg-muted/5 px-3 py-2 text-left text-muted-foreground transition-all hover:bg-muted/15 hover:text-foreground">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[12px]">{business.viewerSharePercent > 0 ? 'Augmenter ma participation' : 'Devenir actionnaire'}</span>
              </button>
              <button type="button" onClick={() => onAction(business.id, 'buyout')}
                className="flex w-full items-center gap-2 rounded-lg border border-border/30 bg-muted/5 px-3 py-2 text-left text-muted-foreground transition-all hover:bg-muted/15 hover:text-rose-400">
                <HandCoins className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[12px]">Faire une offre de rachat</span>
              </button>
            </div>
          )}

          {/* Map link */}
          {isPlaced && onSelectOnMap && (
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onSelectOnMap(business)}>
              <MapPin className="mr-1.5 h-3 w-3" />Voir sur la carte
            </Button>
          )}
        </div>
      </ScrollArea>

      <FinanceModal open={showFinance} onClose={() => setShowFinance(false)} business={business} />
      <ReviewsModal open={showReviews} onClose={() => setShowReviews(false)} business={business} />
      <InvestmentsModal open={showInvestments} onClose={() => setShowInvestments(false)} business={business} />
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
  initialBusinessId,
}: {
  open: boolean;
  onClose: () => void;
  businesses: YouBusiness[];
  userId: string;
  players?: YouPlayer[];
  onReload: () => Promise<void>;
  onSelectOnMap?: (business: YouBusiness) => void;
  initialBusinessId?: string | null;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [detailBusinessId, setDetailBusinessId] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialBusinessId) setDetailBusinessId(initialBusinessId);
  }, [open, initialBusinessId]);
  const [teamRosterBusinessId, setTeamRosterBusinessId] = useState<string | null>(null);
  const [shareholdersViewBusinessId, setShareholdersViewBusinessId] = useState<string | null>(null);
  const [bankBusinessId, setBankBusinessId] = useState<string | null>(null);
  const [loanBusinessId, setLoanBusinessId] = useState<string | null>(null);
  const [investBusinessId, setInvestBusinessId] = useState<string | null>(null);
  const [formationBusinessId, setFormationBusinessId] = useState<string | null>(null);
  const [buyoutBusinessId, setBuyoutBusinessId] = useState<string | null>(null);
  const [shareholderBusinessId, setShareholderBusinessId] = useState<string | null>(null);
  const [transferBusinessId, setTransferBusinessId] = useState<string | null>(null);
  const [applyBusinessId, setApplyBusinessId] = useState<string | null>(null);
  const [purchaseBusinessId, setPurchaseBusinessId] = useState<string | null>(null);
  const [plainteBusinessId, setPlainteBusinessId] = useState<string | null>(null);

  function handleClose() {
    onClose();
    setSearch('');
    setTypeFilters([]);
    setDetailBusinessId(null);
  }

  function handleAction(businessId: string, action: ActionType) {
    if (action === 'bank')              setBankBusinessId(businessId);
    else if (action === 'loan')         setLoanBusinessId(businessId);
    else if (action === 'invest')       setInvestBusinessId(businessId);
    else if (action === 'formation')    setFormationBusinessId(businessId);
    else if (action === 'buyout')       setBuyoutBusinessId(businessId);
    else if (action === 'shareholder')  setShareholderBusinessId(businessId);
    else if (action === 'transfer')     setTransferBusinessId(businessId);
    else if (action === 'apply')        setApplyBusinessId(businessId);
    else if (action === 'purchase')     setPurchaseBusinessId(businessId);
    else if (action === 'plainte')      setPlainteBusinessId(businessId);
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

  const showStateInstitutions = businesses.some((b) => b.isStateOwned) && typeFilters.length === 0 && !search;

  const contentBusinesses = useMemo(
    () => (businesses.some((business) => business.isStateOwned) && typeFilters.length === 0 && !search
      ? filtered.filter((business) => !business.isStateOwned)
      : filtered),
    [businesses, filtered, search, typeFilters],
  );

  const sorted = useMemo(() => sortBusinesses(contentBusinesses, sortMode), [contentBusinesses, sortMode]);

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

  const plainteBusiness = plainteBusinessId ? businesses.find((b) => b.id === plainteBusinessId) ?? null : null;

  const detailBusiness = detailBusinessId ? businesses.find((b) => b.id === detailBusinessId) ?? null : null;
  const teamRosterBusiness = teamRosterBusinessId ? businesses.find((b) => b.id === teamRosterBusinessId) ?? null : null;
  const shareholdersViewBusiness = shareholdersViewBusinessId ? businesses.find((b) => b.id === shareholdersViewBusinessId) ?? null : null;
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
              onShowTeam={() => setTeamRosterBusinessId(detailBusiness.id)}
              onShowShareholders={() => setShareholdersViewBusinessId(detailBusiness.id)}
              onOpenSupport={
                !detailBusiness.isStateOwned && detailBusiness.supportEnabled
                  ? () => {
                      void youApi.openBusinessSupportConversation(detailBusiness.id).then((res) => {
                        handleClose();
                        navigate(`/messages?conversation=${res.data.result.conversationId}`);
                      }).catch(() => {
                        toast({ title: 'Impossible d\'ouvrir le support.', variant: 'destructive' });
                      });
                    }
                  : undefined
              }
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
                <div className="space-y-5 px-5 pb-5 pt-4">
                  {showStateInstitutions ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
                        <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-300">Institutions de l'État</span>
                        <span className="text-[10px] text-muted-foreground">{businesses.filter((b) => b.isStateOwned).length}</span>
                        <div className="ml-1 flex-1 border-t border-border/30" />
                      </div>
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {businesses.filter((b) => b.isStateOwned).map((business) => (
                            <GridCard key={business.id} business={business} onClick={() => setDetailBusinessId(business.id)} />
                          ))}
                        </div>
                      ) : (
                        <div>
                          {businesses.filter((b) => b.isStateOwned).map((business) => (
                            <ListRow key={business.id} business={business} onClick={() => setDetailBusinessId(business.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">Aucune entreprise ne correspond à tes filtres.</p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="space-y-3">
                      {grouped ? (
                        grouped.map((group) => (
                          <div key={group.typeKey} className="space-y-2">
                            <div className="flex items-center gap-2">
                              {(() => { const G = getBizIcon(group.typeKey); return <G className="h-3.5 w-3.5 shrink-0" style={{ color: getBusinessPinColor(group.typeKey) }} />; })()}
                              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: getBusinessPinColor(group.typeKey) }}>{group.label}</span>
                              <span className="text-[10px] text-muted-foreground">{group.businesses.length}</span>
                              <div className="ml-1 flex-1 border-t border-border/30" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {group.businesses.map((b) => (
                                <GridCard key={b.id} business={b} onClick={() => setDetailBusinessId(b.id)} />
                              ))}
                            </div>
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
                    <div className="space-y-3">
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
                </div>
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
      <TeamRosterModal open={Boolean(teamRosterBusiness)} onClose={() => setTeamRosterBusinessId(null)} business={teamRosterBusiness} />
      <ShareholdersModal open={Boolean(shareholdersViewBusiness)} onClose={() => setShareholdersViewBusinessId(null)} business={shareholdersViewBusiness} userId={userId} />
      <FilePlainteModal open={Boolean(plainteBusiness)} onClose={() => setPlainteBusinessId(null)} business={plainteBusiness} userId={userId} players={players} onSubmitted={() => void onReload()} />
    </>
  );
}
