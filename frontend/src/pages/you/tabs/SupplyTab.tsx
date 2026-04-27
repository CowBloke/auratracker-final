import { useState, useRef } from 'react';
import { Plus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { type YouBusiness } from '@/services/api';
import { ManageBusinessModal } from '../components/modals';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Source { id: string; name: string; mine: boolean; rate: number; stock: number; price?: number; }
interface InputMaterial { id: string; type: ResourceType; needed: number; filled: number; source: Source | null; }
interface Project { id: string; kind: 'build' | 'upgrade' | 'goods'; name: string; icon: string; eta: string; inputs: InputMaterial[]; }
interface Demand { id: string; projectName: string; fromName: string; mine: boolean; npc: boolean; status: 'active' | 'pending'; resourceType: ResourceType; needed: number; filled: number; offerPrice?: number; }
interface Business { id: string; name: string; typeKey: string; produces: ResourceType; ratePerHour: number; invUsed: number; invCap: number; demands: Demand[]; }
type Selection = { kind: 'project'; id: string } | { kind: 'business'; id: string } | null;
type Vec2 = { x: number; y: number };
type Positions = Record<string, Vec2>;

// ─── Constants ────────────────────────────────────────────────────────────────

const CARD_SIZE = 116;
const CONN_GAP = 160;
const CARD_GAP = 14;

// ─── Colors / glyphs ─────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  amber: '#f59e0b', slate: '#94a3b8', zinc: '#a1a1aa', green: '#22c55e', rose: '#fb7185',
  gray: '#9ca3af', blue: '#3b82f6', orange: '#f97316', yellow: '#eab308',
  violet: '#8b5cf6', emerald: '#10b981', cyan: '#06b6d4', red: '#ef4444',
};
function resColor(type: ResourceType): string {
  const m = RESOURCE_META[type].iconColor.match(/text-(\w+)-/);
  return COLOR_MAP[m?.[1] ?? 'gray'] ?? '#9ca3af';
}
const GLYPH: Record<ResourceType, string> = {
  WOOD: '▲', STONE: '◆', IRON: '■', FOOD: '✦', CLOTH: '◉',
  CONCRETE: '▣', STEEL: '⬢', FUEL: '◈', PAPER: '▤',
  LUXURY_GOODS: '✧', MEDICINE: '♥', DATA: '⌬', CONTRABAND: '✕',
};
const BIZ_COLOR: Record<string, string> = {
  farm: '#22c55e', sawmill: '#f59e0b', quarry: '#94a3b8', iron_mine: '#a1a1aa',
  fuel_refinery: '#f97316', textile_mill: '#fb7185', restaurant: '#e11d48',
  epicerie: '#84cc16', youtube: '#ef4444', medecins: '#10b981', startup: '#3b82f6',
  agency: '#8b5cf6', bank: '#eab308', law_firm: '#06b6d4',
};
const BIZ_MONO: Record<string, string> = {
  farm: 'FM', sawmill: 'SW', quarry: 'QR', iron_mine: 'IR', fuel_refinery: 'RF',
  textile_mill: 'TX', restaurant: 'RS', epicerie: 'EP', youtube: 'YT',
  medecins: 'MD', startup: 'ST', agency: 'AG', bank: 'BK', law_firm: 'LW',
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const AVAILABLE_SOURCES: Partial<Record<ResourceType, Source[]>> = {
  CONCRETE: [
    { id: 's1', name: 'Cimenterie Pierroux', mine: true, rate: 6, stock: 42 },
    { id: 's2', name: 'Béton du Nord', mine: false, rate: 4, stock: 18, price: 85 },
  ],
  STEEL: [
    { id: 's3', name: 'Aciérie Voss', mine: false, rate: 2, stock: 28, price: 92 },
    { id: 's4', name: 'Aciérie Nord', mine: false, rate: 4, stock: 14, price: 98 },
  ],
  PAPER: [{ id: 's5', name: 'Papeterie Urbaine', mine: false, rate: 4, stock: 60, price: 45 }],
  WOOD: [
    { id: 's6', name: 'Scierie du Nord', mine: true, rate: 8, stock: 120 },
    { id: 's7', name: 'Scierie Vallée', mine: false, rate: 5, stock: 40, price: 30 },
  ],
  STONE: [{ id: 's8', name: 'Carrière Pierroux', mine: true, rate: 7, stock: 180 }],
  IRON: [{ id: 's9', name: 'Mine de Fer Vallée', mine: true, rate: 6, stock: 95 }],
  FOOD: [{ id: 's10', name: 'Ferme de Saint-Clair', mine: true, rate: 10, stock: 280 }],
};

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1', kind: 'build', name: 'Nouvelle banque', icon: 'BK', eta: '~4h 20m',
    inputs: [
      { id: 'i1', type: 'CONCRETE', needed: 40, filled: 28, source: { id: 's1', name: 'Cimenterie Pierroux', mine: true, rate: 6, stock: 42 } },
      { id: 'i2', type: 'STEEL', needed: 20, filled: 12, source: { id: 's3', name: 'Aciérie Voss', mine: false, rate: 2, stock: 28, price: 92 } },
      { id: 'i3', type: 'PAPER', needed: 15, filled: 15, source: { id: 's5', name: 'Papeterie Urbaine', mine: false, rate: 4, stock: 60, price: 45 } },
      { id: 'i4', type: 'WOOD', needed: 25, filled: 0, source: null },
    ],
  },
  {
    id: 'p2', kind: 'upgrade', name: 'Silo · Scierie Nord', icon: '⊕', eta: '~12m',
    inputs: [
      { id: 'i5', type: 'WOOD', needed: 20, filled: 18, source: { id: 's6', name: 'Scierie du Nord', mine: true, rate: 8, stock: 120 } },
      { id: 'i6', type: 'STONE', needed: 10, filled: 8, source: { id: 's8', name: 'Carrière Pierroux', mine: true, rate: 7, stock: 180 } },
    ],
  },
];

