import { AdminUser } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save, UserCog, Users, Shield, TrendingUp, Plus, Minus, Eye } from 'lucide-react';
import { ROLE_LABELS, type AdminRole } from '../constants';
import { cn } from '@/lib/utils';
import { toSafeNumber, getAdminRole } from '../adminPageModels';

type EditValues = {
  username: string;
  firstName: string;
  aura: number;
  money: number;
  auraCoinBalance: number;
  dailyAuraLimit: number;
};

interface EditUserModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: string | null;
  editModalUser: AdminUser | null;
  editValues: EditValues;
  setEditValues: (values: EditValues | ((prev: EditValues) => EditValues)) => void;
  editAuraAddAmount: number;
  setEditAuraAddAmount: (amount: number) => void;
  editAuraRemoveAmount: number;
  setEditAuraRemoveAmount: (amount: number) => void;
  baseEditAura: number;
  nextEditAura: number;
  editMoneyAddAmount: number;
  setEditMoneyAddAmount: (amount: number) => void;
  editMoneyRemoveAmount: number;
  setEditMoneyRemoveAmount: (amount: number) => void;
  baseEditMoney: number;
  nextEditMoney: number;
  editPassword: string;
  setEditPassword: (password: string) => void;
  saving: boolean;
  updatingRoleUserId: string | null;
  user: any;
  onCancelEditing: () => void;
  onSaveUser: (id: string) => void;
  onUpdateUserRole: (user: AdminUser, role: AdminRole) => void;
}

