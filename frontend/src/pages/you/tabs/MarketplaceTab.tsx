import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, ChevronDown, Loader2, Minus, Plus, RefreshCw,
  Search, ShoppingCart, Sparkles, Tag, TrendingDown, TrendingUp, Trash2, X,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AppModal } from '@/components/ui/app-modal';
import { RESOURCE_META, type ResourceType } from '@/lib/resources';
import { ITEM_RESOURCE_TYPES, SHOP_ITEM_DEFS } from '@/lib/shop-items';
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

type BizInventory = { resourceType: string; quantity: number };

// Modal for creating a new listing
function CreateListingModal({
  ownedBusinesses, resourceStats, onCreated,
  initialOpen = false, initialBusinessId = '', initialResourceType = ''
}: {
  ownedBusinesses: YouBusiness[];
  resourceStats: YouResourceMarketState['resourceStats'];
  onCreated: () => void;
  initialOpen?: boolean;
  initialBusinessId?: string;
  initialResourceType?: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [businessId, setBusinessId] = useState(initialBusinessId || (ownedBusinesses[0]?.id ?? ''));
  const [resourceType, setResourceType] = useState<string>(initialResourceType);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [bizInventories, setBizInventories] = useState<Record<string, BizInventory[]>>({});

  const loadInventories = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await youApi.getResourceActionState();
      const map: Record<string, BizInventory[]> = {};
      for (const biz of res.data.businesses) {
        map[biz.id] = biz.inventories
          .filter((inv: any) => inv.quantity > 0)
          .map((inv: any) => ({ resourceType: inv.resourceType, quantity: inv.quantity }));
      }
      setBizInventories(map);
    } catch {
      // silently fail — all resources shown as fallback
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    void loadInventories();
  };

  useEffect(() => {
    if (initialOpen && Object.keys(bizInventories).length === 0 && !inventoryLoading) {
      void loadInventories();
    }
  }, [initialOpen, bizInventories, inventoryLoading, loadInventories]);

  useEffect(() => {
    if (initialResourceType && resourceStats[initialResourceType] && unitPrice === 1) {
      setUnitPrice(resourceStats[initialResourceType].avg);
    }
  }, [initialResourceType, resourceStats, unitPrice]);

  const availableResources = useMemo(() => {
    const inv = bizInventories[businessId];
    if (!inv || inv.length === 0) return Object.keys(RESOURCE_META);
    return inv.map((i) => i.resourceType);
  }, [bizInventories, businessId]);

  const maxQty = useMemo(() => {
    const inv = bizInventories[businessId];
    if (!inv) return 9999;
    return inv.find((i) => i.resourceType === resourceType)?.quantity ?? 9999;
  }, [bizInventories, businessId, resourceType]);

  const stats = resourceType ? resourceStats[resourceType] : null;

  const handleBusinessChange = (id: string) => {
    setBusinessId(id);
    setResourceType('');
  };

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

  const meta = resourceType ? RESOURCE_META[resourceType as ResourceType] : null;
  const ResourceIcon = meta?.Icon ?? Building2;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 transition hover:border-emerald-500/60 hover:bg-emerald-500/10"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/15">
          <Tag className="h-4 w-4" />
        </span>
        Vendre une ressource au marché
      </button>

      {/* Modal */}
      <AppModal open={open} onClose={() => setOpen(false)} tone="money" size="md">
        <AppModal.Header
          tone="money"
          icon={<Tag />}
          title="Nouvelle Annonce"
          subtitle="Mettez en vente vos stocks excédentaires sur le marché."
        />
        <AppModal.Body className="py-4 space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">1. Business source</label>
              <Select value={businessId} onValueChange={handleBusinessChange}>
                <SelectTrigger className="h-10 text-sm font-semibold">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {ownedBusinesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}><span className="font-semibold">{b.name}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5 flex items-center justify-between">
                <span>2. Produit à vendre</span>
                {inventoryLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </label>
              <Select
                value={resourceType}
                onValueChange={(v) => {
                  setResourceType(v);
                  if (resourceStats[v]) setUnitPrice(resourceStats[v].avg);
                  setQuantity(1);
                }}
              >
                <SelectTrigger className="h-10 text-sm font-semibold">
                  <SelectValue placeholder={availableResources.length === 0 ? 'Stock vide' : 'Choisir…'} />
                </SelectTrigger>
                <SelectContent>
                  {availableResources.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Aucun stock disponible</div>
                  ) : availableResources.map((rt) => {
                    const inv = bizInventories[businessId]?.find((i) => i.resourceType === rt);
                    const rtMeta = RESOURCE_META[rt as ResourceType];
                    const RIcon = rtMeta?.Icon ?? Building2;
                    return (
                      <SelectItem key={rt} value={rt}>
                        <div className="flex items-center gap-2">
                          <RIcon className={cn("h-3.5 w-3.5", rtMeta?.iconColor)} />
                          <span className="font-semibold text-sm">
                            {resourceLabel(rt)}
                            {inv && <span className="ml-1.5 text-muted-foreground font-normal">({inv.quantity})</span>}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {resourceType && (
            <div className={cn("rounded-2xl border p-4 shadow-sm", meta?.bg ? meta.bg.replace('bg-', 'border-').replace('/15', '/30') : 'border-border/40', meta?.bg ?? 'bg-muted/10')}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg shadow-sm', meta?.bg ? meta.bg.replace('/15', '/30') : 'bg-muted/40')}>
                  <ResourceIcon className={cn("h-4 w-4", meta?.iconColor)} />
                </span>
                <span className="font-bold text-foreground">{resourceLabel(resourceType)}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground ml-auto">Stats du marché</span>
              </div>
              
              {stats ? (
                <div className="grid grid-cols-1 gap-2">
                  <div className="bg-background/80 rounded-xl p-3 border border-border/50 flex items-center justify-between px-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prix moyen global actuel</div>
                    <div className="font-black text-foreground text-[14px]">{fmtDec(stats.avg)}€/u</div>
                  </div>
                </div>
              ) : (
                 <div className="bg-background/50 rounded-xl p-3 border border-border/30 text-xs text-muted-foreground text-center">
                   Aucune donnée de marché récente pour ce produit.
                 </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">3. Quantité</label>
                <span className="text-[10px] font-bold text-muted-foreground">Max: {maxQty} unités</span>
              </div>
              <Input
                type="number" min={1} max={maxQty} value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value))))}
                className="h-10 text-sm tabular-nums font-bold"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-0.5">4. Prix unitaire</label>
              <Input
                type="number" min={1} value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(1, Number(e.target.value)))}
                className="h-10 text-sm tabular-nums font-bold"
              />
            </div>
          </div>

        </AppModal.Body>
        <AppModal.Footer left={
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Total estimé :</span>
            <span className="text-sm font-black text-emerald-500">{fmt(quantity * unitPrice)}€</span>
          </div>
        }>
          <AppModal.Button variant="ghost" onClick={() => setOpen(false)}>Annuler</AppModal.Button>
          <AppModal.Button tone="money" onClick={() => void submit()} disabled={loading || !resourceType}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Tag className="mr-1.5 h-4 w-4" />}
            Publier l'annonce
          </AppModal.Button>
        </AppModal.Footer>
      </AppModal>
    </>
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
      toast.success(`Achat effectué — ${qty}× ${resourceLabel(listing.resourceType)} pour ${fmt(total)}€.`);
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
        Acheter · {fmt(total)}€
      </button>
    </div>
  );
}

