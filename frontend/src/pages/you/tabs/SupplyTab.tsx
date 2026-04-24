import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Source {
  id: string;
  name: string;
  mine: boolean;
  rate: number;
  stock: number;
  price?: number;
}

interface InputMaterial {
  id: string;
  type: ResourceType;
  needed: number;
  filled: number;
  source: Source | null;
}

interface Project {
  id: string;
  kind: 'build' | 'upgrade' | 'goods';
  name: string;
  icon: string;
  eta: string;
  inputs: InputMaterial[];
}

interface Demand {
  id: string;
  projectName: string;
  fromName: string;
  mine: boolean;
  npc: boolean;
  status: 'active' | 'pending';
  resourceType: ResourceType;
  needed: number;
  filled: number;
  offerPrice?: number;
}

interface Business {
  id: string;
  name: string;
  typeKey: string;
  produces: ResourceType;
  ratePerHour: number;
  invUsed: number;
  invCap: number;
  demands: Demand[];
}

type Selection = { kind: 'project'; id: string } | { kind: 'business'; id: string } | null;

// ─── Mock data ────────────────────────────────────────────────────────────────

const AVAILABLE_SOURCES: Partial<Record<ResourceType, Source[]>> = {
  CONCRETE: [
    { id: 's1', name: 'Cimenterie Pierroux', mine: true,  rate: 6, stock: 42 },
    { id: 's2', name: 'Béton du Nord',        mine: false, rate: 4, stock: 18, price: 85 },
  ],
  STEEL: [
    { id: 's3', name: 'Aciérie Voss',  mine: false, rate: 2, stock: 28, price: 92 },
    { id: 's4', name: 'Aciérie Nord',  mine: false, rate: 4, stock: 14, price: 98 },
  ],
  PAPER: [
    { id: 's5', name: 'Papeterie Urbaine', mine: false, rate: 4, stock: 60, price: 45 },
  ],
  WOOD: [
    { id: 's6', name: 'Scierie du Nord',  mine: true,  rate: 8, stock: 120 },
    { id: 's7', name: 'Scierie Vallée',   mine: false, rate: 5, stock: 40, price: 30 },
  ],
  STONE: [
    { id: 's8', name: 'Carrière Pierroux', mine: true, rate: 7, stock: 180 },
  ],
  IRON: [
    { id: 's9', name: 'Mine de Fer Vallée', mine: true, rate: 6, stock: 95 },
  ],
  FOOD: [
    { id: 's10', name: 'Ferme de Saint-Clair', mine: true, rate: 10, stock: 280 },
  ],
};

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1', kind: 'build', name: 'Nouvelle banque', icon: 'BK', eta: '~4h 20m',
    inputs: [
      { id: 'i1', type: 'CONCRETE', needed: 40, filled: 28, source: { id: 's1', name: 'Cimenterie Pierroux', mine: true, rate: 6, stock: 42 } },
      { id: 'i2', type: 'STEEL',    needed: 20, filled: 12, source: { id: 's3', name: 'Aciérie Voss',        mine: false, rate: 2, stock: 28, price: 92 } },
      { id: 'i3', type: 'PAPER',    needed: 15, filled: 15, source: { id: 's5', name: 'Papeterie Urbaine',   mine: false, rate: 4, stock: 60, price: 45 } },
      { id: 'i4', type: 'WOOD',     needed: 25, filled: 0,  source: null },
    ],
  },
  {
    id: 'p2', kind: 'upgrade', name: 'Silo · Scierie Nord', icon: '⊕', eta: '~12m',
    inputs: [
      { id: 'i5', type: 'WOOD',  needed: 20, filled: 18, source: { id: 's6', name: 'Scierie du Nord',   mine: true, rate: 8, stock: 120 } },
      { id: 'i6', type: 'STONE', needed: 10, filled: 8,  source: { id: 's8', name: 'Carrière Pierroux', mine: true, rate: 7, stock: 180 } },
    ],
  },
];

