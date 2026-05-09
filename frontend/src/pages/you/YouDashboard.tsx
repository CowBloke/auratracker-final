import { useMemo, useRef, useEffect, useState } from 'react';
import {
  Building2,
  Wallet, MapPin, AlertTriangle, ChevronRight, Hammer, Plus, Gauge, TrendingUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { UsernameDisplay } from '@/components/ui/username-display';
import { cn } from '@/lib/utils';
import { type YouState, type YouJobOffer, type YouBusiness, youApi } from '@/services/api';
import { PRODUCER_TYPES } from '@/lib/resources';
import { CreateBusinessModal, ManageBusinessModal } from './components/modals';
import { ProductionModal } from './components/ProductionModal';
import { BUSINESS_ICON_MAP } from './constants';
import { getBusinessPinColor } from './mapConstants';
import { isYouNotification, withRouteError } from './utils';
import { FeedCard } from './components/YouPrimitives';
import { type FeedItem } from './types';
import { CarteTab, type CarteTabHandle } from './tabs/CarteTab';
import { BusinessBrowserModal } from './components/BusinessBrowserModal';
import './dashboard.css';


// ---- Sparkline ----

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 26;
  const w = 260;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`);
  const d = 'M ' + pts.join(' L ');
  const fillD = `${d} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2 h-[26px] w-full">
      <path d={fillD} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---- Business tile (owned — left rail) ----

function OwnedBizTile({ b, onManage, onWork, onStartPlacing, currentUserId }: {
  b: YouBusiness;
  onManage: () => void;
  onWork: () => void;
  onStartPlacing: (id: string) => void;
  currentUserId: string;
}) {
  const Icon = BUSINESS_ICON_MAP[b.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const color = getBusinessPinColor(b.typeKey);
  const net = b.monthlyRevenue - b.monthlyExpenses;
  const isUnplaced = b.mapX == null || b.mapY == null;
  const sparkData = (b.revenueHistory ?? []).slice(-30);
  const isProducer = PRODUCER_TYPES.has(b.typeKey);
  const myMember = b.members.find((m) => m.user.id === currentUserId);
  const needsWork = isProducer && myMember != null && !myMember.workedToday && !b.underConstruction;
  const f = b.financials;
  const displayNet = f?.netDaily ?? Math.round(net / 30);
  const runwayLabel = f?.runwayDays == null ? 'stable' : `${f.runwayDays}j`;

  return (
    <div className="rounded-xl border border-border/40 bg-card transition-all hover:border-border" data-tutorial-id="you-dashboard-owned-business-card">
      {/* Placement warning */}
      {isUnplaced && (
        <div className="flex items-center gap-2 rounded-t-xl border-b border-amber-400/20 bg-amber-400/8 px-3 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
          <span className="min-w-0 flex-1 text-[10px] text-amber-400">Non placé sur la carte</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartPlacing(b.id); }}
            className="flex shrink-0 items-center gap-1 rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-400/25"
            data-tutorial-id="you-dashboard-place-business"
          >
            <MapPin className="h-2.5 w-2.5" />
            Placer
          </button>
        </div>
      )}

      {/* Work reminder banner */}
      {needsWork && (
        <div className="flex items-center gap-2 border-b border-orange-500/20 bg-orange-500/8 px-3 py-2">
          <Hammer className="h-3 w-3 shrink-0 text-orange-400" />
          <span className="min-w-0 flex-1 text-[10px] text-orange-400">Travail journalier requis</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onWork(); }}
            className="flex shrink-0 items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-400 transition-colors hover:bg-orange-500/25"
            data-tutorial-id="you-dashboard-work-button"
          >
            <Hammer className="h-2.5 w-2.5" />
            Travailler
          </button>
        </div>
      )}

      {/* Tile body */}
      <button type="button" onClick={onManage} className="w-full p-3 text-left">
        <div className="mb-2.5 flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{b.name}</div>
            <div className="text-[10px] text-muted-foreground">{b.type?.label ?? b.typeKey} · Niv. {b.level}</div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Trésorerie</div>
            <div className="text-[12px] font-semibold tabular-nums">{b.treasuryMoney.toLocaleString('fr-FR')}€</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Net /jour</div>
            <div className={cn('text-[12px] font-semibold tabular-nums', displayNet >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {displayNet >= 0 ? '+' : ''}{displayNet.toLocaleString('fr-FR')}€
            </div>
          </div>
        </div>
        {f && (
          <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-border/30 pt-2">
            <div>
              <div className="text-[8px] uppercase tracking-wide text-muted-foreground/70">Runway</div>
              <div className={cn('text-[10px] font-semibold tabular-nums', f.runwayDays != null && f.runwayDays < 5 ? 'text-amber-400' : 'text-muted-foreground')}>{runwayLabel}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-wide text-muted-foreground/70">Crédit</div>
              <div className="text-[10px] font-semibold tabular-nums text-sky-400">{f.creditScore}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-wide text-muted-foreground/70">Intrants</div>
              <div className={cn('text-[10px] font-semibold tabular-nums', f.inputCoverage.percent >= 80 ? 'text-emerald-400' : f.inputCoverage.percent >= 45 ? 'text-amber-400' : 'text-red-400')}>{f.inputCoverage.percent}%</div>
            </div>
          </div>
        )}
        <Sparkline data={sparkData} color={color} />
      </button>
    </div>
  );
}


