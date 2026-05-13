import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Coins, Loader2, Package, Play, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { cn } from '@/lib/utils';
import { BUSINESS_COLOR_HEX, BUSINESS_ICON_MAP, BUSINESS_STYLE_MAP } from '../constants';
import {
  type YouResourceAction,
  type YouResourceActionBusiness,
  type YouResourceActionCost,
  type YouResourceActionState,
  type YouResourceActionSourceInput,
  type YouResourceActionSourceOption,
  youApi,
} from '@/services/api';

function money(value: number) {
  return `${Math.round(value).toLocaleString('fr-FR')} money`;
}

function shortMoney(value: number) {
  return Math.round(value).toLocaleString('fr-FR');
}

function resourceLabel(resourceType: string) {
  return RESOURCE_META[resourceType as ResourceType]?.label ?? resourceType;
}

function sourceValue(option: YouResourceActionSourceOption) {
  return option.kind === 'inventory' ? `inventory:${option.businessId}` : `offer:${option.id}`;
}

function sourceInputFromValue(value: string): YouResourceActionSourceInput | null {
  const [kind, id] = value.split(':');
  if (kind === 'inventory' && id) return { kind: 'inventory', businessId: id };
  if (kind === 'offer' && id) return { kind: 'offer', offerId: id };
  return null;
}

function sortSourcesForBusiness(businessId: string, options: YouResourceActionSourceOption[]) {
  return [...options].sort((a, b) => {
    const aOwn = a.kind === 'inventory' && a.businessId === businessId ? 0 : 1;
    const bOwn = b.kind === 'inventory' && b.businessId === businessId ? 0 : 1;
    if (aOwn !== bOwn) return aOwn - bOwn;
    const aInventory = a.kind === 'inventory' ? 0 : 1;
    const bInventory = b.kind === 'inventory' ? 0 : 1;
    if (aInventory !== bInventory) return aInventory - bInventory;
    return a.unitPrice - b.unitPrice;
  });
}

function getOptionsForCost(
  business: YouResourceActionBusiness,
  cost: YouResourceActionCost,
  sourceOptions: YouResourceActionSourceOption[],
) {
  return sortSourcesForBusiness(
    business.id,
    sourceOptions.filter((option) =>
      option.resourceType === cost.resourceType
      && option.quantity >= cost.quantity
      && !(option.kind === 'offer' && option.businessId === business.id)
    ),
  );
}

function getSelectedSource(
  business: YouResourceActionBusiness,
  action: YouResourceAction,
  cost: YouResourceActionCost,
  sourceOptions: YouResourceActionSourceOption[],
  selectedSources: Record<string, string>,
) {
  const key = `${business.id}:${action.key}:${cost.resourceType}`;
  const options = getOptionsForCost(business, cost, sourceOptions);
  const selectedValue = selectedSources[key];
  return options.find((option) => sourceValue(option) === selectedValue) ?? options[0] ?? null;
}

function getSourceCost(businessId: string, cost: YouResourceActionCost, option: YouResourceActionSourceOption | null) {
  if (!option) return 0;
  if (option.kind === 'inventory' && option.businessId === businessId) return 0;
  return option.unitPrice * cost.quantity;
}

const NEUTRAL_STYLE = { card: '', badge: '', iconWrap: 'bg-muted', icon: 'text-muted-foreground' };

function getBusinessStyle(typeKey: string) {
  return BUSINESS_STYLE_MAP[typeKey as keyof typeof BUSINESS_STYLE_MAP] ?? NEUTRAL_STYLE;
}

