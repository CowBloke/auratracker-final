import { type Dispatch, type SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { AlertTriangle, Ban as BanIcon, Loader2, Send, ShieldOff, Trash2 } from 'lucide-react';
import type { AdminUser, AdminWarning, Ban } from '../../../services/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type WarningSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
type WarningType = 'AVERTISSEMENT' | 'AMENDE';

type BansTabProps = {
  bans: Ban[];
  loadingBans: boolean;
  unbanning: string | null;
  unbanUser: (userId: string) => void;
  warnings: AdminWarning[];
  loadingWarnings: boolean;
  warningDialogOpen: boolean;
  setWarningDialogOpen: Dispatch<SetStateAction<boolean>>;
  deletingWarning: string | null;
  deleteWarning: (warningId: string) => void;
  users: AdminUser[];
  warningUserId: string;
  setWarningUserId: Dispatch<SetStateAction<string>>;
  warningType: WarningType;
  setWarningType: Dispatch<SetStateAction<WarningType>>;
  warningSeverity: WarningSeverity;
  setWarningSeverity: Dispatch<SetStateAction<WarningSeverity>>;
  warningMessage: string;
  setWarningMessage: Dispatch<SetStateAction<string>>;
  amendeAmount: number;
  setAmendeAmount: Dispatch<SetStateAction<number>>;
  createWarning: () => void;
  creatingWarning: boolean;
};

export function BansTab(props: BansTabProps) {
  const {
    bans,
    loadingBans,
    unbanning,
    unbanUser,
    warnings,
    loadingWarnings,
    warningDialogOpen,
    setWarningDialogOpen,
    deletingWarning,
    deleteWarning,
    users,
    warningUserId,
    setWarningUserId,
    warningType,
    setWarningType,
    warningSeverity,
    setWarningSeverity,
    warningMessage,
    setWarningMessage,
    amendeAmount,
    setAmendeAmount,
    createWarning,
    creatingWarning,
  } = props;

  return (
    <TabsContent value="bans" className={SPACING.SECTION_SPACING}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Gestion des bannissements</CardDescription>
            <div className={cn('flex items-center gap-2', TYPOGRAPHY.SMALL)}>
              <BanIcon className="h-4 w-4" />
              <span>{bans.filter((b) => b.isActive).length} actifs</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBans ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : bans.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, 'text-center py-12')}>
              Aucun bannissement
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {bans.map((ban) => (
                <div
                  key={ban.id}
                  className={cn('py-4', !ban.isActive && 'opacity-60')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ban.user.username}</span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            ban.isActive
                              ? ban.type === 'PERMANENT'
                                ? 'bg-destructive/20 text-destructive'
                                : 'bg-amber-500/20 text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {ban.isActive
                            ? ban.type === 'PERMANENT'
                              ? 'Permanent'
                              : 'Temporaire'
                            : 'Inactif'}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground">Raison:</span> {ban.reason}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Par <span className="text-foreground">{ban.admin.username}</span> •{' '}
                        {new Date(ban.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {ban.expiresAt && ban.isActive && (
                          <span>
                            {' '}
                            • Expire le{' '}
                            {new Date(ban.expiresAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </p>
                    </div>

                    {ban.isActive && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-green-500/50 text-green-500 hover:bg-green-500/10"
                            disabled={unbanning === ban.userId}
                          >
                            {unbanning === ban.userId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Débannir
                              </>
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Débannir {ban.user.username} ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              L'utilisateur pourra de nouveau se connecter et utiliser la plateforme.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => unbanUser(ban.userId)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Débannir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardDescription>Avertissements admin</CardDescription>
            <div className="flex items-center gap-4">
              <div className={cn('flex items-center gap-2', TYPOGRAPHY.SMALL)}>
                <AlertTriangle className="h-4 w-4" />
                <span>{warnings.filter((w) => !w.isAcknowledged).length} non lus</span>
              </div>
              <Button
                size="sm"
                onClick={() => setWarningDialogOpen(true)}
                className="h-8"
              >
                <Send className="h-4 w-4 mr-1" />
                Envoyer
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingWarnings ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : warnings.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, 'text-center py-12')}>
              Aucun avertissement envoyé
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {warnings.map((warning) => (
                <div
                  key={warning.id}
                  className={cn('py-4', warning.isAcknowledged && 'opacity-60')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{warning.user.username}</span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            warning.severity === 'HIGH'
                              ? 'bg-destructive/20 text-destructive'
                              : warning.severity === 'MEDIUM'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-blue-500/20 text-blue-400'
                          )}
                        >
                          {warning.severity === 'HIGH'
                            ? 'Grave'
                            : warning.severity === 'MEDIUM'
                              ? 'Moyen'
                              : 'Info'}
                        </span>
                        {warning.isAcknowledged ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                            Lu
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            Non lu
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">{warning.message}</p>

                      <p className="text-xs text-muted-foreground">
                        Par <span className="text-foreground">{warning.issuedBy.username}</span> •{' '}
                        {new Date(warning.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {warning.acknowledgedAt && (
                          <span>
                            {' '}
                            • Lu le{' '}
                            {new Date(warning.acknowledgedAt).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </p>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
                          disabled={deletingWarning === warning.id}
                        >
                          {deletingWarning === warning.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet avertissement ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            L'avertissement sera supprimé définitivement.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteWarning(warning.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={warningDialogOpen} onOpenChange={setWarningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer une sanction</DialogTitle>
            <DialogDescription>
              {warningType === 'AMENDE' 
                ? 'L\'utilisateur verra une notification de l\'amende en rouge sur son écran.'
                : 'L\'utilisateur verra un popup d\'avertissement qu\'il devra confirmer avoir lu.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Type de sanction</label>
              <Select value={warningType} onValueChange={(value) => setWarningType(value as WarningType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVERTISSEMENT">Avertissement</SelectItem>
                  <SelectItem value="AMENDE">Amende</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Utilisateur</label>
              {warningUserId ? (
                <div className="px-3 py-2 rounded border border-border/50 bg-muted/30 text-sm font-medium">
                  {users.find((u) => u.id === warningUserId)?.username || 'Utilisateur'}
                </div>
              ) : (
                <Select value={warningUserId} onValueChange={setWarningUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {warningType === 'AVERTISSEMENT' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Sévérité</label>
                <Select
                  value={warningSeverity}
                  onValueChange={(value) => setWarningSeverity(value as WarningSeverity)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Information</SelectItem>
                    <SelectItem value="MEDIUM">Avertissement</SelectItem>
                    <SelectItem value="HIGH">Grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {warningType === 'AMENDE' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Montant de l'amende</label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[amendeAmount]}
                      onValueChange={(value) => setAmendeAmount(value[0])}
                      min={10}
                      max={Math.max(5000, amendeAmount)}
                      step={10}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={amendeAmount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val >= 0) setAmendeAmount(val);
                      }}
                      min={10}
                      className="w-24 text-right tabular-nums bg-red-500/10 border-red-500/50 text-red-400"
                      placeholder="Montant"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Montant minimum: 10 | Entrez un montant personnalisé
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={warningMessage}
                onChange={(event) => setWarningMessage(event.target.value)}
                placeholder={warningType === 'AMENDE' 
                  ? 'Entrez la raison de l\'amende...'
                  : 'Entrez le message de l\'avertissement...'}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={createWarning}
              disabled={creatingWarning || !warningUserId || !warningMessage.trim() || (warningType === 'AMENDE' && (!amendeAmount || amendeAmount <= 0))}
            >
              {creatingWarning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
