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
import { resolveImageUrl } from '@/lib/images';

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
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Échanges
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Marché
            </h1>
          </div>
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            <div>{user?.aura.toLocaleString()} aura</div>
            <div>${user?.money.toLocaleString()}</div>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <p className={cn(
          "text-sm",
          message.type === 'success' ? 'text-foreground' : 'text-destructive'
        )}>
          {message.text}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('browse')}
          className={cn(
            "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
            activeTab === 'browse'
              ? "border-foreground text-foreground"
              : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
          )}
        >
          <ShoppingCart className="w-4 h-4" />
          Parcourir
        </button>
        <button
          onClick={() => setActiveTab('my-listings')}
          className={cn(
            "px-4 py-2 text-sm border transition-colors flex items-center gap-2",
            activeTab === 'my-listings'
              ? "border-foreground text-foreground"
              : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
          )}
        >
          <Tag className="w-4 h-4" />
          Mes annonces ({myListings.length})
        </button>
        <button
          onClick={openSellDialog}
          className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors flex items-center gap-2 ml-auto"
        >
          Vendre
        </button>
      </div>

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex gap-2">
              {(['all', 'PAINTING', 'ITEM'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1 text-sm border transition-colors",
                    filter === f
                      ? "border-foreground text-foreground"
                      : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {f === 'all' ? 'Tout' : f === 'PAINTING' ? 'Tableaux' : 'Objets'}
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="px-3 py-1 text-sm border border-border/30 bg-transparent text-foreground"
            >
              <option value="newest">Plus récent</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>

          <div className="h-px bg-border" />

          {/* Listings */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : listings.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucune annonce disponible
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="border border-border/30 rounded-lg overflow-hidden hover:border-foreground/30 transition-colors"
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
                        "absolute top-2 right-2 px-2 py-0.5 text-xs rounded-full bg-black/50",
                        rarityColors[listing.painting.rarity]
                      )}>
                        {rarityLabels[listing.painting.rarity]}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-medium truncate">
                        {listing.painting?.title || listing.item?.name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {listing.painting?.artist || listing.item?.description}
                      </p>
                      {listing.painting && (
                        <p className="text-xs text-muted-foreground">
                          Copie {listing.painting.copyNumber}/{listing.painting.maxCopies}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-medium">${listing.price.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          par {listing.seller.username}
                        </p>
                      </div>

                      {listing.seller.id !== user?.id && (
                        <button
                          onClick={() => handleBuy(listing.id)}
                          disabled={!canAfford(listing.price) || buying === listing.id}
                          className={cn(
                            "px-4 py-2 text-sm border transition-colors",
                            canAfford(listing.price)
                              ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                              : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                          )}
                        >
                          {buying === listing.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : canAfford(listing.price) ? (
                            'Acheter'
                          ) : (
                            'Insuffisant'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Listings Tab */}
      {activeTab === 'my-listings' && (
        <div className="space-y-6">
          <div className="h-px bg-border" />

          {myListings.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Vous n'avez aucune annonce active
            </p>
          ) : (
            <div className="space-y-0">
              {myListings.map((listing) => (
                <div
                  key={listing.id}
                  className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
                >
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
                        <h3 className="font-medium truncate">
                          {listing.painting?.title || listing.item?.name}
                        </h3>
                        {listing.painting && (
                          <span className={cn("text-xs", rarityColors[listing.painting.rarity])}>
                            {rarityLabels[listing.painting.rarity]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ${listing.price.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCancel(listing.id)}
                    disabled={cancelling === listing.id}
                    className="px-3 py-2 text-sm border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center gap-1 ml-4"
                  >
                    {cancelling === listing.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <X className="w-4 h-4" />
                        Annuler
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
              <button
                onClick={() => {
                  setSellType('painting');
                  setSelectedItem(null);
                }}
                className={cn(
                  "px-4 py-2 text-sm border transition-colors",
                  sellType === 'painting'
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground hover:text-foreground"
                )}
              >
                Tableaux ({warehousePaintings.length})
              </button>
              <button
                onClick={() => {
                  setSellType('item');
                  setSelectedPainting(null);
                }}
                className={cn(
                  "px-4 py-2 text-sm border transition-colors",
                  sellType === 'item'
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground hover:text-foreground"
                )}
              >
                Objets ({userItems.length})
              </button>
            </div>

            {/* Item selection */}
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {sellType === 'painting' ? (
                warehousePaintings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Aucun tableau disponible
                  </p>
                ) : (
                  warehousePaintings.map((painting) => (
                    <button
                      key={painting.id}
                      onClick={() => setSelectedPainting(painting)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 border rounded transition-colors text-left",
                        selectedPainting?.id === painting.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border/30 hover:border-foreground/30"
                      )}
                    >
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
                        <p className="font-medium truncate">{painting.title}</p>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", rarityColors[painting.rarity])}>
                            {rarityLabels[painting.rarity]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {painting.copyNumber}/{painting.maxCopies}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))
                )
              ) : (
                userItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Aucun objet disponible
                  </p>
                ) : (
                  userItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 border rounded transition-colors text-left",
                        selectedItem?.id === item.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border/30 hover:border-foreground/30"
                      )}
                    >
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
                        <p className="font-medium truncate">{item.item.name}</p>
                        <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                      </div>
                    </button>
                  ))
                )
              )}
            </div>

            {/* Price input */}
            {(selectedPainting || selectedItem) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Prix de vente ($)</label>
                <Input
                  type="number"
                  min="1"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value)}
                  placeholder="Entrez le prix"
                  className="bg-transparent"
                />
                {listPrice && parseInt(listPrice) > 0 && (
                  <p className="text-xs text-muted-foreground">
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
    </div>
  );
}