function getBusinessHex(typeKey: string) {
  return BUSINESS_COLOR_HEX[typeKey] ?? '#64748b';
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function SourcePill({
  business,
  action,
  cost,
  sourceOptions,
  selectedSources,
  onSelect,
}: {
  business: YouResourceActionBusiness;
  action: YouResourceAction;
  cost: YouResourceActionCost;
  sourceOptions: YouResourceActionSourceOption[];
  selectedSources: Record<string, string>;
  onSelect: (key: string, value: string) => void;
}) {
  const key = `${business.id}:${action.key}:${cost.resourceType}`;
  const options = getOptionsForCost(business, cost, sourceOptions);
  const selected = getSelectedSource(business, action, cost, sourceOptions, selectedSources);
  const value = selected ? sourceValue(selected) : '';
  const meta = RESOURCE_META[cost.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Package;
  const noSource = options.length === 0 || !selected;
  const extraCost = selected ? getSourceCost(business.id, cost, selected) : 0;
  const ownSelected = selected?.kind === 'inventory' && selected.businessId === business.id;

  return (
    <Select value={value} onValueChange={(v) => onSelect(key, v)} disabled={options.length === 0}>
      <SelectTrigger
        className={cn(
          'inline-flex h-7 w-auto justify-start items-center gap-1.5 rounded-full border py-0 pl-0.5 pr-1.5 text-[11px] font-medium shadow-none ring-offset-0 focus:ring-1 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60 [&>span]:line-clamp-none',
          noSource
            ? 'border-red-400/50 bg-red-500/10 text-red-500'
            : 'border-border/60 bg-card hover:bg-muted/40 hover:border-foreground/30',
        )}
      >
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', meta?.bg ?? 'bg-muted')}>
          <Icon className={cn('h-3 w-3', meta?.iconColor ?? 'text-muted-foreground')} />
        </span>
        <span className={cn('font-bold tabular-nums', meta?.iconColor ?? 'text-foreground')}>{cost.quantity}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="max-w-[110px] truncate text-foreground">
          {selected ? (
            ownSelected ? <span className="italic text-muted-foreground">stock</span> : truncate(selected.businessName, 14)
          ) : (
            <span className="text-red-500">aucune</span>
          )}
        </span>
        {extraCost > 0 && (
          <span className="text-[10px] font-semibold text-amber-500">+{shortMoney(extraCost)}m</span>
        )}
      </SelectTrigger>
      <SelectContent align="start" className="max-w-[320px]">
        {options.length === 0 ? (
          <SelectItem value="__empty" disabled>Aucune source — {resourceLabel(cost.resourceType)}</SelectItem>
        ) : (
          options.map((option) => {
            const sourceCost = getSourceCost(business.id, cost, option);
            const ownStock = option.kind === 'inventory' && option.businessId === business.id;
            return (
              <SelectItem key={sourceValue(option)} value={sourceValue(option)}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {option.businessName}
                    {ownStock && <span className="ml-1 text-[10px] uppercase tracking-wide text-emerald-500">interne</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {option.quantity} dispo
                    {' · '}
                    {ownStock
                      ? 'gratuit'
                      : option.kind === 'inventory'
                        ? `transfert ${shortMoney(sourceCost)}m`
                        : `${shortMoney(sourceCost)}m${option.autoAccept ? ' (auto)' : ''}`}
                  </span>
                </div>
              </SelectItem>
            );
          })
        )}
      </SelectContent>
    </Select>
  );
}

function OutputPill({ output }: { output: { resourceType: string; quantity: number } }) {
  const meta = RESOURCE_META[output.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Package;
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-bold',
        meta?.bg ?? 'bg-muted',
        meta?.iconColor ?? 'text-foreground',
      )}
      title={`+${output.quantity} ${resourceLabel(output.resourceType)}`}
    >
      <Icon className="h-3 w-3" />+{output.quantity}
    </span>
  );
}

function StockPill({ inventory }: { inventory: YouResourceActionBusiness['inventories'][number] }) {
  const meta = RESOURCE_META[inventory.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Package;
  const ratio = inventory.capacity > 0 ? inventory.quantity / inventory.capacity : 0;
  const full = ratio >= 0.95;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold tabular-nums',
        meta?.bg ?? 'bg-muted',
        full ? 'border-amber-500/40 ring-1 ring-amber-500/30' : 'border-transparent',
      )}
      title={`${resourceLabel(inventory.resourceType)} · ${inventory.quantity}/${inventory.capacity}`}
    >
      <Icon className={cn('h-3 w-3', meta?.iconColor ?? 'text-muted-foreground')} />
      <span className={cn(meta?.iconColor ?? 'text-foreground')}>
        {inventory.quantity}
        <span className="opacity-50">/{inventory.capacity}</span>
      </span>
    </span>
  );
}

function StatPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warm';
}) {
  const cls =
    tone === 'positive'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'bg-red-500/15 text-red-500'
        : tone === 'warm'
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'bg-muted text-foreground';
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-semibold tabular-nums', cls)}>
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function ActionCard({
  business,
  action,
  hex,
  sourceOptions,
  selectedSources,
  mutatingKey,
  onSelectSource,
  onRun,
}: {
  business: YouResourceActionBusiness;
  action: YouResourceAction;
  hex: string;
  sourceOptions: YouResourceActionSourceOption[];
  selectedSources: Record<string, string>;
  mutatingKey: string | null;
  onSelectSource: (key: string, value: string) => void;
  onRun: (business: YouResourceActionBusiness, action: YouResourceAction, sources: Record<string, YouResourceActionSourceInput>) => Promise<void>;
}) {
  const selected = action.resourceCosts.map((cost) => ({
    cost,
    source: getSelectedSource(business, action, cost, sourceOptions, selectedSources),
  }));
  const sourceMoneyCost = selected.reduce((sum, entry) => sum + getSourceCost(business.id, entry.cost, entry.source), 0);
  const totalCost = action.moneyCost + sourceMoneyCost;
  const missingSource = selected.some((entry) => !entry.source);
  const outputFull = action.outputs.some((output) => {
    const inventory = business.inventories.find((entry) => entry.resourceType === output.resourceType);
    return inventory ? inventory.quantity + output.quantity > inventory.capacity : false;
  });
  const treasuryShort = business.treasuryMoney < totalCost;
  const blocked = missingSource || outputFull || treasuryShort;
  const blockedReason = missingSource
    ? 'Source manquante'
    : outputFull
      ? 'Stock de sortie plein'
      : treasuryShort
        ? 'Trésorerie insuffisante'
        : null;
  const rowKey = `${business.id}:${action.key}`;
  const running = mutatingKey === rowKey;
  const hasOutputs =
    action.outputs.length > 0 || action.rewardMoney > 0 || action.satisfactionDelta > 0;
  const hasInputs = action.resourceCosts.length > 0;

  const run = async () => {
    const sources: Record<string, YouResourceActionSourceInput> = {};
    for (const entry of selected) {
      if (!entry.source) return;
      const sourceInput = sourceInputFromValue(sourceValue(entry.source));
      if (!sourceInput) return;
      sources[entry.cost.resourceType] = sourceInput;
    }
    await onRun(business, action, sources);
  };

  return (
    <div
      className="rounded-xl border px-2 py-1.5 transition"
      style={{
        backgroundColor: `${hex}10`,
        borderColor: `${hex}33`,
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {action.resourceCosts.map((cost) => (
          <SourcePill
            key={cost.resourceType}
            business={business}
            action={action}
            cost={cost}
            sourceOptions={sourceOptions}
            selectedSources={selectedSources}
            onSelect={onSelectSource}
          />
        ))}
        {hasInputs && hasOutputs && (
          <span className="px-0.5 text-[12px] font-bold text-muted-foreground">→</span>
        )}
        {action.outputs.map((output) => (
          <OutputPill key={output.resourceType} output={output} />
        ))}
        {action.rewardMoney > 0 && (
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-emerald-500/15 px-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <Coins className="h-3 w-3" />+{shortMoney(action.rewardMoney)}m
          </span>
        )}
        {action.satisfactionDelta > 0 && (
          <span className="inline-flex h-7 items-center rounded-full bg-pink-500/15 px-2 text-[11px] font-bold text-pink-600 dark:text-pink-400">
            +{action.satisfactionDelta}% satisf.
          </span>
        )}

        {(running || blocked) && (
          <span
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold',
              running ? 'bg-muted text-muted-foreground' : 'bg-red-500/15 text-red-500',
            )}
          >
            {running ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> En cours
              </>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3" /> {blockedReason}
              </>
            )}
          </span>
        )}

        <button
          type="button"
          onClick={() => void run()}
          disabled={blocked || running}
          className="ml-auto inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: blocked && !running ? `${hex}80` : hex,
            boxShadow: blocked || running ? 'none' : `0 2px 6px -2px ${hex}80`,
          }}
          title={action.label}
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
          )}
          <span className="max-w-[160px] truncate sm:max-w-[220px]">{action.label}</span>
          <span className="ml-1 inline-flex shrink-0 items-baseline gap-0.5 rounded-md bg-black/25 px-1.5 py-0.5 text-[10px] tabular-nums">
            {shortMoney(totalCost)}<span className="opacity-80">m</span>
          </span>
        </button>
      </div>
    </div>
  );
}

