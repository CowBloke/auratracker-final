import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { TabsContent } from '@/components/ui/tabs';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
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
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Award,
  Ban as BanIcon,
  Crown,
  Download,
  Edit2,
  HeartCrack,
  Loader2,
  Package,
  Search,
  Shield,
  ShieldOff,
  TestTube2,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import type { AdminUser } from '../../../services/api';
import { ROLE_LABELS } from '../constants';

type UsersTabProps = {
  userSearchQuery: string;
  setUserSearchQuery: (value: string) => void;
  handleExportUsersCsv: () => void;
  downloadingUsersCsv: boolean;
  filteredUsers: AdminUser[];
  selectedUserIds: string[];
  setSelectedUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  openBadgeModal: (userId: string) => void;
  massMuteUsers: () => void;
  openMassBanDialog: () => void;
  setMassDeleteOpen: (open: boolean) => void;
  loading: boolean;
  allSelected: boolean;
  selectableUsers: AdminUser[];
  user: { id: string } | null;
  startEditing: (user: AdminUser) => void;
  openInventory: (user: AdminUser) => void;
  openSharedMoney: (user: AdminUser) => void;
  getAdminRole: (user: Pick<AdminUser, 'isAdmin' | 'isSuperAdmin' | 'isBetaTester' | 'isFiscalInspector' | 'isJudge'>) => 'USER' | 'BETA_TESTER' | 'ADMIN' | 'SUPER_ADMIN' | 'FISCAL_INSPECTOR' | 'JUDGE';
  toggleChatMute: (user: AdminUser) => void;
  mutingUser: string | null;
  openWarningDialog: (userId: string) => void;
  openBanDialog: (userId: string) => void;
  simulateAltIp: (user: AdminUser) => void;
  deleting: string | null;
  forcingDivorceUserId: string | null;
  forceDivorceUser: (userId: string) => void;
  deleteUser: (userId: string) => void;
};