const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'b1', name: 'Scierie du Nord', typeKey: 'sawmill', produces: 'WOOD',
    ratePerHour: 8, invUsed: 48, invCap: 120,
    demands: [
      { id: 'd1', projectName: 'Nouvelle banque', fromName: 'toi', mine: true, npc: false, status: 'active', resourceType: 'WOOD', needed: 25, filled: 0 },
      { id: 'd2', projectName: 'Silo · Scierie Nord', fromName: 'toi', mine: true, npc: false, status: 'active', resourceType: 'WOOD', needed: 20, filled: 18 },
      { id: 'd3', projectName: 'Papeterie Dupont', fromName: 'Maxime & Co', mine: false, npc: false, status: 'pending', resourceType: 'WOOD', needed: 30, filled: 0, offerPrice: 32 },
      { id: 'd4', projectName: 'Commande ville', fromName: 'Serveur', mine: false, npc: true, status: 'pending', resourceType: 'WOOD', needed: 15, filled: 0, offerPrice: 28 },
    ],
  },
  {
    id: 'b2', name: 'Ferme de Saint-Clair', typeKey: 'farm', produces: 'FOOD',
    ratePerHour: 10, invUsed: 120, invCap: 200,
    demands: [
      { id: 'd5', projectName: 'Restaurant Chez Auguste', fromName: 'toi', mine: true, npc: false, status: 'active', resourceType: 'FOOD', needed: 50, filled: 22 },
      { id: 'd6', projectName: 'Ravitaillement clan', fromName: 'Clan Ω', mine: false, npc: false, status: 'pending', resourceType: 'FOOD', needed: 80, filled: 0, offerPrice: 14 },
      { id: 'd7', projectName: 'Commande NPC', fromName: 'Serveur', mine: false, npc: true, status: 'pending', resourceType: 'FOOD', needed: 20, filled: 0, offerPrice: 12 },
    ],
  },
];

const MOCK_OWNER = { id: 'mock-user-1', username: 'toi', firstName: null, profilePicture: null, bio: null, aura: 1000, money: 50000 } as const;
const MOCK_YOU_BUSINESSES: YouBusiness[] = INITIAL_BUSINESSES.map((b) => ({
  id: b.id, name: b.name, typeKey: b.typeKey, type: null, ownerId: 'mock-user-1', owner: MOCK_OWNER,
  ownerKind: 'you' as const, verified: true, description: null, logoUrl: null, location: null,
  mapX: null, mapY: null, foundedAt: '2026-01-01T00:00:00.000Z', foundedLabel: 'Janvier 2026',
  hiring: false, startingCapital: 0, treasuryMoney: 0, monthlyRevenue: b.ratePerHour * 720,
  monthlyExpenses: 0, satisfaction: 100, memberCount: 1, level: 1,
  actions: ['deposit', 'withdraw'] as YouBusiness['actions'], members: [], pendingInvitations: [],
  recentLoans: [], recentInvestments: [], shareholders: [], ownerSharePercent: 100,
  isShared: false, viewerSharePercent: 100, viewerInvestedAmount: 0, suggestedShareAmount: 0,
  pendingShareholderProposals: [], transferHistory: [], revenueHistory: [], pendingBuyoutOffers: [],
  startupProducts: [], avgRating: null, ratingCount: 0, ratings: [], canRate: false, isStateOwned: false,
}));

