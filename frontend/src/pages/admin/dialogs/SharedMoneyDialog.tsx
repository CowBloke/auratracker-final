import { AdminUser } from '@/services/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wallet } from 'lucide-react';

interface SharedMoneyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sharedMoneyUser: AdminUser | null;
  onClose: () => void;
}

export function SharedMoneyDialog({
  isOpen,
  onOpenChange,
  sharedMoneyUser,
  onClose,
}: SharedMoneyDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compte commun de {sharedMoneyUser?.username || "l'utilisateur"}</DialogTitle>
          <DialogDescription>
            Consultez l'argent personnel et le solde partagé actuel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <p className="text-xs text-muted-foreground">Argent personnel</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-green-400">
                {sharedMoneyUser?.money.toLocaleString('fr-FR') ?? '0'} €
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-emerald-500/10 p-3">
              <p className="text-xs text-muted-foreground">Compte commun</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">
                {sharedMoneyUser?.sharedMoney?.coupleBalance.toLocaleString('fr-FR') ?? '0'} €
              </p>
            </div>
          </div>

          {sharedMoneyUser?.sharedMoney ? (
            <div className="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-medium">Conjoint</p>
                <span className="ml-auto text-sm font-semibold tabular-nums">
                  {sharedMoneyUser.sharedMoney.partner.username}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Argent du conjoint</span>
                <span className="ml-auto font-semibold tabular-nums text-green-400">
                  {sharedMoneyUser.sharedMoney.partner.money.toLocaleString('fr-FR')} €
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Total du foyer</span>
                <span className="ml-auto font-semibold tabular-nums text-amber-400">
                  {(
                    sharedMoneyUser.money +
                    sharedMoneyUser.sharedMoney.partner.money +
                    sharedMoneyUser.sharedMoney.coupleBalance
                  ).toLocaleString('fr-FR')}{' '}
                  €
                </span>
              </div>
              {sharedMoneyUser.sharedMoney.marriedAt && (
                <div className="text-xs text-muted-foreground">
                  Mariage depuis le{' '}
                  {new Date(sharedMoneyUser.sharedMoney.marriedAt).toLocaleDateString('fr-FR')}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/40 bg-muted/5 p-4 text-sm text-muted-foreground">
              Cet utilisateur n'a pas de compte commun actif.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
