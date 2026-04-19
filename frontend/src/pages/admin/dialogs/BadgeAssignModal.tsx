import { Badge } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Award } from 'lucide-react';

interface BadgeAssignModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  badgeModalUserId: string;
  selectedUserIds: string[];
  users: Array<{ id: string; username: string }>;
  badges: Badge[];
  badgeModalBadgeId: string;
  setBadgeModalBadgeId: (id: string) => void;
  badgeModalReason: string;
  setBadgeModalReason: (reason: string) => void;
  onAward: () => void;
  onClose: () => void;
}

export function BadgeAssignModal({
  isOpen,
  onOpenChange,
  badgeModalUserId,
  selectedUserIds,
  users,
  badges,
  badgeModalBadgeId,
  setBadgeModalBadgeId,
  badgeModalReason,
  setBadgeModalReason,
  onAward,
  onClose,
}: BadgeAssignModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Attribuer un badge</DialogTitle>
          <DialogDescription>
            {badgeModalUserId
              ? `Attribution à ${users.find((u) => u.id === badgeModalUserId)?.username || badgeModalUserId}`
              : `Attribution à ${selectedUserIds.length} utilisateur(s) sélectionné(s)`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Badge</label>
            <Select value={badgeModalBadgeId} onValueChange={setBadgeModalBadgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un badge..." />
              </SelectTrigger>
              <SelectContent>
                {badges.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.icon} {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Raison (optionnel)</label>
            <Input
              placeholder="Raison de l'attribution..."
              value={badgeModalReason}
              onChange={(e) => setBadgeModalReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button onClick={onAward} disabled={!badgeModalBadgeId} className="bg-violet-600 hover:bg-violet-700">
            <Award className="h-4 w-4 mr-2" />
            Attribuer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
