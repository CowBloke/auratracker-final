import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { marketplaceApi, giftsApi, usersApi, ShopItem, ShopCategory } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PageShell } from '@/components/layout/page-shell';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { Coins, Loader2, Package, Gift, Send } from 'lucide-react';

const DEFAULT_CATEGORIES: ShopCategory[] = [
  { id: 'COSMETIC', label: 'Cosmétiques' },
  { id: 'CONSUMABLE', label: 'Consommables' },
  { id: 'UPGRADE', label: 'Améliorations' },
  { id: 'GIFT', label: 'Cadeaux' },
];

const parseEffectType = (effect: string | null): string | null => {
  if (!effect) return null;
  try {
    const p = JSON.parse(effect);
    if (typeof p.bonusAura === 'number') return 'BONUS_AURA';
    if (typeof p.bonusMoney === 'number') return 'BONUS_MONEY';
    return p.type ?? null;
  } catch {
    return null;
  }
};

const getEffectLabel = (effect: string | null) => {
  if (!effect) return null;
  try {
    const parsed = JSON.parse(effect) as {
      type?: string;
      bonusAura?: number;
      bonusMoney?: number;
    };
    if (typeof parsed.bonusAura === 'number') return `+${parsed.bonusAura} aura`;
    if (typeof parsed.bonusMoney === 'number') return `+$${parsed.bonusMoney}`;
    if (parsed.type === 'USERNAME_COLOR') return 'Couleur de pseudo';
    if (parsed.type === 'PROFILE_PICTURE') return 'Photo de profil';
    if (parsed.type === 'DOODLE_JUMP_SKIN') return 'Skin Doodle Jump';
    if (parsed.type === 'GIFT') return 'Cadeau à envoyer';
  } catch {
    return null;
  }
  return null;
};

// Exact dark-theme platform colors from DoodleJump.tsx
const DJ_COLORS = {
  background: '#0a0a0a',
  platformNormal: '#e5e7eb',
  platformMoving: '#9ca3af',
  platformBounce: '#7c3aed',
  platformDisappear: '#8b5cf6',
};

const PW = 80; // platform width
const PH = 15; // platform height

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const r = 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + PW - r, y);
  ctx.arcTo(x + PW, y, x + PW, y + PH, r);
  ctx.lineTo(x + PW, y + PH);
  ctx.arcTo(x + PW, y + PH, x, y + PH, r);
  ctx.lineTo(x + r, y + PH);
  ctx.arcTo(x, y + PH, x, y, r);
  ctx.arcTo(x, y, x + PW, y, r);
  ctx.closePath();
  ctx.fill();
}

