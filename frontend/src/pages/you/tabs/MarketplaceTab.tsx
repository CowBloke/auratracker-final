import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Building2, ChevronDown, Loader2, Minus, Plus, RefreshCw,
  Search, ShoppingCart, Sparkles, Tag, TrendingDown, TrendingUp, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Empty, EmptyHeader, EmptyDescription } from '@/components/ui/empty';
import { Badge } from '@/components/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';

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
    <Toggle pressed={active} onPressedChange={onClick} size="sm" variant="outline">
      <Icon />
      {resourceLabel(resourceType)}
    </Toggle>
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
      <Button type="button" variant="outline" onClick={handleOpen}>
        <Tag />
        Vendre une ressource
      </Button>

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
              <label className="text-xs font-bold text-muted-foreground ml-0.5">1. Business source</label>
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
              <label className="text-xs font-bold text-muted-foreground ml-0.5 flex items-center justify-between">
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
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ResourceIcon className="size-4" />
                  {resourceLabel(resourceType)}
                </CardTitle>
                <CardDescription>Stats du marché</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
              {stats ? (
                <div className="grid grid-cols-1 gap-2">
                  <Item variant="outline" className="justify-between">
                    <div className="text-xs font-bold text-muted-foreground">Prix moyen global actuel</div>
                    <div className="font-semibold text-foreground text-sm">{fmtDec(stats.avg)}€/u</div>
                  </Item>
                </div>
              ) : (
                 <Empty className="border"><EmptyHeader><EmptyDescription>
                   Aucune donnée de marché récente pour ce produit.
                 </EmptyDescription></EmptyHeader></Empty>
              )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground ml-0.5">3. Quantité</label>
                <span className="text-xs font-bold text-muted-foreground">Max: {maxQty} unités</span>
              </div>
              <Input
                type="number" min={1} max={maxQty} value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, Number(e.target.value))))}
                className="h-10 text-sm tabular-nums font-bold"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground ml-0.5">4. Prix unitaire</label>
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
            <span className="text-sm font-semibold text-success">{fmt(quantity * unitPrice)}€</span>
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
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Business…" />
          </SelectTrigger>
          <SelectContent>
            {ownedBusinesses.map((b) => (
              <SelectItem key={b.id} value={b.id}><span className="text-xs">{b.name}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <ButtonGroup>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Moins" onClick={() => setQty((q) => Math.max(1, q - 1))}>
          <Minus />
        </Button>
        <ButtonGroupText className="min-w-8 justify-center tabular-nums">{qty}</ButtonGroupText>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Plus" onClick={() => setQty((q) => Math.min(listing.quantity, q + 1))}>
          <Plus />
        </Button>
      </ButtonGroup>
      <Button type="button" size="sm" onClick={() => void buy()} disabled={loading}>
        {loading ? <Spinner /> : <ShoppingCart />}
        Acheter · {fmt(total)}€
      </Button>
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
        <Badge variant="secondary">{effectLabel}</Badge>
      )}
      <Button type="button" size="sm" onClick={() => void buy()} disabled={loading}>
        {loading ? <Spinner /> : <Sparkles />}
        Acheter · {fmt(listing.unitPrice)}€
      </Button>
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
    <TableRow data-state={listing.mine ? 'selected' : undefined}>
      <TableCell>
        <Item className="p-0">
          <ItemMedia variant="icon">
            <Icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {def?.name ?? resourceLabel(listing.resourceType)}
              {listing.mine && <Badge variant="secondary">toi</Badge>}
            </ItemTitle>
            <ItemDescription>{listing.businessName} · {listing.sellerName}</ItemDescription>
          </ItemContent>
        </Item>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{listing.quantity} u. dispo</TableCell>
      <TableCell className="text-right">
        {listing.mine ? (
          <Button variant="outline" size="sm" onClick={() => void cancel()} disabled={cancelling}>
            {cancelling ? <Spinner /> : <Trash2 />}
            Retirer
          </Button>
        ) : (
          <ItemBuyFlow listing={listing} onBought={onBought} />
        )}
      </TableCell>
    </TableRow>
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
    ? { label: 'bon prix', variant: 'success' as const }
    : diff > 6
      ? { label: 'cher', variant: 'warning' as const }
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
    <TableRow data-state={listing.mine ? 'selected' : undefined}>
      <TableCell>
        <Item className="p-0">
          <ItemMedia variant="icon">
            <Icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              {resourceLabel(listing.resourceType)}
              {listing.mine && <Badge variant="secondary">toi</Badge>}
            </ItemTitle>
            <ItemDescription>{listing.businessName} · {listing.sellerName}</ItemDescription>
          </ItemContent>
        </Item>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="font-semibold">{fmt(listing.quantity)}</div>
        <div className="text-xs text-muted-foreground">unités</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="flex items-center justify-end gap-1.5 font-semibold">
          {fmtDec(listing.unitPrice)}€/u
          {priceFlag && <Badge variant={priceFlag.variant}>{priceFlag.label}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">total {fmt(listing.quantity * listing.unitPrice)}€</div>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {stats ? `${fmtDec(stats.avg)}€/u` : '—'}
      </TableCell>
      <TableCell className="text-right">
        {listing.mine ? (
          <Button variant="outline" size="sm" onClick={() => void cancel()} disabled={cancelling}>
            {cancelling ? <Spinner /> : <Trash2 />}
            Retirer
          </Button>
        ) : (
          <BuyFlow listing={listing} ownedBusinesses={ownedBusinesses} onBought={onBought} />
        )}
      </TableCell>
    </TableRow>
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

  const colSpanHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>Ressource · vendeur</TableHead>
        <TableHead className="text-right">Quantité</TableHead>
        <TableHead className="text-right">Prix / u</TableHead>
        <TableHead className="text-right">Prix moyen</TableHead>
        <TableHead className="text-right">Action</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {listings.length} annonce{listings.length > 1 ? 's' : ''} active{listings.length > 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw />}
            Actualiser
          </Button>
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'all' | 'mine')}>
          <TabsList>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="mine">Mes annonces{myListingsCount > 0 ? ` (${myListingsCount})` : ''}</TabsTrigger>
          </TabsList>
        </Tabs>
        <InputGroup className="max-w-sm flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ressource, vendeur…" />
        </InputGroup>
      </div>

      {availableResources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterResource && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFilterResource('')}>
              <X /> Tout
            </Button>
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

      {loading && !state ? (
        <div className="flex min-h-[240px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Chargement du marché…
        </div>
      ) : filtered.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyDescription>
              {tab === 'mine' ? "Tu n'as aucune annonce active." : 'Aucune annonce pour ce filtre.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredItems.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" />
                Marché des items
                <Badge variant="secondary">{filteredItems.length}</Badge>
              </h2>
              <Card className="py-0">
                <Table>
                  <TableBody>
                    {filteredItems.map((listing) => (
                      <ItemListingRow
                        key={listing.id}
                        listing={listing}
                        onCancelled={() => void load()}
                        onBought={() => void load()}
                      />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          )}

          {filteredResources.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4" />
                Marché des ressources
                <Badge variant="secondary">{filteredResources.length}</Badge>
              </h2>
              <Card className="py-0">
                <Table>
                  {colSpanHeader}
                  <TableBody>
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
                  </TableBody>
                </Table>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
