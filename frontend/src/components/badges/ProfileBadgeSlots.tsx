/**
 * ProfileBadgeSlots
 *
 * Shows two large badge slots in the profile header.
 * For own profile: each slot is a clickable button that opens a slim Popover
 * with a 3-column search picker.
 * For other profiles: pure read-only display.
 */

import { useState, useMemo } from 'react';
import { badgesApi, UserBadgeEntry } from '@/services/api';
import { BadgeIcon, BadgeData } from './BadgeIcon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Edit2, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileBadgeSlotsProps {
  /** All badges earned by this user */
  badges: UserBadgeEntry[];
  equippedBadge1Id: string | null;
  equippedBadge2Id: string | null;
  /** If true, slots are interactive (own profile) */
  editable?: boolean;
  onEquip?: (slot: 1 | 2, badgeId: string | null) => void;
}

export function ProfileBadgeSlots({
  badges,
  equippedBadge1Id,
  equippedBadge2Id,
  editable = false,
  onEquip,
}: ProfileBadgeSlotsProps) {
  const [openSlot, setOpenSlot] = useState<1 | 2 | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<1 | 2 | null>(null);

  const equipped1 = badges.find((b) => b.id === equippedBadge1Id) ?? null;
  const equipped2 = badges.find((b) => b.id === equippedBadge2Id) ?? null;

  const filteredBadges = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return badges;
    return badges.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q),
    );
  }, [badges, search]);

  const handleEquip = async (slot: 1 | 2, badgeId: string | null) => {
    setSaving(slot);
    try {
      await badgesApi.equip(slot, badgeId);
      onEquip?.(slot, badgeId);
      setOpenSlot(null);
      setSearch('');
    } catch (err) {
      console.error('Failed to equip badge:', err);
    } finally {
      setSaving(null);
    }
  };

  const slots = [
    { slot: 1 as const, badge: equipped1, otherId: equippedBadge2Id },
    { slot: 2 as const, badge: equipped2, otherId: equippedBadge1Id },
  ];

  return (
    <div className="flex items-center gap-2">
      {slots.map(({ slot, badge, otherId }) => {
        const inner = (
          <SlotButton
            badge={badge as BadgeData | null}
            saving={saving === slot}
            isActive={openSlot === slot}
            editable={editable}
          />
        );

        if (!editable) return <div key={slot}>{inner}</div>;

        return (
          <Popover
            key={slot}
            open={openSlot === slot}
            onOpenChange={(open) => {
              setOpenSlot(open ? slot : null);
              if (!open) setSearch('');
            }}
          >
            <PopoverTrigger asChild>
              <div>{inner}</div>
            </PopoverTrigger>

            <PopoverContent
              className="w-80 p-0 overflow-hidden"
              align="start"
              side="bottom"
              sideOffset={8}
            >
              {/* Search bar */}
              <div className="p-2 border-b border-border/60 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                  autoFocus
                />
                {badge && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Déséquiper"
                    onClick={() => handleEquip(slot, null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* 3-column badge grid */}
              <div className="p-2 max-h-60 overflow-y-auto grid grid-cols-3 gap-1.5">
                {filteredBadges.length === 0 ? (
                  <p className="col-span-3 text-center text-xs text-muted-foreground py-4">
                    Aucun badge trouvé
                  </p>
                ) : (
                  filteredBadges.map((b) => {
                    const isOther = b.id === otherId;
                    const isCurrent = b.id === (slot === 1 ? equippedBadge1Id : equippedBadge2Id);

                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={isOther}
                        onClick={() => !isOther && handleEquip(slot, b.id)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-md border text-center transition-colors',
                          isCurrent
                            ? 'border-foreground bg-foreground/5'
                            : isOther
                              ? 'opacity-30 cursor-not-allowed border-transparent'
                              : 'border-transparent hover:border-border hover:bg-muted/50',
                        )}
                      >
                        <BadgeIcon badge={b as BadgeData} size="md" tooltipSide="top" />
                        <span className="text-[10px] text-muted-foreground leading-tight max-w-[60px] truncate">
                          {b.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

// ─── Internal slot button ─────────────────────────────────────────────────────

function SlotButton({
  badge,
  saving,
  isActive,
  editable,
}: {
  badge: BadgeData | null;
  saving: boolean;
  isActive: boolean;
  editable: boolean;
}) {
  return (
    <div
      className={cn(
        'relative group w-16 h-16 rounded-md border-2 flex items-center justify-center transition-all select-none',
        editable
          ? isActive
            ? 'border-foreground shadow-[0_0_0_3px_hsl(var(--foreground)/0.1)] cursor-pointer'
            : 'border-border/50 hover:border-foreground/60 cursor-pointer'
          : 'border-transparent',
      )}
    >
      {saving ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : badge ? (
        <>
          <BadgeIcon badge={badge} size="2xl" tooltipSide="bottom" />
          {editable && (
            <div className="absolute inset-0 rounded-[calc(theme(borderRadius.md)-2px)] bg-background/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
              <Edit2 className="w-4 h-4" />
            </div>
          )}
        </>
      ) : editable ? (
        <span className="text-2xl text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">+</span>
      ) : null}
    </div>
  );
}
