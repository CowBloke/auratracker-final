import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, ChevronRight, Hammer, Loader2,
  Package, Plus, ShoppingCart, Warehouse, X, Flame,
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
import type { YouBusiness, YouBusinessMember } from '@/services/api';
import { youApi } from '@/services/api';

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

// ── Timing mini-game (farm, lemonade, restaurant, coffee_shop, epicerie) ──
function TimingGame({ onResult }: { onResult: (success: boolean) => void }) {
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      posRef.current += dirRef.current * 2.5;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setPos(posRef.current);
    }, 16);
    return () => window.clearInterval(id);
  }, []);

  const hit = () => {
    if (done) return;
    setDone(true);
    onResult(posRef.current >= 35 && posRef.current <= 65);
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">Cliquez quand l'indicateur est dans la zone verte</p>
      <div className="relative h-10 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
        <div className="absolute inset-y-0 border-x border-emerald-500/40 bg-emerald-500/25" style={{ left: '35%', width: '30%' }} />
        <div className="absolute top-1 h-8 w-2 rounded-full bg-white shadow-md transition-none" style={{ left: `calc(${pos}% - 4px)` }} />
      </div>
      <Button className="w-full" onClick={hit} disabled={done} size="lg">Frapper !</Button>
    </div>
  );
}

// ── Finance mini-game (bank, transfer) ──────────────────
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
      <p className="text-center text-sm text-muted-foreground">Quel placement maximise le rendement annuel ?</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button key={o.label} type="button"
            onClick={() => { if (!selected) { setSelected(o.label); onResult(o.label === best.label); } }}
            className={cn('rounded-xl border p-3 text-left text-sm transition-colors',
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

// ── Memory mini-game (medecins, formation) ───────────────
function MemoryGame({ onResult }: { onResult: (success: boolean) => void }) {
  const PAIRS = ['🍎', '🌿', '💊', '🔬', '📋', '🧪'];
  const [deck, setDeck] = useState(() =>
    [...PAIRS, ...PAIRS].map((v, i) => ({ id: i, value: v, flipped: false, matched: false })).sort(() => Math.random() - 0.5)
  );
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
          const newMatchedCount = deck.filter((c) => c.matched).length + 2;
          if (newMatchedCount === deck.length) { setDone(true); onResult(true); }
        } else {
          setDeck((d) => d.map((c) => newFlipped.includes(c.id) ? { ...c, flipped: false } : c));
        }
        setFlipped([]);
      }, 700);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">Retrouvez toutes les paires</p>
      <div className="grid grid-cols-4 gap-2">
        {deck.map((card) => (
          <button key={card.id} type="button" onClick={() => flip(card.id)}
            className={cn('h-12 rounded-xl border text-xl transition-all',
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

// ── Typing mini-game (sawmill, quarry, iron_mine, fuel_refinery, textile_mill) ──
const TYPING_WORDS = ['acier', 'poutre', 'ciseau', 'forge', 'sciure', 'granite', 'tuyau', 'rouage', 'filage', 'ciment'];

function TypingGame({ onResult }: { onResult: (success: boolean) => void }) {
  const [word] = useState(() => TYPING_WORDS[Math.floor(Math.random() * TYPING_WORDS.length)]);
  const [value, setValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(5);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { window.clearInterval(id); if (!done) { setDone(true); onResult(false); } return 0; }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [done, onResult]);

  const submit = () => {
    if (done) return;
    setDone(true);
    onResult(value.trim().toLowerCase() === word);
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">Tapez le mot avant la fin du chrono</p>
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <span className="text-2xl font-bold tracking-wider text-foreground">{word}</span>
        <span className={cn('text-lg font-mono font-bold', timeLeft <= 2 ? 'text-red-400' : 'text-muted-foreground')}>{timeLeft}s</span>
      </div>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        disabled={done}
        placeholder="Tapez ici..."
        className="h-10 w-full rounded-xl border border-border/60 bg-background px-4 text-sm outline-none focus:border-primary"
      />
      <Button className="w-full" onClick={submit} disabled={done} size="lg">Valider</Button>
    </div>
  );
}

// ── Math mini-game (startup, youtube, agency) ────────────
function MathGame({ onResult }: { onResult: (success: boolean) => void }) {
  const [problem] = useState(() => {
    const ops = [
      () => { const a = Math.floor(Math.random() * 12) + 2; const b = Math.floor(Math.random() * 12) + 2; return { q: `${a} × ${b}`, ans: a * b }; },
      () => { const a = Math.floor(Math.random() * 50) + 20; const b = Math.floor(Math.random() * 20) + 5; return { q: `${a} + ${b}`, ans: a + b }; },
      () => { const a = Math.floor(Math.random() * 80) + 30; const b = Math.floor(Math.random() * 25) + 5; return { q: `${a} - ${b}`, ans: a - b }; },
    ];
    return ops[Math.floor(Math.random() * ops.length)]();
  });
  const [value, setValue] = useState('');
  const [done, setDone] = useState(false);

  const submit = () => {
    if (done) return;
    setDone(true);
    onResult(parseInt(value.trim(), 10) === problem.ans);
  };

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">Résolvez le calcul mental</p>
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-5 text-center text-3xl font-bold tracking-wide text-foreground">
        {problem.q} = ?
      </div>
      <input
        autoFocus
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        disabled={done}
        placeholder="Votre réponse..."
        className="h-10 w-full rounded-xl border border-border/60 bg-background px-4 text-sm outline-none focus:border-primary"
      />
      <Button className="w-full" onClick={submit} disabled={done} size="lg">Valider</Button>
    </div>
  );
}

// ── Sort mini-game (illegal_market) ─────────────────────
function SortGame({ onResult }: { onResult: (success: boolean) => void }) {
  const items = [
    { id: 1, label: '💊 Médicament', value: 90 },
    { id: 2, label: '🔫 Arme légère', value: 45 },
    { id: 3, label: '💎 Bijou', value: 120 },
    { id: 4, label: '📱 Téléphone', value: 30 },
  ];
  const [order, setOrder] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const correct = [...items].sort((a, b) => a.value - b.value).map((i) => i.id);

  const pick = (id: number) => {
    if (done || order.includes(id)) return;
    const next = [...order, id];
    setOrder(next);
    if (next.length === items.length) {
      setDone(true);
      onResult(JSON.stringify(next) === JSON.stringify(correct));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">Classez du moins au plus précieux</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const pos = order.indexOf(item.id);
          return (
            <button key={item.id} type="button" onClick={() => pick(item.id)}
              className={cn('rounded-xl border p-3 text-left text-sm transition-colors',
                pos >= 0
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border/60 bg-muted/10 hover:bg-muted/20',
              )}
            >
              <div className="flex items-center justify-between">
                <span>{item.label}</span>
                {pos >= 0 && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">#{pos + 1}</span>}
              </div>
            </button>
          );
        })}
      </div>
      {order.length > 0 && order.length < items.length && (
        <p className="text-center text-xs text-muted-foreground">{order.length}/{items.length} sélectionnés</p>
      )}
    </div>
  );
}

// ── Mini-game modal ──────────────────────────────────────
function MiniGameModal({
  open,
  member,
  businessTypeKey,
  onClose,
  onDone,
}: {
  open: boolean;
  member: YouBusinessMember | null;
  businessTypeKey: string;
  onClose: () => void;
  onDone: (memberId: string, success: boolean) => void;
}) {
  const [result, setResult] = useState<{ success: boolean } | null>(null);
  const gameType = getMiniGameType(businessTypeKey);

  useEffect(() => {
    if (!open) setResult(null);
  }, [open]);

  const handleResult = (success: boolean) => {
    if (!member) return;
    setResult({ success });
    setTimeout(() => {
      onDone(member.id, success);
      onClose();
    }, 1400);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !result) onClose(); }}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="space-y-1 border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-base font-semibold">{getMiniGameLabel(businessTypeKey)}</DialogTitle>
          {member && <p className="text-xs text-muted-foreground">{member.user.username} · {member.role}</p>}
        </div>
        <div className="p-5">
          {result ? (
            <div className={cn('flex flex-col items-center gap-3 rounded-2xl border py-8',
              result.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
            )}>
              <span className="text-4xl">{result.success ? '✅' : '⚡'}</span>
              <p className={cn('text-lg font-bold', result.success ? 'text-emerald-400' : 'text-amber-400')}>
                {result.success ? 'Succès !' : 'Effort partiel'}
              </p>
              <p className="text-sm text-muted-foreground">Travail enregistré</p>
            </div>
          ) : (
            gameType === 'TIMING' ? <TimingGame onResult={handleResult} /> :
            gameType === 'FINANCE' ? <FinanceGame onResult={handleResult} /> :
            gameType === 'MEMORY' ? <MemoryGame onResult={handleResult} /> :
            gameType === 'TYPING' ? <TypingGame onResult={handleResult} /> :
            gameType === 'MATH' ? <MathGame onResult={handleResult} /> :
            <SortGame onResult={handleResult} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Production tab ───────────────────────────────────────
function ProductionTab({ business, currentUserId, onWorkDone }: {
  business: YouBusiness;
  currentUserId: string;
  onWorkDone: () => void;
}) {
  const [gameTarget, setGameTarget] = useState<YouBusinessMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const produces = BUSINESS_PRODUCES[business.typeKey] ?? [];
  const isProducer = PRODUCER_TYPES.has(business.typeKey);
  const isOwner = business.ownerId === currentUserId;

  const totalMembers = business.members.length;
  const workedCount = business.members.filter((m) => m.workedToday).length;
  const workRatio = totalMembers > 0 ? (workedCount >= 4 ? 1.25 : workedCount / totalMembers) : 1.0;

  const handleWorkDone = async (_memberId: string, _success: boolean) => {
    setSubmitting(true);
    try {
      await youApi.submitWork(business.id);
      onWorkDone();
    } catch {
      toast.error('Impossible d\'enregistrer le travail.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReminder = async (memberId: string) => {
    setSending(memberId);
    try {
      await youApi.sendWorkReminder(business.id, memberId);
      toast.success('Rappel envoyé !');
    } catch {
      toast.error('Impossible d\'envoyer le rappel.');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-5">
      {isProducer && produces.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {produces.map((r) => {
            const meta = RESOURCE_META[r as ResourceType];
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

      {isProducer && totalMembers > 0 && (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Production du jour</span>
            <span className={cn('font-bold tabular-nums', workRatio >= 1 ? 'text-emerald-400' : workRatio > 0 ? 'text-amber-400' : 'text-red-400')}>
              {workRatio >= 1.25 ? '125%' : `${Math.round(workRatio * 100)}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted/40">
            <div
              className={cn('h-full rounded-full transition-all', workRatio >= 1 ? 'bg-emerald-500' : workRatio > 0 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, Math.round(workRatio * 100))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{workedCount}/{totalMembers} employés ont travaillé aujourd'hui{workedCount >= 4 ? ' · Bonus +25%' : ''}</p>
        </div>
      )}

      {!isProducer && (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          Ce type d'entreprise ne produit pas de ressources directement.
        </div>
      )}

      <div className="space-y-3">
        {business.members.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
            Aucun employé. Invitez des joueurs via le panneau de gestion.
          </div>
        )}
        {business.members.map((member) => {
          const isMe = member.user.id === currentUserId;
          const canWork = isMe && !member.workedToday && !submitting;
          const canRemind = isOwner && !isMe && !member.workedToday;
          return (
            <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/10 px-4 py-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                isMe ? 'bg-blue-500/20 text-blue-400' : 'bg-violet-500/20 text-violet-400',
              )}>
                {member.user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium">{member.user.username}</p>
                  {isMe && <Badge variant="outline" className="text-[10px]">Vous</Badge>}
                  <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {member.workedToday ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Fait
                  </div>
                ) : canWork ? (
                  <Button size="sm" onClick={() => setGameTarget(member)} disabled={submitting}>
                    <Hammer className="mr-1.5 h-3.5 w-3.5" />
                    Travailler
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground/50">En attente</span>
                )}
                {canRemind && (
                  <button
                    type="button"
                    onClick={() => void handleReminder(member.id)}
                    disabled={sending === member.id}
                    title="Envoyer un rappel"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50"
                  >
                    {sending === member.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <MiniGameModal
        open={gameTarget !== null}
        member={gameTarget}
        businessTypeKey={business.typeKey}
        onClose={() => setGameTarget(null)}
        onDone={handleWorkDone}
      />
    </div>
  );
}

// ── Stock tab ────────────────────────────────────────────
interface StockEntry { resource: ResourceType; qty: number }
interface StorageState { used: number; base: number; silos: number; hasWarehouse: boolean }

function totalCapacity(s: StorageState) { return s.base + s.silos * 150 + (s.hasWarehouse ? 500 : 0); }

function StockTab({ stock, storage }: { stock: StockEntry[]; storage: StorageState }) {
  const capacity = totalCapacity(storage);
  const pct = Math.min(100, (storage.used / capacity) * 100);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Stockage</span>
          <span className="tabular-nums">{storage.used} / {capacity} u.</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div className={cn('h-full rounded-full transition-all', pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {stock.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 py-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Aucun stock pour l'instant.</p>
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

      {stock.length > 0 && (
        <Button variant="outline" className="w-full gap-2" onClick={() => toast.info('Bientôt disponible')}>
          <ShoppingCart className="h-4 w-4" />
          Mettre en vente sur le marché
        </Button>
      )}
    </div>
  );
}

// ── Crafting tab ─────────────────────────────────────────
function CraftingTab({ business, stock }: { business: YouBusiness; stock: StockEntry[] }) {
  const [crafting, setCrafting] = useState<string | null>(null);

  const available = RECIPES.filter((r) => r.forTypes.includes('*') || r.forTypes.includes(business.typeKey));

  const hasEnough = (recipe: Recipe) =>
    recipe.inputs.every((inp) => (stock.find((s) => s.resource === inp.resource)?.qty ?? 0) >= inp.qty);

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
                <div className="mt-3 flex flex-wrap gap-2">
                  {recipe.inputs.map((inp) => {
                    const meta = RESOURCE_META[inp.resource];
                    const { Icon } = meta;
                    const held = stock.find((s) => s.resource === inp.resource)?.qty ?? 0;
                    const ok = held >= inp.qty;
                    return (
                      <div key={inp.resource} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                        ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border/50 bg-muted/20 text-muted-foreground'
                      )}>
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
              <Button size="sm" className="shrink-0" disabled={!canCraft || !!crafting} onClick={() => void craft(recipe)}>
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
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Capacité totale</p>
          <p className="text-sm font-bold tabular-nums">{storage.used} / {capacity} u.</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted/40">
          <div className={cn('h-full rounded-full', pct > 85 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted/20 px-2 py-2"><p className="text-muted-foreground">Base</p><p className="font-semibold">{storage.base} u.</p></div>
          <div className="rounded-lg bg-muted/20 px-2 py-2"><p className="text-muted-foreground">Silos ({storage.silos}/3)</p><p className="font-semibold">+{storage.silos * 150} u.</p></div>
          <div className="rounded-lg bg-muted/20 px-2 py-2"><p className="text-muted-foreground">Entrepôt</p><p className="font-semibold">{storage.hasWarehouse ? '+500 u.' : '—'}</p></div>
        </div>
      </div>

      <Card className={cn('border-border/60 shadow-none', storage.silos >= 3 && 'opacity-50')}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <Warehouse className="h-5 w-5 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Silo ({storage.silos}/3)</p>
            <p className="text-xs text-muted-foreground">+150 capacité · Bois ×20, Pierre ×10, 500 €</p>
          </div>
          <Button size="sm" variant="outline" disabled={storage.silos >= 3 || building !== null} onClick={() => void build('silo')}>
            {building === 'silo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {storage.silos >= 3 ? 'Max' : 'Construire'}
          </Button>
        </CardContent>
      </Card>

      <Card className={cn('border-border/60 shadow-none', storage.hasWarehouse && 'opacity-50')}>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
            <Warehouse className="h-5 w-5 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Entrepôt</p>
            <p className="text-xs text-muted-foreground">+500 capacité · Béton ×30, Acier ×10, 2000 €</p>
          </div>
          <Button size="sm" variant="outline" disabled={storage.hasWarehouse || building !== null} onClick={() => void build('warehouse')}>
            {building === 'warehouse' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {storage.hasWarehouse ? 'Construit' : 'Construire'}
          </Button>
        </CardContent>
      </Card>

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
  currentUserId,
  onReload,
}: {
  open: boolean;
  onClose: () => void;
  business: YouBusiness | null;
  currentUserId: string;
  onReload?: () => void;
}) {
  const [stock, setStock] = useState<StockEntry[]>([]);
  const [storage, setStorage] = useState<StorageState>({ used: 0, base: 50, silos: 0, hasWarehouse: false });

  useEffect(() => {
    if (open && business) {
      const produces = BUSINESS_PRODUCES[business.typeKey] ?? [];
      setStock(produces.map((r, i) => ({ resource: r as ResourceType, qty: 20 + i * 15 })));
      setStorage({ used: 35, base: 50, silos: 0, hasWarehouse: false });
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

        <Tabs defaultValue="production" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="shrink-0 rounded-none border-b border-border/60 bg-muted/10 px-4 py-0 h-10 justify-start gap-0">
            {([
              { value: 'production', label: 'Équipe' },
              { value: 'stock', label: 'Stock' },
              { value: 'crafting', label: 'Fabrication' },
              { value: 'storage', label: 'Stockage' },
            ] as const).map(({ value, label }) => (
              <TabsTrigger key={value} value={value}
                className="h-10 rounded-none border-b-2 border-transparent px-4 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <TabsContent value="production" className="m-0 p-5">
              <ProductionTab business={business} currentUserId={currentUserId} onWorkDone={() => onReload?.()} />
            </TabsContent>
            <TabsContent value="stock" className="m-0 p-5">
              <StockTab stock={stock} storage={storage} />
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
