import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, ChevronDown, Loader2, Minus, Plus, RefreshCw,
  Search, ShoppingCart, Tag, TrendingDown, TrendingUp, Trash2, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { cn } from '@/lib/utils';
import {
  type YouBusiness,
  type YouResourceMarketListing,
  type YouResourceMarketState,
  type YouSupplyResourceType,
  youApi,
} from '@/services/api';

function fmt(v: number) { return Math.round(v).toLocaleString('fr-FR'); }
function fmtDec(v: number) { return v.toFixed(v < 10 ? 1 : 0).replace('.', ','); }
function resourceLabel(rt: string) { return RESOURCE_META[rt as ResourceType]?.label ?? rt; }

// Deterministic sparkline matching the backend seed (visual only)
function MiniSparkline({ trend, change }: { trend: number[]; change: number }) {
  if (trend.length < 2) return null;
  const w = 56, h = 18;
  const min = Math.min(...trend), max = Math.max(...trend), range = max - min || 1;
  const step = w / (trend.length - 1);
  const toY = (v: number) => h - 2 - ((v - min) / range) * (h - 4);
  const path = trend.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${toY(v)}`).join(' ');
  const color = change >= 0 ? '#34d399' : '#f87171';
  const last = trend[trend.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={path} fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(trend.length - 1) * step} cy={toY(last)} r="1.8" fill={color} />
    </svg>
  );
}

// Resource type filter chip
function ResourcePill({
  resourceType, active, onClick,
}: { resourceType: string; active: boolean; onClick: () => void }) {
  const meta = RESOURCE_META[resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition',
        active
          ? cn('border-border bg-foreground text-background')
          : 'border-border/40 bg-background/60 text-muted-foreground hover:text-foreground hover:border-border',
      )}
    >
      <Icon className={cn('h-3 w-3', active ? '' : (meta?.iconColor ?? 'text-muted-foreground'))} />
      {resourceLabel(resourceType)}
    </button>
  );
}

// Inline post-listing form
function PostListingForm({
  ownedBusinesses, resourceStats, onCreated,
}: {
  ownedBusinesses: YouBusiness[];
  resourceStats: YouResourceMarketState['resourceStats'];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState(ownedBusinesses[0]?.id ?? '');
  const [resourceType, setResourceType] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(1);
  const [loading, setLoading] = useState(false);

  const avgPrice = resourceType && resourceStats[resourceType]
    ? resourceStats[resourceType].avg
    : null;

  const submit = async () => {
    if (!businessId || !resourceType || quantity <= 0 || unitPrice <= 0) {
      toast.error('Remplissez tous les champs.');
      return;
    }
    setLoading(true);
    try {
      await youApi.createMarketListing({ businessId, resourceType: resourceType as YouSupplyResourceType, quantity, unitPrice });
      toast.success('Annonce publiée.');
      setOpen(false);
      onCreated();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de publier l\'annonce.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/50 bg-background/30 px-4 py-3 text-[12.5px] font-medium text-muted-foreground transition hover:border-border hover:text-foreground"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background/60">
          <Plus className="h-3.5 w-3.5" />
        </span>
        Vendre une ressource au marché
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Nouvelle annonce</span>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Business</label>
          <Select value={businessId} onValueChange={setBusinessId}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {ownedBusinesses.map((b) => (
                <SelectItem key={b.id} value={b.id}><span className="text-xs">{b.name}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ressource</label>
          <Select value={resourceType} onValueChange={(v) => {
            setResourceType(v);
            if (resourceStats[v]) setUnitPrice(resourceStats[v].avg);
          }}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(RESOURCE_META).map((rt) => (
                <SelectItem key={rt} value={rt}>
                  <span className="text-xs">{resourceLabel(rt)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quantité</label>
          <Input
            type="number" min={1} value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="h-9 text-xs tabular-nums"
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Prix/u
            {avgPrice && (
              <span className="font-normal normal-case text-[9px] text-muted-foreground/70">cours ~{fmtDec(avgPrice)}m</span>
            )}
          </label>
          <Input
            type="number" min={1} value={unitPrice}
            onChange={(e) => setUnitPrice(Math.max(1, Number(e.target.value)))}
            className="h-9 text-xs tabular-nums"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          Total estimé: <strong>{fmt(quantity * unitPrice)}m</strong>
        </span>
        <Button size="sm" onClick={() => void submit()} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Tag className="mr-1.5 h-3.5 w-3.5" />}
          Publier
        </Button>
      </div>
    </div>
  );
}

// Buy flow inline inside each row
function BuyFlow({
  listing, ownedBusinesses, onBought,
}: {
  listing: YouResourceMarketListing;
  ownedBusinesses: YouBusiness[];
  onBought: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [targetId, setTargetId] = useState(ownedBusinesses[0]?.id ?? '');
  const [loading, setLoading] = useState(false);

  const total = qty * listing.unitPrice;

  const buy = async () => {
    if (!targetId) { toast.error('Choisissez un business destinataire.'); return; }
    setLoading(true);
    try {
      await youApi.buyMarketListing(listing.id, { quantity: qty, targetBusinessId: targetId });
      toast.success(`Achat effectué — ${qty}× ${resourceLabel(listing.resourceType)} pour ${fmt(total)}m.`);
      onBought();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Achat impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {ownedBusinesses.length > 1 && (
        <Select value={targetId} onValueChange={setTargetId}>
          <SelectTrigger className="h-8 w-[130px] text-[11px]">
            <SelectValue placeholder="Business…" />
          </SelectTrigger>
          <SelectContent>
            {ownedBusinesses.map((b) => (
              <SelectItem key={b.id} value={b.id}><span className="text-xs">{b.name}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="inline-flex h-8 items-center rounded-lg border border-border/40 bg-background/60">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="min-w-[1.5rem] text-center text-[13px] font-bold tabular-nums text-foreground">{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(listing.quantity, q + 1))}
          className="flex h-full w-7 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => void buy()}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border-none bg-emerald-500 px-3 py-1.5 text-[12.5px] font-bold text-[#06281c] shadow-[0_2px_8px_-2px_rgba(52,211,153,0.5)] transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
        Acheter · {fmt(total)}m
      </button>
    </div>
  );
}

// Single listing row
function ListingRow({
  listing, stats, ownedBusinesses, onCancelled, onBought,
}: {
  listing: YouResourceMarketListing;
  stats: YouResourceMarketState['resourceStats'][string] | undefined;
  ownedBusinesses: YouBusiness[];
  onCancelled: () => void;
  onBought: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const meta = RESOURCE_META[listing.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  const avg = stats?.avg ?? listing.unitPrice;
  const diff = ((listing.unitPrice - avg) / avg) * 100;
  const priceFlag = diff < -4
    ? { label: 'bon prix', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' }
    : diff > 6
      ? { label: 'cher', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' }
      : null;

  const cancel = async () => {
    setCancelling(true);
    try {
      await youApi.cancelMarketListing(listing.id);
      toast.success('Annonce retirée.');
      onCancelled();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de retirer l\'annonce.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className={cn(
        'grid items-center gap-3 border-t border-border/30 px-4 py-3.5',
        listing.mine ? 'bg-amber-500/4' : '',
      )}
      style={{ gridTemplateColumns: '1fr auto auto auto auto' }}
    >
      {/* Resource + seller */}
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta?.bg ?? 'bg-muted')}>
          <Icon className={cn('h-4.5 w-4.5', meta?.iconColor ?? 'text-muted-foreground')} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground leading-tight">
            {resourceLabel(listing.resourceType)}
            {listing.mine && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-500">toi</span>
            )}
          </div>
          <div className="text-[10.5px] text-muted-foreground truncate">
            {listing.businessName} · {listing.sellerName}
          </div>
        </div>
      </div>

      {/* Qty */}
      <div className="text-right">
        <div className="text-[15px] font-bold tabular-nums text-foreground leading-tight">{fmt(listing.quantity)}</div>
        <div className="text-[10px] text-muted-foreground">unités</div>
      </div>

      {/* Unit price + flag */}
      <div className="text-right">
        <div className="flex items-baseline gap-1.5 justify-end">
          <span className="text-[15px] font-bold tabular-nums text-foreground leading-tight">{fmtDec(listing.unitPrice)}m</span>
          {priceFlag && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', priceFlag.cls)}>
              {priceFlag.label}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">total {fmt(listing.quantity * listing.unitPrice)}m</div>
      </div>

      {/* Trend */}
      <div className="flex items-center gap-2">
        {stats && <MiniSparkline trend={stats.trend} change={stats.change} />}
        {stats && (
          <div>
            <div className={cn('text-[11px] font-bold tabular-nums leading-tight', stats.change >= 0 ? 'text-emerald-500' : 'text-red-500')}>
              {stats.change >= 0 ? '+' : ''}{stats.change}%
            </div>
            <div className="text-[10px] text-muted-foreground">7j · {fmtDec(stats.avg)}m moy</div>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center gap-2 justify-end">
        {listing.mine ? (
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={cancelling}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-1.5 text-[12px] font-semibold text-red-500 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Retirer
          </button>
        ) : (
          <BuyFlow listing={listing} ownedBusinesses={ownedBusinesses} onBought={onBought} />
        )}
      </div>
    </div>
  );
}

// Column header row
function ColumnHeaders() {
  return (
    <div
      className="grid border-b border-border/30 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      style={{ gridTemplateColumns: '1fr auto auto auto auto' }}
    >
      <span>Ressource · vendeur</span>
      <span className="text-right">Quantité</span>
      <span className="flex cursor-pointer items-center justify-end gap-1 text-right hover:text-foreground">
        Prix / u <ChevronDown className="h-3 w-3" />
      </span>
      <span>Tendance 7j</span>
      <span className="text-right">Action</span>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function MarketplaceTab({ ownedBusinesses }: { ownedBusinesses: YouBusiness[] }) {
  const [params] = useSearchParams();
  const prefilterResource = params.get('resource');
  const prefilterForBusiness = params.get('for');
  const presellResource = params.get('sell');
  const presellFrom = params.get('from');

  const [state, setState] = useState<YouResourceMarketState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [search, setSearch] = useState('');
  const [filterResource, setFilterResource] = useState<string>(prefilterResource ?? '');

  // Pre-fill target business from URL "for" param
  const prefilledBusiness = useMemo(() => {
    if (!prefilterForBusiness) return null;
    return ownedBusinesses.find((b) => b.id === prefilterForBusiness) ?? null;
  }, [prefilterForBusiness, ownedBusinesses]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await youApi.getMarketListings();
      setState(res.data);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de charger le marché.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const listings = state?.listings ?? [];
  const resourceStats = state?.resourceStats ?? {};

  // Unique resource types that have active listings
  const availableResources = useMemo(
    () => [...new Set(listings.map((l) => l.resourceType))].sort(),
    [listings],
  );

  const filtered = useMemo(() => {
    let result = listings;
    if (tab === 'mine') result = result.filter((l) => l.mine);
    if (filterResource) result = result.filter((l) => l.resourceType === filterResource);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) =>
          resourceLabel(l.resourceType).toLowerCase().includes(q)
          || l.businessName.toLowerCase().includes(q)
          || l.sellerName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [listings, tab, filterResource, search]);

  const myListingsCount = listings.filter((l) => l.mine).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Salle de marché</h2>
          <p className="text-xs text-muted-foreground">
            {listings.length} annonce{listings.length > 1 ? 's' : ''} actives
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          Actualiser
        </Button>
      </div>

      {/* Inline post form */}
      {ownedBusinesses.length > 0 && (
        <PostListingForm
          ownedBusinesses={ownedBusinesses}
          resourceStats={resourceStats}
          onCreated={() => void load()}
        />
      )}

      {/* Tabs + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border/40 bg-muted/30 p-0.5">
          {(['all', 'mine'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[12px] font-semibold transition',
                tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'all' ? 'Toutes' : `Mes annonces${myListingsCount > 0 ? ` (${myListingsCount})` : ''}`}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ressource, vendeur…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Resource filter chips */}
      {availableResources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterResource && (
            <button
              type="button"
              onClick={() => setFilterResource('')}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2.5 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-2.5 w-2.5" /> Tout
            </button>
          )}
          {availableResources.map((rt) => (
            <ResourcePill
              key={rt}
              resourceType={rt}
              active={filterResource === rt}
              onClick={() => setFilterResource(filterResource === rt ? '' : rt)}
            />
          ))}
        </div>
      )}

      {/* Listings table */}
      {loading && !state ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement du marché…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
            {tab === 'mine' ? 'Vous n\'avez aucune annonce active.' : 'Aucune annonce pour ce filtre.'}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ColumnHeaders />
          <div>
            {filtered.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                stats={resourceStats[listing.resourceType]}
                ownedBusinesses={
                  // If we arrived via "Acheter au marché" → pre-select the target business
                  prefilledBusiness
                    ? [prefilledBusiness, ...ownedBusinesses.filter((b) => b.id !== prefilledBusiness.id)]
                    : ownedBusinesses
                }
                onCancelled={() => void load()}
                onBought={() => void load()}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
