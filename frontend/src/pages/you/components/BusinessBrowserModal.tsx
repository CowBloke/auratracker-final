import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Building2, CalendarDays, ChevronLeft, ChevronRight,
  GraduationCap, HandCoins, Hammer, Landmark, LayoutGrid,
  MapPin, MessageSquare, Search, ShoppingCart,
  Sparkles, Star, TrendingUp, UserCheck, Users, X, Scale, Crown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type YouBusiness, type YouPlayer, youApi, justiceApi } from '@/services/api';
import {
  BankAccountModal, BuyoutOfferModal, FormationCatalogModal,
  InvestModal, LoanModal, ShareholderProposalModal, TeamRosterModal, TransferBusinessModal,
} from './modals';
import { FieldRow } from './YouPrimitives';
import { AppModal } from '@/components/ui/app-modal';
import { TYPE_LABELS_FR } from '../mapConstants';
import { BUSINESS_ICON_MAP } from '../constants';
import { withRouteError } from '../utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

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
    <AppModal open={open} onClose={onClose} tone="cyan" size="md" description="Le proprietaire doit valider le contrat pour l activer.">
      <AppModal.Header tone="cyan" title={business ? `Postuler · ${business.name}` : 'Postuler'} subtitle="Le proprietaire doit valider le contrat pour l activer." />
      <AppModal.Body scrollable>
      <FieldRow label="Role vise"><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="employee" /></FieldRow>
      <FieldRow label="Salaire demande / jour"><Input type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} /></FieldRow>
      <FieldRow label="Message">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={240} placeholder="Explique ce que tu peux apporter a cette entreprise." />
      </FieldRow>
      </AppModal.Body>
      <AppModal.Footer>
        <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
        <AppModal.Button tone="cyan" variant="soft" onClick={submit} disabled={submitting || !business || !role.trim()}>Envoyer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="cyan" size="md" description={isAgency ? 'Acheter un bien immobilier. Gagne du XP Social.' : 'Parcourir les articles disponibles.'}>
      <AppModal.Header tone="cyan" title={business.name} subtitle={isAgency ? 'Acheter un bien immobilier. Gagne du XP Social.' : 'Parcourir les articles disponibles.'} />
      <AppModal.Body scrollable>
      <div className="space-y-4">
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <div key={section} className="space-y-2">
            {(section !== 'Général' || Object.keys(groupedItems).length > 1) && (
              <h3 className="px-1 text-sm font-semibold text-muted-foreground">{section}</h3>
            )}
            {sectionItems.map((item) => (
              <Item key={item.key} variant="muted" className="justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-warning/15 text-lg">
                    {(item as any).imageUrl
                      ? <img src={(item as any).imageUrl} className="h-9 w-9 object-cover" alt={item.label} />
                      : (item.emoji ?? <ShoppingCart className="h-4 w-4 text-warning" />)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.price.toLocaleString('fr-FR')} €</p>
                    {item.xpHint && <p className="text-xs text-primary/80">{item.xpHint}</p>}
                  </div>
                </div>
                <Button size="sm" onClick={() => void buy(item.key)} disabled={buying !== null}>Acheter</Button>
              </Item>
            ))}
          </div>
        ))}
      </div>
      </AppModal.Body>
    </AppModal>
  );
}

// ── Business grid card ────────────────────────────────────────────────────────

function GridCard({ business, onClick }: { business: YouBusiness; onClick: () => void }) {
  const BizIcon = getBizIcon(business.typeKey);
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer gap-3 py-4 transition-colors hover:bg-accent"
    >
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BizIcon className="size-4 shrink-0" />
            <span className="truncate">{business.name}</span>
          </CardTitle>
          <CardDescription className="truncate">
            {getBizLabel(business)} · @{business.owner.username}
          </CardDescription>
          <CardAction>
            <ChevronRight className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5 px-4">
          <Badge variant="secondary" className="tabular-nums">{fmt(business.treasuryMoney)}</Badge>
          <Badge variant="outline">
            <Users />{displayedMemberCount(business)}
          </Badge>
          {business.isStateOwned && <Badge variant="outline">État</Badge>}
          {business.avgRating != null && business.ratingCount > 0 && (
            <Badge variant="warning">
              <Star />{business.avgRating.toFixed(1)}
            </Badge>
          )}
          <Badge variant={business.satisfaction >= 70 ? 'success' : business.satisfaction >= 40 ? 'warning' : 'destructive'} className="tabular-nums">
            {business.satisfaction}%
          </Badge>
          {underConstruction && (
            <Badge variant="warning">
              <Hammer />{business.constructionProject?.progress.percent ?? 0}%
            </Badge>
          )}
        </CardContent>
    </Card>
  );
}