const NEW_PROJECT_OPTIONS = [
  { id: 'bank', kind: 'build' as const, icon: 'BK', name: 'Banque', inputs: [['CONCRETE', 40], ['STEEL', 20], ['PAPER', 15], ['WOOD', 25]] as [ResourceType, number][] },
  { id: 'law', kind: 'build' as const, icon: 'LW', name: "Cabinet d'avocats", inputs: [['WOOD', 30], ['PAPER', 20], ['STONE', 10]] as [ResourceType, number][] },
  { id: 'silo', kind: 'upgrade' as const, icon: '⊕', name: 'Silo (+150 stock)', inputs: [['WOOD', 20], ['STONE', 10]] as [ResourceType, number][] },
  { id: 'cadence', kind: 'upgrade' as const, icon: '⚡', name: 'Cadence +50%', inputs: [['STEEL', 15], ['FUEL', 20]] as [ResourceType, number][] },
  { id: 'warehouse', kind: 'upgrade' as const, icon: '▣', name: 'Entrepôt', inputs: [['CONCRETE', 30], ['STEEL', 10]] as [ResourceType, number][] },
  { id: 'gift', kind: 'goods' as const, icon: '✧', name: 'Boîte cadeau luxe', inputs: [['LUXURY_GOODS', 2], ['PAPER', 1]] as [ResourceType, number][] },
];

// ─── Drag + Pan hook ─────────────────────────────────────────────────────────

function useDragCanvas(initPositions: Positions) {
  const [positions, setPositions] = useState<Positions>(initPositions);
  const [pan, setPan] = useState<Vec2>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Use refs for values needed inside event handlers to avoid stale closures
  const panRef = useRef(pan);
  panRef.current = pan;
  const modeRef = useRef<'idle' | 'card' | 'pan'>('idle');
  const activeIdRef = useRef<string | null>(null);
  const offsetRef = useRef<Vec2>({ x: 0, y: 0 });
  const panStartRef = useRef<Vec2>({ x: 0, y: 0 });
  const panOriginRef = useRef<Vec2>({ x: 0, y: 0 });

  function startDrag(id: string, e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const pos = positions[id] ?? { x: 0, y: 0 };
    // Mouse position in canvas-local coordinates (before pan)
    const mx = e.clientX - rect.left - panRef.current.x;
    const my = e.clientY - rect.top - panRef.current.y;
    offsetRef.current = { x: mx - pos.x, y: my - pos.y };
    modeRef.current = 'card';
    activeIdRef.current = id;
    e.preventDefault();
    e.stopPropagation(); // prevent canvas onMouseDown from firing
  }

  function onCanvasDown(e: React.MouseEvent) {
    if (modeRef.current !== 'idle') return;
    modeRef.current = 'pan';
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { ...panRef.current };
    e.preventDefault();
  }

  function onMove(e: React.MouseEvent) {
    if (modeRef.current === 'card' && activeIdRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const mx = e.clientX - rect.left - panRef.current.x;
      const my = e.clientY - rect.top - panRef.current.y;
      const id = activeIdRef.current;
      setPositions(prev => ({ ...prev, [id]: { x: mx - offsetRef.current.x, y: my - offsetRef.current.y } }));
    } else if (modeRef.current === 'pan') {
      setPan({
        x: panOriginRef.current.x + (e.clientX - panStartRef.current.x),
        y: panOriginRef.current.y + (e.clientY - panStartRef.current.y),
      });
    }
  }

  function stopAll() {
    modeRef.current = 'idle';
    activeIdRef.current = null;
  }

  // Positions adjusted by pan for rendering
  function screenPos(id: string): Vec2 {
    const p = positions[id] ?? { x: 0, y: 0 };
    return { x: p.x + pan.x, y: p.y + pan.y };
  }

  return { positions, pan, canvasRef, startDrag, onCanvasDown, onMove, stopAll, screenPos };
}

