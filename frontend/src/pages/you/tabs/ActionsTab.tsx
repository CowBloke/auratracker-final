import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowRight, ArrowUpCircle, Building2, CheckCircle2, Clock, Coins,
  Hammer, Layers, Loader2, Package, Plus, Play, RefreshCw, Settings2, ShoppingCart, Star, User, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Toggle } from '@/components/ui/toggle';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AppModal } from '@/components/ui/app-modal';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BUSINESS_COLOR_HEX, BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { ManageBusinessModal } from '../components/modals';
import {
  type YouBusiness,
  type YouConstructionProject,
  type YouResourceAction,
  type YouResourceActionBusiness,
  type YouResourceActionCost,
  type YouResourceActionSourceInput,
  type YouResourceActionSourceOption,
  type YouState,
  type YouSupplyInventory,
  youApi,
} from '@/services/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

const UPGRADE_CONFIGS = {
  productionSpeed: [
    { level: 0, multiplier: 1.0, cost: 0, label: "Standard", desc: "Production à vitesse normale." },
    { level: 1, multiplier: 2.0, cost: 350000, label: "Survoltage I", desc: "Production accélérée à 200%." },
    { level: 2, multiplier: 3.0, cost: 800000, label: "Survoltage II", desc: "Vitesse maximale de production à 300%." },
  ],
  stockSize: [
    { level: 0, multiplier: 1.0, cost: 0, label: "Standard", desc: "Stockage de base." },
    { level: 1, multiplier: 1.5, cost: 150000, label: "Entrepôt I", desc: "+50% de capacité maximale de stock." },
    { level: 2, multiplier: 2.0, cost: 400000, label: "Entrepôt II", desc: "+100% de capacité maximale de stock." },
    { level: 3, multiplier: 3.0, cost: 950000, label: "Entrepôt III", desc: "+200% de capacité maximale de stock." },
  ],
  queue: [
    { level: 0, queueSize: 1, cost: 0, label: "Manuel", desc: "Lancement unitaire des productions." },
    { level: 1, queueSize: 3, cost: 250000, label: "Séquenceur I", desc: "File d'attente de 2 productions similaires." },
    { level: 2, queueSize: 5, cost: 500000, label: "Séquenceur II", desc: "File d'attente de 4 productions similaires." },
    { level: 3, queueSize: 999, cost: 1200000, label: "Automatisation", desc: "Activer la Production en Continu (Loop automatique)." },
  ],
};

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) { return Math.round(v).toLocaleString('fr-FR'); }

function resourceLabel(rt: string) {
  return RESOURCE_META[rt as ResourceType]?.label ?? rt;
}

function sourceValue(opt: YouResourceActionSourceOption) {
  return opt.kind === 'inventory' ? `inventory:${opt.businessId}` : `offer:${opt.id}`;
}

function sourceInputFromValue(v: string): YouResourceActionSourceInput | null {
  const [kind, id] = v.split(':');
  if (kind === 'inventory' && id) return { kind: 'inventory', businessId: id };
  if (kind === 'offer' && id) return { kind: 'offer', offerId: id };
  return null;
}

function sortSources(businessId: string, opts: YouResourceActionSourceOption[]) {
  return [...opts].sort((a, b) => {
    const aOwn = a.kind === 'inventory' && a.businessId === businessId ? 0 : 1;
    const bOwn = b.kind === 'inventory' && b.businessId === businessId ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;
    const aInv = a.kind === 'inventory' ? 0 : 1;
    const bInv = b.kind === 'inventory' ? 0 : 1;
    if (aInv !== bInv) return aInv - bInv;
    return a.unitPrice - b.unitPrice;
  });
}

function getOptions(
  biz: YouResourceActionBusiness,
  cost: YouResourceActionCost,
  sourceOptions: YouResourceActionSourceOption[],
) {
  return sortSources(
    biz.id,
    sourceOptions.filter((o) =>
      o.resourceType === cost.resourceType
      && o.quantity >= cost.quantity
      && !(o.kind === 'offer' && o.businessId === biz.id)
      && (o.kind !== 'inventory' || o.businessId === biz.id)
    ),
  );
}

function getSelected(
  biz: YouResourceActionBusiness,
  action: YouResourceAction,
  cost: YouResourceActionCost,
  sourceOptions: YouResourceActionSourceOption[],
  selections: Record<string, string>,
) {
  const key = `${biz.id}:${action.key}:${cost.resourceType}`;
  const opts = getOptions(biz, cost, sourceOptions);
  const sel = selections[key];
  return opts.find((o) => sourceValue(o) === sel) ?? opts[0] ?? null;
}