// ---- Member business tile (employee — left rail) ----

function MemberBizTile({ b, currentUserId, onOpen, onWork }: {
  b: YouBusiness;
  currentUserId: string;
  onOpen: () => void;
  onWork: () => void;
}) {
  const Icon = BUSINESS_ICON_MAP[b.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const color = getBusinessPinColor(b.typeKey);
  const isProducer = PRODUCER_TYPES.has(b.typeKey);
  const myMember = b.members.find((m) => m.user.id === currentUserId);
  const needsWork = isProducer && myMember != null && !myMember.workedToday && !b.underConstruction;
  const owner = b.owner as typeof b.owner & { usernameColor?: string | null };

  return (
    <div className="rounded-xl border border-border/40 bg-card transition-all hover:border-border">
      {needsWork && (
        <div className="flex items-center gap-2 border-b border-orange-500/20 bg-orange-500/8 px-3 py-2">
          <Hammer className="h-3 w-3 shrink-0 text-orange-400" />
          <span className="min-w-0 flex-1 text-[10px] text-orange-400">Travail journalier requis</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onWork(); }}
            className="flex shrink-0 items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-400 transition-colors hover:bg-orange-500/25"
          >
            <Hammer className="h-2.5 w-2.5" />
            Travailler
          </button>
        </div>
      )}
      <button type="button" onClick={onOpen} className="w-full p-3 text-left">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}22` }}>
            <Icon className="h-3.5 w-3.5" style={{ color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{b.name}</div>
            <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
              <span>@</span>
              <UsernameDisplay
                username={owner.username}
                userId={owner.id}
                firstName={owner.firstName}
                usernameColor={owner.usernameColor}
                preset="minimal"
                clickable
                usernameClassName="text-[10px]"
              />
              <span className="shrink-0">· {b.type?.label ?? b.typeKey}</span>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        </div>
      </button>
    </div>
  );
}

// ---- Left Rail ----

function DashLeftRail({ data, currentUserId, onManageBiz, onWorkBiz, onStartPlacing, onOpenBrowser, onCreateBusiness }: {
  data: YouState;
  currentUserId: string;
  onManageBiz: (id: string) => void;
  onWorkBiz: (id: string) => void;
  onStartPlacing: (id: string) => void;
  onOpenBrowser: () => void;
  onCreateBusiness: () => void;
}) {
  const owned = data.ownedBusinesses;
  const memberOnly = data.memberBusinesses;
  const allCount = useMemo(() => {
    const ids = new Set<string>();
    [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses]
      .forEach((g) => g.forEach((b) => ids.add(b.id)));
    return ids.size;
  }, [data]);

  const totalTreasury = owned.reduce((s, b) => s + b.treasuryMoney, 0);
  const totalNet = owned.reduce((s, b) => s + b.monthlyRevenue - b.monthlyExpenses, 0);

  return (
    <div className="you-dash-left-rail border-r border-border/40" data-tutorial-id="you-dashboard-left-rail">
      {/* Scrollable content */}
      <div className="you-dash-left-scroll px-3 py-4">
        {/* Empire header */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Ton empire</span>
          <button
            type="button"
            onClick={onCreateBusiness}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border/50 px-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            data-tutorial-id="you-dashboard-create-business"
          >
            <Plus className="h-3 w-3" />
            Créer
          </button>
          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{owned.length}/{data.businessSlots}</span>
        </div>

        {owned.length > 0 && (
          <div className="mb-3 rounded-xl border border-border/40 bg-card p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Valeur totale</span>
              <span className={cn('text-[10px] font-medium tabular-nums', totalNet >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString('fr-FR')}€ /mois
              </span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {totalTreasury.toLocaleString('fr-FR')}<span className="ml-1 text-sm text-muted-foreground">€</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/30 pt-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Gauge className="h-3 w-3" />
                Crédit moyen {Math.round(owned.reduce((s, b) => s + (b.financials?.creditScore ?? 500), 0) / Math.max(1, owned.length))}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {owned.reduce((s, b) => s + (b.financials?.receivables ?? 0), 0).toLocaleString('fr-FR')}€ à recevoir
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {owned.map((b) => (
            <OwnedBizTile
              key={b.id}
              b={b}
              onManage={() => onManageBiz(b.id)}
              onWork={() => onWorkBiz(b.id)}
              onStartPlacing={onStartPlacing}
              currentUserId={currentUserId}
            />
          ))}
          {owned.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/40 py-6 text-center text-xs text-muted-foreground">
              Aucun business pour le moment
            </div>
          )}
        </div>

        {/* Employee businesses */}
        {memberOnly.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Employé</div>
            <div className="space-y-2">
              {memberOnly.map((b) => (
                <MemberBizTile
                  key={b.id}
                  b={b}
                  currentUserId={currentUserId}
                  onOpen={() => onManageBiz(b.id)}
                  onWork={() => onWorkBiz(b.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky browse button */}
      <div className="shrink-0 border-t border-border/40 px-3 py-3">
        <button
          type="button"
          onClick={onOpenBrowser}
          className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 px-3 py-3 text-left transition-all hover:border-primary/50 hover:bg-primary/12 active:scale-[0.98]"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">Parcourir les entreprises</p>
            <p className="text-[10px] text-muted-foreground">{allCount} disponibles</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary/60" />
        </button>
      </div>
    </div>
  );
}

// ---- Right Rail (feed — real FeedCard with actions) ----

const FEED_TABS = [
  { key: 'all',    label: 'Tout'     },
  { key: 'biz',    label: 'Business' },
  { key: 'money',  label: 'Argent'   },
  { key: 'social', label: 'Social'   },
] as const;

type FeedTab = typeof FEED_TABS[number]['key'];

function DashRightRail({ data, userId, onReload }: { data: YouState; userId: string; onReload: () => Promise<void> }) {
  const [tab, setTab] = useState<FeedTab>('all');
  const { notifications } = useNotifications();
  const youNotifs = useMemo(() => notifications.filter(isYouNotification).slice(0, 6), [notifications]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    const seenLoanIds = new Set<string>();

    for (const n of youNotifs) {
      items.push({ kind: 'notification', date: n.createdAt, id: `notif-${n.id}`, notification: n });
    }
    for (const offer of data.jobOffers) {
      items.push({ kind: 'job_offer', date: offer.createdAt, id: `offer-${offer.id}`, offer });
    }
    for (const r of data.relationships) {
      if (r.pendingProposal?.canRespond) {
        items.push({ kind: 'marriage_proposal', date: r.pendingProposal.createdAt, id: `marry-${r.id}`, relationship: r });
      }
      if (r.pendingDivorceProposal?.canRespond) {
        items.push({ kind: 'divorce_proposal', date: r.pendingDivorceProposal.createdAt, id: `divorce-${r.id}`, relationship: r });
      }
      items.push({ kind: 'relationship', date: r.createdAt, id: `rel-${r.id}`, relationship: r });
    }
    for (const business of [...data.ownedBusinesses, ...data.exploreBusinesses]) {
      for (const loan of business.recentLoans) {
        if (loan.status === 'ACTIVE' && loan.borrower.id === userId && !seenLoanIds.has(loan.id)) {
          seenLoanIds.add(loan.id);
          items.push({ kind: 'active_loan', date: loan.createdAt, id: `loan-${loan.id}`, businessName: business.name, loan });
        }
      }
    }
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, userId, youNotifs]);

  const respondToJobOffer = async (offer: YouJobOffer, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToBusinessInvitation(offer.id, decision), 'Impossible de traiter cette offre.');
    toast.success(decision === 'accept' ? 'Offre acceptée' : 'Offre refusée');
    await onReload();
  };

  const respondToMarriage = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToMarriageProposal(proposalId, decision), 'Impossible de traiter la demande.');
    toast.success(decision === 'accept' ? 'Mariage validé' : 'Demande refusée');
    await onReload();
  };

  const respondToDivorce = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToDivorceProposal(proposalId, decision), 'Impossible de traiter la demande de divorce.');
    toast.success(decision === 'accept' ? 'Divorce validé' : 'Divorce refusé');
    await onReload();
  };

  const repayLoan = async (loanId: string, percentage: number) => {
    await withRouteError(() => youApi.borrowerRepayLoan(loanId, percentage), 'Impossible de rembourser ce prêt.');
    toast.success(percentage === 100 ? 'Tentative de remboursement intégral' : `${percentage}% remboursé`);
    await onReload();
  };

  const filtered = tab === 'all' ? feedItems
    : tab === 'biz'    ? feedItems.filter((f) => f.kind === 'job_offer')
    : tab === 'money'  ? feedItems.filter((f) => f.kind === 'active_loan')
    : feedItems.filter((f) => f.kind === 'marriage_proposal' || f.kind === 'divorce_proposal' || f.kind === 'relationship');

  return (
    <div className="you-dash-right-rail border-l border-border/40 px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Fil d'actualité</span>
        {filtered.length > 0 && (
          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{filtered.length}</span>
        )}
      </div>

      {/* Tab strip */}
      <div className="mb-3.5 flex gap-0.5 rounded-xl bg-muted/30 p-0.5">
        {FEED_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all',
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 py-6 text-center text-xs text-muted-foreground">
          Aucun événement récent
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onRespondJobOffer={respondToJobOffer}
              onRespondMarriage={respondToMarriage}
              onRespondDivorce={respondToDivorce}
              onRepayLoan={repayLoan}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Bottom Ticker ----

function DashTicker({ data }: { data: YouState }) {
  const offsetRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const items = useMemo(() => {
    const base = [
      { sym: 'EMP', label: `${data.ownedBusinesses.length} businesses` },
      { sym: 'TRE', label: `${data.ownedBusinesses.reduce((s, b) => s + b.treasuryMoney, 0).toLocaleString('fr-FR')}€ trésorerie` },
      { sym: 'REV', label: `+${data.ownedBusinesses.reduce((s, b) => s + b.monthlyRevenue, 0).toLocaleString('fr-FR')}€ /mois` },
      { sym: 'SOC', label: `${data.relationships.length} relations` },
    ];
    const market = data.shareMarketListings
      .filter((l) => l.status === 'ACTIVE').slice(0, 6)
      .map((l) => ({ sym: l.business.name.slice(0, 5).toUpperCase(), label: `${l.business.name} · ${l.sharePercent}% · ${l.price.toLocaleString('fr-FR')}€` }));
    return [...base, ...market, ...base, ...market];
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => { offsetRef.current = (offsetRef.current + 0.4) % 2400; forceUpdate((n) => n + 1); }, 40);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="you-dash-ticker flex items-center gap-4 overflow-hidden border-t border-border/40 bg-card px-4">
      <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Wallet className="h-3 w-3" />Flux
      </div>
      <div className="h-4 w-px shrink-0 bg-border/40" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-6 whitespace-nowrap" style={{ transform: `translateX(${-offsetRef.current}px)` }}>
          {items.map((item, i) => (
            <div key={i} className="inline-flex items-center gap-2 text-[11px]">
              <span className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{item.sym}</span>
              <span className="text-foreground/80">{item.label}</span>
              <span className="text-muted-foreground/30">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Main Dashboard ----

export function YouDashboard({ data, userId, isAdmin, onReload }: {
  data: YouState;
  userId: string;
  isAdmin: boolean;
  onReload: () => Promise<void>;
}) {
  const carteRef = useRef<CarteTabHandle>(null);
  const [managedBizId, setManagedBizId] = useState<string | null>(null);
  const [productionBizId, setProductionBizId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showBrowserModal, setShowBrowserModal] = useState(false);

  const allBusinesses = useMemo(() => {
    const map = new Map<string, YouBusiness>();
    [data.ownedBusinesses, data.exploreBusinesses, data.memberBusinesses, data.shareholderBusinesses]
      .forEach((g) => g.forEach((b) => map.set(b.id, b)));
    return Array.from(map.values());
  }, [data]);

  const managedBusiness = managedBizId
    ? (data.ownedBusinesses.find((b) => b.id === managedBizId) ??
       data.memberBusinesses.find((b) => b.id === managedBizId) ?? null)
    : null;

  const productionBusiness = productionBizId
    ? (data.ownedBusinesses.find((b) => b.id === productionBizId) ??
       data.memberBusinesses.find((b) => b.id === productionBizId) ?? null)
    : null;

  function handleStartPlacing(id: string) {
    carteRef.current?.startPlacing(id);
  }

  return (
    <>
      <div className="you-dash">
        <DashLeftRail
          data={data}
          currentUserId={userId}
          onManageBiz={setManagedBizId}
          onWorkBiz={setProductionBizId}
          onStartPlacing={handleStartPlacing}
          onOpenBrowser={() => setShowBrowserModal(true)}
          onCreateBusiness={() => setCreateOpen(true)}
        />
        <div className="you-dash-map" data-tutorial-id="you-dashboard-map">
          <CarteTab
            ref={carteRef}
            data={data}
            userId={userId}
            isAdmin={isAdmin}
            onReload={onReload}
            embedded
          />
        </div>
        <DashRightRail data={data} userId={userId} onReload={onReload} />
        <DashTicker data={data} />
      </div>

      <BusinessBrowserModal
        open={showBrowserModal}
        onClose={() => setShowBrowserModal(false)}
        businesses={allBusinesses}
        userId={userId}
        players={data.players}
        onReload={onReload}
      />

      <ManageBusinessModal
        open={Boolean(managedBusiness)}
        onClose={() => setManagedBizId(null)}
        business={managedBusiness}
        players={data.players}
        currentUserId={userId}
        onInviteRequested={() => {}}
        onSubmitted={onReload}
      />

      {productionBusiness && (
        <ProductionModal
          open
          onClose={() => setProductionBizId(null)}
          business={productionBusiness}
          currentUserId={userId}
          onReload={onReload}
        />
      )}
      <CreateBusinessModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        businessTypes={data.businessTypes}
        unlockedBusinessLevel={data.unlockedBusinessLevel ?? 0}
        onCreated={onReload}
      />

    </>
  );
}
