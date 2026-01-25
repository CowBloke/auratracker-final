import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketApi, galleryApi, marketplaceApi, MarketListing, Painting } from '../services/api';
import { Loader2, Package, ShoppingCart, Tag, X, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resolveImageUrl } from '@/lib/images';
import PageLayout from '@/components/layout/PageLayout';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

const rarityLabels: Record<string, string> = {
  COMMON: 'Commun',
  RARE: 'Rare',
  GOLDEN: 'Doré',
};

const rarityColors: Record<string, string> = {
  COMMON: 'text-muted-foreground',
  RARE: 'text-blue-400',
  GOLDEN: 'text-yellow-400',
};

const rarityFilters: Record<string, string> = {
  COMMON: 'grayscale',
  RARE: '',
  GOLDEN: 'sepia brightness-110 saturate-150',
};

interface UserItem {
  id: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    description: string;
    type: string;
    imageUrl?: string;
  };
}

export default function PlayerMarket() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'browse' | 'sell' | 'my-listings' | 'history'>('browse');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [filter, setFilter] = useState<'all' | 'PAINTING' | 'ITEM'>('all');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Sell dialog state
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellType, setSellType] = useState<'painting' | 'item'>('painting');
  const [warehousePaintings, setWarehousePaintings] = useState<Painting[]>([]);
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [selectedPainting, setSelectedPainting] = useState<Painting | null>(null);
  const [selectedItem, setSelectedItem] = useState<UserItem | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [listing, setListing] = useState(false);

  useEffect(() => {
    fetchListings();
    if (user) {
      fetchMyListings();
    }
  }, [filter, sort, user]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { sort };
      if (filter !== 'all') params.type = filter;
      const response = await marketApi.getListings(params);
      setListings(response.data.listings);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyListings = async () => {
    try {
      const response = await marketApi.getMyListings();
      setMyListings(response.data.listings);
    } catch (error) {
      console.error('Failed to fetch my listings:', error);
    }
  };

  const fetchSellables = async () => {
    try {
      const [paintingsRes, itemsRes] = await Promise.all([
        galleryApi.getWarehouse(),
        marketplaceApi.getInventory(user!.id),
      ]);
      // Filter out already listed paintings
      setWarehousePaintings(paintingsRes.data.paintings.filter(p => !p.isListed));
      setUserItems(itemsRes.data.items);
    } catch (error) {
      console.error('Failed to fetch sellables:', error);
    }
  };

  const handleBuy = async (listingId: string) => {
    if (buying) return;

    try {
      setBuying(listingId);
      setMessage(null);

      const response = await marketApi.buy(listingId);
      await refreshUser();
      await fetchListings();

      const itemName = response.data.type === 'PAINTING'
        ? response.data.painting?.title
        : response.data.item?.name;

      setMessage({
        type: 'success',
        text: `${itemName} acheté pour $${response.data.pricePaid} (frais: $${response.data.fee})`,
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'achat',
      });
    } finally {
      setBuying(null);
    }
  };

  const handleCancel = async (listingId: string) => {
    if (cancelling) return;

    try {
      setCancelling(listingId);
      setMessage(null);

      await marketApi.cancel(listingId);
      await fetchMyListings();
      await fetchListings();

      setMessage({ type: 'success', text: 'Annonce annulée' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'annulation',
      });
    } finally {
      setCancelling(null);
    }
  };

  const openSellDialog = async () => {
    await fetchSellables();
    setSellDialogOpen(true);
    setSelectedPainting(null);
    setSelectedItem(null);
    setListPrice('');
  };

  const handleListItem = async () => {
    if (listing || !listPrice) return;

    const price = parseInt(listPrice);
    if (isNaN(price) || price < 1) {
      setMessage({ type: 'error', text: 'Prix invalide' });
      return;
    }

    try {
      setListing(true);
      setMessage(null);

      if (sellType === 'painting' && selectedPainting) {
        await marketApi.listPainting({ paintingCopyId: selectedPainting.id, price });
      } else if (sellType === 'item' && selectedItem) {
        await marketApi.listItem({ userItemId: selectedItem.id, price });
      } else {
        return;
      }

      await fetchMyListings();
      await fetchListings();
      setSellDialogOpen(false);

      setMessage({ type: 'success', text: 'Annonce créée' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de la création',
      });
    } finally {
      setListing(false);
    }
  };

  const canAfford = (price: number) => (user?.money || 0) >= price;

  return (
    <>
      <PageLayout>
        {/* Header */}
        <div className="flex items-center justify-end">
          <div className={cn("text-right", TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>
            <div>{user?.aura.toLocaleString()} aura</div>
            <div>${user?.money.toLocaleString()}</div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <Card className={message.type === 'success' ? 'border-emerald-500/50' : 'border-destructive/50'}>
            <CardContent className="p-4">
              <p className={cn(
                TYPOGRAPHY.SMALL,
                message.type === 'success' ? 'text-foreground' : 'text-destructive'
              )}>
                {message.text}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'browse' | 'sell' | 'my-listings' | 'history')}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="browse">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Parcourir
              </TabsTrigger>
              <TabsTrigger value="my-listings">
                <Tag className="w-4 h-4 mr-2" />
                Mes annonces ({myListings.length})
              </TabsTrigger>
            </TabsList>
            <Button
              onClick={openSellDialog}
              variant="outline"
            >
              Vendre
            </Button>
          </div>

          <TabsContent value="browse" className={SPACING.SECTION_SPACING}>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-2">
                {(['all', 'PAINTING', 'ITEM'] as const).map((f) => (
                  <Button
                    key={f}
                    onClick={() => setFilter(f)}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                  >
                    {f === 'all' ? 'Tout' : f === 'PAINTING' ? 'Tableaux' : 'Objets'}
                  </Button>
                ))}
              </div>

              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Plus récent</SelectItem>
                  <SelectItem value="price_asc">Prix croissant</SelectItem>
                  <SelectItem value="price_desc">Prix décroissant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Listings */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
              </div>
            ) : listings.length === 0 ? (
              <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                Aucune annonce disponible
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="border-border/40 overflow-hidden hover:border-foreground/30 transition-colors"
                  >
                    {/* Image */}
                    <div className="aspect-square bg-muted/20 relative">
                      {listing.type === 'PAINTING' && listing.painting ? (
                        <img
                          src={resolveImageUrl(listing.painting.imageUrl)}
                          alt={listing.painting.title}
                          className={cn(
                            "w-full h-full object-cover",
                            rarityFilters[listing.painting.rarity]
                          )}
                        />
                      ) : listing.type === 'ITEM' && listing.item?.imageUrl ? (
                        <img
                          src={resolveImageUrl(listing.item.imageUrl)}
                          alt={listing.item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {listing.type === 'PAINTING' ? (
                            <ImageIcon className="w-12 h-12 text-muted-foreground" />
                          ) : (
                            <Package className="w-12 h-12 text-muted-foreground" />
                          )}
                        </div>
                      )}

                      {/* Rarity badge for paintings */}
                      {listing.painting && (
                        <div className={cn(
                          "absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50",
                          TYPOGRAPHY.XS,
                          rarityColors[listing.painting.rarity]
                        )}>
                          {rarityLabels[listing.painting.rarity]}
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <CardContent className={SPACING.CARD_SPACING}>
                      <div>
                        <h3 className={TYPOGRAPHY.SMALL}>
                          {listing.painting?.title || listing.item?.name}
                        </h3>
                        <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground truncate")}>
                          {listing.painting?.artist || listing.item?.description}
                        </p>
                        {listing.painting && (
                          <p className={TYPOGRAPHY.XS}>
                            Copie {listing.painting.copyNumber}/{listing.painting.maxCopies}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn(TYPOGRAPHY.H5, "tabular-nums")}>${listing.price.toLocaleString()}</p>
                          <p className={TYPOGRAPHY.XS}>
                            par {listing.seller.username}
                          </p>
                        </div>

                        {listing.seller.id !== user?.id && (
                          <Button
                            onClick={() => handleBuy(listing.id)}
                            disabled={!canAfford(listing.price) || buying === listing.id}
                            variant="outline"
                            size="sm"
                          >
                            {buying === listing.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : null}
                            {canAfford(listing.price) ? 'Acheter' : 'Insuffisant'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-listings" className={SPACING.SECTION_SPACING}>
            {myListings.length === 0 ? (
              <p className={cn(TYPOGRAPHY.MUTED, "text-center py-12")}>
                Vous n'avez aucune annonce active
              </p>
            ) : (
              <div className="space-y-0">
                {myListings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="border-border/40 border-b last:border-b"
                  >
                    <CardContent className="py-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-14 h-14 rounded overflow-hidden shrink-0 bg-muted/20">
                            {listing.painting ? (
                              <img
                                src={resolveImageUrl(listing.painting.imageUrl)}
                                alt={listing.painting.title}
                                className={cn(
                                  "w-full h-full object-cover",
                                  rarityFilters[listing.painting.rarity]
                                )}
                              />
                            ) : listing.item?.imageUrl ? (
                              <img
                                src={resolveImageUrl(listing.item.imageUrl)}
                                alt={listing.item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <h3 className={TYPOGRAPHY.SMALL}>
                                {listing.painting?.title || listing.item?.name}
                              </h3>
                              {listing.painting && (
                                <span className={cn(TYPOGRAPHY.XS, rarityColors[listing.painting.rarity])}>
                                  {rarityLabels[listing.painting.rarity]}
                                </span>
                              )}
                            </div>
                            <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>
                              ${listing.price.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleCancel(listing.id)}
                          disabled={cancelling === listing.id}
                          variant="destructive"
                          size="sm"
                          className="ml-4"
                        >
                          {cancelling === listing.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <X className="w-4 h-4 mr-1" />
                          )}
                          Annuler
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageLayout>

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vendre un objet</DialogTitle>
            <DialogDescription>
              Choisissez un objet de votre inventaire à mettre en vente.
              Une commission de 5% sera prélevée lors de la vente.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Type selection */}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setSellType('painting');
                  setSelectedItem(null);
                }}
                variant={sellType === 'painting' ? 'default' : 'outline'}
                size="sm"
              >
                Tableaux ({warehousePaintings.length})
              </Button>
              <Button
                onClick={() => {
                  setSellType('item');
                  setSelectedPainting(null);
                }}
                variant={sellType === 'item' ? 'default' : 'outline'}
                size="sm"
              >
                Objets ({userItems.length})
              </Button>
            </div>

            {/* Item selection */}
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {sellType === 'painting' ? (
                warehousePaintings.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.MUTED, "text-center py-4")}>
                    Aucun tableau disponible
                  </p>
                ) : (
                  warehousePaintings.map((painting) => (
                    <Card
                      key={painting.id}
                      onClick={() => setSelectedPainting(painting)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedPainting?.id === painting.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border/40 hover:border-foreground/30"
                      )}
                    >
                      <CardContent className="p-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                            <img
                              src={resolveImageUrl(painting.imageUrl)}
                              alt={painting.title}
                              className={cn(
                                "w-full h-full object-cover",
                                rarityFilters[painting.rarity]
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={TYPOGRAPHY.SMALL}>{painting.title}</p>
                            <div className="flex items-center gap-2">
                              <span className={cn(TYPOGRAPHY.XS, rarityColors[painting.rarity])}>
                                {rarityLabels[painting.rarity]}
                              </span>
                              <span className={TYPOGRAPHY.XS}>
                                {painting.copyNumber}/{painting.maxCopies}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )
              ) : (
                userItems.length === 0 ? (
                  <p className={cn(TYPOGRAPHY.MUTED, "text-center py-4")}>
                    Aucun objet disponible
                  </p>
                ) : (
                  userItems.map((item) => (
                    <Card
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedItem?.id === item.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border/40 hover:border-foreground/30"
                      )}
                    >
                      <CardContent className="p-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-muted/20 flex items-center justify-center">
                            {item.item.imageUrl ? (
                              <img
                                src={resolveImageUrl(item.item.imageUrl)}
                                alt={item.item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={TYPOGRAPHY.SMALL}>{item.item.name}</p>
                            <p className={TYPOGRAPHY.XS}>x{item.quantity}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )
              )}
            </div>

            {/* Price input */}
            {(selectedPainting || selectedItem) && (
              <div className="space-y-2">
                <label className={TYPOGRAPHY.SMALL}>Prix de vente ($)</label>
                <Input
                  type="number"
                  min="1"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="Entrez le prix"
                  className="bg-transparent"
                />
                {listPrice && parseInt(listPrice) > 0 && (
                  <p className={TYPOGRAPHY.XS}>
                    Vous recevrez ${Math.floor(parseInt(listPrice) * 0.95).toLocaleString()} après frais (5%)
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleListItem}
              disabled={
                listing ||
                (!selectedPainting && !selectedItem) ||
                !listPrice ||
                parseInt(listPrice) < 1
              }
            >
              {listing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Mettre en vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
