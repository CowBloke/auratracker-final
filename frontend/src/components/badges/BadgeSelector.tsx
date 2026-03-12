import { useState, useEffect } from 'react';
import { badgesApi, UserBadgeEntry } from '@/services/api';
import { BadgeIcon, BadgeData } from './BadgeIcon';
import { UserBadges } from './UserBadges';
import { cn } from '@/lib/utils';
import { Loader2, X, Check } from 'lucide-react';

interface BadgeSelectorProps {
  userId: string;
  className?: string;
}

/**
 * Badge equip UI for the profile page.
 * Shows the user's owned badges and lets them select which two to equip.
 */
export function BadgeSelector({ userId, className }: BadgeSelectorProps) {
  const [badges, setBadges] = useState<UserBadgeEntry[]>([]);
  const [equippedSlot1, setEquippedSlot1] = useState<string | null>(null);
  const [equippedSlot2, setEquippedSlot2] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<1 | 2 | null>(null);
  const [activeSlot, setActiveSlot] = useState<1 | 2 | null>(null);

  useEffect(() => {
    fetchBadges();
  }, [userId]);

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
      setActiveSlot(null);
    } catch (error) {
      console.error('Failed to equip badge:', error);
    } finally {
      setSaving(null);
    }
  };

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
    <div className={cn('space-y-4', className)}>
      {/* Current equipped preview */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Badges équipés :</span>
        <UserBadges badges={[equipped1, equipped2].filter(Boolean) as BadgeData[]} size="md" showEmptySlots />
      </div>

      {/* Slot selectors */}
      <div className="flex items-center gap-2">
        {([1, 2] as const).map((slot) => {
          const equippedId = slot === 1 ? equippedSlot1 : equippedSlot2;
          const equippedBadge = badges.find((b) => b.id === equippedId) ?? null;
          const isActive = activeSlot === slot;

          return (
            <div key={slot} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Slot {slot}</span>
              <button
                type="button"
                onClick={() => setActiveSlot(isActive ? null : slot)}
                className={cn(
                  'w-10 h-10 rounded-md border-2 flex items-center justify-center transition-colors',
                  isActive ? 'border-foreground' : 'border-border hover:border-foreground/50',
                )}
              >
                {saving === slot ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : equippedBadge ? (
                  <BadgeIcon badge={equippedBadge} size="md" />
                ) : (
                  <span className="text-xs text-muted-foreground">+</span>
                )}
              </button>
              {equippedBadge && (
                <button
                  type="button"
                  onClick={() => handleEquip(null, slot)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  title="Déséquiper"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Badge picker panel */}
      {activeSlot !== null && (
        <div className="border border-border rounded-md p-3">
          <p className="text-xs text-muted-foreground mb-3">
            Sélectionne un badge pour le slot {activeSlot} :
          </p>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => {
              const otherEquipped = activeSlot === 1 ? equippedSlot2 : equippedSlot1;
              const isOtherSlot = badge.id === otherEquipped;
              const isCurrentSlot = badge.id === (activeSlot === 1 ? equippedSlot1 : equippedSlot2);

              return (
                <button
                  key={badge.id}
                  type="button"
                  disabled={isOtherSlot}
                  onClick={() => !isOtherSlot && handleEquip(badge.id, activeSlot)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-md border transition-colors',
                    isCurrentSlot
                      ? 'border-foreground bg-foreground/5'
                      : isOtherSlot
                        ? 'opacity-40 cursor-not-allowed border-border'
                        : 'border-border hover:border-foreground/50 hover:bg-muted/50',
                  )}
                  title={badge.name}
                >
                  <BadgeIcon badge={badge} size="md" />
                  <span className="text-[9px] text-muted-foreground max-w-[48px] truncate">
                    {badge.name}
                  </span>
                  {isCurrentSlot && <Check className="w-3 h-3 text-foreground" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