// One-click buy for item listings (applies effect directly, no target business)
function ItemBuyFlow({ listing, onBought }: { listing: YouResourceMarketListing; onBought: () => void }) {
  const [loading, setLoading] = useState(false);
  const def = SHOP_ITEM_DEFS.find((d) => d.craftableResourceType === listing.resourceType);

  const buy = async () => {
    setLoading(true);
    try {
      const res = await youApi.buyItemMarketListing(listing.id);
      const eff = res.data.effect;
      let msg = 'Item obtenu !';
      if (eff?.type === 'BONUS_AURA') msg = `+${eff.bonusAura} aura ajouté à ton compte.`;
      else if (eff?.type === 'BONUS_MONEY') msg = `+${eff.bonusMoney}€ ajouté à ton compte.`;
      else if (eff?.type === 'YOU_ADBLOCK') msg = 'ADblock activé 60 min.';
      else if (eff?.type === 'PROFILE_PICTURE') msg = "Jus d'abricot ajouté à ton inventaire.";
      else if (eff?.type === 'USERNAME_COLOR') msg = 'Jus de gingembre ajouté à ton inventaire.';
      else if (eff?.type === 'PROFILE_BANNER') msg = 'Jus de malakoukou ajouté à ton inventaire.';
      toast.success(msg);
      onBought();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Achat impossible.');
    } finally {
      setLoading(false);
    }
  };

  const effectLabel = def
    ? (def.effect.type === 'BONUS_AURA' ? `+${def.effect.bonusAura} aura`
      : def.effect.type === 'BONUS_MONEY' ? `+${def.effect.bonusMoney as number}€`
      : def.effect.type === 'YOU_ADBLOCK' ? 'ADblock 60 min'
      : def.effect.type === 'PROFILE_PICTURE' ? 'Changer PDP'
      : def.effect.type === 'USERNAME_COLOR' ? 'Couleur pseudo'
      : def.effect.type === 'PROFILE_BANNER' ? 'Bannière profil'
      : '')
    : '';

  return (
    <div className="flex items-center gap-2">
      {effectLabel && (
        <span className="rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-bold text-pink-500 border border-pink-500/20">
          {effectLabel}
        </span>
      )}
      <button
        type="button"
        onClick={() => void buy()}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-pink-500 px-3 py-1.5 text-[12.5px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(236,72,153,0.5)] transition hover:bg-pink-400 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Acheter · {fmt(listing.unitPrice)}€
      </button>
    </div>
  );
}

