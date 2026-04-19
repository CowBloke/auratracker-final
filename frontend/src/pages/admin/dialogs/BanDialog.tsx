import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Ban as BanIcon } from 'lucide-react';

interface BanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  banReason: string;
  setBanReason: (reason: string) => void;
  banType: 'TEMPORARY' | 'PERMANENT';
  setBanType: (type: 'TEMPORARY' | 'PERMANENT') => void;
  banDuration: number;
  setBanDuration: (duration: number) => void;
  creatingBan: boolean;
  onCreateBan: () => void;
}

export function BanDialog({
  isOpen,
  onOpenChange,
  banReason,
  setBanReason,
  banType,
  setBanType,
  banDuration,
  setBanDuration,
  creatingBan,
  onCreateBan,
}: BanDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bannir un utilisateur</DialogTitle>
          <DialogDescription>
            Empêcher un utilisateur d'accéder à la plateforme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Raison</label>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Indiquez la raison du bannissement..."
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type de bannissement</label>
            <Select value={banType} onValueChange={(value: 'TEMPORARY' | 'PERMANENT') => setBanType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEMPORARY">Temporaire</SelectItem>
                <SelectItem value="PERMANENT">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {banType === 'TEMPORARY' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Durée (heures)</label>
              <Input
                type="number"
                value={banDuration}
                onChange={(e) => setBanDuration(parseInt(e.target.value) || 1)}
                min={1}
                placeholder="24"
              />
              <p className="text-xs text-muted-foreground">
                Le bannissement expirera dans {banDuration} heure{banDuration > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creatingBan}
          >
            Annuler
          </Button>
          <Button
            onClick={onCreateBan}
            disabled={creatingBan || !banReason.trim()}
            className="bg-destructive hover:bg-destructive/90"
          >
            {creatingBan ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Bannissement...
              </>
            ) : (
              <>
                <BanIcon className="h-4 w-4 mr-2" />
                Bannir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
