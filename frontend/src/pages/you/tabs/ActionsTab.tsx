import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowRight, Building2, Coins,
  Loader2, Play, RefreshCw, ShoppingCart, Sparkles, TrendingDown, TrendingUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { cn } from '@/lib/utils';
import { BUSINESS_COLOR_HEX, BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import {
  type YouResourceAction,
  type YouResourceActionBusiness,
  type YouResourceActionCost,
  type YouResourceActionSourceInput,
  type YouResourceActionSourceOption,
  type YouSupplyInventory,
  youApi,
} from '@/services/api';

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

// Tiny sparkline
function Sparkline({ price, change }: { price: number; change: number }) {
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums',
      up ? 'text-emerald-500' : 'text-red-500',
    )}>
      <Icon className="h-2.5 w-2.5" />
      {price}m
    </span>
  );
}

// Stock glance chip with ambient market price arrow
function StockChip({ inventory }: { inventory: YouSupplyInventory }) {
  const meta = RESOURCE_META[inventory.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  const price = inventory.globalMarketUnitPrice;
  // We don't have change % here, so just show price
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border border-border/40 bg-background/60 pl-1.5 pr-2.5 text-[11px] font-semibold',
      )}
      title={`${resourceLabel(inventory.resourceType)} · ${inventory.quantity}/${inventory.capacity} · marché ~${price}m`}
    >
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[9px]', meta?.bg ?? 'bg-muted')}>
        <Icon className={cn('h-2.5 w-2.5', meta?.iconColor ?? 'text-foreground')} />
      </span>
      <span className="tabular-nums text-foreground">{inventory.quantity}</span>
      <span className="text-muted-foreground/50">/</span>
      <span className="text-muted-foreground/60 tabular-nums">{inventory.capacity}</span>
      <span className="ml-0.5 text-muted-foreground/40">·</span>
      <TrendingUp className="h-2.5 w-2.5 text-emerald-500/70" />
      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 text-[10px]">{price}m</span>
    </span>
  );
}

