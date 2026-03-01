import { useEffect, useMemo, useState } from 'react';
import { marketplaceApi, ShopItem } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { Coins, Loader2, Package } from 'lucide-react';

type ShopFilter = 'ALL' | 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE';

const FILTERS: Array<{ value: ShopFilter; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'COSMETIC', label: 'Cosmetiques' },
  { value: 'CONSUMABLE', label: 'Consommables' },
  { value: 'UPGRADE', label: 'Ameliorations' },
];

const TYPE_LABELS: Record<ShopItem['type'], string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmetique',
  UPGRADE: 'Amelioration',
};

const getEffectLabel = (effect: string | null) => {
  if (!effect) return null;

  try {
    const parsed = JSON.parse(effect) as {
      type?: string;
      bonusAura?: number;
      bonusMoney?: number;
    };

    if (typeof parsed.bonusAura === 'number') {
      return `+${parsed.bonusAura} aura`;
    }

    if (typeof parsed.bonusMoney === 'number') {
      return `+$${parsed.bonusMoney}`;
    }

    if (parsed.type === 'USERNAME_COLOR') {
      return 'Couleur de pseudo';
    }

    if (parsed.type === 'PROFILE_PICTURE') {
      return 'Photo de profil';
    }
  } catch {
    return null;
  }

  return null;
};

export default function Shop() {
  const { user, updateBalance } = useAuth();
  const [filter, setFilter] = useState<ShopFilter>('ALL');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const response = await marketplaceApi.getItems({
          type: filter === 'ALL' ? undefined : filter,
          limit: 100,
        });
        setItems(response.data.items || []);
      } catch (error) {
        console.error('Failed to fetch shop items:', error);
        setMessage({ type: 'error', text: 'Impossible de charger la boutique.' });
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [filter]);

  const availableItems = useMemo(() => (
    items.filter((item) => !item.expiresAt || new Date(item.expiresAt) >= new Date())
  ), [items]);

  const handlePurchase = async (item: ShopItem) => {
    if (!user || buyingItemId) return;

    try {
      setBuyingItemId(item.id);
      setMessage(null);
      const response = await marketplaceApi.purchase({ itemId: item.id, quantity: 1 });
      updateBalance(response.data.newBalance.aura, response.data.newBalance.money);
      setMessage({ type: 'success', text: `${item.name} ajoute a ton inventaire.` });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Achat impossible.',
      });
    } finally {
      setBuyingItemId(null);
    }
  };

  return (
    <PageShell>
      <div className={SPACING.SECTION_SPACING}>
        {message && (
          <Card className={cn(
            'border',
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}>
            <CardContent className="px-4 py-3">{message.text}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className={TYPOGRAPHY.H3}>Boutique</h2>
              <p className={TYPOGRAPHY.PAGE_DESCRIPTION}>
                Achete des objets, cosmetiques et bonus avec ton argent.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-muted-foreground">Solde</span>
              <span className="font-medium tabular-nums">${user?.money ?? 0}</span>
            </div>
          </CardHeader>
          <CardContent className={SPACING.SECTION_SPACING}>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as ShopFilter)}>
              <TabsList className="h-auto flex-wrap">
                {FILTERS.map((entry) => (
                  <TabsTrigger key={entry.value} value={entry.value}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
              </div>
            ) : availableItems.length === 0 ? (
              <p className={cn(TYPOGRAPHY.MUTED, 'py-12 text-center')}>
                Aucun objet disponible pour le moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {availableItems.map((item) => {
                  const effectLabel = getEffectLabel(item.effect);
                  const canAfford = (user?.money ?? 0) >= item.price;

                  return (
                    <Card key={item.id} className="overflow-hidden border-border/40">
                      <CardContent className="p-0">
                        {item.imageUrl ? (
                          <img
                            src={resolveImageUrl(item.imageUrl)}
                            alt={item.name}
                            className="h-44 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-44 w-full items-center justify-center bg-muted/20">
                            <Package className="h-10 w-10 text-muted-foreground" />
                          </div>
                        )}

                        <div className="space-y-4 p-5">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className={TYPOGRAPHY.H5}>{item.name}</h3>
                                <p className="text-xs text-muted-foreground">{TYPE_LABELS[item.type]}</p>
                              </div>
                              <div className="rounded-md border border-border/40 px-2 py-1 text-sm font-medium tabular-nums">
                                ${item.price}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            {effectLabel && (
                              <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                                Effet: {effectLabel}
                              </p>
                            )}
                          </div>

                          <Button
                            onClick={() => handlePurchase(item)}
                            disabled={!canAfford || buyingItemId === item.id}
                            className="w-full"
                          >
                            {buyingItemId === item.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Achat...
                              </>
                            ) : canAfford ? (
                              'Acheter'
                            ) : (
                              'Solde insuffisant'
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
