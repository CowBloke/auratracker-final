import { useMemo, useRef, useEffect, useState } from 'react';
import {
  Brain, Building2, ShieldAlert, Star, TrendingUp, Users,
  Wallet, MapPin, AlertTriangle, ChevronDown, ChevronRight, Plus,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationContext';
import { cn } from '@/lib/utils';
import { type YouState, type YouSkill, type YouJobOffer, type YouBusiness, youApi } from '@/services/api';
import { CreateBusinessModal, ManageBusinessModal } from './components/modals';
import { BUSINESS_ICON_MAP } from './constants';
import { getBusinessPinColor, TYPE_EMOJI } from './mapConstants';
import { isYouNotification, withRouteError } from './utils';
import { FeedCard } from './components/ui';
import { type FeedItem } from './types';
import { CarteTab, type CarteTabHandle } from './tabs/CarteTab';
import './dashboard.css';

// ---- Skill color maps ----

const SKILL_COLOR_MAP: Record<YouSkill['color'], { icon: string; text: string }> = {
  emerald: { icon: 'text-emerald-400', text: 'text-emerald-400' },
  purple:  { icon: 'text-purple-400',  text: 'text-purple-400'  },
  sky:     { icon: 'text-sky-400',     text: 'text-sky-400'     },
  pink:    { icon: 'text-pink-400',    text: 'text-pink-400'    },
  amber:   { icon: 'text-amber-400',   text: 'text-amber-400'   },
  rose:    { icon: 'text-rose-400',    text: 'text-rose-400'    },
};


const SKILL_HSL_MAP: Record<YouSkill['color'], string> = {
  emerald: '152 69% 52%',
  purple:  '280 93% 75%',
  sky:     '198 93% 60%',
  pink:    '330 86% 70%',
  amber:   '43 96% 56%',
  rose:    '351 95% 71%',
};

const SKILL_ICON_MAP: Record<string, typeof Brain> = {
  affaires: Building2,
  social: Users,
  intelligence: Brain,
  charisme: Star,
  finance: TrendingUp,
  illegalite: ShieldAlert,
};

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

function OwnedBizTile({ b, onManage, onStartPlacing }: {
  b: YouBusiness;
  onManage: () => void;
  onStartPlacing: (id: string) => void;
}) {
  const Icon = BUSINESS_ICON_MAP[b.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const color = getBusinessPinColor(b.typeKey);
  const net = b.monthlyRevenue - b.monthlyExpenses;
  const isUnplaced = b.mapX == null || b.mapY == null;
  const sparkData = (b.revenueHistory ?? []).slice(-30);

  return (
    <div className="rounded-xl border border-border/40 bg-card transition-all hover:border-border">
      {/* Placement warning */}
      {isUnplaced && (
        <div className="flex items-center gap-2 rounded-t-xl border-b border-amber-400/20 bg-amber-400/8 px-3 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
          <span className="min-w-0 flex-1 text-[10px] text-amber-400">Non placé sur la carte</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartPlacing(b.id); }}
            className="flex shrink-0 items-center gap-1 rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-400/25"
          >
            <MapPin className="h-2.5 w-2.5" />
            Placer
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
            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Net /mois</div>
            <div className={cn('text-[12px] font-semibold tabular-nums', net >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {net >= 0 ? '+' : ''}{net.toLocaleString('fr-FR')}€
            </div>
          </div>
        </div>
        <Sparkline data={sparkData} color={color} />
      </button>
    </div>
  );
}

// ---- Other business row ----

function OtherBizRow({ b, onSelect, isSelected }: {
  b: YouState['exploreBusinesses'][number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const emoji = TYPE_EMOJI[b.typeKey] ?? '📍';
  const color = getBusinessPinColor(b.typeKey);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
        isSelected ? 'bg-muted/30' : 'hover:bg-muted/20',
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm" style={{ background: `${color}22` }}>
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium">{b.name}</div>
        <div className="truncate text-[10px] text-muted-foreground">@{b.owner.username} · {b.type?.label ?? b.typeKey}</div>
      </div>
      <div className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{b.treasuryMoney.toLocaleString('fr-FR')}€</div>
    </button>
  );
}

// ---- Skill cell ----

function SkillCell({ skill }: { skill: YouSkill }) {
  const Icon = SKILL_ICON_MAP[skill.key] ?? Building2;
  const theme = SKILL_COLOR_MAP[skill.color] ?? SKILL_COLOR_MAP.amber;
  const pct = Math.min(100, Math.round((skill.xp / skill.maxXp) * 100));

  return (
    <div title={`${skill.label} · Niv. ${skill.level}`} className="flex cursor-pointer flex-col items-center rounded-xl border border-border/40 bg-card p-[10px_8px] transition-colors hover:bg-muted/30">
      <div
        className="relative mb-1.5 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(hsl(${SKILL_HSL_MAP[skill.color] ?? '43 96% 56%'}) ${pct}%, hsl(var(--muted) / 0.35) 0)` }}
      >
        <div className="absolute inset-[3px] flex items-center justify-center rounded-full" style={{ background: 'hsl(var(--card))' }}>
          <Icon className={cn('h-4 w-4', theme.icon)} />
        </div>
      </div>
      <div className={cn('text-[11px] font-bold tabular-nums', theme.text)}>Niv. {skill.level}</div>
      <div className="text-[9px] text-muted-foreground">{skill.label}</div>
    </div>
  );
}

// ---- Left Rail ----

function DashLeftRail({ data, onManageBiz, onStartPlacing, onCreateBusiness }: {
  data: YouState;
  onManageBiz: (id: string) => void;
  onStartPlacing: (id: string) => void;
  onCreateBusiness: () => void;
}) {
  const [showAllOthers, setShowAllOthers] = useState(false);
  const owned = data.ownedBusinesses;
  const others = useMemo(() => {
    const ownedIds = new Set(owned.map((b) => b.id));
    return [...data.exploreBusinesses, ...data.memberBusinesses, ...data.shareholderBusinesses]
      .filter((b) => !ownedIds.has(b.id))
      .reduce<typeof data.exploreBusinesses>((acc, b) => {
        if (!acc.some((x) => x.id === b.id)) acc.push(b);
        return acc;
      }, []);
  }, [data, owned]);

  const previewOtherIdx = useMemo(() => (others.length > 0 ? Math.floor(Math.random() * others.length) : 0), [others.length]);
  const canCreate = owned.length < data.businessSlots;

  const totalTreasury = owned.reduce((s, b) => s + b.treasuryMoney, 0);
  const totalNet = owned.reduce((s, b) => s + b.monthlyRevenue - b.monthlyExpenses, 0);

  return (
    <div className="you-dash-left-rail border-r border-border/40 px-3 py-4">
      {/* Empire header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Ton empire</span>
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
        </div>
      )}

      <div className="mb-1.5 space-y-2">
        {owned.map((b) => (
          <OwnedBizTile
            key={b.id}
            b={b}
            onManage={() => onManageBiz(b.id)}
            onStartPlacing={onStartPlacing}
          />
        ))}
        {owned.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/40 py-6 text-center text-xs text-muted-foreground">
            Aucun business pour le moment
          </div>
        )}
      </div>

      {/* Create button */}
      {canCreate && (
        <button
          type="button"
          onClick={onCreateBusiness}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un business
        </button>
      )}

      {/* Other businesses — one preview + expand */}
      {others.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            <span>Autres businesses</span>
            <span className="rounded-full bg-muted/50 px-2 py-0.5 font-medium text-muted-foreground">{others.length}</span>
          </div>
          <div className="rounded-xl border border-border/40 bg-card">
            <OtherBizRow
              key={others[previewOtherIdx]?.id}
              b={others[previewOtherIdx]}
              isSelected={false}
              onSelect={() => {}}
            />
            {showAllOthers && others.filter((_, i) => i !== previewOtherIdx).slice(0, 19).map((b) => (
              <OtherBizRow key={b.id} b={b} isSelected={false} onSelect={() => {}} />
            ))}
          </div>
          {others.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAllOthers((v) => !v)}
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              {showAllOthers
                ? <><ChevronDown className="h-3 w-3" /> Réduire</>
                : <><Plus className="h-3 w-3" /> {others.length - 1} autre{others.length > 2 ? 's' : ''}</>}
            </button>
          )}
        </div>
      )}

      {/* Skills */}
      <div className="mt-5">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Compétences</div>
        <div className="grid grid-cols-3 gap-1.5">
          {data.skills.map((sk) => <SkillCell key={sk.key} skill={sk} />)}
        </div>
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
  const [createOpen, setCreateOpen] = useState(false);

  const managedBusiness = managedBizId
    ? (data.ownedBusinesses.find((b) => b.id === managedBizId) ?? null)
    : null;

  function handleStartPlacing(id: string) {
    carteRef.current?.startPlacing(id);
  }

  return (
    <>
      <div className="you-dash">
        <DashLeftRail
          data={data}
          onManageBiz={setManagedBizId}
          onStartPlacing={handleStartPlacing}
          onCreateBusiness={() => setCreateOpen(true)}
        />
        <div className="you-dash-map">
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

      <ManageBusinessModal
        open={Boolean(managedBusiness)}
        onClose={() => setManagedBizId(null)}
        business={managedBusiness}
        players={data.players}
        currentUserId={userId}
        onInviteRequested={() => {}}
        onSubmitted={onReload}
      />
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