const INITIAL_BUSINESSES: Business[] = [
  {
    id: 'b1', name: 'Scierie du Nord', typeKey: 'sawmill', produces: 'WOOD',
    ratePerHour: 8, invUsed: 48, invCap: 120,
    demands: [
      { id: 'd1', projectName: 'Nouvelle banque',    fromName: 'toi',         mine: true,  npc: false, status: 'active',  resourceType: 'WOOD', needed: 25, filled: 0 },
      { id: 'd2', projectName: 'Silo · Scierie Nord', fromName: 'toi',        mine: true,  npc: false, status: 'active',  resourceType: 'WOOD', needed: 20, filled: 18 },
      { id: 'd3', projectName: 'Papeterie Dupont',   fromName: 'Maxime & Co', mine: false, npc: false, status: 'pending', resourceType: 'WOOD', needed: 30, filled: 0, offerPrice: 32 },
      { id: 'd4', projectName: 'Commande ville',     fromName: 'Serveur',     mine: false, npc: true,  status: 'pending', resourceType: 'WOOD', needed: 15, filled: 0, offerPrice: 28 },
    ],
  },
  {
    id: 'b2', name: 'Ferme de Saint-Clair', typeKey: 'farm', produces: 'FOOD',
    ratePerHour: 10, invUsed: 120, invCap: 200,
    demands: [
      { id: 'd5', projectName: 'Restaurant Chez Auguste', fromName: 'toi',    mine: true,  npc: false, status: 'active',  resourceType: 'FOOD', needed: 50, filled: 22 },
      { id: 'd6', projectName: 'Ravitaillement clan',     fromName: 'Clan Ω', mine: false, npc: false, status: 'pending', resourceType: 'FOOD', needed: 80, filled: 0, offerPrice: 14 },
      { id: 'd7', projectName: 'Commande NPC',            fromName: 'Serveur', mine: false, npc: true, status: 'pending', resourceType: 'FOOD', needed: 20, filled: 0, offerPrice: 12 },
    ],
  },
];

