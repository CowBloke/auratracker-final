import { useEffect, useRef, useState } from 'react';
import {
  Bot, CheckCircle2, ChevronRight, Hammer, Loader2,
  Package, Plus, ShoppingCart, Warehouse, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  type ResourceType, RESOURCE_META, TIER_META,
  RECIPES, BUSINESS_PRODUCES, PRODUCER_TYPES,
  getMiniGameType, getMiniGameLabel,
  type Recipe,
} from '@/lib/resources';
import type { YouBusiness } from '@/services/api';

// ── Mock production state (replaced by API data once backend exists) ──
interface StockEntry { resource: ResourceType; qty: number }
interface EmployeeSlot {
  id: string;
  name: string;
  isNpc: boolean;
  level: number;
  workedToday: boolean;
  baseOutput: number;
}
interface StorageState {
  used: number;
  base: number;
  silos: number;
  hasWarehouse: boolean;
}

function getMockStock(typeKey: string): StockEntry[] {
  const produces = BUSINESS_PRODUCES[typeKey] ?? [];
  return produces.map((r, i) => ({ resource: r, qty: 20 + i * 15 }));
}

function getMockEmployees(): EmployeeSlot[] {
  return [
    { id: 'e1', name: 'Jean-Pierre', isNpc: false, level: 3, workedToday: false, baseOutput: 12 },
    { id: 'e2', name: 'NPC Ouvrier', isNpc: true,  level: 1, workedToday: false, baseOutput: 8 },
  ];
}

function getMockStorage(): StorageState {
  return { used: 35, base: 50, silos: 1, hasWarehouse: false };
}

function totalCapacity(s: StorageState) { return s.base + s.silos * 150 + (s.hasWarehouse ? 500 : 0); }

// ── Resource icon helper ─────────────────────────────────
function ResIcon({ type, size = 'sm' }: { type: ResourceType; size?: 'sm' | 'md' }) {
  const meta = RESOURCE_META[type];
  const { Icon } = meta;
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <div className={cn(dim, 'flex shrink-0 items-center justify-center rounded-lg', meta.bg)}>
      <Icon className={cn(icon, meta.iconColor)} />
    </div>
  );
}

// ── Timing mini-game ─────────────────────────────────────
function TimingGame({ onResult }: { onResult: (success: boolean) => void }) {
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      posRef.current += dirRef.current * 2.2;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setPos(posRef.current);
    }, 16);
    return () => window.clearInterval(id);
  }, []);

  const hit = () => {
    if (done) return;
    setDone(true);
    const inZone = posRef.current >= 35 && posRef.current <= 65;
    onResult(inZone);
  };

  const GREEN_LEFT = 35;
  const GREEN_WIDTH = 30;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">Cliquez quand l'indicateur est dans la zone verte</p>
      <div className="relative h-10 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
        {/* Green zone */}
        <div
          className="absolute inset-y-0 bg-emerald-500/25 border-x border-emerald-500/40"
          style={{ left: `${GREEN_LEFT}%`, width: `${GREEN_WIDTH}%` }}
        />
        {/* Indicator */}
        <div
          className="absolute top-1 h-8 w-2 rounded-full bg-white shadow-md transition-none"
          style={{ left: `calc(${pos}% - 4px)` }}
        />
      </div>
      <Button className="w-full" onClick={hit} disabled={done} size="lg">
        Frapper !
      </Button>
    </div>
  );
}

