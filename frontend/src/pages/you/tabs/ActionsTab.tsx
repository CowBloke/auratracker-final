import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowRight, ArrowUpCircle, Building2, Clock, Coins,
  Layers, Loader2, Package, Play, Plus, RefreshCw, Settings2, ShoppingCart, User, Zap,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select';
import { AppModal } from '@/components/ui/app-modal';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { BUSINESS_COLOR_HEX, BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import { CreateBusinessModal, ManageBusinessModal } from '../components/modals';
import {
  type YouBusiness,
  type YouResourceAction,
  type YouResourceActionBusiness,
  type YouResourceActionCost,
  type YouResourceActionSourceInput,
  type YouResourceActionSourceOption,
  type YouState,
  type YouSupplyInventory,
  youApi,
} from '@/services/api';

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

// Color-coded stock card (used in the right column of each recipe)
function StockCard({ inventory }: { inventory: YouSupplyInventory }) {
  const meta = RESOURCE_META[inventory.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  const pct = inventory.capacity > 0 ? Math.min(100, (inventory.quantity / inventory.capacity) * 100) : 0;
  const barCls = meta?.iconColor?.split(' ')[0]?.replace('text-', 'bg-') ?? 'bg-muted-foreground';
  return (
    <div className={cn('rounded-xl border p-2 h-[58px] flex flex-col justify-between', meta?.bg ?? 'bg-muted/20', 'border-border/30')}>
      <div className="flex items-center justify-between gap-1 leading-none">
        <div className="flex items-center gap-1 min-w-0">
          <Icon className={cn('h-3 w-3 shrink-0', meta?.iconColor ?? 'text-muted-foreground')} />
          <span className={cn('text-[10px] font-bold truncate', meta?.iconColor ?? 'text-muted-foreground')}>{resourceLabel(inventory.resourceType)}</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 leading-none">~{inventory.globalMarketUnitPrice}€</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10 my-0.5">
        <div className={cn('h-full rounded-full transition-all opacity-70', barCls)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] leading-none">
        <span className={cn('font-bold tabular-nums', meta?.iconColor ?? 'text-foreground')}>{inventory.quantity}</span>
        <span className="text-muted-foreground">/ {inventory.capacity}</span>
      </div>
    </div>
  );
}

// Total Payment Card - shows total sum and allows selecting funding source
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
    <Select value={value} onValueChange={(v) => onSelect(v as 'business' | 'personal')}>
      <SelectTrigger
        className={cn(
          'p-0 rounded-xl border flex items-center overflow-hidden h-[58px] text-left w-full shadow-sm transition duration-200 mt-1',
          'focus:ring-1 focus:ring-primary/20 hover:bg-background/80',
          treasuryShort
            ? 'border-red-500/30 bg-red-500/8'
            : 'border-border/40 bg-muted/20'
        )}
      >
        {/* Left: Full height Icon block */}
        <div className={cn(
          "flex h-full w-12 shrink-0 items-center justify-center border-r transition",
          treasuryShort
            ? "bg-red-500/15 border-red-500/20 text-red-500"
            : "bg-muted/40 border-border/40 text-foreground"
        )}>
          <Coins className="h-5 w-5" />
        </div>

        {/* Right: Info block */}
        <div className="flex flex-col justify-center h-full flex-1 min-w-0 px-3 py-1 pr-6 relative text-left gap-1">
          <div className="flex items-baseline justify-between w-full leading-none">
            <span className="text-[13px] font-bold text-muted-foreground truncate">
              Total à payer
            </span>
            <span className={cn(
              "text-[15px] font-black tabular-nums",
              treasuryShort ? "text-red-500" : "text-foreground"
            )}>
              {totalCost > 0 ? `${fmt(totalCost)}€` : '0€'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 w-full text-[10.5px] leading-none">
            <span className="text-muted-foreground/75 truncate font-semibold flex items-center gap-1">
              Source: {isPersonalPay ? 'Poche perso' : 'Trésorerie pro'}
            </span>
            {treasuryShort && (
              <span className="shrink-0 text-[10px] font-bold text-red-500 animate-pulse">Insuffisant</span>
            )}
          </div>
        </div>
      </SelectTrigger>
      
      <SelectContent align="start" className="w-[260px] p-1 border-black/10 dark:border-white/10 shadow-lg rounded-xl">
        <div className="px-2.5 py-2 text-[11.5px] font-black text-foreground uppercase tracking-wide bg-muted/65 border-b border-border/35 rounded-lg mb-1 text-left pl-3">
          Sélectionner source pour paiement ({fmt(totalCost)}€)
        </div>
        {/* Option 1: Business Treasury */}
        <SelectItem value="business" indicatorSide="right" className="rounded-lg py-1.5 px-2 focus:bg-accent cursor-pointer transition-colors duration-150">
          <div className="flex items-center gap-2.5 min-w-0 py-0.5">
            <span className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm',
              biz.treasuryMoney >= totalCost ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-red-500/10 text-red-500'
            )}>
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span className="truncate">Trésorerie du business</span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="font-semibold text-foreground/80">{fmt(biz.treasuryMoney)}€ dispo</span>
                {biz.treasuryMoney < totalCost && (
                  <>
                    <span>·</span>
                    <span className="text-red-500 font-bold">faible</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </SelectItem>

        {/* Option 2: Personal Money */}
        <SelectItem value="personal" indicatorSide="right" className="rounded-lg py-1.5 px-2 focus:bg-accent cursor-pointer transition-colors duration-150">
          <div className="flex items-center gap-2.5 min-w-0 py-0.5">
            <span className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm',
              userMoney >= totalCost ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-500'
            )}>
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <span className="truncate">Payer de ma poche</span>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <span className="font-semibold text-foreground/80">{fmt(userMoney)}€ dispo</span>
                {userMoney < totalCost && (
                  <>
                    <span>·</span>
                    <span className="text-red-500 font-bold">faible</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Ingredient card for a resource cost — shows resource info + source selector
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
  const ownSelected = selected?.kind === 'inventory' && selected.businessId === biz.id;
  const extra = selected ? sourceCost(biz.id, cost, selected) : 0;

  const selBizStyle = selected ? getBusinessStyle(selected.businessTypeKey) : null;
  const SelBizIcon = selected
    ? (BUSINESS_ICON_MAP[selected.businessTypeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2)
    : Building2;

  const bgCls = noSource ? 'bg-red-500/8' : (meta?.bg ?? 'bg-muted/10');
  const borderCls = noSource
    ? 'border-red-500/25'
    : (meta?.bg ? meta.bg.replace('bg-', 'border-').replace('/15', '/25') : 'border-border/40');

  if (noSource) {
    return (
      <button
        type="button"
        onClick={() => onBuyAtMarket(cost.resourceType)}
        className={cn(
          'rounded-xl border flex items-center overflow-hidden h-[58px] text-left w-full transition duration-200',
          'border-red-500/30 bg-red-500/8 hover:bg-red-500/12'
        )}
      >
        {/* Left: Full height Icon block */}
        <div className="flex h-full w-12 shrink-0 items-center justify-center border-r bg-red-500/15 border-red-500/20 text-red-500">
          <Icon className="h-5 w-5" />
        </div>

        {/* Right: Info block */}
        <div className="flex flex-col justify-center h-full flex-1 min-w-0 px-3 py-1 text-left gap-1">
          <div className="flex items-baseline gap-1.5 w-full leading-none">
            <span className="text-[15px] font-black text-red-500 tabular-nums mr-1">{cost.quantity}×</span>
            <span className="text-[13px] font-bold text-muted-foreground truncate">{resourceLabel(cost.resourceType)}</span>
          </div>
          <div className="flex items-center justify-between gap-1 w-full text-[10.5px] text-red-500 leading-none">
            <span className="font-semibold flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              Stock insuffisant
            </span>
            <span className="font-bold flex items-center gap-0.5 hover:underline">
              Acheter <ShoppingCart className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <Select value={value} onValueChange={(v) => onSelect(key, v)}>
      <SelectTrigger
        className={cn(
          'p-0 rounded-xl border flex items-center overflow-hidden h-[58px] text-left w-full shadow-sm transition duration-200',
          'focus:ring-1 focus:ring-primary/20 hover:bg-background/80',
          bgCls,
          borderCls,
        )}
      >
        {/* Left: Full height Icon block */}
        <div className={cn(
          "flex h-full w-12 shrink-0 items-center justify-center border-r transition",
          meta?.bg ? meta.bg.replace('/15', '/25') : 'bg-muted/20',
          meta?.bg ? meta.bg.replace('bg-', 'border-').replace('/15', '/20') : 'border-border/20',
          meta?.iconColor ?? 'text-foreground'
        )}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Right: Info block */}
        <div className="flex flex-col justify-center h-full flex-1 min-w-0 px-3 py-1 pr-6 relative text-left gap-1">
          <div className="flex items-baseline justify-between w-full leading-none">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[15px] font-black text-foreground tabular-nums mr-1">{cost.quantity}×</span>
              <span className="text-[13px] font-bold text-muted-foreground truncate">{resourceLabel(cost.resourceType)}</span>
            </div>
            <span className={cn(
              "text-[13px] font-bold shrink-0 tabular-nums",
              extra > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            )}>
              {extra > 0 ? `${fmt(extra)}€` : 'Gratuit'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 w-full text-[10.5px] leading-none">
            <span className="text-muted-foreground/75 truncate font-semibold flex items-center gap-1">
              {selBizStyle && (
                <span className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded', selBizStyle.iconWrap)}>
                  <SelBizIcon className={cn('h-2 w-2', selBizStyle.icon)} />
                </span>
              )}
              {ownSelected ? 'Stock interne' : (selected?.businessName ?? '?')}
            </span>
          </div>
        </div>
      </SelectTrigger>
      
      <SelectContent align="start" className="w-[260px] p-1 border-black/10 dark:border-white/10 shadow-lg rounded-xl">
        <div className="px-2.5 py-2 text-[11.5px] font-black text-foreground uppercase tracking-wide bg-muted/65 border-b border-border/35 rounded-lg mb-1 text-left pl-3">
          Sélectionner source pour {resourceLabel(cost.resourceType)}
        </div>
        {opts.map((opt) => {
          const cost2 = sourceCost(biz.id, cost, opt);
          const own = opt.kind === 'inventory' && opt.businessId === biz.id;
          const bizStyle = getBusinessStyle(opt.businessTypeKey);
          const BizIcon = BUSINESS_ICON_MAP[opt.businessTypeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
          return (
            <SelectItem key={sourceValue(opt)} value={sourceValue(opt)} indicatorSide="right" className="rounded-lg py-1 px-2 focus:bg-accent cursor-pointer transition-colors duration-150">
              <div className="flex items-center gap-2.5 min-w-0 py-0.5">
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm', bizStyle.iconWrap)}>
                  <BizIcon className={cn('h-3.5 w-3.5', bizStyle.icon)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span className="truncate">{opt.businessName}</span>
                    {own && <span className="shrink-0 rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">interne</span>}
                    {opt.kind === 'offer' && !opt.autoAccept && <span className="shrink-0 rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500">offre</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span className="font-semibold text-foreground/80">{opt.quantity} dispo</span>
                    <span>·</span>
                    <span className={cn(own ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'font-semibold text-amber-600 dark:text-amber-400')}>
                      {own ? 'gratuit' : `${fmt(opt.unitPrice)}€/unité`}
                    </span>
                    {!own && (
                      <>
                        <span>·</span>
                        <span className="truncate text-muted-foreground/60">{opt.ownerName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Arrow between pipeline columns
function PipelineArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center self-center">
      <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
    </div>
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
    <div className="border border-border bg-card/45 dark:bg-card/25 rounded-2xl p-4 shadow-sm flex flex-col gap-3 transition hover:shadow-md hover:border-border/80">
      {/* Header with big title and running job details */}
      <div className="flex items-center justify-between pl-0.5">
        <span className="text-sm font-bold text-foreground">
          {action.label}
        </span>
        <div className="flex items-center gap-2">
          {upgrades.queueLvl >= 3 && (
            <Button
              size="sm"
              variant={isConstantProdEnabled ? "default" : "outline"}
              className={cn(
                "h-6 px-2.5 text-[9px] font-bold rounded-full transition-all duration-200 shrink-0",
                isConstantProdEnabled 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)] border-transparent" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onToggleConstantProd(biz.id, action.key, !isConstantProdEnabled)}
            >
              <RefreshCw className={cn("mr-1 h-3 w-3", isConstantProdEnabled && "animate-spin")} />
              {isConstantProdEnabled ? "Loop : ON" : "Loop : OFF"}
            </Button>
          )}
          {isCooldownActive && (
            <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <Clock className="h-3 w-3 animate-spin" /> Action active — {timeLeft}s rest.
            </span>
          )}
          {queuedCount > 0 && (
            <span className="text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> {queuedCount} en file
            </span>
          )}
        </div>
      </div>

      <div className="flex items-stretch gap-2.5">
        {/* Left: Ingrédients */}
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 pl-0.5">Ingrédients</div>

          {/* Action Money Cost (if any) */}
          {action.moneyCost > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 flex items-center overflow-hidden h-[58px] text-left w-full shadow-sm">
              <div className="flex h-full w-12 shrink-0 items-center justify-center border-r border-amber-500/20 bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Coins className="h-5 w-5" />
              </div>
              <div className="flex flex-col justify-center h-full flex-1 min-w-0 px-3 py-1 relative text-left gap-1">
                <div className="flex items-baseline justify-between w-full leading-none pr-3">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[13px] font-bold text-muted-foreground truncate">Frais de production</span>
                  </div>
                  <span className="text-[13px] font-bold shrink-0 tabular-nums text-amber-600 dark:text-amber-400">
                    {fmt(action.moneyCost)}€
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 w-full text-[10.5px] leading-none">
                  <span className="text-muted-foreground/75 truncate font-semibold flex items-center gap-1">
                    Coût fixe
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Resource ingredient cards */}
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

          {/* Total Payment Card */}
          <TotalPaymentCard
            biz={biz}
            totalCost={totalCost}
            isPersonalPay={isPersonalPay}
            userMoney={userMoney}
            onSelect={(val) => onSelectSource(moneySelectionKey, val)}
          />
        </div>

        <PipelineArrow />

        {/* Middle: Produire button */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-2 px-1">
          {blockedReason && !running && (!isCooldownActive || isPlayDisabled) && (
            <div className="flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/8 px-2 py-1 text-[9px] font-semibold text-red-500 text-center max-w-[72px]">
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              <span className="leading-tight">{blockedReason}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void run()}
            disabled={isPlayDisabled}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: isPlayDisabled && !running ? `${hex}60` : hex,
              boxShadow: isPlayDisabled || running ? 'none' : `0 2px 10px -2px ${hex}90`,
            }}
            title={action.label}
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCooldownActive && maxQueueSize > 0 && queuedCount < maxQueueSize ? (
              <Plus className="h-5 w-5 font-black" />
            ) : isCooldownActive && queuedCount >= maxQueueSize ? (
              <span className="text-[10px] font-black">{timeLeft}s</span>
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
          </button>
          <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[72px]">
            {isCooldownActive && maxQueueSize > 0 && queuedCount < maxQueueSize 
              ? "Ajouter à file" 
              : isCooldownActive 
                ? `Actif (${timeLeft}s)` 
                : action.label}
          </span>
        </div>

        {/* Right: Stock */}
        {action.outputs.length > 0 && (
          <>
            <PipelineArrow />
            <div className="flex flex-1 flex-col gap-2 min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50 pl-0.5">Stock</div>
              {action.outputs.map((o) => {
                const inv = biz.inventories.find((i) => i.resourceType === o.resourceType);
                if (!inv) return null;
                return (
                  <div key={o.resourceType} className="flex items-center gap-1.5 w-full">
                    <div className="flex-1 min-w-0 relative">
                      <div className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white shadow-sm border border-emerald-600/50 leading-none">
                        +{o.quantity}
                      </div>
                      <StockCard inventory={inv} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSellAll(o.resourceType)}
                      className="flex h-[58px] px-3 shrink-0 flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 shadow-sm text-muted-foreground transition hover:bg-muted hover:text-foreground hover:border-border"
                      title="Mettre en vente"
                    >
                      <ShoppingCart className="h-4 w-4 mb-0.5" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Vendre</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
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
  const style = getBusinessStyle(biz.typeKey);
  const hex = getBusinessHex(biz.typeKey);
  const Icon = BUSINESS_ICON_MAP[biz.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;

  const upgrades = biz.upgrades ?? { productionSpeedLvl: 0, stockSizeLvl: 0, queueLvl: 0 };

  return (
    <Card className="overflow-hidden border-l-[3px]" style={{ borderLeftColor: hex }}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-muted/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', style.iconWrap)}>
            <Icon className={cn('h-4.5 w-4.5', style.icon)} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight" style={{ color: hex }}>
              {biz.name}
            </h3>
            <p className="text-[10px] text-muted-foreground leading-tight truncate">
              {biz.typeLabel}
              {biz.typeKey === 'juterie' && biz.customData && (() => {
                try {
                  const d = JSON.parse(biz.customData) as { juiceSpecialization?: string };
                  const names: Record<string, string> = {
                    JUICE_ABRICOT: "abricot", JUICE_GINGEMBRE: "gingembre",
                    JUICE_PAPAYE: "papaye", JUICE_MALAKOUKOU: "malakoukou", JUICE_GOYAVE: "goyave",
                  };
                  return d.juiceSpecialization ? ` · ${names[d.juiceSpecialization] ?? d.juiceSpecialization}` : '';
                } catch { return ''; }
              })()}
              {biz.underConstruction ? ' · chantier' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400 border border-amber-500/10 shadow-sm">
            <Coins className="h-4 w-4" />{fmt(biz.treasuryMoney)}€
          </span>
          {biz.avgRating != null && (
            <span className="inline-flex h-8 items-center gap-1 px-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 rounded-full border border-emerald-500/10 shadow-sm">
              ⭐ {biz.avgRating.toFixed(1)}/5
            </span>
          )}
          <button
            type="button"
            onClick={() => onUpgradeClick(biz)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 text-xs font-bold text-purple-600 dark:text-purple-400 transition hover:bg-purple-500/20 shadow-sm"
          >
            <ArrowUpCircle className="h-4 w-4" /> Améliorer ({upgrades.productionSpeedLvl + upgrades.stockSizeLvl + upgrades.queueLvl}/8)
          </button>
          <button
            type="button"
            onClick={() => onManage(biz.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-3.5 text-xs font-bold text-muted-foreground transition hover:text-foreground shadow-sm"
          >
            <Settings2 className="h-4 w-4" /> Gérer
          </button>
        </div>
      </div>

      {/* Actions */}
      {biz.underConstruction ? (
        <div className="border-t border-border/40 bg-amber-500/5 px-4 py-3 text-xs text-amber-500">
          Chantier en cours — actions bloquées.
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-border/40 px-4 py-3">
          {biz.actions.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Aucune recette de production disponible.
            </div>
          ) : biz.actions.map((action) => (
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
          ))}
        </div>
      )}
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
    productionSpeed: {
      title: "Vitesse Production",
      maxLevel: 2,
      activeColor: "bg-amber-500",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      iconBg: "bg-amber-500/15 border border-amber-500/20 text-amber-500",
      btnBg: "bg-amber-600 hover:bg-amber-700 text-white",
      Icon: Zap,
    },
    stockSize: {
      title: "Taille des Stocks",
      maxLevel: 3,
      activeColor: "bg-emerald-500",
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      iconBg: "bg-emerald-500/15 border border-emerald-500/20 text-emerald-500",
      btnBg: "bg-emerald-600 hover:bg-emerald-700 text-white",
      Icon: Package,
    },
    queue: {
      title: "File d'attente",
      maxLevel: 3,
      activeColor: "bg-blue-500",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      iconBg: "bg-blue-500/15 border border-blue-500/20 text-blue-500",
      btnBg: "bg-blue-600 hover:bg-blue-700 text-white",
      Icon: Layers,
    },
  };

  return (
    <AppModal open={open} onClose={onClose} tone="money" size="lg" description={`Améliorations de production pour ${biz.name}`}>
      <AppModal.Header
        tone="money"
        icon={<ArrowUpCircle />}
        title={`Améliorations · ${biz.name}`}
        subtitle={
          <div className="flex items-center gap-2 mt-1">
            <span>Booste l'efficacité et l'automatisation de tes lignes.</span>
            <span className="inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[10px] font-bold text-primary">
              {totalLevels} / 8 Niveaux
            </span>
          </div>
        }
      />
      <AppModal.Body className="py-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
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
              <div
                key={type}
                className="bg-card/30 border border-border/30 rounded-xl p-4 flex flex-col justify-between transition hover:border-border/60"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg shrink-0", details.iconBg)}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground leading-tight">
                        {details.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        {Array.from({ length: maxLevel }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 w-4 rounded-full transition-colors",
                              i < currentLevel ? details.activeColor : "bg-muted-foreground/20"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-4 min-h-[34px]">
                    {currentData?.desc}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold bg-muted/20 border border-border/20 rounded-lg px-3 py-2 mb-3">
                    <span className="text-muted-foreground">Effet actuel</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground">{currentStat}</span>
                      {!isMax && (
                        <>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <span className="text-emerald-500 font-bold">{nextStat}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isMax ? (
                    <div className="w-full text-center text-xs font-bold text-emerald-500 bg-emerald-500/10 py-2.5 rounded-lg border border-emerald-500/20">
                      Niveau Maximum
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className={cn("w-full h-9 text-[11.5px] font-bold text-white transition hover:brightness-110", details.btnBg)}
                      onClick={() => onBuyUpgrade(biz.id, type, currentLevel + 1)}
                    >
                      Améliorer · {fmt(nextData?.cost ?? 0)}€
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AppModal.Body>
      <AppModal.Footer left={
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>Trésorerie dispo : <strong className="text-foreground">{fmt(biz.treasuryMoney)}€</strong></span>
        </div>
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
  const [createOpen, setCreateOpen] = useState(false);
  const [managedBizId, setManagedBizId] = useState<string | null>(null);
  const [upgradingBiz, setUpgradingBiz] = useState<YouResourceActionBusiness | null>(null);

  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const canCreate = isAdmin || data.ownedBusinesses.length < (data.businessSlots ?? 0);
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
        toast.error("Votre solde personnel est insuffisant pour payer cette action.");
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
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des actions…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Actions</h2>
          <p className="text-xs text-muted-foreground">
            {businesses.length} business{businesses.length > 1 ? 'es' : ''} · chaîne de production
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (canCreate) setCreateOpen(true);
              else toast.error('Monte Affaires pour débloquer un slot business.');
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Créer
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || mutatingKey !== null}>
            {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
            Actualiser
          </Button>
        </div>
      </div>

      {/* Job offers */}
      {data.jobOffers.length > 0 && (
        <Card>
          <CardContent className="px-4 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Contrats en attente ({data.jobOffers.length})
            </p>
            <div className="space-y-2">
              {data.jobOffers.filter((o) => o.needsViewerAcceptance).map((offer) => (
                <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{offer.business.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {offer.initiatedByRole === 'EMPLOYER' ? offer.employer.username : offer.employee.username} · {offer.salary.toLocaleString('fr-FR')}€/j
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs" onClick={async () => { await youApi.respondToBusinessInvitation(offer.id, 'accept'); onReload?.(); }}>Accepter</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { await youApi.respondToBusinessInvitation(offer.id, 'reject'); onReload?.(); }}>Refuser</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business pipeline cards */}
      {businesses.length === 0 ? (
        <Card>
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aucun business disponible. Créez votre première entreprise avec le bouton ci-dessus.
          </CardContent>
        </Card>
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
      {createOpen && (
        <CreateBusinessModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          businessTypes={data.businessTypes}
          unlockedBusinessLevel={data.unlockedBusinessLevel ?? 0}
          onCreated={async () => { setCreateOpen(false); onReload?.(); await load(); }}
        />
      )}
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