export function EditUserModal({
  isOpen,
  onOpenChange,
  editingUser,
  editModalUser,
  editValues,
  setEditValues,
  editAuraAddAmount,
  setEditAuraAddAmount,
  editAuraRemoveAmount,
  setEditAuraRemoveAmount,
  baseEditAura,
  nextEditAura,
  editMoneyAddAmount,
  setEditMoneyAddAmount,
  editMoneyRemoveAmount,
  setEditMoneyRemoveAmount,
  baseEditMoney,
  nextEditMoney,
  editPassword,
  setEditPassword,
  saving,
  updatingRoleUserId,
  user,
  onCancelEditing,
  onSaveUser,
  onUpdateUserRole,
}: EditUserModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) onCancelEditing();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier {editModalUser?.username}</DialogTitle>
          <DialogDescription>{editModalUser?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-400 flex items-center gap-1">
                <UserCog className="h-3 w-3" />
                Pseudo
              </label>
              <div className="relative">
                <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400/60 pointer-events-none" />
                <Input
                  type="text"
                  value={editValues.username}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, username: e.target.value }))}
                  className="h-9 bg-transparent border-blue-500/30 focus-visible:ring-blue-500/30 pl-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-400 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Prénom
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-400/60 pointer-events-none" />
                <Input
                  type="text"
                  value={editValues.firstName}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="h-9 bg-transparent border-blue-500/30 focus-visible:ring-blue-500/30 pl-8"
                  placeholder="Non défini"
                />
              </div>
            </div>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-amber-400 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Rôle
            </label>
            <Select
              value={editModalUser ? getAdminRole(editModalUser) : 'USER'}
              onValueChange={(value) => editModalUser && void onUpdateUserRole(editModalUser, value as any)}
              disabled={updatingRoleUserId === editModalUser?.id || user?.id === editModalUser?.id}
            >
              <SelectTrigger className="h-9 border-amber-500/30 bg-transparent">
                <Shield className="h-3.5 w-3.5 text-amber-400/60 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">{ROLE_LABELS.USER}</SelectItem>
                <SelectItem value="BETA_TESTER">{ROLE_LABELS.BETA_TESTER}</SelectItem>
                <SelectItem value="FISCAL_INSPECTOR">{ROLE_LABELS.FISCAL_INSPECTOR}</SelectItem>
                <SelectItem value="JUDGE">{ROLE_LABELS.JUDGE}</SelectItem>
                <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                <SelectItem value="SUPER_ADMIN">{ROLE_LABELS.SUPER_ADMIN}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Economy */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-purple-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Aura (solde direct)
              </label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-400/60 pointer-events-none" />
                <Input
                  type="number"
                  min={0}
                  value={editValues.aura}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, aura: Number.parseInt(e.target.value, 10) || 0 }))}
                  className="h-9 bg-transparent border-purple-500/30 focus-visible:ring-purple-500/30 pl-8"
                  placeholder="Solde aura"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400/70 pointer-events-none" />
                  <Input
                    type="number"
                    min={0}
                    value={editAuraAddAmount}
                    onChange={(e) => setEditAuraAddAmount(Number.parseInt(e.target.value, 10) || 0)}
                    className="h-9 bg-transparent border-emerald-500/30 focus-visible:ring-emerald-500/30 pl-8"
                    placeholder="Ajouter"
                  />
                </div>
                <div className="relative">
                  <Minus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400/70 pointer-events-none" />
                  <Input
                    type="number"
                    min={0}
                    value={editAuraRemoveAmount}
                    onChange={(e) => setEditAuraRemoveAmount(Number.parseInt(e.target.value, 10) || 0)}
                    className="h-9 bg-transparent border-rose-500/30 focus-visible:ring-rose-500/30 pl-8"
                    placeholder="Enlever"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Actuel: {baseEditAura.toLocaleString()} • Base: {toSafeNumber(editValues.aura).toLocaleString()} • Resultat:{' '}
                <span className={cn(nextEditAura < 0 ? 'text-rose-400' : 'text-purple-300')}>
                  {nextEditAura.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-green-400 flex items-center gap-1">
                <CurrencyIcon type="money" className="h-3 w-3" />
                Argent (solde direct)
              </label>
              <div className="relative">
                <CurrencyIcon type="money" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                <Input
                  type="number"
                  min={0}
                  value={editValues.money}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, money: Number.parseInt(e.target.value, 10) || 0 }))}
                  className="h-9 bg-transparent border-green-500/30 focus-visible:ring-green-500/30 pl-8"
                  placeholder="Solde argent"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-400/70 pointer-events-none" />
                  <Input
                    type="number"
                    min={0}
                    value={editMoneyAddAmount}
                    onChange={(e) => setEditMoneyAddAmount(Number.parseInt(e.target.value, 10) || 0)}
                    className="h-9 bg-transparent border-emerald-500/30 focus-visible:ring-emerald-500/30 pl-8"
                    placeholder="Ajouter"
                  />
                </div>
                <div className="relative">
                  <Minus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400/70 pointer-events-none" />
                  <Input
                    type="number"
                    min={0}
                    value={editMoneyRemoveAmount}
                    onChange={(e) => setEditMoneyRemoveAmount(Number.parseInt(e.target.value, 10) || 0)}
                    className="h-9 bg-transparent border-rose-500/30 focus-visible:ring-rose-500/30 pl-8"
                    placeholder="Enlever"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Actuel: {baseEditMoney.toLocaleString()} • Base: {toSafeNumber(editValues.money).toLocaleString()} • Resultat:{' '}
                <span className={cn(nextEditMoney < 0 ? 'text-rose-400' : 'text-green-300')}>
                  {nextEditMoney.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-yellow-400 flex items-center gap-1">
                <CurrencyIcon type="money" className="h-3 w-3" />
                AuraCoin
              </label>
              <div className="relative">
                <CurrencyIcon type="money" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" />
                <Input
                  type="number"
                  step="0.01"
                  value={editValues.auraCoinBalance}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, auraCoinBalance: parseFloat(e.target.value) || 0 }))}
                  className="h-9 bg-transparent border-yellow-500/30 focus-visible:ring-yellow-500/30 pl-8"
                />
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Eye className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                className="h-9 bg-transparent border-border/40 pl-8"
                placeholder="Laisser vide pour ne pas changer"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancelEditing}>
            Annuler
          </Button>
          <Button onClick={() => editingUser && onSaveUser(editingUser)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