function sourceCost(bizId: string, cost: YouResourceActionCost, opt: YouResourceActionSourceOption | null) {
  if (!opt) return 0;
  if (opt.kind === 'inventory' && opt.businessId === bizId) return 0;
  return opt.unitPrice * cost.quantity;
}

function getBusinessHex(typeKey: string) {
  return BUSINESS_COLOR_HEX[typeKey] ?? '#64748b';
}
function getBusinessStyle(typeKey: string) {
  return BUSINESS_STYLE_MAP[typeKey as keyof typeof BUSINESS_STYLE_MAP] ?? { iconWrap: 'bg-muted', icon: 'text-muted-foreground' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Stock level of one resource (right column of each recipe)
function StockCard({ inventory }: { inventory: YouSupplyInventory }) {
  const meta = RESOURCE_META[inventory.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  const pct = inventory.capacity > 0 ? Math.min(100, (inventory.quantity / inventory.capacity) * 100) : 0;
  return (
    <Item variant="outline" size="sm" className="flex-1">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="w-full justify-between">
          {resourceLabel(inventory.resourceType)}
          <span className="text-xs font-normal tabular-nums text-muted-foreground">~{inventory.globalMarketUnitPrice}€</span>
        </ItemTitle>
        <Progress value={pct} />
        <ItemDescription className="tabular-nums">
          {inventory.quantity} / {inventory.capacity}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

// Funding source (business treasury or personal money) for the action total
function TotalPaymentCard({
  biz, totalCost, isPersonalPay, userMoney, onSelect,
}: {
  biz: YouResourceActionBusiness;
  totalCost: number;
  isPersonalPay: boolean;
  userMoney: number;
  onSelect: (value: 'business' | 'personal') => void;
}) {
  const value = isPersonalPay ? 'personal' : 'business';
  const availableMoney = isPersonalPay ? userMoney : biz.treasuryMoney;
  const treasuryShort = availableMoney < totalCost;

  return (
    <Item variant="outline" size="sm" className={cn(treasuryShort && 'border-destructive/50')}>
      <ItemMedia variant="icon">
        <Coins />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="w-full justify-between">
          Total à payer
          <span className={cn('tabular-nums', treasuryShort && 'text-destructive')}>{totalCost > 0 ? `${fmt(totalCost)}€` : '0€'}</span>
        </ItemTitle>
        <Select value={value} onValueChange={(v) => onSelect(v as 'business' | 'personal')}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="business">
              Trésorerie pro · {fmt(biz.treasuryMoney)}€ dispo{biz.treasuryMoney < totalCost ? ' (faible)' : ''}
            </SelectItem>
            <SelectItem value="personal">
              Ma poche · {fmt(userMoney)}€ dispo{userMoney < totalCost ? ' (faible)' : ''}
            </SelectItem>
          </SelectContent>
        </Select>
        {treasuryShort ? <ItemDescription className="text-destructive">Insuffisant</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
}

// Ingredient of a recipe, with its source selector
function IngredientCard({
  biz, action, cost, sourceOptions, selections, onSelect, onBuyAtMarket,
}: {
  biz: YouResourceActionBusiness;
  action: YouResourceAction;
  cost: YouResourceActionCost;
  sourceOptions: YouResourceActionSourceOption[];
  selections: Record<string, string>;
  onSelect: (key: string, value: string) => void;
  onBuyAtMarket: (resourceType: string) => void;
}) {
  const key = `${biz.id}:${action.key}:${cost.resourceType}`;
  const opts = getOptions(biz, cost, sourceOptions);
  const selected = getSelected(biz, action, cost, sourceOptions, selections);
  const value = selected ? sourceValue(selected) : '';
  const meta = RESOURCE_META[cost.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  const noSource = opts.length === 0 || !selected;
  const extra = selected ? sourceCost(biz.id, cost, selected) : 0;

  if (noSource) {
    return (
      <Item asChild variant="outline" size="sm" className="border-destructive/50">
        <button type="button" onClick={() => onBuyAtMarket(cost.resourceType)} className="w-full text-left">
          <ItemMedia variant="icon">
            <Icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{cost.quantity}× {resourceLabel(cost.resourceType)}</ItemTitle>
            <ItemDescription className="flex items-center gap-1 text-destructive">
              <AlertCircle className="size-3" />
              Stock insuffisant
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="outline">
              Acheter <ShoppingCart />
            </Badge>
          </ItemActions>
        </button>
      </Item>
    );
  }

  const describe = (opt: YouResourceActionSourceOption) => {
    const own = opt.kind === 'inventory' && opt.businessId === biz.id;
    const price = own ? 'gratuit' : `${fmt(opt.unitPrice)}€/unité`;
    const tag = own ? ' · interne' : opt.kind === 'offer' && !opt.autoAccept ? ' · offre' : '';
    return `${opt.businessName}${tag} · ${opt.quantity} dispo · ${price}`;
  };

  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="w-full justify-between">
          {cost.quantity}× {resourceLabel(cost.resourceType)}
          <span className={cn('text-xs tabular-nums', extra > 0 ? 'text-warning' : 'text-success')}>
            {extra > 0 ? `${fmt(extra)}€` : 'Gratuit'}
          </span>
        </ItemTitle>
        <Select value={value} onValueChange={(v) => onSelect(key, v)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {opts.map((opt) => (
              <SelectItem key={sourceValue(opt)} value={sourceValue(opt)}>
                {describe(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ItemContent>
    </Item>
  );
}

// One action as a pipeline row: [Ingrédients] → [Produire] → [Stock]
function ActionPipeline({
  biz, action, hex, sourceOptions, selections, mutatingKey, onSelectSource, onRun, onBuyAtMarket, onSellAll, onReload, onToggleConstantProd,
}: {
  biz: YouResourceActionBusiness;
  action: YouResourceAction;
  hex: string;
  sourceOptions: YouResourceActionSourceOption[];
  selections: Record<string, string>;
  mutatingKey: string | null;
  onSelectSource: (k: string, v: string) => void;
  onRun: (biz: YouResourceActionBusiness, action: YouResourceAction, sources: Record<string, YouResourceActionSourceInput>, payFromPersonal?: boolean) => Promise<void>;
  onBuyAtMarket: (resourceType: string) => void;
  onSellAll: (resourceType: string) => void;
  onReload?: () => void;
  onToggleConstantProd: (bizId: string, actionKey: string, enabled: boolean) => Promise<void>;
}) {
  const { user } = useAuth();
  const userMoney = Number(user?.money ?? 0);
  const moneySelectionKey = `${biz.id}:${action.key}:MONEY`;
  const isPersonalPay = selections[moneySelectionKey] === 'personal';

  const activeAction = biz.activeActions?.find((a) => a.actionKey === action.key);
  const isCooldownActive = Boolean(activeAction);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!activeAction) {
      setTimeLeft(0);
      return;
    }
    const update = () => {
      const remaining = new Date(activeAction.endsAt).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft(0);
        if (onReload) onReload();
      } else {
        setTimeLeft(Math.ceil(remaining / 1000));
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeAction, onReload]);

  const selected = action.resourceCosts.map((cost) => ({
    cost,
    source: getSelected(biz, action, cost, sourceOptions, selections),
  }));
  const extraCost = selected.reduce((sum, e) => sum + sourceCost(biz.id, e.cost, e.source), 0);
  const totalCost = action.moneyCost + extraCost;

  const availableMoney = isPersonalPay ? userMoney : biz.treasuryMoney;
  const treasuryShort = availableMoney < totalCost;

  const missingSource = selected.some((e) => !e.source);
  const outputFull = action.outputs.some((o) => {
    const inv = biz.inventories.find((i) => i.resourceType === o.resourceType);
    return inv ? inv.quantity + o.quantity > inv.capacity : false;
  });
  const blocked = missingSource || outputFull || treasuryShort;
  const rowKey = `${biz.id}:${action.key}`;
  const running = mutatingKey === rowKey;

  const upgrades = biz.upgrades ?? { productionSpeedLvl: 0, stockSizeLvl: 0, queueLvl: 0 };
  const queueConfig = UPGRADE_CONFIGS.queue[upgrades.queueLvl] ?? UPGRADE_CONFIGS.queue[0];
  const maxQueueSize = queueConfig.queueSize - 1; // max queued *additional* actions
  const queuedCount = biz.queuedActions?.filter((q) => q.actionKey === action.key).length ?? 0;

  const isPlayDisabled = blocked || running || (isCooldownActive && maxQueueSize <= 0) || (isCooldownActive && queuedCount >= maxQueueSize);

  const run = async () => {
    const sources: Record<string, YouResourceActionSourceInput> = {};
    for (const e of selected) {
      if (!e.source) return;
      const si = sourceInputFromValue(sourceValue(e.source));
      if (!si) return;
      sources[e.cost.resourceType] = si;
    }
    await onRun(biz, action, sources, isPersonalPay);
  };

  const parsedCustomData = biz.customData ? JSON.parse(biz.customData) : {};
  const isConstantProdEnabled = parsedCustomData.constantProduction?.[action.key] ?? false;

  const blockedReason = missingSource
    ? 'Source manquante'
    : outputFull ? 'Stock plein'
    : treasuryShort ? 'Trésorerie faible'
    : isCooldownActive && queuedCount >= maxQueueSize ? 'File pleine'
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {action.label}
          {action.rewardMoney > 0 && <Badge variant="success">+{fmt(action.rewardMoney)}€ à la fin</Badge>}
        </CardTitle>
        <CardAction className="flex flex-wrap items-center gap-2">
          {upgrades.queueLvl >= 3 && (
            <Toggle
              size="sm"
              variant="outline"
              pressed={isConstantProdEnabled}
              onPressedChange={(pressed) => void onToggleConstantProd(biz.id, action.key, pressed)}
            >
              <RefreshCw />
              {isConstantProdEnabled ? 'Loop : ON' : 'Loop : OFF'}
            </Toggle>
          )}
          {isCooldownActive && (
            <Badge variant="warning">
              <Clock /> Action active — {timeLeft}s
            </Badge>
          )}
          {queuedCount > 0 && (
            <Badge variant="secondary">
              <RefreshCw /> {queuedCount} en file
            </Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-2" data-tutorial-id="actions-ingredients">
          <p className="text-xs font-medium text-muted-foreground">Ingrédients</p>

          {action.moneyCost > 0 && (
            <Item variant="outline" size="sm">
              <ItemMedia variant="icon">
                <Coins />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Frais de production</ItemTitle>
                <ItemDescription>Coût fixe</ItemDescription>
              </ItemContent>
              <ItemActions>
                <span className="text-sm font-semibold tabular-nums">{fmt(action.moneyCost)}€</span>
              </ItemActions>
            </Item>
          )}

          {action.resourceCosts.map((cost) => (
            <IngredientCard
              key={cost.resourceType}
              biz={biz}
              action={action}
              cost={cost}
              sourceOptions={sourceOptions}
              selections={selections}
              onSelect={onSelectSource}
              onBuyAtMarket={onBuyAtMarket}
            />
          ))}

          <TotalPaymentCard
            biz={biz}
            totalCost={totalCost}
            isPersonalPay={isPersonalPay}
            userMoney={userMoney}
            onSelect={(val) => onSelectSource(moneySelectionKey, val)}
          />
        </div>

        <div className="flex flex-col items-center justify-center gap-2 lg:self-center" data-tutorial-id="actions-produce-button">
          <Button
            type="button"
            size="icon"
            onClick={() => void run()}
            disabled={isPlayDisabled}
            title={action.label}
            aria-label={action.label}
          >
            {running ? (
              <Spinner />
            ) : isCooldownActive && maxQueueSize > 0 && queuedCount < maxQueueSize ? (
              <Plus />
            ) : isCooldownActive && queuedCount >= maxQueueSize ? (
              <span className="text-xs font-semibold">{timeLeft}s</span>
            ) : (
              <Play />
            )}
          </Button>
          <span className="max-w-24 text-center text-xs text-muted-foreground">
            {isCooldownActive && maxQueueSize > 0 && queuedCount < maxQueueSize
              ? 'Ajouter à la file'
              : isCooldownActive
                ? `Actif (${timeLeft}s)`
                : action.label}
          </span>
          {blockedReason && !running && (!isCooldownActive || isPlayDisabled) && (
            <Badge variant="destructive">
              <AlertTriangle /> {blockedReason}
            </Badge>
          )}
        </div>

        {action.outputs.length > 0 && (
          <div className="flex min-w-0 flex-col gap-2" data-tutorial-id="actions-stock">
            <p className="text-xs font-medium text-muted-foreground">Stock</p>
            {action.outputs.map((o) => {
              const inv = biz.inventories.find((i) => i.resourceType === o.resourceType);
              if (!inv) return null;
              return (
                <div key={o.resourceType} className="flex items-stretch gap-2">
                  <StockCard inventory={inv} />
                  <Button type="button" variant="outline" className="h-auto flex-col gap-0.5 px-3" onClick={() => onSellAll(o.resourceType)} title="Mettre en vente">
                    <ShoppingCart />
                    <span className="text-xs">Vendre</span>
                  </Button>
                  <Badge variant="success" className="self-start tabular-nums">+{o.quantity}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Construction panel ────────────────────────────────────────────────────────

function useCountdown(completesAt: string | null): string {
  const [label, setLabel] = useState('');
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!completesAt) { setLabel(''); return; }
    const tick = () => {
      const diff = new Date(completesAt).getTime() - Date.now();
      if (diff <= 0) { setLabel('Terminé'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}h ${m}min` : m > 0 ? `${m}min ${s}s` : `${s}s`);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [completesAt]);

  return label;
}

function ConstructionPanel({
  biz,
  project,
  sourceOptions,
  onDone,
}: {
  biz: YouResourceActionBusiness;
  project: YouConstructionProject;
  sourceOptions: YouResourceActionSourceOption[];
  onDone: () => void;
}) {
  const countdown = useCountdown(project.completesAt ?? null);
  const [sources, setSources] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const timerStarted = Boolean(project.completesAt);
  const isDone = timerStarted && countdown === 'Terminé';

  const inventoryOptions = (resourceType: string) =>
    sourceOptions.filter((o) => o.kind === 'inventory' && o.resourceType === resourceType);

  const allSourcesSelected = project.materials.every((m) => sources[m.resourceType]);

  const handleLaunch = async () => {
    setSubmitting(true);
    try {
      await youApi.supplyConstructionMaterials(biz.id, sources);
      toast.success('Chantier lancé !');
      onDone();
    } catch (err: any) {
      const code = err?.response?.data?.error ?? '';
      if (code.startsWith('INSUFFICIENT_INVENTORY_')) {
        const rt = code.replace('INSUFFICIENT_INVENTORY_', '');
        toast.error(`Stock insuffisant pour ${RESOURCE_META[rt as ResourceType]?.label ?? rt}.`);
      } else if (code.startsWith('MISSING_SOURCE_')) {
        toast.error('Sélectionnez une source pour chaque matériau.');
      } else {
        toast.error(code || 'Impossible de lancer le chantier.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Chantier terminé !</AlertTitle>
        <AlertDescription>
          <p>Actualise pour débloquer la production.</p>
          <Button size="sm" variant="outline" onClick={onDone} className="mt-2">
            <RefreshCw /> Actualiser
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (timerStarted) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="warning">
          <Hammer />
          <AlertTitle>Chantier en cours</AlertTitle>
          <AlertDescription>
            Terminé dans <span className="font-mono font-semibold text-foreground">{countdown}</span>
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {project.materials.map((m) => (
            <Item key={m.resourceType} variant="outline" size="sm">
              <ItemMedia variant="icon">
                <CheckCircle2 />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {RESOURCE_META[m.resourceType as ResourceType]?.label ?? m.resourceType} ×{m.requiredQuantity}
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Hammer className="size-4" /> Plan de construction
        </p>
        <span className="text-xs text-muted-foreground">Choisis les sources</span>
      </div>

      <div className="flex flex-col gap-2">
        {project.materials.map((m) => {
          const opts = inventoryOptions(m.resourceType);
          const meta = RESOURCE_META[m.resourceType as ResourceType];
          const Icon = meta?.Icon ?? Building2;
          const selected = sources[m.resourceType];
          const selectedOpt = opts.find((o) => o.businessId === selected);
          const hasEnough = selectedOpt ? selectedOpt.quantity >= m.requiredQuantity : false;

          return (
            <Item key={m.resourceType} variant="outline" size="sm">
              <ItemMedia variant="icon">
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {meta?.label ?? m.resourceType}
                  <span className="font-normal text-muted-foreground">×{m.requiredQuantity}</span>
                </ItemTitle>
              </ItemContent>
              <ItemActions className="w-56">
                {opts.length === 0 ? (
                  <span className="text-xs text-destructive">Aucun stock disponible</span>
                ) : (
                  <Select
                    value={selected ?? ''}
                    onValueChange={(v) => setSources((prev) => ({ ...prev, [m.resourceType]: v }))}
                  >
                    <SelectTrigger size="sm" className="w-full" aria-invalid={Boolean(selected && !hasEnough)}>
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {opts.map((o) => (
                        <SelectItem key={o.businessId} value={o.businessId}>
                          {o.businessName} ({o.quantity} dispo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </ItemActions>
            </Item>
          );
        })}
      </div>

      <Button disabled={!allSourcesSelected || submitting} onClick={handleLaunch}>
        {submitting ? <Spinner /> : <Hammer />}
        {submitting ? 'Lancement…' : 'Lancer le chantier'}
      </Button>
    </div>
  );
}

// Business card
function BusinessCard({
  biz, sourceOptions, selections, mutatingKey,
  onSelectSource, onRun, onBuyAtMarket, onSellAll, onManage, onReload,
  onUpgradeClick, onToggleConstantProd,
}: {
  biz: YouResourceActionBusiness;
  sourceOptions: YouResourceActionSourceOption[];
  selections: Record<string, string>;
  mutatingKey: string | null;
  onSelectSource: (k: string, v: string) => void;
  onRun: (biz: YouResourceActionBusiness, action: YouResourceAction, sources: Record<string, YouResourceActionSourceInput>, payFromPersonal?: boolean) => Promise<void>;
  onBuyAtMarket: (resourceType: string, forBusinessId: string) => void;
  onSellAll: (biz: YouResourceActionBusiness, resourceType: string) => void;
  onManage: (bizId: string) => void;
  onReload?: () => void;
  onUpgradeClick: (biz: YouResourceActionBusiness) => void;
  onToggleConstantProd: (bizId: string, actionKey: string, enabled: boolean) => Promise<void>;
}) {
  const hex = getBusinessHex(biz.typeKey);
  const Icon = BUSINESS_ICON_MAP[biz.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;

  const upgrades = biz.upgrades ?? { productionSpeedLvl: 0, stockSizeLvl: 0, queueLvl: 0 };

  const specialization = (() => {
    if (biz.typeKey !== 'juterie' || !biz.customData) return '';
    try {
      const d = JSON.parse(biz.customData) as { juiceSpecialization?: string };
      const names: Record<string, string> = {
        JUICE_ABRICOT: 'abricot', JUICE_GINGEMBRE: 'gingembre',
        JUICE_PAPAYE: 'papaye', JUICE_MALAKOUKOU: 'malakoukou', JUICE_GOYAVE: 'goyave',
      };
      return d.juiceSpecialization ? ` · ${names[d.juiceSpecialization] ?? d.juiceSpecialization}` : '';
    } catch { return ''; }
  })();

  return (
    <Card data-tutorial-id="actions-business-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4" />
          {biz.name}
        </CardTitle>
        <CardDescription>
          {biz.typeLabel}{specialization}{biz.underConstruction ? ' · chantier' : ''}
        </CardDescription>
        <CardAction className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="warning" className="tabular-nums">
            <Coins />{fmt(biz.treasuryMoney)}€
          </Badge>
          {biz.avgRating != null && (
            <Badge variant="success">
              <Star />{biz.avgRating.toFixed(1)}/5
            </Badge>
          )}
          <Button type="button" size="sm" variant="outline" data-tutorial-id="actions-upgrade-button" onClick={() => onUpgradeClick(biz)}>
            <ArrowUpCircle /> Améliorer ({upgrades.productionSpeedLvl + upgrades.stockSizeLvl + upgrades.queueLvl}/8)
          </Button>
          <Button type="button" size="sm" variant="outline" data-tutorial-id="actions-manage-button" onClick={() => onManage(biz.id)}>
            <Settings2 /> Gérer
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {biz.underConstruction && biz.constructionProject ? (
          <ConstructionPanel
            biz={biz}
            project={biz.constructionProject}
            sourceOptions={sourceOptions}
            onDone={onReload ?? (() => {})}
          />
        ) : biz.actions.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyDescription>Aucune recette de production disponible.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          biz.actions.map((action) => (
            <ActionPipeline
              key={action.key}
              biz={biz}
              action={action}
              hex={hex}
              sourceOptions={sourceOptions}
              selections={selections}
              mutatingKey={mutatingKey}
              onSelectSource={onSelectSource}
              onRun={onRun}
              onBuyAtMarket={(rt) => onBuyAtMarket(rt, biz.id)}
              onSellAll={(rt) => onSellAll(biz, rt)}
              onReload={onReload}
              onToggleConstantProd={onToggleConstantProd}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function getUpgradeStat(type: 'productionSpeed' | 'stockSize' | 'queue', lvl: number): string {
  if (type === 'productionSpeed') {
    const mult = UPGRADE_CONFIGS.productionSpeed[lvl]?.multiplier ?? 1.0;
    return `${mult * 100}%`;
  }
  if (type === 'stockSize') {
    const mult = UPGRADE_CONFIGS.stockSize[lvl]?.multiplier ?? 1.0;
    return `+${Math.round((mult - 1.0) * 100)}%`;
  }
  if (type === 'queue') {
    const size = UPGRADE_CONFIGS.queue[lvl]?.queueSize ?? 1;
    if (size === 999) return 'Loop continu';
    if (size === 1) return 'Manuel';
    return `${size - 1} slot${size - 1 > 1 ? 's' : ''}`;
  }
  return '';
}

interface BusinessUpgradesModalProps {
  open: boolean;
  onClose: () => void;
  biz: YouResourceActionBusiness | null;
  onBuyUpgrade: (bizId: string, upgradeType: 'productionSpeed' | 'stockSize' | 'queue', level: number) => Promise<void>;
}

function BusinessUpgradesModal({ open, onClose, biz, onBuyUpgrade }: BusinessUpgradesModalProps) {
  if (!biz) return null;

  const upgrades = biz.upgrades ?? { productionSpeedLvl: 0, stockSizeLvl: 0, queueLvl: 0 };
  const totalLevels = upgrades.productionSpeedLvl + upgrades.stockSizeLvl + upgrades.queueLvl;

  const configKeys: ('productionSpeed' | 'stockSize' | 'queue')[] = ['productionSpeed', 'stockSize', 'queue'];

  const UPGRADE_DETAILS = {
    productionSpeed: { title: 'Vitesse production', maxLevel: 2, Icon: Zap },
    stockSize: { title: 'Taille des stocks', maxLevel: 3, Icon: Package },
    queue: { title: "File d'attente", maxLevel: 3, Icon: Layers },
  };

  return (
    <AppModal open={open} onClose={onClose} tone="money" size="lg" description={`Améliorations de production pour ${biz.name}`}>
      <AppModal.Header
        tone="money"
        icon={<ArrowUpCircle />}
        title={`Améliorations · ${biz.name}`}
        subtitle={
          <span className="flex items-center gap-2">
            Booste l'efficacité et l'automatisation de tes lignes.
            <Badge variant="secondary">{totalLevels} / 8 niveaux</Badge>
          </span>
        }
      />
      <AppModal.Body>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {configKeys.map((type) => {
            const currentLevel = upgrades[`${type}Lvl` as keyof typeof upgrades] ?? 0;
            const details = UPGRADE_DETAILS[type];
            const maxLevel = details.maxLevel;
            const isMax = currentLevel >= maxLevel;

            const configList = UPGRADE_CONFIGS[type];
            const currentData = configList[currentLevel];
            const nextData = !isMax ? configList[currentLevel + 1] : null;

            const Icon = details.Icon;

            const currentStat = getUpgradeStat(type, currentLevel);
            const nextStat = nextData ? getUpgradeStat(type, currentLevel + 1) : '';

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-4" />
                    {details.title}
                  </CardTitle>
                  <CardDescription>{currentData?.desc}</CardDescription>
                  <CardAction>
                    <Badge variant="outline" className="tabular-nums">{currentLevel}/{maxLevel}</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <Progress value={(currentLevel / maxLevel) * 100} />
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Effet actuel</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      {currentStat}
                      {!isMax && (
                        <>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="text-success">{nextStat}</span>
                        </>
                      )}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  {isMax ? (
                    <Badge variant="success" className="w-full justify-center">Niveau maximum</Badge>
                  ) : (
                    <Button className="w-full" onClick={() => onBuyUpgrade(biz.id, type, currentLevel + 1)}>
                      Améliorer · {fmt(nextData?.cost ?? 0)}€
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </AppModal.Body>
      <AppModal.Footer left={
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="size-4" />
          Trésorerie dispo : <strong className="text-foreground">{fmt(biz.treasuryMoney)}€</strong>
        </span>
      }>
        <AppModal.Button variant="ghost" onClick={onClose}>Fermer</AppModal.Button>
      </AppModal.Footer>
    </AppModal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActionsTab({ data, userId, onReload }: { data: YouState; userId: string; onReload?: () => void }) {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const { user } = useAuth();
  const [state, setState] = useState<import('@/services/api').YouResourceActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [managedBizId, setManagedBizId] = useState<string | null>(null);
  const [upgradingBiz, setUpgradingBiz] = useState<YouResourceActionBusiness | null>(null);

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const allAccessibleBiz = [...data.ownedBusinesses, ...data.memberBusinesses];
  const managedBiz: YouBusiness | null = managedBizId
    ? (allAccessibleBiz.find((b) => b.id === managedBizId) ?? null)
    : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await youApi.getResourceActionState();
      setState(res.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de charger les actions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const businesses = useMemo(() => state?.businesses ?? [], [state]);
  const sourceOptions = state?.sourceOptions ?? [];

  const selectSource = (key: string, value: string) => {
    setSelections((s) => ({ ...s, [key]: value }));
  };

  const buyUpgrade = async (bizId: string, upgradeType: 'productionSpeed' | 'stockSize' | 'queue', level: number) => {
    try {
      await youApi.buyBusinessUpgrade(bizId, upgradeType, level);
      toast.success("Amélioration achetée avec succès !");
      await load();
      onReload?.();
    } catch (error: any) {
      const err = error?.response?.data?.error;
      if (err === 'BUSINESS_TREASURY_TOO_LOW') {
        toast.error("La trésorerie du business est insuffisante pour acheter cette amélioration.");
      } else {
        toast.error(err || "Impossible d'acheter l'amélioration.");
      }
    }
  };

  const toggleConstantProd = async (bizId: string, actionKey: string, enabled: boolean) => {
    try {
      await youApi.toggleConstantProduction(bizId, actionKey, enabled);
      toast.success(enabled ? "Production en continu activée !" : "Production en continu désactivée.");
      await load();
      onReload?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Impossible de modifier la production en continu.");
    }
  };

  const runAction = async (
    biz: YouResourceActionBusiness,
    action: YouResourceAction,
    sources: Record<string, YouResourceActionSourceInput>,
    payFromPersonal?: boolean,
  ) => {
    const rowKey = `${biz.id}:${action.key}`;
    setMutatingKey(rowKey);
    try {
      const res = await youApi.runResourceAction(biz.id, { actionKey: action.key, sources, payFromPersonal });
      const r = res.data.result;
      toast.success(`${action.label} — coût ${fmt(r.totalMoneyCost)}€${r.rewardMoney > 0 ? `, gain ${fmt(r.rewardMoney)}€` : ''}.`);
      await load();
      onReload?.();
    } catch (error: any) {
      const errCode = error?.response?.data?.error;
      if (errCode === 'USER_MONEY_TOO_LOW') {
        toast.error("Ton solde personnel est insuffisant pour payer cette action.");
      } else if (errCode === 'BUSINESS_TREASURY_TOO_LOW') {
        toast.error("La trésorerie du business est insuffisante pour payer cette action.");
      } else {
        toast.error(errCode || 'Action impossible.');
      }
    } finally {
      setMutatingKey(null);
    }
  };

  const handleBuyAtMarket = (resourceType: string, forBusinessId: string) => {
    navigate(`/you?tab=salle-de-marche&resource=${resourceType}&for=${forBusinessId}`);
  };

  const handleSellAll = (biz: YouResourceActionBusiness, resourceType: string) => {
    navigate(`/you?tab=salle-de-marche&sell=${resourceType}&from=${biz.id}`);
  };

  if (loading && !state) {
    return (
      <div className="flex min-h-[360px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Chargement des actions…
      </div>
    );
  }

  const pendingOffers = data.jobOffers.filter((o) => o.needsViewerAcceptance);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {businesses.length} business{businesses.length > 1 ? 'es' : ''} · chaîne de production
        </p>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || mutatingKey !== null}>
          {loading ? <Spinner /> : <RefreshCw />}
          Actualiser
        </Button>
      </div>

      {pendingOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contrats en attente ({pendingOffers.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pendingOffers.map((offer) => (
              <Item key={offer.id} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{offer.business.name}</ItemTitle>
                  <ItemDescription>
                    {offer.initiatedByRole === 'EMPLOYER' ? offer.employer.username : offer.employee.username} · {offer.salary.toLocaleString('fr-FR')}€/j
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" onClick={async () => { await youApi.respondToBusinessInvitation(offer.id, 'accept'); onReload?.(); }}>Accepter</Button>
                  <Button size="sm" variant="outline" onClick={async () => { await youApi.respondToBusinessInvitation(offer.id, 'reject'); onReload?.(); }}>Refuser</Button>
                </ItemActions>
              </Item>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Business pipeline cards */}
      {businesses.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyDescription>Aucun business disponible. Crée ta première entreprise depuis l'onglet Carte.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        businesses.map((biz) => (
          <BusinessCard
            key={biz.id}
            biz={biz}
            sourceOptions={sourceOptions}
            selections={selections}
            mutatingKey={mutatingKey}
            onSelectSource={selectSource}
            onRun={runAction}
            onBuyAtMarket={handleBuyAtMarket}
            onSellAll={handleSellAll}
            onManage={(id) => setManagedBizId(id)}
            onReload={load}
            onUpgradeClick={(b) => setUpgradingBiz(b)}
            onToggleConstantProd={toggleConstantProd}
          />
        ))
      )}

      {/* Modals */}
      <ManageBusinessModal
        open={managedBiz !== null}
        onClose={() => setManagedBizId(null)}
        business={managedBiz}
        currentUserId={userId}
        players={data.players}
        onInviteRequested={() => {}}
        onSubmitted={async () => { onReload?.(); await load(); }}
      />
      {upgradingBiz !== null && (
        <BusinessUpgradesModal
          open={upgradingBiz !== null}
          onClose={() => setUpgradingBiz(null)}
          biz={businesses.find((b) => b.id === upgradingBiz.id) ?? null}
          onBuyUpgrade={buyUpgrade}
        />
      )}
    </div>
  );
}