// ── Finance stats modal ───────────────────────────────────────────────────────

function FinanceModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness }) {
  const net = business.monthlyRevenue - business.monthlyExpenses;
  return (
    <AppModal open={open} onClose={onClose} tone="money" size="sm" description={business.name}>
      <AppModal.Header tone="money" title="Finances" subtitle={business.name} />
      <AppModal.Body scrollable>
      <div className="space-y-3">
        <Alert variant="success">
          <p className="text-xs font-semibold text-success">Trésorerie</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums leading-tight text-success">{fmt(business.treasuryMoney)}</p>
        </Alert>
        <div className="grid grid-cols-2 gap-2">
          <Alert variant="success">
            <p className="text-xs text-muted-foreground/70">Rev. mensuel</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-success">{fmt(business.monthlyRevenue)}</p>
          </Alert>
          <div className={cn('rounded-xl border px-3 py-3', net >= 0 ? 'bg-success/8 border-success/20' : 'bg-destructive/8 border-destructive/20')}>
            <p className="text-xs text-muted-foreground/70">Net / mois</p>
            <p className={cn('mt-1 text-sm font-bold tabular-nums', net >= 0 ? 'text-success' : 'text-destructive')}>
              {net >= 0 ? '+' : ''}{fmt(net)}
            </p>
          </div>
        </div>
      </div>
      </AppModal.Body>
    </AppModal>
  );
}

// ── Reviews modal ─────────────────────────────────────────────────────────────

function ReviewsModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness }) {
  const reviews = business.ratings ?? [];
  return (
    <AppModal open={open} onClose={onClose} tone="money" size="md" description={business.name}>
      <AppModal.Header tone="money" title="Avis clients" subtitle={business.name} />
      <AppModal.Body scrollable>
      {business.avgRating != null && business.ratingCount > 0 ? (
        <div className="space-y-3">
          <Alert variant="warning" className="flex items-center gap-4">
            <span className="text-[40px] font-bold text-warning tabular-nums leading-none">{business.avgRating.toFixed(1)}</span>
            <div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={cn('h-4 w-4',
                    i <= Math.floor(business.avgRating!) ? 'fill-warning text-warning'
                    : i === Math.ceil(business.avgRating!) && business.avgRating! % 1 >= 0.3 ? 'fill-warning/40 text-warning'
                    : 'text-warning/20',
                  )} />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{business.ratingCount} avis · sur 5</p>
            </div>
          </Alert>
          {reviews.length > 0 && (
            <div className="space-y-2">
              {reviews.map((r) => (
                <Card key={r.id} className="gap-0 py-0 shadow-none"><CardContent className="px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{r.user.username}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn('h-3 w-3', i <= r.rating ? 'fill-warning text-warning' : 'text-warning/20')} />
                      ))}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{r.comment}</p>
                  )}
                </CardContent></Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucun avis pour le moment.</p>
      )}
      </AppModal.Body>
    </AppModal>
  );
}

// ── Investments modal ─────────────────────────────────────────────────────────

