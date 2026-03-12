import { useState, useEffect, useMemo } from 'react';
import { badgesApi, UserBadgeEntry } from '@/services/api';
import { BadgeIcon, BadgeData } from './BadgeIcon';
import { cn } from '@/lib/utils';
import { Loader2, X, Search, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface BadgeSelectorProps {
  userId: string;
  className?: string;
  /** Pre-loaded badge data from parent (skips internal fetch) */
  initialData?: {
    badges: UserBadgeEntry[];
    equippedBadge1Id: string | null;
    equippedBadge2Id: string | null;
  };
  /** Called after a badge is equipped/unequipped */
  onBadgeEquipped?: (slot: 1 | 2, badgeId: string | null) => void;
}

/**
 * Badge equip UI for the profile badge card.
 * Shows large equipped badge slots; clicking opens a 3-column search picker.
 * Can work standalone (fetches own data) or in controlled mode (via initialData).
 */
export function BadgeSelector({ userId, className, initialData, onBadgeEquipped }: BadgeSelectorProps) {
  const [badges, setBadges] = useState<UserBadgeEntry[]>(initialData?.badges ?? []);
  const [equippedSlot1, setEquippedSlot1] = useState<string | null>(initialData?.equippedBadge1Id ?? null);
  const [equippedSlot2, setEquippedSlot2] = useState<string | null>(initialData?.equippedBadge2Id ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState<1 | 2 | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!initialData) fetchBadges();
  }, [userId]);

  // Sync if parent updates initialData
  useEffect(() => {
    if (initialData) {
      setBadges(initialData.badges);
      setEquippedSlot1(initialData.equippedBadge1Id);
      setEquippedSlot2(initialData.equippedBadge2Id);
    }
  }, [initialData]);

  const fetchBadges = async () => {
    try {
      setLoading(true);
      const res = await badgesApi.getUserBadges(userId);
      setBadges(res.data.badges);
      setEquippedSlot1(res.data.equippedBadge1Id);
      setEquippedSlot2(res.data.equippedBadge2Id);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEquip = async (badgeId: string | null, slot: 1 | 2) => {
    setSaving(slot);
    try {
      await badgesApi.equip(slot, badgeId);
      if (slot === 1) setEquippedSlot1(badgeId);
      else setEquippedSlot2(badgeId);
      onBadgeEquipped?.(slot, badgeId);
      setActiveSlot(null);
      setSearch('');
    } catch (error) {
      console.error('Failed to equip badge:', error);
    } finally {
      setSaving(null);
    }
  };

  const filteredBadges = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return badges;
    return badges.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [badges, search]);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Chargement des badges...</span>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>
        Aucun badge disponible pour l&apos;instant.
      </div>
    );
  }

  const equipped1 = badges.find((b) => b.id === equippedSlot1) ?? null;
  const equipped2 = badges.find((b) => b.id === equippedSlot2) ?? null;

  return (
    <div className={cn('space-y-5', className)}>
      {/* Equipped slot buttons */}
      <div className="flex items-end gap-5">
        {([1, 2] as const).map((slot) => {
          const equippedBadge = slot === 1 ? equipped1 : equipped2;
          const isActive = activeSlot === slot;

          return (
            <div key={slot} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Slot {slot}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveSlot(isActive ? null : slot);
                  setSearch('');
                }}
                className={cn(
                  'relative group w-14 h-14 rounded-md border-2 flex items-center justify-center transition-all',
                  isActive
                    ? 'border-foreground shadow-[0_0_0_3px_hsl(var(--foreground)/0.12)]'
                    : 'border-border hover:border-foreground/60',
                )}
              >
                {saving === slot ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : equippedBadge ? (
                  <>
                    <BadgeIcon badge={equippedBadge} size="xl" />
                    {/* edit overlay */}
                    <div className="absolute inset-0 rounded-md bg-background/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Edit2 className="w-4 h-4" />
                    </div>
                  </>
                ) : (
                  <span className="text-xl text-muted-foreground">+</span>
                )}
              </button>
              {equippedBadge && (
                <button
                  type="button"
                  onClick={() => handleEquip(null, slot)}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                  title="Déséquiper"
                >
                  <X className="w-2.5 h-2.5" />
                  retirer
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 3-column badge picker */}
      {activeSlot !== null && (
        <div className="border border-border rounded-md overflow-hidden">
          {/* Picker header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              Slot {activeSlot} — sélectionne un badge
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setActiveSlot(null); setSearch(''); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm bg-transparent"
                autoFocus
              />
            </div>
          </div>

          {/* 3-column grid — square tiles, no text */}
          <div className="p-2 grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
            {filteredBadges.length === 0 ? (
              <p className="col-span-3 text-center text-xs text-muted-foreground py-4">
                Aucun badge trouvé
              </p>
            ) : (
              filteredBadges.map((badge) => {
                const otherEquipped = activeSlot === 1 ? equippedSlot2 : equippedSlot1;
                const isOtherSlot = badge.id === otherEquipped;
                const isCurrentSlot =
                  badge.id === (activeSlot === 1 ? equippedSlot1 : equippedSlot2);

                return (
                  <button
                    key={badge.id}
                    type="button"
                    disabled={isOtherSlot}
                    onClick={() => !isOtherSlot && handleEquip(badge.id, activeSlot)}
                    className={cn(
                      'aspect-square flex items-center justify-center rounded-md border transition-colors',
                      isCurrentSlot
                        ? 'border-foreground bg-foreground/5'
                        : isOtherSlot
                          ? 'opacity-30 cursor-not-allowed border-transparent'
                          : 'border-transparent hover:border-border hover:bg-muted/40',
                    )}
                  >
                    <BadgeIcon badge={badge} size="lg" tooltipSide="top" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only list of all badges a user has earned, used as history. */
export function BadgeHistory({
  badges,
  className,
}: {
  badges: UserBadgeEntry[];
  className?: string;
}) {
  if (badges.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {badges.map((badge) => (
        <BadgeIcon key={badge.id} badge={badge as BadgeData} size="lg" tooltipSide="bottom" />
      ))}
    </div>
  );
}