export function UsersTab(props: UsersTabProps) {
  const {
    userSearchQuery,
    setUserSearchQuery,
    handleExportUsersCsv,
    downloadingUsersCsv,
    filteredUsers,
    selectedUserIds,
    setSelectedUserIds,
    openBadgeModal,
    massMuteUsers,
    openMassBanDialog,
    setMassDeleteOpen,
    loading,
    allSelected,
    selectableUsers,
    user,
    startEditing,
    openInventory,
    openSharedMoney,
    getAdminRole,
    toggleChatMute,
    mutingUser,
    openWarningDialog,
    openBanDialog,
    simulateAltIp,
    deleting,
    forcingDivorceUserId,
    forceDivorceUser,
    deleteUser,
  } = props;

  return (
    <TabsContent value="users" className={SPACING.SECTION_SPACING}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par pseudo ou prénom..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9 bg-transparent border-border/50 h-9"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportUsersCsv}
              disabled={downloadingUsersCsv || filteredUsers.length === 0}
              className="h-9 border-border/50 shrink-0"
            >
              {downloadingUsersCsv ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              Export CSV ({filteredUsers.length})
            </Button>
            {selectedUserIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setSelectedUserIds([])} className="h-9 border-border/50 shrink-0">
                <X className="h-4 w-4 mr-1" />
                Annuler ({selectedUserIds.length})
              </Button>
            )}
          </div>

          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-border/30">
              <span className="text-xs text-muted-foreground">{selectedUserIds.length} sélectionné(s) :</span>
              <Button size="sm" onClick={() => openBadgeModal('')} className="h-7 bg-primary hover:bg-primary text-white text-xs gap-1.5">
                <Award className="h-3.5 w-3.5" />
                Badge
              </Button>
              <Button size="sm" onClick={massMuteUsers} className="h-7 bg-warning hover:bg-warning text-white text-xs gap-1.5">
                <ShieldOff className="h-3.5 w-3.5" />
                Mute
              </Button>
              <Button size="sm" onClick={openMassBanDialog} className="h-7 bg-warning hover:bg-warning text-white text-xs gap-1.5">
                <BanIcon className="h-3.5 w-3.5" />
                Bannir
              </Button>
              <Button size="sm" onClick={() => setMassDeleteOpen(true)} className="h-7 bg-destructive hover:bg-destructive/90 text-white text-xs gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className={cn(TYPOGRAPHY.MUTED, 'text-center py-12')}>
              {userSearchQuery.trim() ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur'}
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              <div className="flex items-center gap-3 py-2">
                <Checkbox
                  checked={allSelected ? true : selectedUserIds.length > 0 ? 'indeterminate' : false}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedUserIds(selectableUsers.map((entry) => entry.id));
                    else setSelectedUserIds([]);
                  }}
                />
                <span className="text-xs text-muted-foreground">Tout sélectionner ({selectableUsers.length})</span>
              </div>

              {filteredUsers.map((u) => (
                <div
                  key={u.id}
                  className={cn('py-3', u.isSuperAdmin ? 'bg-warning/10' : u.isAdmin ? 'bg-muted/20' : undefined)}
                >
                  {(() => {
                    const adminRole = getAdminRole(u);
                    const roleBadgeClassName =
                      adminRole === 'SUPER_ADMIN'
                        ? 'bg-warning/20 text-warning font-medium'
                        : adminRole === 'ADMIN'
                          ? 'bg-warning/15 text-warning'
                          : adminRole === 'BETA_TESTER'
                            ? 'bg-muted/15 text-primary'
                            : adminRole === 'FISCAL_INSPECTOR'
                              ? 'bg-success/15 text-success'
                              : adminRole === 'JUDGE'
                                ? 'bg-muted/15 text-primary'
                                : 'bg-muted text-muted-foreground';

                    return (
                  <div className="flex items-center gap-3">
                    <div className="w-4 shrink-0">
                      {!u.isSuperAdmin && u.id !== user?.id && (
                        <Checkbox
                          checked={selectedUserIds.includes(u.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedUserIds((prev) => [...prev, u.id]);
                            else setSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
                          }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-medium text-sm">{u.username}</span>
                        {u.firstName && <span className="text-xs text-muted-foreground/70">({u.firstName})</span>}
                        <span className="text-muted-foreground/30 text-xs select-none">·</span>
                        <span className="text-xs text-muted-foreground/60 truncate">{u.email}</span>
                        <span className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full shrink-0', roleBadgeClassName)}>
                          {adminRole === 'SUPER_ADMIN' ? <Crown className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                          {ROLE_LABELS[adminRole]}
                        </span>
                        {u.isChatMuted && <span className="text-xs px-1.5 py-0.5 rounded-full bg-warning/20 text-warning shrink-0">muet</span>}
                        {u.schoolLevel && (
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0',
                              u.schoolLevel === 'SECONDE' && 'bg-muted/15 text-primary',
                              u.schoolLevel === 'PREMIERE' && 'bg-muted/15 text-primary',
                              u.schoolLevel === 'TERMINALE' && 'bg-destructive/15 text-destructive',
                            )}
                          >
                            {u.schoolLevel === 'SECONDE' ? '2nde' : u.schoolLevel === 'PREMIERE' ? '1ère' : 'Tle'}
                            {u.classLetter ? ` ${u.classLetter}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground/65">
                        Dernière IP: <span className="font-mono">{u.lastLoginIpAddress || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="hidden xl:flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted/15 text-primary text-xs tabular-nums font-medium">
                        <CurrencyIcon type="aura" className="h-3 w-3" />
                        {u.aura.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/15 text-success text-xs tabular-nums font-medium">
                        <CurrencyIcon type="money" className="h-3 w-3" />
                        {u.money.toLocaleString()}
                      </span>
                      {u.sharedMoney && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/15 text-success text-xs tabular-nums font-medium">
                          <Wallet className="h-3 w-3" />
                          {u.sharedMoney.coupleBalance.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => startEditing(u)} className="h-8 w-8 p-0 border-border/50 text-primary hover:bg-muted/10" title="Modifier">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button size="sm" variant="outline" onClick={() => openInventory(u)} className="h-8 w-8 p-0 border-border/50 text-primary hover:bg-muted/10" title="Inventaire">
                        <Package className="h-3.5 w-3.5" />
                      </Button>

                      <Button size="sm" variant="outline" onClick={() => openSharedMoney(u)} className="h-8 w-8 p-0 border-success/50 text-success hover:bg-success/10" title="Compte commun">
                        <Wallet className="h-3.5 w-3.5" />
                      </Button>

                      <Button size="sm" variant="outline" onClick={() => openBadgeModal(u.id)} className="h-8 w-8 p-0 border-border/50 text-primary hover:bg-muted/10" title="Attribuer badge">
                        <Award className="h-3.5 w-3.5" />
                      </Button>

                      {getAdminRole(u) === 'USER' && u.sharedMoney && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={forcingDivorceUserId === u.id}
                              title="Forcer divorce"
                            >
                              {forcingDivorceUserId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HeartCrack className="h-3.5 w-3.5" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <HeartCrack className="h-5 w-5 text-destructive" />
                                Forcer le divorce de {u.username} et {u.sharedMoney.partner.username} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action dissout immédiatement le mariage, partage le compte commun et annule les demandes de mariage ou divorce en attente sur cette relation.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void forceDivorceUser(u.id)} className="bg-destructive hover:bg-destructive">
                                Forcer le divorce
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {getAdminRole(u) === 'USER' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleChatMute(u)}
                          disabled={mutingUser === u.id}
                          title={u.isChatMuted ? 'Démuter' : 'Muter'}
                          className={cn(
                            'h-8 w-8 p-0',
                            u.isChatMuted
                              ? 'border-warning/50 text-warning bg-warning/10 hover:bg-warning/20'
                              : 'border-warning/50 text-warning hover:bg-warning/10',
                          )}
                        >
                          {mutingUser === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                        </Button>
                      )}

                      {getAdminRole(u) === 'USER' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWarningDialog(u.id)}
                          className="h-8 w-8 p-0 border-warning/50 text-warning hover:bg-warning/10"
                          title="Avertir"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {getAdminRole(u) === 'USER' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => simulateAltIp(u)}
                            className="h-8 w-8 p-0 border-border/50 text-primary hover:bg-muted/10"
                            title="Simuler une IP alt"
                          >
                            <TestTube2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openBanDialog(u.id)}
                            className="h-8 w-8 p-0 border-warning/50 text-warning hover:bg-warning/10"
                            title="Bannir"
                          >
                            <BanIcon className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}

                      {getAdminRole(u) === 'USER' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={deleting === u.id}
                              title="Supprimer"
                            >
                              {deleting === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Supprimer {u.username} ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Toutes les données de l'utilisateur seront définitivement supprimées (messages, transferts, statistiques, inventaire, etc.).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUser(u.id)} className="bg-destructive hover:bg-destructive/90">
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
