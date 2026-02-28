import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/services/api';

interface Badge {
  id: string;
  badgeId: string;
  isSelected: boolean;
  assignedAt: string;
  badge: {
    id: string;
    name: string;
    description: string | null;
    color: string;
  };
}

interface BadgeSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function BadgeSelectionModal({ open, onOpenChange, onUpdate }: BadgeSelectionModalProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBadges();
    }
  }, [open]);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/me/badges');
      const userBadges = response.data.badges;
      setBadges(userBadges);

      // Set currently selected badges
      const selected = userBadges
        .filter((b: Badge) => b.isSelected)
        .map((b: Badge) => b.badgeId);
      setSelectedBadgeIds(selected);
    } catch (error) {
      console.error('Failed to fetch badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBadge = (badgeId: string) => {
    setSelectedBadgeIds((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      } else if (prev.length < 2) {
        return [...prev, badgeId];
      }
      return prev;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/me/badges/selected', { badgeIds: selectedBadgeIds });
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update badges:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm text-muted-foreground   font-normal">
            Sélectionner tes badges (max 2)
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : badges.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">
            Aucun badge disponible
          </p>
        ) : (
          <div className="space-y-2 py-4">
            {badges.map((userBadge) => {
              const isSelected = selectedBadgeIds.includes(userBadge.badgeId);
              return (
                <Button
                  key={userBadge.id}
                  type="button"
                  onClick={() => toggleBadge(userBadge.badgeId)}
                  variant="ghost"
                  className={cn(
                    "h-auto w-full justify-between border border-border/40 p-3 hover:border-foreground/30",
                    isSelected && "border-foreground/60 bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="px-2.5 py-1 rounded-full border text-xs  "
                      style={{
                        color: userBadge.badge.color,
                        borderColor: userBadge.badge.color,
                      }}
                    >
                      {userBadge.badge.name}
                    </div>
                    {userBadge.badge.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {userBadge.badge.description}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-foreground shrink-0" />
                  )}
                </Button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground">
            {selectedBadgeIds.length}/2 sélectionnés
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