const NEW_PROJECT_OPTIONS = [
  { id: 'bank',      kind: 'build'   as const, icon: 'BK', name: 'Banque',             inputs: [['CONCRETE',40],['STEEL',20],['PAPER',15],['WOOD',25]] as [ResourceType,number][] },
  { id: 'law',       kind: 'build'   as const, icon: 'LW', name: "Cabinet d'avocats",  inputs: [['WOOD',30],['PAPER',20],['STONE',10]] as [ResourceType,number][] },
  { id: 'silo',      kind: 'upgrade' as const, icon: '⊕',  name: 'Silo (+150 stock)',  inputs: [['WOOD',20],['STONE',10]] as [ResourceType,number][] },
  { id: 'cadence',   kind: 'upgrade' as const, icon: '⚡', name: 'Cadence +50%',       inputs: [['STEEL',15],['FUEL',20]] as [ResourceType,number][] },
  { id: 'warehouse', kind: 'upgrade' as const, icon: '▣',  name: 'Entrepôt',           inputs: [['CONCRETE',30],['STEEL',10]] as [ResourceType,number][] },
  { id: 'gift',      kind: 'goods'   as const, icon: '✧',  name: 'Boîte cadeau luxe',  inputs: [['LUXURY_GOODS',2],['PAPER',1]] as [ResourceType,number][] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  amber:'#f59e0b', slate:'#94a3b8', zinc:'#a1a1aa', green:'#22c55e', rose:'#fb7185',
  gray:'#9ca3af', blue:'#3b82f6', orange:'#f97316', yellow:'#eab308',
  violet:'#8b5cf6', emerald:'#10b981', cyan:'#06b6d4', red:'#ef4444',
};

function resColor(type: ResourceType): string {
  const match = RESOURCE_META[type].iconColor.match(/text-(\w+)-/);
  return COLOR_MAP[match?.[1] ?? 'gray'] ?? '#9ca3af';
}

const GLYPH: Record<ResourceType, string> = {
  WOOD:'▲', STONE:'◆', IRON:'■', FOOD:'✦', CLOTH:'◉',
  CONCRETE:'▣', STEEL:'⬢', FUEL:'◈', PAPER:'▤',
  LUXURY_GOODS:'✧', MEDICINE:'♥', DATA:'⌬', CONTRABAND:'✕',
};

const BIZ_MONO: Record<string, string> = {
  farm:'FM', sawmill:'SW', quarry:'QR', iron_mine:'IR', fuel_refinery:'RF',
  textile_mill:'TX', restaurant:'RS', epicerie:'EP', youtube:'YT',
  medecins:'MD', startup:'ST', agency:'AG', bank:'BK', law_firm:'LW',
};

function ResChip({ type, label }: { type: ResourceType; label?: string }) {
  const c = resColor(type);
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{ borderColor: c + '50', background: c + '20', color: c }}>
      <span className="font-bold">{GLYPH[type]}</span>
      <span>{label ?? RESOURCE_META[type].label}</span>
    </span>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (opt: typeof NEW_PROJECT_OPTIONS[0]) => void;
}) {
  const sections = [
    { key: 'build'   as const, label: 'Nouvelle entreprise', color: 'text-sky-300' },
    { key: 'upgrade' as const, label: 'Amélioration',        color: 'text-violet-300' },
    { key: 'goods'   as const, label: 'Lot de biens',        color: 'text-amber-300' },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-[580px] max-w-[90vw] rounded-2xl border border-white/15 bg-[#0f1115] p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/40">Nouveau projet</p>
            <p className="text-base font-semibold text-white">Que veux-tu construire ?</p>
          </div>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/5 text-xl leading-none">
            ×
          </button>
        </div>
        {sections.map(sec => (
          <div key={sec.key} className="mb-4">
            <p className={cn('mb-2 text-[10px] uppercase tracking-[0.16em]', sec.color)}>{sec.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {NEW_PROJECT_OPTIONS.filter(o => o.kind === sec.key).map(opt => (
                <button key={opt.id}
                  onClick={() => { onCreate(opt); onClose(); }}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:bg-white/5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-sm font-bold text-white/70">
                    {opt.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{opt.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {opt.inputs.map(([t, q]) => (
                        <ResChip key={t} type={t} label={String(q)} />
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pick Source Modal ────────────────────────────────────────────────────────

function PickSourceModal({ type, onClose, onPick }: {
  type: ResourceType;
  onClose: () => void;
  onPick: (src: Source) => void;
}) {
  const candidates = AVAILABLE_SOURCES[type] ?? [];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-[460px] max-w-[90vw] rounded-2xl border border-white/15 bg-[#0f1115] p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <ResChip type={type} />
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/40">Choisir une source</p>
            <p className="text-sm font-semibold text-white">
              Qui te fournit en {RESOURCE_META[type].label} ?
            </p>
          </div>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-white/50 hover:bg-white/5 text-xl leading-none">
            ×
          </button>
        </div>
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-white/40">
            Aucune source disponible pour cette ressource.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map(c => (
              <button key={c.id}
                onClick={() => { onPick(c); onClose(); }}
                className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:bg-white/5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-200">
                  {c.mine ? '★' : c.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-white">{c.name}</p>
                    {c.mine && (
                      <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">
                        à toi
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-white/50">{c.stock} u en stock · {c.rate} u/h</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold tabular-nums"
                    style={{ color: c.mine ? '#34d399' : '#f59e0b' }}>
                    {c.mine ? 'gratuit' : `${c.price} ₽/u`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-center text-[10px] text-white/30">Tu peux changer de source à tout moment.</p>
      </div>
    </div>
  );
}

// ─── Project Graph View ───────────────────────────────────────────────────────

const INPUT_H = 116;
const INPUT_GAP = 10;
const CONN_W = 160;

function ProjectConnectors({ inputs }: { inputs: InputMaterial[] }) {
  const totalH = inputs.length * (INPUT_H + INPUT_GAP) - INPUT_GAP;
  const destY = totalH / 2;

  return (
    <svg viewBox={`0 0 ${CONN_W} ${totalH}`} width={CONN_W} height={totalH}
      className="block shrink-0" style={{ minHeight: totalH }}>
      {inputs.map((inp, i) => {
        const inputY = i * (INPUT_H + INPUT_GAP) + INPUT_H / 2;
        // flow goes input-side (right) → destination (left)
        const path = `M ${CONN_W} ${inputY} C ${CONN_W * 0.5} ${inputY}, ${CONN_W * 0.5} ${destY}, 0 ${destY}`;
        const color = inp.source ? resColor(inp.type) : '#444';
        const done = inp.filled >= inp.needed;
        return (
          <g key={inp.id}>
            <path d={path} fill="none"
              stroke={done ? '#10b981' : inp.source ? color : '#333'}
              strokeOpacity={done ? 0.7 : inp.source ? 0.5 : 0.2}
              strokeDasharray={inp.source ? undefined : '4 4'}
              strokeWidth={inp.source ? 2.5 : 1.5}
              strokeLinecap="round" />
            {inp.source && !done && (
              <circle r="3.5" fill={color}>
                <animateMotion
                  dur={`${Math.max(2, 9 - inp.source.rate)}s`}
                  repeatCount="indefinite"
                  path={path}
                />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function InputPanel({ inp, onPick }: { inp: InputMaterial; onPick: () => void }) {
  const pct = Math.round((inp.filled / inp.needed) * 100);
  const done = inp.filled >= inp.needed;
  const empty = !inp.source;

  return (
    <div className={cn('rounded-xl border p-3', {
      'border-emerald-500/30 bg-emerald-500/[0.04]': done,
      'border-dashed border-amber-500/40 bg-amber-500/[0.04]': empty && !done,
      'border-white/10 bg-[#121418]': !done && !empty,
    })}>
      <div className="flex items-center gap-2">
        <ResChip type={inp.type} />
        <div className="flex-1" />
        <span className={cn('font-mono text-sm font-bold tabular-nums', done ? 'text-emerald-300' : 'text-white')}>
          {inp.filled}/{inp.needed}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={cn('h-full rounded-full transition-all', {
          'bg-emerald-500': done,
          'bg-white/10':    empty && !done,
          'bg-sky-500':     !done && !empty,
        })} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2.5">
        {empty ? (
          <button onClick={onPick}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 py-2 text-[11px] text-amber-200 transition-colors hover:bg-amber-500/10">
            ⊕ Choisir une source
          </button>
        ) : (
          <button onClick={onPick}
            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-left transition-colors hover:bg-black/30">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[9px] font-bold text-violet-200">
              {inp.source!.mine ? '★' : inp.source!.name[0]}
            </div>
            <span className="flex-1 min-w-0 truncate text-[11px] text-white">{inp.source!.name}</span>
            <span className="font-mono text-[11px] text-sky-300 tabular-nums">{inp.source!.rate} u/h</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectGraphView({ project }: { project: Project }) {
  const [inputs, setInputs] = useState<InputMaterial[]>(project.inputs);
  const [pickingId, setPickingId] = useState<string | null>(null);

  const totalNeeded = inputs.reduce((s, i) => s + i.needed, 0);
  const totalFilled = inputs.reduce((s, i) => s + i.filled, 0);
  const pct = Math.round((totalFilled / totalNeeded) * 100);
  const pickingInput = inputs.find(i => i.id === pickingId);

  return (
    <div className="relative flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#101215] px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Projet en cours</p>
          <h2 className="text-xl font-semibold text-white">{project.name}</h2>
          <p className="mt-0.5 text-xs text-white/50">
            Choisis une source pour chaque matériau — le projet se remplit automatiquement.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Fin estimée</p>
          <p className="font-bold tabular-nums text-white">{project.eta}</p>
        </div>
      </div>

      <div className="flex flex-1 items-start gap-0 overflow-auto">
        {/* LEFT — destination */}
        <div className="flex w-[260px] shrink-0 flex-col gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Destination</p>
          <div className="rounded-xl border border-white/10 bg-[#121418] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/10 font-mono text-lg font-bold text-sky-300">
                {project.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{project.name}</p>
                <p className="text-[11px] text-white/40">
                  {project.kind === 'build' ? 'Construction' : project.kind === 'upgrade' ? 'Amélioration' : 'Lot de biens'}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-white/50">Avancement global</span>
                <span className="font-mono tabular-nums text-white">{pct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="mt-2.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">À la fin</p>
              <p className="mt-1 text-[11px] text-white/70">Entreprise débloquée et opérationnelle.</p>
            </div>
          </div>
        </div>

        {/* CENTER — connectors */}
        <div className="flex shrink-0 items-start" style={{ paddingTop: 28 }}>
          <ProjectConnectors inputs={inputs} />
        </div>

        {/* RIGHT — input panels */}
        <div className="flex flex-1 flex-col gap-[10px]">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Matériaux requis</p>
          {inputs.map(inp => (
            <InputPanel key={inp.id} inp={inp} onPick={() => setPickingId(inp.id)} />
          ))}
        </div>
      </div>

      {pickingInput && (
        <PickSourceModal
          type={pickingInput.type}
          onClose={() => setPickingId(null)}
          onPick={src =>
            setInputs(prev => prev.map(i => i.id === pickingId ? { ...i, source: src } : i))
          }
        />
      )}
    </div>
  );
}

// ─── Business Outbound View ───────────────────────────────────────────────────

const DEMAND_H = 120;
const DEMAND_GAP = 10;

function BizConnectors({ count }: { count: number }) {
  const totalH = Math.max(1, count * (DEMAND_H + DEMAND_GAP) - DEMAND_GAP);
  const srcY = totalH / 2;

  return (
    <svg viewBox={`0 0 ${CONN_W} ${totalH}`} width={CONN_W} height={totalH}
      className="block shrink-0" style={{ minHeight: totalH }}>
      {Array.from({ length: count }).map((_, i) => {
        const destY = i * (DEMAND_H + DEMAND_GAP) + DEMAND_H / 2;
        const path = `M 0 ${srcY} C ${CONN_W * 0.5} ${srcY}, ${CONN_W * 0.5} ${destY}, ${CONN_W} ${destY}`;
        return (
          <g key={i}>
            <path d={path} fill="none" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
            <circle r="3" fill="#38bdf8">
              <animateMotion dur={`${3.5 + i * 0.5}s`} repeatCount="indefinite" path={path} />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

function DemandCard({ d, onAccept, onReject }: {
  d: Demand;
  onAccept: () => void;
  onReject: () => void;
}) {
  const pct = d.needed ? Math.round((d.filled / d.needed) * 100) : 0;
  const pending = d.status === 'pending';

  return (
    <div className={cn('rounded-xl border p-3', {
      'border-amber-500/30 bg-amber-500/[0.04]': pending,
      'border-white/10 bg-[#121418]':            !pending,
    })}>
      <div className="flex items-center gap-2">
        <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
          d.npc ? 'bg-slate-500/20 text-slate-300' : 'bg-violet-500/20 text-violet-200')}>
          {d.npc ? '⚙' : d.mine ? '★' : d.fromName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{d.projectName}</p>
          <p className="text-[10px] text-white/40">
            {d.mine ? 'ton projet' : d.npc ? 'serveur NPC' : d.fromName}
            {' · '}{d.needed}u de {RESOURCE_META[d.resourceType].label}
          </p>
        </div>
        {d.offerPrice && (
          <p className="font-mono text-sm font-bold tabular-nums text-emerald-300">{d.offerPrice} ₽/u</p>
        )}
      </div>

      {!pending && (
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-white/40">Remplissage</span>
            <span className="font-mono tabular-nums text-white/70">{d.filled}/{d.needed}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {pending && (
        <div className="mt-2.5 flex items-center gap-2">
          <p className="flex-1 text-[11px] text-amber-200/80">En attente de ton accord.</p>
          <button onClick={onReject}
            className="h-7 rounded-md border border-white/15 bg-white/5 px-2.5 text-[11px] text-white/70 transition-colors hover:bg-white/10">
            Refuser
          </button>
          <button onClick={onAccept}
            className="h-7 rounded-md bg-white px-2.5 text-[11px] font-medium text-black transition-colors hover:bg-white/90">
            Accepter
          </button>
        </div>
      )}
    </div>
  );
}

function BusinessOutboundView({ biz }: { biz: Business }) {
  const [demands, setDemands] = useState<Demand[]>(biz.demands);

  const active = demands.filter(d => d.status === 'active');
  const pending = demands.filter(d => d.status === 'pending');
  const invPct = Math.round((biz.invUsed / biz.invCap) * 100);

  function accept(id: string) {
    setDemands(prev => prev.map(d => d.id === id ? { ...d, status: 'active' } : d));
  }
  function reject(id: string) {
    setDemands(prev => prev.filter(d => d.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#101215] px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Vue entreprise · demandes</p>
          <h2 className="text-xl font-semibold text-white">{biz.name}</h2>
          <p className="mt-0.5 text-xs text-white/50">
            Ta cadence se partage équitablement entre toutes les demandes acceptées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            {active.length} actives
          </span>
          {pending.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              {pending.length} en attente
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-start gap-0 overflow-auto">
        {/* LEFT — business */}
        <div className="flex w-[240px] shrink-0 flex-col gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Ma production</p>
          <div className="rounded-xl border border-white/10 bg-[#121418] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-[11px] font-bold text-white/70">
                {BIZ_MONO[biz.typeKey] ?? '??'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{biz.name}</p>
                <ResChip type={biz.produces} label={`${biz.ratePerHour} u/h`} />
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-white/50">Cadence totale</span>
                <span className="font-mono text-sky-300">{biz.ratePerHour} u/h</span>
              </div>
              {active.length > 0 && (
                <p className="mt-0.5 text-[10px] text-white/40">
                  → {(biz.ratePerHour / active.length).toFixed(1)} u/h par demande ({active.length} actives)
                </p>
              )}
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-white/50">Inventaire</span>
                <span className="font-mono tabular-nums text-white">{biz.invUsed}/{biz.invCap}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className={cn('h-full rounded-full', invPct > 85 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${invPct}%` }} />
              </div>
              {invPct > 85 && (
                <p className="mt-1 text-[10px] text-amber-300">
                  Stock bientôt plein — accepte plus de demandes.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CENTER — connectors */}
        <div className="flex shrink-0 items-start" style={{ paddingTop: 28 }}>
          <BizConnectors count={demands.length} />
        </div>

        {/* RIGHT — demands */}
        <div className="flex flex-1 flex-col gap-[10px] overflow-auto">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">Destinations</p>
          {demands.map(d => (
            <DemandCard key={d.id} d={d} onAccept={() => accept(d.id)} onReject={() => reject(d.id)} />
          ))}
          {demands.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <p className="text-[11px] text-white/40">Aucune demande pour l'instant.</p>
              <p className="mt-1 text-[10px] text-white/25">Des commandes serveur apparaîtront bientôt.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ projects, selection, onSelect, onNewProject }: {
  projects: Project[];
  selection: Selection;
  onSelect: (s: Selection) => void;
  onNewProject: () => void;
}) {
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-white/10 pr-3">
      <button onClick={onNewProject}
        className="mb-2 flex items-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/[0.02] px-3 py-2 text-[11px] text-white/60 transition-colors hover:bg-white/5 hover:text-white">
        <Plus size={12} />
        Nouveau projet
      </button>

      <p className="px-2 text-[10px] uppercase tracking-[0.16em] text-white/30">Mes projets</p>
      {projects.map(p => {
        const isActive = selection?.kind === 'project' && selection.id === p.id;
        const totalNeeded = p.inputs.reduce((s, i) => s + i.needed, 0);
        const totalFilled = p.inputs.reduce((s, i) => s + i.filled, 0);
        const pct = totalNeeded ? Math.round((totalFilled / totalNeeded) * 100) : 0;
        return (
          <button key={p.id}
            onClick={() => onSelect({ kind: 'project', id: p.id })}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 font-mono text-[10px] font-bold text-white/70">
              {p.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{p.name}</p>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </button>
        );
      })}

      <p className="mt-3 px-2 text-[10px] uppercase tracking-[0.16em] text-white/30">Mes entreprises</p>
      {INITIAL_BUSINESSES.map(b => {
        const isActive = selection?.kind === 'business' && selection.id === b.id;
        const pendingCount = b.demands.filter(d => d.status === 'pending').length;
        return (
          <button key={b.id}
            onClick={() => onSelect({ kind: 'business', id: b.id })}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
              isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 font-mono text-[10px] font-bold text-white/70">
              {BIZ_MONO[b.typeKey] ?? '??'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{b.name}</p>
              <p className="text-[10px] text-white/40">{RESOURCE_META[b.produces].label}</p>
            </div>
            {pendingCount > 0 && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-300">
                {pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SupplyTab() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selection, setSelection] = useState<Selection>({ kind: 'project', id: 'p1' });
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  function handleCreate(opt: typeof NEW_PROJECT_OPTIONS[0]) {
    const id = `p${Date.now()}`;
    const newProject: Project = {
      id,
      kind: opt.kind,
      name: opt.name,
      icon: opt.icon,
      eta: 'calcul en cours…',
      inputs: opt.inputs.map(([type, needed], idx) => ({
        id: `${id}-i${idx}`,
        type,
        needed,
        filled: 0,
        source: null,
      })),
    };
    setProjects(prev => [...prev, newProject]);
    setSelection({ kind: 'project', id });
  }

  const activeProject = selection?.kind === 'project'
    ? projects.find(p => p.id === selection.id)
    : null;
  const activeBiz = selection?.kind === 'business'
    ? INITIAL_BUSINESSES.find(b => b.id === selection.id)
    : null;

  return (
    <div className="relative flex h-full overflow-hidden bg-[#0a0b0d] p-5 text-white">
      <Sidebar
        projects={projects}
        selection={selection}
        onSelect={setSelection}
        onNewProject={() => setNewProjectOpen(true)}
      />
      <div className="flex-1 overflow-auto pl-5">
        {activeProject && <ProjectGraphView key={activeProject.id} project={activeProject} />}
        {activeBiz && <BusinessOutboundView key={activeBiz.id} biz={activeBiz} />}
        {!activeProject && !activeBiz && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-white/30">
              Sélectionne un projet ou une entreprise.
            </p>
          </div>
        )}
      </div>
      {newProjectOpen && (
        <NewProjectModal onClose={() => setNewProjectOpen(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