function DoodleJumpSkinPreview({ skinImageUrl }: { skinImageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // logical canvas dimensions
  const CW = 400;
  const CH = 220;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Enable crisp rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const draw = (skinImg: HTMLImageElement | null) => {
      // Background
      ctx.fillStyle = DJ_COLORS.background;
      ctx.fillRect(0, 0, CW, CH);

      // Platform layout — staggered, spread across width, rising left-to-right
      const platY1 = CH - 28;
      const platY2 = CH - 90;
      const platY3 = CH - 152;

      const p1x = 40;
      const p2x = CW / 2 - PW / 2; // center
      const p3x = CW - 40 - PW;

      // Subtle vertical grid lines as background texture
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CW; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
      }

      // Bottom-left platform (normal)
      drawPlatform(ctx, p1x, platY1, DJ_COLORS.platformNormal);
      // Center platform (bounce — purple) — character stands here
      drawPlatform(ctx, p2x, platY2, DJ_COLORS.platformBounce);
      // Top-right platform (moving — gray)
      drawPlatform(ctx, p3x, platY3, DJ_COLORS.platformMoving);

      // Jump arc — dashed line from center platform to top-right
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const arcStartX = p2x + PW / 2;
      const arcStartY = platY2;
      const arcEndX = p3x + PW / 2;
      const arcEndY = platY3;
      const cpX = (arcStartX + arcEndX) / 2;
      const cpY = Math.min(arcStartY, arcEndY) - 50;
      ctx.moveTo(arcStartX, arcStartY);
      ctx.quadraticCurveTo(cpX, cpY, arcEndX, arcEndY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Character on center platform
      const charSize = 70;
      const charX = p2x + PW / 2 - charSize / 2;
      const charY = platY2 - charSize;

      if (skinImg && skinImg.complete && skinImg.naturalWidth > 0) {
        ctx.drawImage(skinImg, charX, charY, charSize, charSize);
      } else {
        // Fallback silhouette
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.arc(p2x + PW / 2, platY2 - charSize / 2, charSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score indicator (decorative)
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'right';
      ctx.fillText('Doodle Jump', CW - 12, 18);
      ctx.textAlign = 'left';
    };

    // Draw background immediately, then draw with image once loaded
    draw(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => draw(img);
    img.onerror = () => { /* keep background-only render */ };
    img.src = resolveImageUrl(skinImageUrl);
  }, [skinImageUrl]); // CW/CH are constants, no need in deps

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      className="w-full"
      style={{ display: 'block', height: '220px' }}
    />
  );
}

function ShopCard({
  item,
  user,
  buyingItemId,
  onPurchase,
  onSend,
}: {
  item: ShopItem;
  user: ReturnType<typeof useAuth>['user'];
  buyingItemId: string | null;
  onPurchase: (item: ShopItem) => void;
  onSend: (item: ShopItem) => void;
}) {
  const isGift = item.type === 'GIFT' || parseEffectType(item.effect) === 'GIFT';
  const effectLabel = isGift ? null : getEffectLabel(item.effect);
  const canAfford = (user?.money ?? 0) >= item.price;

  let skinImageUrl: string | null = null;
  try {
    if (item.effect) {
      const parsed = JSON.parse(item.effect);
      if (parsed.type === 'DOODLE_JUMP_SKIN' && parsed.skinImageUrl) {
        skinImageUrl = parsed.skinImageUrl as string;
      }
    }
  } catch { /* empty */ }

  const renderImage = () => {
    if (skinImageUrl) {
      return <DoodleJumpSkinPreview skinImageUrl={skinImageUrl} />;
    }
    if (item.imageUrl) {
      return <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="h-44 w-full object-cover" />;
    }
    return (
      <div className="flex h-44 w-full items-center justify-center bg-muted/20">
        {isGift ? <Gift className="h-10 w-10 text-muted-foreground" /> : <Package className="h-10 w-10 text-muted-foreground" />}
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {renderImage()}
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className={TYPOGRAPHY.H5}>{item.name}</h3>
                <p className="text-xs text-muted-foreground">{humanizeUiLabel(item.type)}</p>
              </div>
              <div className="rounded-md border border-border/40 px-2 py-1 text-sm font-medium tabular-nums">
                ${item.price}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            {effectLabel && (
              <p className="text-xs text-muted-foreground/80">
                {isGift ? effectLabel : `Effet: ${effectLabel}`}
              </p>
            )}
          </div>
          {isGift ? (
            <Button onClick={() => onSend(item)} disabled={!canAfford} className="w-full" variant={canAfford ? 'default' : 'outline'}>
              <Gift className="mr-2 h-4 w-4" />
              {canAfford ? 'Envoyer un cadeau' : 'Solde insuffisant'}
            </Button>
          ) : (
            <Button onClick={() => onPurchase(item)} disabled={!canAfford || buyingItemId === item.id} className="w-full">
              {buyingItemId === item.id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Achat...</>
              ) : canAfford ? 'Acheter' : 'Solde insuffisant'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Shop() {
  const { user, updateBalance } = useAuth();
  const [filter, setFilter] = useState<string>('ALL');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>(DEFAULT_CATEGORIES);
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
    const fetchData = async () => {
      try {
        setLoading(true);
        const [itemsRes, categoriesRes] = await Promise.all([
          marketplaceApi.getItems({ limit: 100 }),
          marketplaceApi.getCategories(),
        ]);
        setItems(itemsRes.data.items || []);
        if (categoriesRes.data.categories?.length) {
          setCategories(categoriesRes.data.categories);
        }
      } catch (error) {
        console.error('Failed to fetch shop items:', error);
        setMessage({ type: 'error', text: 'Impossible de charger la boutique.' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filters = useMemo(() => [
    { value: 'ALL', label: 'Tous' },
    ...categories.map((c) => ({ value: c.id, label: c.label })),
  ], [categories]);

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

  const filteredItems = useMemo(() => (
    filter === 'ALL' ? availableItems : availableItems.filter((item) => item.type === filter)
  ), [availableItems, filter]);

  const sections = useMemo(() => (
    categories
      .map((cat) => ({
        id: cat.id,
        label: cat.label,
        items: availableItems.filter((item) => item.type === cat.id),
      }))
      .filter((s) => s.items.length > 0)
  ), [availableItems, categories]);

  const handlePurchase = async (item: ShopItem) => {
    if (!user || buyingItemId) return;

    try {
      setBuyingItemId(item.id);
      setMessage(null);
      const response = await marketplaceApi.purchase({ itemId: item.id, quantity: 1 });
      updateBalance(response.data.newBalance.aura, response.data.newBalance.money);

      // Check if it's a doodle jump skin
      let isDoodleSkin = false;
      try {
        if (item.effect) {
          const parsed = JSON.parse(item.effect);
          if (parsed.type === 'DOODLE_JUMP_SKIN') isDoodleSkin = true;
        }
      } catch { /* empty */ }

      setMessage({
        type: 'success',
        text: isDoodleSkin
          ? `Skin "${item.name}" débloqué ! Disponible dans Doodle Jump.`
          : `${item.name} ajouté à ton inventaire.`,
      });
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
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="h-auto flex-wrap">
                {filters.map((entry) => (
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
          ) : filteredItems.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, 'py-12 text-center')}>
              Aucun objet disponible pour le moment.
            </p>
          ) : filter === 'ALL' ? (
            <div className="space-y-8">
              {sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  <p className="text-xs font-medium text-muted-foreground/60">{section.label}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {section.items.map((item) => <ShopCard key={item.id} item={item} user={user} buyingItemId={buyingItemId} onPurchase={handlePurchase} onSend={openSendDialog} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => <ShopCard key={item.id} item={item} user={user} buyingItemId={buyingItemId} onPurchase={handlePurchase} onSend={openSendDialog} />)}
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