// Item listing row (no quantity selector, 1 unit per purchase)
function ItemListingRow({ listing, onCancelled, onBought }: {
  listing: YouResourceMarketListing;
  onCancelled: () => void;
  onBought: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const meta = RESOURCE_META[listing.resourceType as ResourceType];
  const Icon = meta?.Icon ?? Building2;
  const def = SHOP_ITEM_DEFS.find((d) => d.craftableResourceType === listing.resourceType);

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
    <div className={cn('flex flex-wrap items-center gap-3 border-t border-border/30 px-4 py-3.5', listing.mine && 'bg-amber-500/4')}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', meta?.bg ?? 'bg-muted')}>
        <Icon className={cn('h-4.5 w-4.5', meta?.iconColor ?? 'text-muted-foreground')} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground leading-tight">
          {def?.name ?? resourceLabel(listing.resourceType)}
          {listing.mine && <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-500">toi</span>}
        </div>
        <div className="text-[10.5px] text-muted-foreground">{listing.businessName} · {listing.sellerName}</div>
      </div>
      <div className="text-right">
        <div className="text-[13px] font-bold tabular-nums">{listing.quantity} u. dispo</div>
      </div>
      <div className="flex items-center gap-2">
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
          <ItemBuyFlow listing={listing} onBought={onBought} />
        )}
      </div>
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
          <span className="text-[15px] font-bold tabular-nums text-foreground leading-tight">{fmtDec(listing.unitPrice)}€/u</span>
          {priceFlag && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', priceFlag.cls)}>
              {priceFlag.label}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">total {fmt(listing.quantity * listing.unitPrice)}€</div>
      </div>

      {/* Avg Price */}
      <div className="flex items-center gap-2">
        {stats && (
          <div className="bg-muted/30 px-2.5 py-1.5 rounded-lg border border-border/40 shadow-sm">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-tight mb-0.5">Prix moyen</div>
            <div className="text-[12px] font-black text-foreground">{fmtDec(stats.avg)}€/u</div>
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
      <span>Prix Moyen</span>
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
      const getLabel = (l: YouResourceMarketListing) => {
        const def = SHOP_ITEM_DEFS.find((d) => d.craftableResourceType === l.resourceType);
        return def?.name ?? resourceLabel(l.resourceType);
      };
      result = result.filter(
        (l) =>
          getLabel(l).toLowerCase().includes(q)
          || l.businessName.toLowerCase().includes(q)
          || l.sellerName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [listings, tab, filterResource, search]);

  const filteredItems = useMemo(
    () => filtered.filter((l) => ITEM_RESOURCE_TYPES.has(l.resourceType)),
    [filtered],
  );
  const filteredResources = useMemo(
    () => filtered.filter((l) => !ITEM_RESOURCE_TYPES.has(l.resourceType)),
    [filtered],
  );

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

      {/* Inline post form trigger / Modal */}
      {ownedBusinesses.length > 0 && (
        <CreateListingModal
          ownedBusinesses={ownedBusinesses}
          resourceStats={resourceStats}
          onCreated={() => void load()}
          initialOpen={!!presellResource}
          initialBusinessId={presellFrom ?? ''}
          initialResourceType={presellResource ?? ''}
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

      {/* Listings */}
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
        <div className="space-y-4">
          {/* Items section */}
          {filteredItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-pink-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-pink-500">Marché des Items</span>
                <div className="flex-1 border-t border-pink-500/20" />
                <span className="text-[10px] text-muted-foreground">{filteredItems.length} annonce{filteredItems.length > 1 ? 's' : ''}</span>
              </div>
              <Card className="overflow-hidden">
                <div>
                  {filteredItems.map((listing) => (
                    <ItemListingRow
                      key={listing.id}
                      listing={listing}
                      onCancelled={() => void load()}
                      onBought={() => void load()}
                    />
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Resources section */}
          {filteredResources.length > 0 && (
            <div className="space-y-2">
              {filteredItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Marché des Ressources</span>
                  <div className="flex-1 border-t border-emerald-500/20" />
                  <span className="text-[10px] text-muted-foreground">{filteredResources.length} annonce{filteredResources.length > 1 ? 's' : ''}</span>
                </div>
              )}
              <Card className="overflow-hidden">
                <ColumnHeaders />
                <div>
                  {filteredResources.map((listing) => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      stats={resourceStats[listing.resourceType]}
                      ownedBusinesses={
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