function BusinessCard({
  business,
  sourceOptions,
  selectedSources,
  mutatingKey,
  onSelectSource,
  onRun,
}: {
  business: YouResourceActionBusiness;
  sourceOptions: YouResourceActionSourceOption[];
  selectedSources: Record<string, string>;
  mutatingKey: string | null;
  onSelectSource: (key: string, value: string) => void;
  onRun: (business: YouResourceActionBusiness, action: YouResourceAction, sources: Record<string, YouResourceActionSourceInput>) => Promise<void>;
}) {
  const style = getBusinessStyle(business.typeKey);
  const hex = getBusinessHex(business.typeKey);
  const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  const net = Math.round((business.monthlyRevenue - business.monthlyExpenses) / 30);
  const stockPills = business.inventories.filter((inventory) => inventory.capacity > 0);

  return (
    <Card className="overflow-hidden border-l-[3px]" style={{ borderLeftColor: hex }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', style.iconWrap)}>
            <Icon className={cn('h-4 w-4', style.icon)} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight" style={{ color: hex }}>
              {business.name}
            </h3>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">
              {business.typeLabel}
              {business.underConstruction ? ' · chantier' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-1">
          <StatPill label="💰" value={`${shortMoney(business.treasuryMoney)}m`} tone="warm" />
          <StatPill
            label="Net/j"
            value={`${net >= 0 ? '+' : ''}${shortMoney(net)}`}
            tone={net >= 0 ? 'positive' : 'negative'}
          />
          <StatPill label="😊" value={`${business.satisfaction}%`} tone="neutral" />
          {stockPills.map((inventory) => (
            <StockPill key={inventory.id} inventory={inventory} />
          ))}
        </div>
      </div>

      {business.underConstruction ? (
        <div className="border-t border-border/40 bg-amber-500/5 px-3 py-3 text-xs text-amber-500">
          Chantier en cours — actions bloquées.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 border-t border-border/40 p-2">
          {business.actions.map((action) => (
            <ActionCard
              key={action.key}
              business={business}
              action={action}
              hex={hex}
              sourceOptions={sourceOptions}
              selectedSources={selectedSources}
              mutatingKey={mutatingKey}
              onSelectSource={onSelectSource}
              onRun={onRun}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export function ActionsTab({ onReload }: { onReload?: () => void }) {
  const [state, setState] = useState<YouResourceActionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await youApi.getResourceActionState();
      setState(response.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de charger les actions ressources.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const businesses = useMemo(() => state?.businesses ?? [], [state]);
  const sourceOptions = state?.sourceOptions ?? [];

  const selectSource = (key: string, value: string) => {
    setSelectedSources((current) => ({ ...current, [key]: value }));
  };

  const runAction = async (
    business: YouResourceActionBusiness,
    action: YouResourceAction,
    sources: Record<string, YouResourceActionSourceInput>,
  ) => {
    const rowKey = `${business.id}:${action.key}`;
    setMutatingKey(rowKey);
    try {
      const response = await youApi.runResourceAction(business.id, { actionKey: action.key, sources });
      const result = response.data.result;
      toast.success(`${action.label} terminé — coût ${money(result.totalMoneyCost)}${result.rewardMoney > 0 ? `, gain ${money(result.rewardMoney)}` : ''}.`);
      await load();
      onReload?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Action impossible.');
    } finally {
      setMutatingKey(null);
    }
  };

  if (loading && !state) {
    return (
      <div className="flex min-h-[360px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des actions…
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Actions</h2>
          <p className="text-xs text-muted-foreground">
            {businesses.length} business{businesses.length > 1 ? 'es' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || mutatingKey !== null}>
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Actualiser
        </Button>
      </div>

      {businesses.length === 0 ? (
        <Card>
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun business disponible.</CardContent>
        </Card>
      ) : (
        businesses.map((business) => (
          <BusinessCard
            key={business.id}
            business={business}
            sourceOptions={sourceOptions}
            selectedSources={selectedSources}
            mutatingKey={mutatingKey}
            onSelectSource={selectSource}
            onRun={runAction}
          />
        ))
      )}
    </div>
  );
}
