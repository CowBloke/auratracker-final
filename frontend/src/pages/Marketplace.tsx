import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { marketplaceApi, Nft } from '../services/api';
import { Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';

const nftRarityLabels: Record<string, string> = {
  COMMON: 'Commun',
  UNCOMMON: 'Inhabituel',
  RARE: 'Rare',
  EPIC: 'Épique',
  LEGENDARY: 'Légendaire',
};

export default function Marketplace() {
  const { user, refreshUser } = useAuth();
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingNft, setPurchasingNft] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ownedNftIds, setOwnedNftIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNfts();
    if (user?.id) {
      fetchNftInventory();
    }
  }, [user?.id]);

  const fetchNfts = async () => {
    try {
      setLoading(true);
      const response = await marketplaceApi.getNfts();
      setNfts(response.data.nfts);
    } catch (error) {
      console.error('Failed to fetch NFTs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNftInventory = async () => {
    if (!user?.id) {
      setOwnedNftIds(new Set());
      return;
    }
    try {
      const response = await marketplaceApi.getNftInventory(user.id);
      setOwnedNftIds(new Set(response.data.items.map((item) => item.nft.id)));
    } catch (error) {
      console.error('Failed to fetch NFT inventory:', error);
    }
  };

  const handlePurchaseNft = async (nft: Nft) => {
    if (purchasingNft) return;

    try {
      setPurchasingNft(nft.id);
      setMessage(null);

      await marketplaceApi.purchaseNft({ nftId: nft.id });
      await refreshUser();
      setOwnedNftIds((prev) => new Set(prev).add(nft.id));

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

  const canAffordNft = (nft: Nft) => {
    return (user?.money || 0) >= nft.price;
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Collection
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              NFT
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

      <div className="space-y-6">
        <div className="h-px bg-border" />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
          </div>
        ) : nfts.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            Aucun NFT disponible
          </p>
        ) : (
          <div className="space-y-0">
            {nfts.map((nft) => {
              const isOwned = ownedNftIds.has(nft.id);

              return (
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
                    disabled={isOwned || !canAffordNft(nft) || purchasingNft === nft.id}
                    className={cn(
                      "px-4 py-2 text-sm border transition-colors",
                      isOwned
                        ? "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                        : canAffordNft(nft)
                        ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                        : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
                    )}
                  >
                    {purchasingNft === nft.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isOwned ? (
                      'Déjà acheté'
                    ) : canAffordNft(nft) ? (
                      'Acheter'
                    ) : (
                      'Insuffisant'
                    )}
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