// Source row inside the Sources stage
function SourceRow({
  biz, action, cost, sourceOptions, selections, onSelect,
  onBuyAtMarket,
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

  if (noSource) {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-red-500/25 bg-red-500/8 p-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', meta?.bg ?? 'bg-muted')}>
            <Icon className={cn('h-3 w-3', meta?.iconColor ?? 'text-muted-foreground')} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 text-[12px] font-semibold">
              <span className="text-foreground tabular-nums">×{cost.quantity}</span>
              <span className="text-muted-foreground">{resourceLabel(cost.resourceType)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold text-red-500">
              <AlertCircle className="h-3 w-3" /> Stock insuffisant
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onBuyAtMarket(cost.resourceType)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border/50 bg-background/40 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition hover:bg-muted"
        >
          <ShoppingCart className="h-3 w-3" />
          Acheter au marché
          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={(v) => onSelect(key, v)}>
      <SelectTrigger
        className={cn(
          'inline-flex h-8 w-full justify-start items-center gap-1.5 rounded-xl border py-0 pl-1.5 pr-2 text-[11px] font-medium shadow-none ring-offset-0 focus:ring-1 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60',
          'border-border/50 bg-background/50 hover:bg-muted/50',
        )}
      >
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md', meta?.bg ?? 'bg-muted')}>
          <Icon className={cn('h-2.5 w-2.5', meta?.iconColor ?? 'text-foreground')} />
        </span>
        <span className="font-bold tabular-nums text-foreground">×{cost.quantity}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="flex-1 truncate text-foreground">
          {ownSelected
            ? <span className="italic text-muted-foreground text-[10px]">stock interne</span>
            : selected?.businessName ?? '?'}
        </span>
        {extra > 0 && <span className="ml-auto shrink-0 text-[10px] font-semibold text-amber-500">+{fmt(extra)}m</span>}
      </SelectTrigger>
      <SelectContent align="start" className="max-w-[300px]">
        {opts.map((opt) => {
          const cost2 = sourceCost(biz.id, cost, opt);
          const own = opt.kind === 'inventory' && opt.businessId === biz.id;
          return (
            <SelectItem key={sourceValue(opt)} value={sourceValue(opt)}>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {opt.businessName}
                  {own && <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-500">interne</span>}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {opt.quantity} dispo · {own ? 'gratuit' : `${fmt(cost2)}m${opt.autoAccept ? ' (auto)' : ''}`}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

// Auto-sell toggle for a single output inventory
function AutoSellToggle({
  biz, inventory, onToggle,
}: {
  biz: YouResourceActionBusiness;
  inventory: YouSupplyInventory;
  onToggle: (enabled: boolean, price: number) => void;
}) {
  const [enabled, setEnabled] = useState(inventory.autoSellEnabled);
  const [price, setPrice] = useState(
    inventory.autoSellPrice > 0 ? inventory.autoSellPrice : inventory.globalMarketUnitPrice,
  );
  const [saving, setSaving] = useState(false);

  const toggle = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    setSaving(true);
    try {
      await youApi.setAutoSell(biz.id, inventory.resourceType as any, { enabled: newEnabled, price });
      onToggle(newEnabled, price);
    } catch {
      setEnabled(!newEnabled);
      toast.error('Impossible de modifier l\'auto-vente.');
    } finally {
      setSaving(false);
    }
  };

  const savePrice = async (newPrice: number) => {
    if (!enabled) return;
    setPrice(newPrice);
    try {
      await youApi.setAutoSell(biz.id, inventory.resourceType as any, { enabled, price: newPrice });
      onToggle(enabled, newPrice);
    } catch {
      toast.error('Impossible de modifier le prix.');
    }
  };

  return (
    <div className={cn(
      'rounded-xl border p-2.5 transition-all',
      enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/40 bg-background/30',
    )}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
            Auto-vente
            <Sparkles className={cn('h-3 w-3', enabled ? 'text-emerald-500' : 'text-muted-foreground/40')} />
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight">
            {enabled ? 'la production part au marché' : 'la production reste en stock'}
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void toggle(!enabled)}
          className={cn(
            'relative flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
            enabled ? 'bg-emerald-500' : 'bg-muted-foreground/25',
          )}
        >
          <span className={cn(
            'absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
            enabled ? 'translate-x-4' : 'translate-x-0.5',
          )} />
        </button>
      </div>
      {enabled && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground">Prix</span>
          <div className="flex flex-1 items-center justify-between rounded-lg border border-border/40 bg-background/60 px-2 py-1 h-7">
            <input
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              onBlur={(e) => void savePrice(Number(e.target.value))}
              className="w-16 bg-transparent text-[12px] font-bold tabular-nums text-foreground outline-none"
            />
            <span className="text-[10px] text-muted-foreground">
              cours ~{inventory.globalMarketUnitPrice}m
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Sell stage for a single output resource
function SellStage({
  biz, action, onSellAll,
}: {
  biz: YouResourceActionBusiness;
  action: YouResourceAction;
  onSellAll: (resourceType: string) => void;
}) {
  const outputInventories = action.outputs
    .map((o) => biz.inventories.find((inv) => inv.resourceType === o.resourceType))
    .filter((inv): inv is YouSupplyInventory => inv != null);

  if (outputInventories.length === 0) {
    if (action.rewardMoney > 0) {
      return (
        <div className="flex flex-col gap-2 h-full">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Revenu direct</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{fmt(action.rewardMoney)}m
            </div>
          </div>
        </div>
      );
    }
    if (action.satisfactionDelta > 0) {
      return (
        <div className="rounded-xl border border-pink-500/30 bg-pink-500/8 p-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-pink-500">Satisfaction</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-pink-500">+{action.satisfactionDelta}%</div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      {outputInventories.map((inv) => {
        const stockValue = Math.round(inv.quantity * inv.globalMarketUnitPrice);
        return (
          <div key={inv.resourceType} className="flex flex-col gap-1.5">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Stock prêt à vendre</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                +{fmt(stockValue)}m
              </div>
              <div className="text-[10px] text-muted-foreground">{inv.quantity} × {inv.globalMarketUnitPrice}m</div>
            </div>
            <AutoSellToggle biz={biz} inventory={inv} onToggle={() => { /* state refresh via reload */ }} />
            <button
              type="button"
              onClick={() => onSellAll(inv.resourceType)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-[12px] font-bold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Vendre au marché
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Pipeline stage wrapper
function Stage({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border/40 bg-muted/20 p-3 min-w-0 min-h-[160px]">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// Arrow between stages
function PipelineArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center self-center">
      <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
    </div>
  );
}

// One action as a pipeline row
function ActionPipeline({
  biz, action, hex, sourceOptions, selections, mutatingKey, onSelectSource, onRun, onBuyAtMarket, onSellAll,
}: {
  biz: YouResourceActionBusiness;
  action: YouResourceAction;
  hex: string;
  sourceOptions: YouResourceActionSourceOption[];
  selections: Record<string, string>;
  mutatingKey: string | null;
  onSelectSource: (k: string, v: string) => void;
  onRun: (biz: YouResourceActionBusiness, action: YouResourceAction, sources: Record<string, YouResourceActionSourceInput>) => Promise<void>;
  onBuyAtMarket: (resourceType: string) => void;
  onSellAll: (resourceType: string) => void;
}) {
  const selected = action.resourceCosts.map((cost) => ({
    cost,
    source: getSelected(biz, action, cost, sourceOptions, selections),
  }));
  const extraCost = selected.reduce((sum, e) => sum + sourceCost(biz.id, e.cost, e.source), 0);
  const totalCost = action.moneyCost + extraCost;
  const missingSource = selected.some((e) => !e.source);
  const outputFull = action.outputs.some((o) => {
    const inv = biz.inventories.find((i) => i.resourceType === o.resourceType);
    return inv ? inv.quantity + o.quantity > inv.capacity : false;
  });
  const treasuryShort = biz.treasuryMoney < totalCost;
  const blocked = missingSource || outputFull || treasuryShort;
  const rowKey = `${biz.id}:${action.key}`;
  const running = mutatingKey === rowKey;

  const run = async () => {
    const sources: Record<string, YouResourceActionSourceInput> = {};
    for (const e of selected) {
      if (!e.source) return;
      const si = sourceInputFromValue(sourceValue(e.source));
      if (!si) return;
      sources[e.cost.resourceType] = si;
    }
    await onRun(biz, action, sources);
  };

  const blockedReason = missingSource
    ? 'Source manquante'
    : outputFull
      ? 'Stock plein'
      : treasuryShort
        ? 'Trésorerie faible'
        : null;

  const hasInputs = action.resourceCosts.length > 0;
  const hasOutputsOrReward = action.outputs.length > 0 || action.rewardMoney > 0 || action.satisfactionDelta > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide pl-0.5">{action.label}</div>
      <div className="flex items-stretch gap-1.5">
        {/* Sources stage */}
        {hasInputs && (
          <>
            <Stage label="Sources" accent="#60a5fa">
              <div className="flex flex-col gap-1.5">
                {action.resourceCosts.map((cost) => (
                  <SourceRow
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
              </div>
            </Stage>
            <PipelineArrow />
          </>
        )}

        {/* Produce stage */}
        <Stage label="Produire" accent={hex}>
          <div className="flex flex-col gap-2 h-full">
            {action.outputs.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {action.outputs.map((o) => {
                  const meta = RESOURCE_META[o.resourceType as ResourceType];
                  const Icon = meta?.Icon ?? Building2;
                  return (
                    <span
                      key={o.resourceType}
                      className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold', meta?.bg ?? 'bg-muted', meta?.iconColor ?? 'text-foreground')}
                    >
                      <Icon className="h-2.5 w-2.5" />+{o.quantity}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mt-auto">
              {blocked && !running && (
                <div className="mb-1.5 flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/8 px-2 py-1.5 text-[10.5px] font-semibold text-red-500">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {blockedReason}
                </div>
              )}
              <button
                type="button"
                onClick={() => void run()}
                disabled={blocked || running}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: blocked && !running ? `${hex}60` : hex,
                  boxShadow: blocked || running ? 'none' : `0 2px 8px -2px ${hex}80`,
                }}
              >
                {running
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Play className="h-3.5 w-3.5 fill-current" />}
                <span className="truncate">{running ? 'En cours…' : action.label}</span>
                <span className="ml-0.5 shrink-0 rounded-md bg-black/20 px-1.5 py-0.5 text-[10.5px] tabular-nums">
                  {fmt(totalCost)}m
                </span>
              </button>
            </div>
          </div>
        </Stage>

        {/* Sell stage */}
        {hasOutputsOrReward && (
          <>
            <PipelineArrow />
            <Stage label="Vendre" accent="#34d399">
              <SellStage biz={biz} action={action} onSellAll={onSellAll} />
            </Stage>
          </>
        )}
      </div>
    </div>
  );
}

// Business card with V2 pipeline layout
function BusinessCard({
  biz, sourceOptions, selections, mutatingKey,
  onSelectSource, onRun, onBuyAtMarket, onSellAll,
}: {
  biz: YouResourceActionBusiness;
  sourceOptions: YouResourceActionSourceOption[];
  selections: Record<string, string>;
  mutatingKey: string | null;
  onSelectSource: (k: string, v: string) => void;
  onRun: (biz: YouResourceActionBusiness, action: YouResourceAction, sources: Record<string, YouResourceActionSourceInput>) => Promise<void>;
  onBuyAtMarket: (resourceType: string, forBusinessId: string) => void;
  onSellAll: (biz: YouResourceActionBusiness, resourceType: string) => void;
}) {
  const style = getBusinessStyle(biz.typeKey);
  const hex = getBusinessHex(biz.typeKey);
  const Icon = BUSINESS_ICON_MAP[biz.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const net = Math.round((biz.monthlyRevenue - biz.monthlyExpenses) / 30);
  const stockPills = biz.inventories.filter((inv) => inv.capacity > 0);

  return (
    <Card className="overflow-hidden border-l-[3px]" style={{ borderLeftColor: hex }}>
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', style.iconWrap)}>
              <Icon className={cn('h-4.5 w-4.5', style.icon)} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold leading-tight" style={{ color: hex }}>
                {biz.name}
              </h3>
              <p className="text-[10px] text-muted-foreground leading-tight truncate">
                {biz.typeLabel}{biz.underConstruction ? ' · chantier' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500/15 px-2 text-[10px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              <Coins className="h-3 w-3" />{fmt(biz.treasuryMoney)}m
            </span>
            <span className={cn(
              'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-semibold tabular-nums',
              net >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-500',
            )}>
              Net/j {net >= 0 ? '+' : ''}{fmt(net)}
            </span>
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-[10px] font-semibold text-foreground">
              😊 {biz.satisfaction}%
            </span>
          </div>
        </div>
        {/* Stock glance bar */}
        {stockPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stockPills.map((inv) => <StockChip key={inv.id} inventory={inv} />)}
          </div>
        )}
      </div>

      {/* Actions */}
      {biz.underConstruction ? (
        <div className="border-t border-border/40 bg-amber-500/5 px-4 py-3 text-xs text-amber-500">
          Chantier en cours — actions bloquées.
        </div>
      ) : (
        <div className="flex flex-col gap-4 border-t border-border/40 px-4 py-3">
          {biz.actions.map((action) => (
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
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActionsTab({ onReload }: { onReload?: () => void }) {
  const navigate = useNavigate();
  const [, setParams] = useSearchParams();
  const [state, setState] = useState<import('@/services/api').YouResourceActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

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

  const runAction = async (
    biz: YouResourceActionBusiness,
    action: YouResourceAction,
    sources: Record<string, YouResourceActionSourceInput>,
  ) => {
    const rowKey = `${biz.id}:${action.key}`;
    setMutatingKey(rowKey);
    try {
      const res = await youApi.runResourceAction(biz.id, { actionKey: action.key, sources });
      const r = res.data.result;
      toast.success(`${action.label} — coût ${fmt(r.totalMoneyCost)}m${r.rewardMoney > 0 ? `, gain ${fmt(r.rewardMoney)}m` : ''}.`);
      await load();
      onReload?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Action impossible.');
    } finally {
      setMutatingKey(null);
    }
  };

  const handleBuyAtMarket = (resourceType: string, forBusinessId: string) => {
    navigate(`/you?tab=salle-de-marche&resource=${resourceType}&for=${forBusinessId}`);
  };

  const handleSellAll = async (biz: YouResourceActionBusiness, resourceType: string) => {
    const inv = biz.inventories.find((i) => i.resourceType === resourceType);
    if (!inv || inv.quantity === 0) {
      toast.error('Aucune unité en stock à vendre.');
      return;
    }
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Actions</h2>
          <p className="text-xs text-muted-foreground">
            {businesses.length} business{businesses.length > 1 ? 'es' : ''} · chaîne de production
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || mutatingKey !== null}>
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Actualiser
        </Button>
      </div>

      {businesses.length === 0 ? (
        <Card>
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aucun business disponible.
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
          />
        ))
      )}
    </div>
  );
}
