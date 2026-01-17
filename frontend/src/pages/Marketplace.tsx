import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, Nft } from '../services/api';
import { Loader2, Package, Palette, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Item {
  id: string;
  name: string;
  description: string;
  type: 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';
  price: number;
  imageUrl?: string;
  effect?: string;
}

interface ItemEffect {
  type: string;
  value?: string;
}

const typeLabels: Record<string, string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
};

const nftRarityLabels: Record<string, string> = {
  COMMON: 'Commun',
  UNCOMMON: 'Inhabituel',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

const parseEffect = (effectStr?: string): ItemEffect | null => {
  if (!effectStr) return null;
  try {
    return JSON.parse(effectStr);
  } catch {
    return null;
  }
};

const getEffectIcon = (effect: ItemEffect | null) => {
  if (!effect) return null;
  switch (effect.type) {
    case 'USERNAME_COLOR':
      return <Palette className="w-4 h-4" />;
    case 'PROFILE_PICTURE':
      return <Camera className="w-4 h-4" />;
    default:
      return null;
  }
};

const getEffectLabel = (effect: ItemEffect | null) => {
  if (!effect) return '';
  switch (effect.type) {
    case 'USERNAME_COLOR':
      return 'Couleur de pseudo';
    case 'PROFILE_PICTURE':
      return 'Photo de profil';
    case 'BONUS_AURA':
      return `+${effect.value || '?'} aura`;
    case 'BONUS_MONEY':
      return `+$${effect.value || '?'}`;
    default:
      return effect.type;
  }
};

export default function Marketplace() {
  const { user, refreshUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNfts, setLoadingNfts] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'items' | 'nfts'>('items');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasingNft, setPurchasingNft] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'items') {
      fetchItems();
    }
  }, [filter, activeTab]);

  useEffect(() => {
    if (activeTab === 'nfts') {
      fetchNfts();
    }
  }, [activeTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { type: filter } : {};
      const response = await marketplaceApi.getItems(params);
      setItems(response.data.items);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNfts = async () => {
    try {
      setLoadingNfts(true);
      const response = await marketplaceApi.getNfts();
      setNfts(response.data.nfts);
    } catch (error) {
      console.error('Failed to fetch NFTs:', error);
    } finally {
      setLoadingNfts(false);
    }
  };

  const handlePurchase = async (item: Item) => {
    if (purchasing) return;
    
    try {
      setPurchasing(item.id);
      setMessage(null);
      
      await marketplaceApi.purchase({ itemId: item.id });
      await refreshUser();
      
      setMessage({ type: 'success', text: `${item.name} acheté` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'achat',
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handlePurchaseNft = async (nft: Nft) => {
    if (purchasingNft) return;

    try {
      setPurchasingNft(nft.id);
      setMessage(null);

      await marketplaceApi.purchaseNft({ nftId: nft.id });
      await refreshUser();

      setMessage({ type: 'success', text: `${nft.name} acheté` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Échec de l\'achat',
      });
    } finally {
      setPurchasingNft(null);
    }
  };

  const canAfford = (item: Item) => {
    return (user?.money || 0) >= item.price;
  };

  const canAffordNft = (nft: Nft) => {
    return (user?.money || 0) >= nft.price;
  };

  const filters = ['all', 'CONSUMABLE', 'COSMETIC', 'UPGRADE'];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Acheter
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'items' | 'nfts')} className="space-y-10">
        <TabsList className="bg-transparent border border-border/30 p-1 w-fit">
          <TabsTrigger value="items">Objets</TabsTrigger>
          <TabsTrigger value="nfts">NFT</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-10">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 text-sm border transition-colors",
                  filter === f
                    ? "border-foreground text-foreground"
                    : "border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                {f === 'all' ? 'Tout' : typeLabels[f]}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Items */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun article disponible
            </p>
          ) : (
            <div className="space-y-0">
              {items.map((item) => {
                const effect = parseEffect(item.effect);
                const effectIcon = getEffectIcon(effect);
                const effectLabel = getEffectLabel(effect);
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Item Image */}
                      {item.imageUrl ? (
                        <img 
                          src={resolveImageUrl(item.imageUrl)} 
                          alt={item.name}
                          className="w-14 h-14 object-cover rounded shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 bg-muted/30 flex items-center justify-center rounded shrink-0">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-4">
                          <h2 className="text-lg font-medium truncate">{item.name}</h2>
                          <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
                            {typeLabels[item.type]}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md truncate">
                          {item.description}
                        </p>
                        {effectLabel && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
                            {effectIcon}
                            <span>{effectLabel}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 ml-4 shrink-0">
                      <div className="text-right text-sm tabular-nums text-muted-foreground">
                        {item.price > 0 && <div>${item.price}</div>}
                      </div>
                      
                      <button
                        onClick={() => handlePurchase(item)}
                        disabled={!canAfford(item) || purchasing === item.id}
                        className={cn(
                          "px-4 py-2 text-sm border transition-colors",
                          canAfford(item)
                            ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                            : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                        )}
                      >
                        {purchasing === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : canAfford(item) ? (
                          'Acheter'
                        ) : (
                          'Insuffisant'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="nfts" className="space-y-10">
          <div className="h-px bg-border" />

          {loadingNfts ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : nfts.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Aucun NFT disponible
            </p>
          ) : (
            <div className="space-y-0">
              {nfts.map((nft) => (
                <div
                  key={nft.id}
                  className="flex items-center justify-between py-6 border-b border-border/30 last:border-0"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {nft.imageUrl ? (
                      <img 
                        src={resolveImageUrl(nft.imageUrl)} 
                        alt={nft.name}
                        className="w-14 h-14 object-cover rounded shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-14 h-14 bg-muted/30 flex items-center justify-center rounded shrink-0">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-4">
                        <h2 className="text-lg font-medium truncate">{nft.name}</h2>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
                          {nftRarityLabels[nft.rarity] || nft.rarity}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-md truncate">
                        {nft.description}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 ml-4 shrink-0">
                    <div className="text-right text-sm tabular-nums text-muted-foreground">
                      {nft.price > 0 && <div>${nft.price}</div>}
                    </div>
                    
                    <button
                      onClick={() => handlePurchaseNft(nft)}
                      disabled={!canAffordNft(nft) || purchasingNft === nft.id}
                      className={cn(
                        "px-4 py-2 text-sm border transition-colors",
                        canAffordNft(nft)
                          ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                          : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                      )}
                    >
                      {purchasingNft === nft.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : canAffordNft(nft) ? (
                        'Acheter'
                      ) : (
                        'Insuffisant'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