// ── Finance mini-game (bank/transfer) ────────────────────
function FinanceGame({ onResult }: { onResult: (success: boolean) => void }) {
  const options = [
    { label: 'Obligations court terme', yield: 3.2 },
    { label: 'ETF marché', yield: 7.1 },
    { label: 'Compte épargne', yield: 0.8 },
    { label: 'Actions tech', yield: 12.4 },
  ];
  const best = options.reduce((a, b) => a.yield > b.yield ? a : b);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">Quel placement maximise le rendement annuel ?</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => { if (!selected) { setSelected(o.label); onResult(o.label === best.label); } }}
            className={cn(
              'rounded-xl border p-3 text-left text-sm transition-colors',
              selected === o.label
                ? o.label === best.label ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'
                : selected
                  ? o.label === best.label ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border/40 opacity-40'
                  : 'border-border/60 bg-muted/10 hover:bg-muted/20',
            )}
          >
            <p className="font-medium">{o.label}</p>
            <p className="text-xs text-muted-foreground">{o.yield}% / an</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Memory mini-game ─────────────────────────────────────
function MemoryGame({ onResult }: { onResult: (success: boolean) => void }) {
  const PAIRS = ['🍎', '🌿', '💊', '🔬', '📋', '🧪'];
  const cards = [...PAIRS, ...PAIRS].map((v, i) => ({ id: i, value: v, flipped: false, matched: false }));
  const [deck, setDeck] = useState(cards.sort(() => Math.random() - 0.5));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const flip = (id: number) => {
    if (done || flipped.length === 2) return;
    const card = deck.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;
    const newFlipped = [...flipped, id];
    setDeck((d) => d.map((c) => c.id === id ? { ...c, flipped: true } : c));
    setFlipped(newFlipped);
    if (newFlipped.length === 2) {
      const [a, b] = newFlipped.map((fid) => deck.find((c) => c.id === fid)!);
      setTimeout(() => {
        if (a.value === b.value) {
          setDeck((d) => d.map((c) => newFlipped.includes(c.id) ? { ...c, matched: true } : c));
          const allMatched = deck.filter((c) => !newFlipped.includes(c.id)).every((c) => c.matched);
          if (allMatched || deck.filter((c) => c.matched).length + 2 === deck.length) {
            setDone(true);
            onResult(true);
          }
        } else {
          setDeck((d) => d.map((c) => newFlipped.includes(c.id) ? { ...c, flipped: false } : c));
        }
        setFlipped([]);
      }, 700);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">Retrouvez toutes les paires</p>
      <div className="grid grid-cols-4 gap-2">
        {deck.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => flip(card.id)}
            className={cn(
              'h-12 rounded-xl border text-xl transition-all',
              card.flipped || card.matched
                ? card.matched ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border/60 bg-muted/30'
                : 'border-border/40 bg-muted/10 hover:bg-muted/20',
            )}
          >
            {card.flipped || card.matched ? card.value : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mini-game modal ──────────────────────────────────────
function MiniGameModal({
  open,
  employee,
  businessTypeKey,
  onClose,
  onDone,
}: {
  open: boolean;
  employee: EmployeeSlot | null;
  businessTypeKey: string;
  onClose: () => void;
  onDone: (employeeId: string, success: boolean) => void;
}) {
  const [result, setResult] = useState<{ success: boolean; amount: number } | null>(null);
  const gameType = getMiniGameType(businessTypeKey);

  useEffect(() => {
    if (!open) setResult(null);
  }, [open]);

  const handleResult = (success: boolean) => {
    if (!employee) return;
    const base = employee.baseOutput;
    const amount = success ? base : Math.floor(base * 0.5);
    setResult({ success, amount });
    setTimeout(() => {
      onDone(employee.id, success);
      onClose();
    }, 1400);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !result) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="space-y-1 border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-base font-semibold">
            {getMiniGameLabel(businessTypeKey)}
          </DialogTitle>
          {employee && (
            <p className="text-xs text-muted-foreground">{employee.name} · Niv. {employee.level} · Quota: {employee.baseOutput} u.</p>
          )}
        </div>
        <div className="p-5">
          {result ? (
            <div className={cn('flex flex-col items-center gap-3 rounded-2xl border py-8', result.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5')}>
              <span className="text-4xl">{result.success ? '✅' : '⚡'}</span>
              <p className={cn('text-lg font-bold', result.success ? 'text-emerald-400' : 'text-amber-400')}>
                {result.success ? 'Succès !' : 'Effort partiel'}
              </p>
              <p className="text-sm text-muted-foreground">+{result.amount} unités produites</p>
            </div>
          ) : (
            gameType === 'TIMING' ? <TimingGame onResult={handleResult} /> :
            gameType === 'FINANCE' ? <FinanceGame onResult={handleResult} /> :
            <MemoryGame onResult={handleResult} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock tab ────────────────────────────────────────────
function StockTab({ stock, storage }: { business?: YouBusiness; stock: StockEntry[]; storage: StorageState }) {
  const capacity = totalCapacity(storage);
  const pct = Math.min(100, (storage.used / capacity) * 100);

  return (
    <div className="space-y-5">
      {/* Storage meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Stockage</span>
          <span className="tabular-nums">{storage.used} / {capacity} u.</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div
            className={cn('h-full rounded-full transition-all', pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-2 text-[11px] text-muted-foreground">
          <span>Base: {storage.base}</span>
          {storage.silos > 0 && <span>· Silos ×{storage.silos}: +{storage.silos * 150}</span>}
          {storage.hasWarehouse && <span>· Entrepôt: +500</span>}
        </div>
      </div>

      {/* Resources */}
      {stock.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 py-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucun stock pour l'instant.</p>
          <p className="text-xs text-muted-foreground/60">Les employés produisent des ressources via leurs tâches quotidiennes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stock.map(({ resource, qty }) => {
            const meta = RESOURCE_META[resource];
            const tier = TIER_META[meta.tier];
            return (
              <div key={resource} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-3">
                <ResIcon type={resource} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{meta.label}</p>
                  <Badge className={cn('mt-0.5 border px-1.5 py-0 text-[10px] leading-4', tier.cls)}>{tier.label}</Badge>
                  <p className="mt-1 text-base font-bold tabular-nums">{qty} u.</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sell button */}
      {stock.length > 0 && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => toast.info('Bientôt disponible', { description: 'La mise en vente de ressources sera disponible une fois le backend connecté.' })}
        >
          <ShoppingCart className="h-4 w-4" />
          Mettre en vente sur le marché
        </Button>
      )}
    </div>
  );
}

// ── Production tab ───────────────────────────────────────
function ProductionTab({ business, employees, setEmployees }: {
  business: YouBusiness;
  employees: EmployeeSlot[];
  setEmployees: React.Dispatch<React.SetStateAction<EmployeeSlot[]>>;
}) {
  const [gameTarget, setGameTarget] = useState<EmployeeSlot | null>(null);
  const produces = BUSINESS_PRODUCES[business.typeKey] ?? [];
  const isProducer = PRODUCER_TYPES.has(business.typeKey);

  const handleWorkDone = (employeeId: string, _success: boolean) => {
    setEmployees((prev) => prev.map((e) => e.id === employeeId ? { ...e, workedToday: true } : e));
  };

  const hireNpc = () => {
    const npcCount = employees.filter((e) => e.isNpc).length;
    setEmployees((prev) => [
      ...prev,
      {
        id: `npc-${Date.now()}`,
        name: `NPC Ouvrier ${npcCount + 1}`,
        isNpc: true,
        level: 1,
        workedToday: false,
        baseOutput: 6,
      },
    ]);
    toast.success('NPC embauché', { description: 'Le NPC produira automatiquement à 70% chaque jour.' });
  };

  return (
    <div className="space-y-5">
      {/* Production summary */}
      {isProducer && produces.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {produces.map((r) => {
            const meta = RESOURCE_META[r];
            const { Icon } = meta;
            return (
              <div key={r} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', meta.bg, meta.iconColor)}>
                <Icon className="h-3 w-3" />
                Produit: {meta.label}
              </div>
            );
          })}
        </div>
      )}

      {!isProducer && (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          Ce type d'entreprise ne produit pas de ressources directement. Les mini-jeux des employés génèrent des revenus financiers.
        </div>
      )}

      {/* Employee slots */}
      <div className="space-y-3">
        {employees.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
            Aucun employé. Invitez des joueurs ou embauchez un NPC.
          </div>
        )}
        {employees.map((emp) => {
          const npcPct = emp.isNpc ? 70 : 100;
          return (
            <div key={emp.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                emp.isNpc ? 'bg-slate-500/20 text-slate-400' : 'bg-violet-500/20 text-violet-400',
              )}>
                {emp.isNpc ? <Bot className="h-4 w-4" /> : emp.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium">{emp.name}</p>
                  {emp.isNpc && <Badge variant="outline" className="text-[10px]">NPC</Badge>}
                  <Badge variant="outline" className="text-[10px]">Niv. {emp.level}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quota: {emp.baseOutput} u. · Rendement: {npcPct}%
                  {emp.isNpc ? ' (auto)' : ''}
                </p>
              </div>
              <div className="shrink-0">
                {emp.workedToday ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Fait
                  </div>
                ) : emp.isNpc ? (
                  <Badge variant="secondary" className="text-[11px]">Auto demain</Badge>
                ) : (
                  <Button size="sm" onClick={() => setGameTarget(emp)}>
                    <Hammer className="mr-1.5 h-3.5 w-3.5" />
                    Travailler
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hire NPC */}
      <Button variant="outline" className="w-full gap-2 text-sm" onClick={hireNpc}>
        <Bot className="h-4 w-4" />
        Embaucher un NPC (2× salaire · 70% rendement)
      </Button>

      <MiniGameModal
        open={gameTarget !== null}
        employee={gameTarget}
        businessTypeKey={business.typeKey}
        onClose={() => setGameTarget(null)}
        onDone={handleWorkDone}
      />
    </div>
  );
}

// ── Crafting tab ─────────────────────────────────────────
function CraftingTab({ business, stock }: { business: YouBusiness; stock: StockEntry[] }) {
  const [crafting, setCrafting] = useState<string | null>(null);

  const available = RECIPES.filter((r) =>
    r.forTypes.includes('*') || r.forTypes.includes(business.typeKey),
  );

  const hasEnough = (recipe: Recipe) =>
    recipe.inputs.every((inp) => {
      const held = stock.find((s) => s.resource === inp.resource)?.qty ?? 0;
      return held >= inp.qty;
    });

  const craft = async (recipe: Recipe) => {
    setCrafting(recipe.id);
    await new Promise((r) => setTimeout(r, 800));
    toast.success(`${recipe.output.label}`, { description: recipe.name + ' fabriqué avec succès.' });
    setCrafting(null);
  };

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 py-10 text-center">
        <Package className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Aucune recette disponible pour ce type d'entreprise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {available.map((recipe) => {
        const canCraft = hasEnough(recipe);
        const busy = crafting === recipe.id;
        return (
          <div key={recipe.id} className="rounded-xl border border-border/50 bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{recipe.name}</p>
                  <Badge variant="outline" className="text-[10px]">{recipe.output.type === 'structure' ? 'Structure' : recipe.output.type === 'item' ? 'Objet' : 'Entreprise'}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{recipe.description}</p>

                {/* Ingredients */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {recipe.inputs.map((inp) => {
                    const meta = RESOURCE_META[inp.resource];
                    const { Icon } = meta;
                    const held = stock.find((s) => s.resource === inp.resource)?.qty ?? 0;
                    const ok = held >= inp.qty;
                    return (
                      <div key={inp.resource} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border/50 bg-muted/20 text-muted-foreground')}>
                        <Icon className="h-3 w-3" />
                        <span>{meta.label}</span>
                        <span className="font-medium">{held}/{inp.qty}</span>
                      </div>
                    );
                  })}
                  {recipe.moneyCost > 0 && (
                    <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400">
                      💰 {recipe.moneyCost.toLocaleString('fr-FR')} €
                    </div>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                className="shrink-0"
                disabled={!canCraft || !!crafting}
                onClick={() => void craft(recipe)}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {canCraft ? 'Fabriquer' : 'Manque'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Storage tab ──────────────────────────────────────────
function StorageTab({ storage, setStorage }: {
  storage: StorageState;
  setStorage: React.Dispatch<React.SetStateAction<StorageState>>;
}) {
  const capacity = totalCapacity(storage);
  const pct = Math.min(100, (storage.used / capacity) * 100);
  const canAddSilo = storage.silos < 3;
  const canAddWarehouse = !storage.hasWarehouse;
  const [building, setBuilding] = useState<string | null>(null);

  const build = async (what: 'silo' | 'warehouse') => {
    setBuilding(what);
    await new Promise((r) => setTimeout(r, 900));
    if (what === 'silo') {
      setStorage((s) => ({ ...s, silos: s.silos + 1 }));
      toast.success('Silo construit', { description: '+150 capacité de stockage.' });
    } else {
      setStorage((s) => ({ ...s, hasWarehouse: true }));
      toast.success('Entrepôt construit', { description: '+500 capacité de stockage.' });
    }
    setBuilding(null);
  };

  return (
    <div className="space-y-5">
      {/* Capacity overview */}
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Capacité totale</p>
          <p className="text-sm font-bold tabular-nums">{storage.used} / {capacity} u.</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div className={cn('h-full rounded-full', pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted/20 px-2 py-2">
            <p className="text-muted-foreground">Base</p>
            <p className="font-semibold">{storage.base} u.</p>
          </div>
          <div className="rounded-lg bg-muted/20 px-2 py-2">
            <p className="text-muted-foreground">Silos ({storage.silos}/3)</p>
            <p className="font-semibold">+{storage.silos * 150} u.</p>
          </div>
          <div className="rounded-lg bg-muted/20 px-2 py-2">
            <p className="text-muted-foreground">Entrepôt</p>
            <p className="font-semibold">{storage.hasWarehouse ? '+500 u.' : '—'}</p>
          </div>
        </div>
      </div>

      {/* Build silo */}
      <Card className={cn('border-border/60 shadow-none', !canAddSilo && 'opacity-50')}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <Warehouse className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Silo ({storage.silos}/3)</p>
            <p className="text-xs text-muted-foreground">+150 capacité · Recette: Bois ×20, Pierre ×10, 500 €</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!canAddSilo || building !== null}
            onClick={() => void build('silo')}
          >
            {building === 'silo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {canAddSilo ? 'Construire' : 'Max'}
          </Button>
        </CardContent>
      </Card>

      {/* Build warehouse */}
      <Card className={cn('border-border/60 shadow-none', !canAddWarehouse && 'opacity-50')}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
            <Warehouse className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Entrepôt</p>
            <p className="text-xs text-muted-foreground">+500 capacité · Recette: Béton ×30, Acier ×10, 2000 €</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!canAddWarehouse || building !== null}
            onClick={() => void build('warehouse')}
          >
            {building === 'warehouse' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {canAddWarehouse ? 'Construire' : 'Construit'}
          </Button>
        </CardContent>
      </Card>

      {/* Borrow section */}
      <div className="rounded-xl border border-dashed border-border/50 bg-muted/5 p-4">
        <div className="flex items-center gap-3">
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Emprunter un espace de stockage</p>
            <p className="text-xs text-muted-foreground">Louez l'espace inutilisé d'un autre joueur. Bientôt disponible.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────
export function ProductionModal({
  open,
  onClose,
  business,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
}) {
  const [stock, setStock] = useState<StockEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeSlot[]>([]);
  const [storage, setStorage] = useState<StorageState>({ used: 0, base: 50, silos: 0, hasWarehouse: false });

  useEffect(() => {
    if (open && business) {
      setStock(getMockStock(business.typeKey));
      setEmployees(getMockEmployees());
      setStorage(getMockStorage());
    }
  }, [open, business?.id]);

  if (!business) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <DialogTitle className="text-base font-semibold">Production — {business.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">Ressources, équipe, fabrication et stockage</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/20 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Tabs defaultValue="stock" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="shrink-0 rounded-none border-b border-border/60 bg-muted/10 px-4 py-0 h-10 justify-start gap-0">
            {([
              { value: 'stock', label: 'Stock' },
              { value: 'production', label: 'Équipe' },
              { value: 'crafting', label: 'Fabrication' },
              { value: 'storage', label: 'Stockage' },
            ] as const).map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-10 rounded-none border-b-2 border-transparent px-4 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="stock" className="m-0 p-5">
              <StockTab business={business} stock={stock} storage={storage} />
            </TabsContent>
            <TabsContent value="production" className="m-0 p-5">
              <ProductionTab business={business} employees={employees} setEmployees={setEmployees} />
            </TabsContent>
            <TabsContent value="crafting" className="m-0 p-5">
              <CraftingTab business={business} stock={stock} />
            </TabsContent>
            <TabsContent value="storage" className="m-0 p-5">
              <StorageTab storage={storage} setStorage={setStorage} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