function InvestmentsModal({ open, onClose, business }: { open: boolean; onClose: () => void; business: YouBusiness }) {
  return (
    <AppModal open={open} onClose={onClose} tone="money" size="sm" description={business.name}>
      <AppModal.Header tone="money" title="Investissements reçus" subtitle={business.name} />
      <AppModal.Body scrollable>
      {business.recentInvestments.length > 0 ? (
        <div className="space-y-1.5">
          {business.recentInvestments.map((inv) => {
            const riskColor = inv.riskLevel === 'low' ? 'text-success' : inv.riskLevel === 'high' ? 'text-destructive' : 'text-warning';
            return (
              <Item key={inv.id} variant="muted" className="justify-between gap-2 text-xs">
                <span className="font-medium">{inv.investor.username}</span>
                <span className={cn('font-semibold', riskColor)}>{fmt(inv.amount)}</span>
              </Item>
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucun investissement récent.</p>
      )}
      </AppModal.Body>
    </AppModal>
  );
}

// ── Shareholders modal ────────────────────────────────────────────────────────

function ShareholdersModal({ open, onClose, business, userId }: {
  open: boolean; onClose: () => void; business: YouBusiness | null; userId: string;
}) {
  if (!business) return null;
  const shareholderDesc = `${business.shareholders.length + 1} actionnaire(s)${business.viewerSharePercent > 0 ? ` · ta part : ${business.viewerSharePercent.toFixed(2)}%` : ''}`;
  return (
    <AppModal open={open} onClose={onClose} tone="money" size="md" description={shareholderDesc}>
      <AppModal.Header tone="money" title={`Capital · ${business.name}`} subtitle={shareholderDesc} />
      <AppModal.Body scrollable>
      <div className="space-y-1.5">
        <Alert variant="warning">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{business.owner.username}{business.ownerId === userId ? ' · toi' : ''}</span>
            <span className="font-bold text-warning">{business.ownerSharePercent.toFixed(2)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
            <div className="h-full rounded-full bg-warning/70" style={{ width: `${Math.max(0, Math.min(100, business.ownerSharePercent))}%` }} />
          </div>
        </Alert>
        {business.shareholders.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Aucun actionnaire externe.</p>
        ) : business.shareholders.map((s) => (
          <Card key={s.id} className="gap-0 py-0 shadow-none"><CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.user.username}{s.user.id === userId ? ' · toi' : ''}</span>
              <span className="font-bold">{s.sharePercent.toFixed(2)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full rounded-full bg-warning/70" style={{ width: `${Math.max(0, Math.min(100, s.sharePercent))}%` }} />
            </div>
          </CardContent></Card>
        ))}
      </div>
      </AppModal.Body>
    </AppModal>
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
    <AppModal open={open} onClose={onClose} tone="orange" size="md" description={business ? `Cour suprême · ${business.name}` : 'Cour suprême'}>
      <AppModal.Header tone="orange" title="Déposer une plainte" subtitle={business ? `Cour suprême · ${business.name}` : 'Cour suprême'} />
      <AppModal.Body scrollable>
      {business ? (
        <div className="space-y-4">
          <Card className="gap-0 py-0 shadow-none"><CardContent className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Déposer une plainte contre un joueur ou un business.</span>
            </div>
          </CardContent></Card>

          <FieldRow label="Titre de la plainte *">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="Ex: Arnaque lors d'un échange de monnaie"
            />
            <p className="mt-1 text-xs text-muted-foreground/50">{title.length}/100</p>
          </FieldRow>

          <FieldRow label="Description des faits *">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Décrivez les faits en détail : que s'est-il passé, quand, et pourquoi c'est une violation des règles..."
            />
            <p className="mt-1 text-xs text-muted-foreground/50">{description.length}/2000</p>
          </FieldRow>

          <FieldRow label="Coupable (optionnel)">
            {selectedPlayer ? (
              <Item variant="muted" className="gap-2">
                <span className="flex-1 text-sm font-medium">{selectedPlayer.username}</span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Retirer" onClick={() => { setDefendantId(''); setDefendantSearch(''); }}><X /></Button>
              </Item>
            ) : (
              <div className="space-y-2">
                <Input
                  value={defendantSearch}
                  onChange={(e) => setDefendantSearch(e.target.value)}
                  placeholder="Rechercher un joueur..."
                />
                {defendantSearch.length > 0 && filteredPlayers.length > 0 && (
                  <Card className="max-h-40 gap-0 overflow-y-auto py-1">
                    <CardContent className="flex flex-col px-1">
                      {filteredPlayers.map((p) => (
                        <Button
                          key={p.id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => { setDefendantId(p.id); setDefendantSearch(''); }}
                        >
                          {p.username}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
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
        </div>
      ) : null}
      </AppModal.Body>
      {business ? (
        <AppModal.Footer>
          <AppModal.Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</AppModal.Button>
          <AppModal.Button tone="orange" variant="soft" onClick={() => void submit()} disabled={submitting || title.trim().length < 5 || description.trim().length < 20}>
            {submitting ? 'Dépôt...' : 'Déposer'}
          </AppModal.Button>
        </AppModal.Footer>
      ) : null}
    </AppModal>
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

  const BizIcon = getBizIcon(business.typeKey);
  const isPlaced = business.mapX != null && business.mapY != null;
  const isOwned = business.ownerId === userId;
  const underConstruction = Boolean(business.underConstruction && business.constructionProject);
  const isEmployee = business.members.some((m) => m.user.id === userId);
  const hasPendingApplication = business.pendingInvitations.some((inv) => inv.employee.id === userId);
  const canApply = !isOwned && !isEmployee && !hasPendingApplication && business.hiring;

  const serviceItem = (opts: {
    icon: LucideIcon;
    title: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <Item asChild variant="outline" className={cn(opts.disabled && 'pointer-events-none opacity-50')}>
      <button type="button" disabled={opts.disabled} onClick={opts.onClick} className="w-full text-left">
        <ItemMedia variant="icon">
          <opts.icon />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{opts.title}</ItemTitle>
          <ItemDescription>{opts.description}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" />
        </ItemActions>
      </button>
    </Item>
  );

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-start gap-4 px-4 pb-4 pt-3">
        <Item className="min-w-0 flex-1 p-0">
          <ItemMedia variant="icon" className="size-12">
            <BizIcon className="size-6" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="text-lg">{business.name}</ItemTitle>
            <ItemDescription>@{business.owner.username}</ItemDescription>
            {business.description && <p className="line-clamp-2 text-xs italic text-muted-foreground">{business.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Button type="button" size="xs" variant="outline" onClick={() => setShowFinance(true)}>
                <TrendingUp />{fmtCompact(business.treasuryMoney)}
              </Button>
              {business.avgRating != null && business.ratingCount > 0 && (
                <Button type="button" size="xs" variant="outline" onClick={() => setShowReviews(true)}>
                  <Star />{business.avgRating.toFixed(1)}
                </Button>
              )}
              {onShowTeam && (
                <Button type="button" size="xs" variant="outline" onClick={onShowTeam}>
                  <Users />{displayedMemberCount(business)}
                </Button>
              )}
              {business.isShared && onShowShareholders && (
                <Button type="button" size="xs" variant="outline" onClick={onShowShareholders}>
                  <Crown />{business.shareholders.length + 1}
                </Button>
              )}
              {business.recentInvestments.length > 0 && (
                <Button type="button" size="xs" variant="outline" onClick={() => setShowInvestments(true)}>
                  <TrendingUp />{business.recentInvestments.length}
                </Button>
              )}
              {underConstruction && (
                <Badge variant="warning">
                  <Hammer />{business.constructionProject?.progress.percent ?? 0}%
                </Badge>
              )}
            </div>
          </ItemContent>
        </Item>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!isOwned && business.supportEnabled && onOpenSupport && (
            <Button type="button" size="sm" variant="outline" onClick={onOpenSupport}>
              <MessageSquare />Support
            </Button>
          )}
          {canApply ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onAction(business.id, 'apply')}>
              <UserCheck />Postuler
            </Button>
          ) : !isOwned && hasPendingApplication ? (
            <Badge variant="secondary">Candidature en attente</Badge>
          ) : null}
        </div>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-5 py-4">
          {business.typeKey === 'bank' && business.livretEpargneUnlocked && (
            <Alert variant="warning">
              <Sparkles />
              <AlertDescription>Livret épargne disponible</AlertDescription>
            </Alert>
          )}

          {business.typeKey === 'startup' && business.startupProducts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Produits</p>
              {business.startupProducts.map((product) => (
                <Item key={product.id} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{product.name}</ItemTitle>
                    <ItemDescription>Niv. {product.deployedLevel}/10</ItemDescription>
                    {(product.isResearchActive || product.canDeploy) && <Progress value={product.progressPercent} />}
                  </ItemContent>
                  <ItemActions>
                    <span className="text-xs font-semibold">+{product.currentRevenue.toLocaleString('fr-FR')} €</span>
                  </ItemActions>
                </Item>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Services disponibles</p>

            {(() => {
              if (business.typeKey === 'bank') return serviceItem({
                icon: Landmark, title: 'Gérer mes comptes',
                description: `Taux d'emprunt : ${business.loanInterestRate ?? 4}%`,
                onClick: () => onAction(business.id, 'bank'),
              });
              if (business.typeKey === 'transfer') return serviceItem({
                icon: ArrowLeftRight, title: "Envoyer de l'argent",
                description: `Frais de service : ${business.transferFeeRate ?? 2}%`,
                onClick: () => onAction(business.id, 'transfer'),
              });
              if (business.typeKey === 'formation') return serviceItem({
                icon: GraduationCap, title: 'Accéder aux formations',
                description: `${business.formationProducts?.length ?? 0} formation(s) disponible(s)`,
                disabled: (business.formationProducts?.length ?? 0) === 0,
                onClick: () => onAction(business.id, 'formation'),
              });
              if (PURCHASE_TYPES.includes(business.typeKey)) return serviceItem({
                icon: ShoppingCart, title: isOwned ? 'Achat indisponible' : 'Acheter',
                description: isOwned ? 'Tu ne peux pas acheter tes propres articles.' : 'Parcourir les articles disponibles',
                disabled: isOwned,
                onClick: () => { if (!isOwned) onAction(business.id, 'purchase'); },
              });
              if (business.typeKey === 'supreme_court') return serviceItem({
                icon: Scale, title: 'Déposer une plainte',
                description: 'Soumettre une plainte formelle aux juges',
                onClick: () => onAction(business.id, 'plainte'),
              });
              if (!business.isStateOwned) return serviceItem({
                icon: TrendingUp, title: 'Investir',
                description: 'Le rendement dépend du niveau de risque choisi.',
                onClick: () => onAction(business.id, 'invest'),
              });
              return null;
            })()}

            {business.typeKey === 'bank' && serviceItem({
              icon: HandCoins, title: 'Prendre un prêt',
              description: 'Emprunt avec remboursement mensuel',
              onClick: () => onAction(business.id, 'loan'),
            })}
          </div>

          {!business.isStateOwned && !isOwned && (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Autres options</p>
                <Button type="button" variant="outline" className="justify-start" onClick={() => onAction(business.id, 'shareholder')}>
                  <TrendingUp />
                  {business.viewerSharePercent > 0 ? 'Augmenter ma participation' : 'Devenir actionnaire'}
                </Button>
                <Button type="button" variant="outline" className="justify-start" onClick={() => onAction(business.id, 'buyout')}>
                  <HandCoins />
                  Faire une offre de rachat
                </Button>
              </div>
            </>
          )}

          {isPlaced && onSelectOnMap && (
            <Button size="sm" variant="outline" className="w-full" onClick={() => onSelectOnMap(business)}>
              <MapPin />Voir sur la carte
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
  const [sortMode, setSortMode] = useState<SortMode>('default');
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

  // Sidebar: "all" + one entry per type
  const sidebarCategories = useMemo(() => {
    const counts = new Map<string, number>();
    businesses.forEach((b) => {
      counts.set(b.typeKey, (counts.get(b.typeKey) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: TYPE_LABELS_FR[key] ?? key,
        count,
        Icon: getBizIcon(key),
      }));
  }, [businesses]);

  // Active sidebar filter (null = all)
  const [sidebarType, setSidebarType] = useState<string | null>(null);

  // Combine sidebar + search filtering
  const visibleBusinesses = useMemo(() => {
    let result = businesses;
    if (sidebarType) result = result.filter((b) => b.typeKey === sidebarType);
    const q = search.trim().toLowerCase();
    if (q) result = result.filter((b) =>
      [b.name, b.owner.username, b.type?.label ?? b.typeKey, b.location ?? ''].join(' ').toLowerCase().includes(q),
    );
    return sortBusinesses(result, sortMode);
  }, [businesses, sidebarType, search, sortMode]);

  return (
    <>
      <AppModal open={open} onClose={handleClose} tone="cyan" size="xl" description="Parcourir les entreprises du serveur.">
        <AppModal.Header icon={<Building2 />} tone="cyan" title="Entreprises" subtitle={`${visibleBusinesses.length} résultat${visibleBusinesses.length !== 1 ? 's' : ''}`} />

        <div className="grid h-[530px] border-t" style={{ gridTemplateColumns: '200px 1fr' }}>
          <div className="flex flex-col overflow-hidden border-r">
            <div className="shrink-0 p-2">
              <InputGroup>
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" />
                {search && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" aria-label="Effacer" onClick={() => setSearch('')}>
                      <X />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-0.5 p-2 pt-0">
                <Button
                  type="button"
                  variant={sidebarType === null ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-start"
                  onClick={() => setSidebarType(null)}
                >
                  <Building2 />
                  <span className="flex-1 truncate text-left">Toutes</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{businesses.length}</span>
                </Button>
                {sidebarCategories.map((cat) => (
                  <Button
                    key={cat.key}
                    type="button"
                    variant={sidebarType === cat.key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setSidebarType(sidebarType === cat.key ? null : cat.key)}
                  >
                    <cat.Icon />
                    <span className="flex-1 truncate text-left">{cat.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{cat.count}</span>
                  </Button>
                ))}
              </div>
            </ScrollArea>

            <div className="flex shrink-0 flex-col gap-1.5 border-t p-2">
              <p className="text-xs font-medium text-muted-foreground">Tri</p>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(({ key, label }) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            {detailBusiness ? (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Retour" onClick={() => setDetailBusinessId(null)}>
                    <ChevronLeft />
                  </Button>
                  <p className="truncate text-xs text-muted-foreground">{getBizLabel(detailBusiness)}</p>
                </div>
                <ScrollArea className="min-h-0 flex-1">
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
                              toast.error('Impossible d\'ouvrir le support.');
                            });
                          }
                        : undefined
                    }
                  />
                </ScrollArea>
              </>
            ) : (
              <ScrollArea className="min-h-0 flex-1">
                <div className="p-3">
                  {visibleBusinesses.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Search /></EmptyMedia>
                        <EmptyDescription>Aucune entreprise ne correspond.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleBusinesses.map((b) => (
                        <GridCard key={b.id} business={b} onClick={() => setDetailBusinessId(b.id)} />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </AppModal>

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
