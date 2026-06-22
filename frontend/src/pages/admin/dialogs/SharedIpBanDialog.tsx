import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Ban as BanIcon, Check, Loader2, ShieldAlert } from 'lucide-react';
import type { SharedIpUser } from '../../../services/api';

interface SharedIpBanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ip: string | null;
  isTrustedIp: boolean;
  bannedUsername: string;
  banType: 'TEMPORARY' | 'PERMANENT';
  banDuration: number;
  users: SharedIpUser[];
  loading: boolean;
  banningId: string | null;
  bannedIds: string[];
  onBanUser: (userId: string) => void;
  onBanAll: () => void;
}

export function SharedIpBanDialog({
  isOpen,
  onOpenChange,
  ip,
  isTrustedIp,
  bannedUsername,
  banType,
  banDuration,
  users,
  loading,
  banningId,
  bannedIds,
  onBanUser,
  onBanAll,
}: SharedIpBanDialogProps) {
  const banLabel =
    banType === 'PERMANENT'
      ? 'permanent'
      : `temporaire (${banDuration}h)`;

  // Users that can still be banned (not admin, no active ban, not already banned here)
  const bannableUsers = users.filter(
    (u) => !u.isAdmin && !u.activeBan && !bannedIds.includes(u.id)
  );
  const allBanning = banningId === '__all__';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            Comptes liés à la même IP
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{bannedUsername}</span> a été banni{' '}
            <span className="font-medium text-foreground">{banLabel}</span>. Ces comptes se sont
            connectés depuis la même adresse IP
            {ip && <span className="font-mono text-foreground"> ({ip})</span>}. Le ban rapide
            applique exactement les mêmes paramètres.
            {isTrustedIp && (
              <span className="mt-2 block text-amber-500">
                Cette IP est marquee comme IP STDO/lycee fiable : les comptes lies ne sont pas proposes au ban rapide.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              {isTrustedIp ? 'IP STDO/lycee ignoree pour le ban rapide.' : 'Aucun autre compte connu sur cette adresse IP.'}
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto divide-y divide-border/30 rounded border border-border/40">
              {users.map((u) => {
                const alreadyBanned = u.activeBan != null || bannedIds.includes(u.id);
                const isBanning = banningId === u.id || allBanning;
                return (
                  <div
                    key={u.id}
                    className={cn(
                      'flex items-center justify-between gap-3 px-3 py-2.5',
                      alreadyBanned && 'opacity-60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{u.username}</span>
                        {u.isAdmin && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            Admin
                          </span>
                        )}
                        {u.activeBan && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
                            Déjà banni
                          </span>
                        )}
                        {!u.activeBan && bannedIds.includes(u.id) && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                            Banni
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>

                    {u.isAdmin ? (
                      <span className="text-xs text-muted-foreground shrink-0">Protégé</span>
                    ) : alreadyBanned ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                        disabled={isBanning}
                        onClick={() => onBanUser(u.id)}
                      >
                        {isBanning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <BanIcon className="h-4 w-4 mr-1" />
                            Bannir
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={allBanning}>
            Fermer
          </Button>
          {bannableUsers.length > 0 && (
            <Button
              className="bg-destructive hover:bg-destructive/90"
              disabled={banningId !== null}
              onClick={onBanAll}
            >
              {allBanning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bannissement...
                </>
              ) : (
                <>
                  <BanIcon className="h-4 w-4 mr-2" />
                  Tout bannir ({bannableUsers.length})
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