// ─── Connectors SVG ───────────────────────────────────────────────────────────

interface Link { from: Vec2; to: Vec2; color: string; active: boolean; }

function Connectors({ links }: { links: Link[] }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
      {links.map((l, i) => {
        const mx = (l.from.x + l.to.x) / 2;
        const path = `M ${l.from.x} ${l.from.y} C ${mx} ${l.from.y}, ${mx} ${l.to.y}, ${l.to.x} ${l.to.y}`;
        return (
          <g key={i}>
            <path d={path} fill="none"
              stroke={l.color} strokeOpacity={l.active ? 0.45 : 0.2}
              strokeDasharray={l.active ? undefined : '5 4'}
              strokeWidth={1.5} strokeLinecap="round" />
            {l.active && (
              <circle r="2.5" fill={l.color} opacity="0.8">
                <animateMotion dur="2.5s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function SourceCard({ inp, pos, onDragStart, onPick }: {
  inp: InputMaterial; pos: Vec2;
  onDragStart: (e: React.MouseEvent) => void;
  onPick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const c = resColor(inp.type);
  const pct = inp.needed ? Math.round(inp.filled / inp.needed * 100) : 0;
  const done = inp.filled >= inp.needed;
  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y, width: CARD_SIZE, zIndex: hovered ? 50 : 10 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="rounded-xl border bg-card overflow-visible cursor-grab active:cursor-grabbing select-none shadow-sm"
        style={{ borderColor: c + '55' }} onMouseDown={onDragStart}>
        <div className="flex flex-col items-center justify-center gap-1.5 p-3" style={{ height: CARD_SIZE }}>
          <span style={{ fontSize: 28, color: c, lineHeight: 1 }}>{GLYPH[inp.type]}</span>
          <p className="text-[10px] font-semibold text-foreground text-center leading-tight line-clamp-2 w-full">
            {inp.source ? inp.source.name : RESOURCE_META[inp.type].label}
          </p>
          <p className="text-[10px] text-muted-foreground">{inp.source ? `${inp.source.rate} u/h` : 'Sans source'}</p>
        </div>
        {hovered && (
          <div className="border-t border-border px-2.5 pb-2.5 pt-2 bg-card rounded-b-xl">
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-muted-foreground">Remplissage</span>
              <span className={done ? 'text-emerald-500' : 'text-foreground'}>{inp.filled}/{inp.needed}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: done ? '#10b981' : c }} />
            </div>
            {inp.source?.stock != null && (
              <p className="mt-1 text-[9px] text-muted-foreground">{inp.source.stock} u en stock</p>
            )}
            <button onMouseDown={e => e.stopPropagation()} onClick={onPick}
              className="mt-1.5 w-full text-[9px] rounded-md border border-border bg-muted/50 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              {inp.source ? 'Changer source' : '+ Choisir source'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GoalCard({ project, pos, onDragStart }: {
  project: Project; pos: Vec2;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const totalNeeded = project.inputs.reduce((s, i) => s + i.needed, 0);
  const totalFilled = project.inputs.reduce((s, i) => s + i.filled, 0);
  const pct = totalNeeded ? Math.round(totalFilled / totalNeeded * 100) : 0;
  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y, width: CARD_SIZE, zIndex: hovered ? 50 : 10 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="rounded-xl border border-border bg-card overflow-visible cursor-grab active:cursor-grabbing select-none shadow-sm"
        onMouseDown={onDragStart}>
        <div className="flex flex-col items-center justify-center gap-1.5 p-3" style={{ height: CARD_SIZE }}>
          <div className="w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-sm font-bold text-foreground">
            {project.icon}
          </div>
          <p className="text-[10px] font-semibold text-foreground text-center leading-tight line-clamp-2 w-full">{project.name}</p>
          <p className="text-xs font-bold text-primary">{pct}%</p>
        </div>
        {hovered && (
          <div className="border-t border-border px-2.5 pb-2.5 pt-2 bg-card rounded-b-xl">
            <div className="h-1 rounded-full bg-muted overflow-hidden mb-1.5">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[9px] text-muted-foreground">ETA: {project.eta}</p>
            <p className="text-[9px] text-muted-foreground">{totalFilled}/{totalNeeded} matériaux</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BizSourceCard({ biz, pos, onDragStart }: {
  biz: Business; pos: Vec2;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const c = BIZ_COLOR[biz.typeKey] ?? '#9ca3af';
  const invPct = Math.round(biz.invUsed / biz.invCap * 100);
  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y, width: CARD_SIZE, zIndex: hovered ? 50 : 10 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="rounded-xl border bg-card overflow-visible cursor-grab active:cursor-grabbing select-none shadow-sm"
        style={{ borderColor: c + '55' }} onMouseDown={onDragStart}>
        <div className="flex flex-col items-center justify-center gap-1.5 p-3" style={{ height: CARD_SIZE }}>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold"
            style={{ background: c + '22', color: c }}>
            {BIZ_MONO[biz.typeKey] ?? '??'}
          </div>
          <p className="text-[10px] font-semibold text-foreground text-center leading-tight line-clamp-2 w-full">{biz.name}</p>
          <p className="text-[10px] text-muted-foreground">{biz.ratePerHour} u/h</p>
        </div>
        {hovered && (
          <div className="border-t border-border px-2.5 pb-2.5 pt-2 bg-card rounded-b-xl">
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-muted-foreground">Inventaire</span>
              <span className="text-foreground">{biz.invUsed}/{biz.invCap}</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${invPct}%`, background: invPct > 85 ? '#f59e0b' : c }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DestCard({ d, pos, onDragStart, onAccept, onReject }: {
  d: Demand; pos: Vec2;
  onDragStart: (e: React.MouseEvent) => void;
  onAccept: () => void; onReject: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = d.needed ? Math.round(d.filled / d.needed * 100) : 0;
  const pending = d.status === 'pending';
  const c = pending ? '#f59e0b' : '#38bdf8';
  return (
    <div className="absolute" style={{ left: pos.x, top: pos.y, width: CARD_SIZE, zIndex: hovered ? 50 : 10 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="rounded-xl border bg-card overflow-visible cursor-grab active:cursor-grabbing select-none shadow-sm"
        style={{ borderColor: c + '44' }} onMouseDown={onDragStart}>
        <div className="flex flex-col items-center justify-center gap-1.5 p-3" style={{ height: CARD_SIZE }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: c + '22', color: c }}>
            {d.npc ? '⚙' : d.mine ? '★' : d.fromName[0]}
          </div>
          <p className="text-[10px] font-semibold text-foreground text-center leading-tight line-clamp-2 w-full">{d.projectName}</p>
          <p className="text-[10px] text-muted-foreground">{d.needed}u{d.offerPrice ? ` · ${d.offerPrice}₽/u` : ''}</p>
        </div>
        {hovered && (
          <div className="border-t border-border px-2.5 pb-2.5 pt-2 bg-card rounded-b-xl">
            {!pending ? (
              <>
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="text-muted-foreground">Remplissage</span>
                  <span className="text-foreground">{d.filled}/{d.needed}</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
                </div>
              </>
            ) : (
              <div className="flex gap-1.5">
                <button onMouseDown={e => e.stopPropagation()} onClick={onReject}
                  className="flex-1 text-[9px] rounded-md border border-border bg-muted/50 py-1 text-muted-foreground hover:bg-muted transition-colors">
                  Refuser
                </button>
                <button onMouseDown={e => e.stopPropagation()} onClick={onAccept}
                  className="flex-1 text-[9px] rounded-md bg-primary py-1 text-primary-foreground hover:bg-primary/90 transition-colors">
                  Accepter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function PickSourceModal({ type, onClose, onPick }: {
  type: ResourceType; onClose: () => void; onPick: (src: Source) => void;
}) {
  const candidates = AVAILABLE_SOURCES[type] ?? [];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[400px] max-w-[90vw] rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Source · <span style={{ color: resColor(type) }}>{GLYPH[type]}</span> {RESOURCE_META[type].label}
          </p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">×</button>
        </div>
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">Aucune source disponible.</p>
        ) : (
          <div className="space-y-2">
            {candidates.map(c => (
              <button key={c.id} onClick={() => { onPick(c); onClose(); }}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-left hover:bg-muted transition-colors">
                <div className="w-7 h-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                  {c.mine ? '★' : c.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-foreground">{c.name}</p>
                    {c.mine && <span className="text-[9px] text-primary border border-primary/30 rounded-full px-1.5 py-0.5 shrink-0">à toi</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{c.stock} u · {c.rate} u/h</p>
                </div>
                <p className="font-mono text-sm font-bold shrink-0" style={{ color: c.mine ? '#10b981' : '#f59e0b' }}>
                  {c.mine ? 'gratuit' : `${c.price}₽`}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }: {
  onClose: () => void; onCreate: (opt: typeof NEW_PROJECT_OPTIONS[0]) => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[500px] max-w-[90vw] rounded-xl border border-border bg-card p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Nouveau projet</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none px-1">×</button>
        </div>
        {(['build', 'upgrade', 'goods'] as const).map(kind => {
          const opts = NEW_PROJECT_OPTIONS.filter(o => o.kind === kind);
          const label = kind === 'build' ? 'Nouvelle entreprise' : kind === 'upgrade' ? 'Amélioration' : 'Lot de biens';
          return (
            <div key={kind} className="mb-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
              <div className="grid grid-cols-2 gap-2">
                {opts.map(opt => (
                  <button key={opt.id} onClick={() => { onCreate(opt); onClose(); }}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2.5 text-left hover:bg-muted transition-colors">
                    <div className="w-8 h-8 shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center font-mono text-xs font-bold text-foreground">
                      {opt.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{opt.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {opt.inputs.map(([t, q]) => `${q} ${RESOURCE_META[t as ResourceType].label}`).join(', ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Canvases ─────────────────────────────────────────────────────────────────

function ProjectCanvas({ project }: { project: Project }) {
  const [inputs, setInputs] = useState<InputMaterial[]>(project.inputs);
  const [pickingId, setPickingId] = useState<string | null>(null);

  const initPos: Positions = {};
  project.inputs.forEach((inp, i) => {
    initPos[`src-${inp.id}`] = { x: 24, y: 24 + i * (CARD_SIZE + CARD_GAP) };
  });
  const totalH = project.inputs.length * (CARD_SIZE + CARD_GAP) - CARD_GAP;
  initPos['goal'] = { x: 24 + CARD_SIZE + CONN_GAP, y: Math.max(0, (totalH - CARD_SIZE) / 2) + 24 };

  const { pan, canvasRef, startDrag, onCanvasDown, onMove, stopAll, screenPos } = useDragCanvas(initPos);

  const goalSP = screenPos('goal');
  const links: Link[] = inputs.map(inp => {
    const sp = screenPos(`src-${inp.id}`);
    return {
      from: { x: sp.x + CARD_SIZE, y: sp.y + CARD_SIZE / 2 },
      to: { x: goalSP.x, y: goalSP.y + CARD_SIZE / 2 },
      color: inp.source ? resColor(inp.type) : '#555',
      active: !!inp.source,
    };
  });

  const pickingInput = inputs.find(i => i.id === pickingId);

  return (
    <div ref={canvasRef} className="relative flex-1 overflow-hidden"
      style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.7) 1px, transparent 1px)', backgroundSize: '24px 24px', backgroundPosition: `${pan.x % 24}px ${pan.y % 24}px`, cursor: 'default' }}
      onMouseDown={onCanvasDown} onMouseMove={onMove} onMouseUp={stopAll} onMouseLeave={stopAll}>
      <Connectors links={links} />
      {inputs.map(inp => (
        <SourceCard key={inp.id} inp={inp}
          pos={screenPos(`src-${inp.id}`)}
          onDragStart={e => startDrag(`src-${inp.id}`, e)}
          onPick={() => setPickingId(inp.id)} />
      ))}
      <GoalCard project={{ ...project, inputs }} pos={goalSP}
        onDragStart={e => startDrag('goal', e)} />
      {pickingInput && (
        <PickSourceModal type={pickingInput.type}
          onClose={() => setPickingId(null)}
          onPick={src => { setInputs(prev => prev.map(i => i.id === pickingId ? { ...i, source: src } : i)); setPickingId(null); }} />
      )}
    </div>
  );
}

function BusinessCanvas({ biz }: { biz: Business }) {
  const [demands, setDemands] = useState<Demand[]>(biz.demands);

  const initPos: Positions = {};
  initPos['src-biz'] = { x: 24, y: 24 };
  demands.forEach((d, i) => {
    initPos[`dest-${d.id}`] = { x: 24 + CARD_SIZE + CONN_GAP, y: 24 + i * (CARD_SIZE + CARD_GAP) };
  });

  const { pan, canvasRef, startDrag, onCanvasDown, onMove, stopAll, screenPos } = useDragCanvas(initPos);

  const srcSP = screenPos('src-biz');
  const links: Link[] = demands.map(d => {
    const dp = screenPos(`dest-${d.id}`);
    return {
      from: { x: srcSP.x + CARD_SIZE, y: srcSP.y + CARD_SIZE / 2 },
      to: { x: dp.x, y: dp.y + CARD_SIZE / 2 },
      color: d.status === 'pending' ? '#f59e0b' : '#38bdf8',
      active: d.status === 'active',
    };
  });

  return (
    <div ref={canvasRef} className="relative flex-1 overflow-hidden"
      style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.7) 1px, transparent 1px)', backgroundSize: '24px 24px', backgroundPosition: `${pan.x % 24}px ${pan.y % 24}px`, cursor: 'default' }}
      onMouseDown={onCanvasDown} onMouseMove={onMove} onMouseUp={stopAll} onMouseLeave={stopAll}>
      <Connectors links={links} />
      <BizSourceCard biz={biz} pos={srcSP} onDragStart={e => startDrag('src-biz', e)} />
      {demands.map(d => (
        <DestCard key={d.id} d={d}
          pos={screenPos(`dest-${d.id}`)}
          onDragStart={e => startDrag(`dest-${d.id}`, e)}
          onAccept={() => setDemands(prev => prev.map(x => x.id === d.id ? { ...x, status: 'active' as const } : x))}
          onReject={() => setDemands(prev => prev.filter(x => x.id !== d.id))} />
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ projects, businesses, selection, onSelect, onNewProject }: {
  projects: Project[]; businesses: Business[];
  selection: Selection; onSelect: (s: Selection) => void; onNewProject: () => void;
}) {
  return (
    <nav className="w-44 shrink-0 flex flex-col gap-0.5 border-r border-border px-2 py-2 overflow-y-auto">
      <button onClick={onNewProject}
        className="mb-2 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <Plus size={11} /> Nouveau projet
      </button>
      <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">Projets</p>
      {projects.map(p => {
        const isActive = selection?.kind === 'project' && selection.id === p.id;
        const totalNeeded = p.inputs.reduce((s, i) => s + i.needed, 0);
        const totalFilled = p.inputs.reduce((s, i) => s + i.filled, 0);
        const pct = totalNeeded ? Math.round(totalFilled / totalNeeded * 100) : 0;
        return (
          <button key={p.id} onClick={() => onSelect({ kind: 'project', id: p.id })}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
              isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md border border-border bg-muted font-mono text-[10px] font-bold text-foreground/70">
              {p.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{p.name}</p>
              <div className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </button>
        );
      })}
      <p className="px-1 pt-3 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">Entreprises</p>
      {businesses.map(b => {
        const isActive = selection?.kind === 'business' && selection.id === b.id;
        const c = BIZ_COLOR[b.typeKey] ?? '#9ca3af';
        const pendingCount = b.demands.filter(d => d.status === 'pending').length;
        return (
          <button key={b.id} onClick={() => onSelect({ kind: 'business', id: b.id })}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
              isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md font-mono text-[10px] font-bold"
              style={{ background: c + '22', color: c }}>
              {BIZ_MONO[b.typeKey] ?? '??'}
            </div>
            <p className="truncate text-[11px] font-medium flex-1">{b.name}</p>
            {pendingCount > 0 && (
              <span className="w-4 h-4 shrink-0 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function OffersPanel({ businesses, onAccept, onReject }: {
  businesses: Business[];
  onAccept: (bizId: string, demandId: string) => void;
  onReject: (bizId: string, demandId: string) => void;
}) {
  const offers = businesses.flatMap(b =>
    b.demands.filter(d => d.status === 'pending').map(d => ({ ...d, bizName: b.name, bizId: b.id }))
  );
  return (
    <div className="w-52 shrink-0 flex flex-col border-l border-border overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <p className="text-xs font-semibold text-foreground">Offres entrantes</p>
        <p className="text-[10px] text-muted-foreground">{offers.length} en attente</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {offers.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-[11px] text-muted-foreground">Aucune offre</p>
          </div>
        ) : offers.map(d => (
          <div key={d.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center text-[9px] font-bold text-amber-400">
                {d.npc ? '⚙' : d.fromName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate">{d.projectName}</p>
                <p className="text-[9px] text-muted-foreground truncate">{d.bizName}</p>
              </div>
              {d.offerPrice && (
                <span className="text-[10px] font-mono font-bold text-emerald-500 shrink-0">{d.offerPrice}₽</span>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground mb-2">{d.needed}u de {RESOURCE_META[d.resourceType].label}</p>
            <div className="flex gap-1.5">
              <button onClick={() => onReject(d.bizId, d.id)}
                className="flex-1 text-[9px] rounded-md border border-border bg-muted/50 py-1 text-muted-foreground hover:bg-muted transition-colors">
                Refuser
              </button>
              <button onClick={() => onAccept(d.bizId, d.id)}
                className="flex-1 text-[9px] rounded-md bg-primary py-1 text-primary-foreground hover:bg-primary/90 transition-colors">
                Accepter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SupplyTab() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [businesses, setBusinesses] = useState<Business[]>(INITIAL_BUSINESSES);
  const [selection, setSelection] = useState<Selection>({ kind: 'project', id: 'p1' });
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [managingBizId, setManagingBizId] = useState<string | null>(null);

  const managingBiz = managingBizId ? (MOCK_YOU_BUSINESSES.find(b => b.id === managingBizId) ?? null) : null;
  const activeProject = selection?.kind === 'project' ? projects.find(p => p.id === selection.id) : null;
  const activeBiz = selection?.kind === 'business' ? businesses.find(b => b.id === selection.id) : null;

  function handleAccept(bizId: string, demandId: string) {
    setBusinesses(prev => prev.map(b => b.id === bizId
      ? { ...b, demands: b.demands.map(d => d.id === demandId ? { ...d, status: 'active' as const } : d) }
      : b));
  }
  function handleReject(bizId: string, demandId: string) {
    setBusinesses(prev => prev.map(b => b.id === bizId
      ? { ...b, demands: b.demands.filter(d => d.id !== demandId) }
      : b));
  }

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden bg-background text-foreground">
      <Sidebar projects={projects} businesses={businesses}
        selection={selection} onSelect={setSelection}
        onNewProject={() => setNewProjectOpen(true)} />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <div className="flex items-center gap-3 border-b border-border px-4 shrink-0 h-10">
          <p className="text-sm font-medium text-foreground">
            {activeProject ? activeProject.name : activeBiz ? activeBiz.name : 'Approvisionnement'}
          </p>
          {activeProject && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {activeProject.kind === 'build' ? 'Construction' : activeProject.kind === 'upgrade' ? 'Amélioration' : 'Lot'}
            </span>
          )}
          {activeBiz && (
            <button onClick={() => setManagingBizId(activeBiz.id)}
              className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Settings size={11} /> Gérer
            </button>
          )}
        </div>

        {activeProject && <ProjectCanvas key={activeProject.id} project={activeProject} />}
        {activeBiz && <BusinessCanvas key={activeBiz.id} biz={activeBiz} />}
        {!activeProject && !activeBiz && (
          <div className="flex flex-1 items-center justify-center"
            style={{ backgroundImage: 'radial-gradient(circle, hsl(var(--border) / 0.7) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <p className="text-sm text-muted-foreground">Sélectionne un projet ou une entreprise.</p>
          </div>
        )}
      </div>

      <OffersPanel businesses={businesses} onAccept={handleAccept} onReject={handleReject} />

      {newProjectOpen && (
        <NewProjectModal onClose={() => setNewProjectOpen(false)}
          onCreate={opt => {
            const id = `p${Date.now()}`;
            setProjects(prev => [...prev, {
              id, kind: opt.kind, name: opt.name, icon: opt.icon, eta: 'calcul en cours…',
              inputs: opt.inputs.map(([type, needed], idx) => ({ id: `${id}-i${idx}`, type, needed, filled: 0, source: null })),
            }]);
            setSelection({ kind: 'project', id });
          }} />
      )}

      <ManageBusinessModal open={Boolean(managingBiz)} onClose={() => setManagingBizId(null)}
        business={managingBiz} players={[]} currentUserId="mock-user-1"
        onInviteRequested={() => {}} onSubmitted={async () => {}} />
    </div>
  );
}
