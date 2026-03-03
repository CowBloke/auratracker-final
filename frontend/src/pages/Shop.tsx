import { useEffect, useMemo, useState, useCallback } from 'react';
import { marketplaceApi, giftsApi, usersApi, ShopItem } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { Coins, Loader2, Package, Gift, Send } from 'lucide-react';

type ShopFilter = 'ALL' | 'CONSUMABLE' | 'COSMETIC' | 'UPGRADE' | 'GIFT';

const FILTERS: Array<{ value: ShopFilter; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'COSMETIC', label: 'Cosmétiques' },
  { value: 'CONSUMABLE', label: 'Consommables' },
  { value: 'UPGRADE', label: 'Améliorations' },
  { value: 'GIFT', label: 'Cadeaux' },
];

const TYPE_LABELS: Record<ShopItem['type'], string> = {
  CONSUMABLE: 'Consommable',
  COSMETIC: 'Cosmétique',
  UPGRADE: 'Amélioration',
  GIFT: 'Cadeau',
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

  // Gift send dialog state
  const [sendDialogItem, setSendDialogItem] = useState<ShopItem | null>(null);
  const [giftUsers, setGiftUsers] = useState<{ id: string; username: string }[]>([]);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [sendingGift, setSendingGift] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

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

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await usersApi.getAll();
      const allUsers = (res.data as { users?: { id: string; username: string }[] }).users || res.data as unknown as { id: string; username: string }[];
      const list = Array.isArray(allUsers) ? allUsers : [];
      setGiftUsers(list.filter((u: { id: string }) => u.id !== user?.id));
    } catch {
      // ignore
    }
    setLoadingUsers(false);
  }, [user?.id]);

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

  const openSendDialog = (item: ShopItem) => {
    setSendDialogItem(item);
    setSelectedReceiver('');
    setGiftMessage('');
    setMessage(null);
    fetchUsers();
  };

  const handleSendGift = async () => {
    if (!sendDialogItem || !selectedReceiver) return;
    setSendingGift(true);
    try {
      const res = await giftsApi.sendShopItem({
        itemId: sendDialogItem.id,
        receiverId: selectedReceiver,
        message: giftMessage.trim() || undefined,
      });
      updateBalance(res.data.newBalance.aura, res.data.newBalance.money);
      setSendDialogItem(null);
      setMessage({ type: 'success', text: `"${sendDialogItem.name}" envoyé !` });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Envoi impossible.',
      });
    } finally {
      setSendingGift(false);
    }
  };

  return (
    <PageShell>
      <div className={SPACING.SECTION_SPACING}>
        {message && (
          <div className={cn(
            'border',
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          )}>
            <div className="px-4 py-3">{message.text}</div>
          </div>
        )}

        <div className={SPACING.SECTION_SPACING}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <Tabs value={filter} onValueChange={(value) => setFilter(value as ShopFilter)}>
              <TabsList className="h-auto flex-wrap">
                {FILTERS.map((entry) => (
                  <TabsTrigger key={entry.value} value={entry.value}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm md:shrink-0">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Solde</span>
              <span className="font-medium tabular-nums">${user?.money ?? 0}</span>
            </div>
          </div>

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
                const isGift = item.type === 'GIFT';
                const effectLabel = isGift ? `${item.price} aura pour le destinataire` : getEffectLabel(item.effect);
                const canAfford = (user?.money ?? 0) >= item.price;

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-0">
                    {item.imageUrl ? (
                      <img
                        src={resolveImageUrl(item.imageUrl)}
                        alt={item.name}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-44 w-full items-center justify-center bg-muted/20">
                        {isGift
                          ? <Gift className="h-10 w-10 text-muted-foreground" />
                          : <Package className="h-10 w-10 text-muted-foreground" />
                        }
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
                          <p className="text-xs tracking-wide text-muted-foreground/80">
                            {isGift ? effectLabel : `Effet: ${effectLabel}`}
                          </p>
                        )}
                      </div>

                      {isGift ? (
                        <Button
                          onClick={() => openSendDialog(item)}
                          disabled={!canAfford}
                          className="w-full"
                          variant={canAfford ? 'default' : 'outline'}
                        >
                          <Gift className="mr-2 h-4 w-4" />
                          {canAfford ? 'Envoyer un cadeau' : 'Solde insuffisant'}
                        </Button>
                      ) : (
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
                      )}
                    </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Send gift dialog */}
      <Dialog open={!!sendDialogItem} onOpenChange={(open) => { if (!open) setSendDialogItem(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-muted-foreground" />
              Envoyer {sendDialogItem?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Prix</span>
              <span className="font-medium tabular-nums">${sendDialogItem?.price}</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Destinataire</label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement...
                </div>
              ) : (
                <Select value={selectedReceiver} onValueChange={setSelectedReceiver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un utilisateur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {giftUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message (optionnel)</label>
              <Textarea
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value.slice(0, 200))}
                placeholder="Ajouter un message..."
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">{giftMessage.length}/200</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogItem(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleSendGift}
              disabled={!selectedReceiver || sendingGift}
            >
              {sendingGift ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
