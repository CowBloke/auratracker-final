import { ShopCategory, Badge } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Save } from 'lucide-react';
import { ImagePicker } from '@/components/ui/image-picker';
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { EFFECT_TYPES, EFFECT_TYPES_WITHOUT_VALUE, generateBadgeSvgDataUrl } from '../adminPageModels';
import { cn } from '@/lib/utils';

interface ItemForm {
  name: string;
  type: string;
  price: number;
  description: string;
  imageUrl: string;
  effectType: string;
  effectValue: string;
  bonusAura?: number;
  bonusMoney?: number;
  skinImageUrl?: string;
  skinShopType?: 'none' | 'static' | 'rotating';
  badgeId?: string;
  durationMinutes?: number;
}

interface ItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: any;
  itemForm: ItemForm;
  setItemForm: (form: ItemForm | ((prev: ItemForm) => ItemForm)) => void;
  shopCategories: ShopCategory[];
  badges: Badge[];
  savingItem: boolean;
  onSaveItem: () => void;
  uploadItemImageFile: (file: File) => Promise<string>;
}

export function ItemDialog({
  isOpen,
  onOpenChange,
  editingItem,
  itemForm,
  setItemForm,
  shopCategories,
  badges,
  savingItem,
  onSaveItem,
  uploadItemImageFile,
}: ItemDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "Modifier l'objet" : 'Créer un objet'}
          </DialogTitle>
          <DialogDescription>
            {editingItem
              ? 'Modifiez les propriétés de l\'objet.'
              : 'Créez un nouvel objet pour la boutique.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Row 1: Name + Category + Price */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom</label>
              <Input
                value={itemForm.name}
                onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nom de l'objet"
                className="bg-transparent"
              />
            </div>
            <div className="col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
              <Select
                value={itemForm.type}
                onValueChange={(value) => setItemForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shopCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Prix ($)</label>
              <Input
                type="number"
                value={itemForm.price}
                onChange={(e) => setItemForm((prev) => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                className="bg-transparent"
                min={0}
              />
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={itemForm.description}
              onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description de l'objet"
              className="bg-transparent resize-none"
              rows={2}
            />
          </div>

          {/* Row 3: Image + Effect */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Image boutique (optionnel)</label>
              <ImagePicker
                value={itemForm.imageUrl}
                onChange={(url) => setItemForm((prev) => ({ ...prev, imageUrl: url }))}
                uploadFn={uploadItemImageFile}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type d'effet</label>
                <Select
                  value={itemForm.effectType}
                  onValueChange={(value) => {
                    setItemForm((prev) => ({
                      ...prev,
                      effectType: value,
                      effectValue: '',
                      bonusAura: 0,
                      bonusMoney: 0,
                      skinImageUrl: '',
                      skinShopType: 'none',
                      badgeId: '',
                      durationMinutes: 60,
                    }));
                  }}
                >
                  <SelectTrigger className="bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EFFECT_TYPES.map((effect) => (
                      <SelectItem key={effect.value} value={effect.value}>
                        {effect.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {EFFECT_TYPES.find((e) => e.value === itemForm.effectType)?.description}
                </p>
              </div>

              {itemForm.effectType === 'BONUS_AURA' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Valeur Bonus Aura</label>
                  <Input
                    type="number"
                    value={itemForm.bonusAura || 0}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, bonusAura: parseInt(e.target.value) || 0 }))}
                    className="bg-transparent"
                    min="0"
                  />
                </div>
              )}

              {itemForm.effectType === 'BONUS_MONEY' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Valeur Bonus Argent</label>
                  <Input
                    type="number"
                    value={itemForm.bonusMoney || 0}
                    onChange={(e) => setItemForm((prev) => ({ ...prev, bonusMoney: parseInt(e.target.value) || 0 }))}
                    className="bg-transparent"
                    min="0"
                  />
                </div>
              )}

              {itemForm.effectType === 'DOODLE_JUMP_SKIN' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Image du skin</label>
                    <ImagePicker
                      value={itemForm.skinImageUrl || ''}
                      onChange={(url) => setItemForm((prev) => ({ ...prev, skinImageUrl: url }))}
                      uploadFn={uploadItemImageFile}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cette image sera utilisée comme sprite du personnage dans Doodle Jump.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Placement dans la boutique DJ</label>
                    <Select
                      value={itemForm.skinShopType || 'none'}
                      onValueChange={(value) =>
                        setItemForm((prev) => ({ ...prev, skinShopType: value as 'none' | 'static' | 'rotating' }))
                      }
                    >
                      <SelectTrigger className="bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non placé (invisible en boutique)</SelectItem>
                        <SelectItem value="static">⭐ Boutique permanente</SelectItem>
                        <SelectItem value="rotating">🔥 Pool de rotation quotidienne</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choisir si ce skin apparaît en permanence ou dans la rotation du jour.
                    </p>
                  </div>
                </div>
              )}

              {itemForm.effectType === 'AWARD_BADGE' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Badge à attribuer</label>
                  <div className="max-h-48 overflow-y-auto rounded border border-border/40 bg-muted/10 p-2">
                    {badges.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2">Aucun badge disponible.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1">
                        {badges
                          .filter((b) => b.isActive)
                          .map((badge) => (
                            <button
                              key={badge.id}
                              type="button"
                              onClick={() => {
                                const svg = generateBadgeSvgDataUrl(badge);
                                setItemForm((prev) => ({
                                  ...prev,
                                  badgeId: badge.id,
                                  imageUrl: prev.imageUrl || svg,
                                }));
                              }}
                              className={cn(
                                'flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/40',
                                itemForm.badgeId === badge.id ? 'bg-muted/60 ring-1 ring-border' : '',
                              )}
                            >
                              <BadgeIcon badge={badge} size="xs" />
                              <span className="truncate font-medium">{badge.name}</span>
                              <span className="ml-auto shrink-0 text-muted-foreground">{badge.rarity}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {itemForm.badgeId && (
                    <p className="text-xs text-muted-foreground">
                      Sélectionné : {badges.find((b) => b.id === itemForm.badgeId)?.name ?? itemForm.badgeId}
                    </p>
                  )}
                </div>
              )}

              {(itemForm.effectType === 'YOU_ADBLOCK' || itemForm.effectType === 'GLOBAL_ADBLOCK') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Durée de l'effet (minutes)</label>
                  <Input
                    type="number"
                    value={itemForm.durationMinutes || 60}
                    onChange={(e) =>
                      setItemForm((prev) => ({
                        ...prev,
                        durationMinutes: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="bg-transparent"
                    min="1"
                  />
                </div>
              )}

              {itemForm.effectType !== 'BONUS_AURA' &&
                itemForm.effectType !== 'BONUS_MONEY' &&
                itemForm.effectType !== 'DOODLE_JUMP_SKIN' &&
                !EFFECT_TYPES_WITHOUT_VALUE.has(itemForm.effectType) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {itemForm.effectType === 'CLAN_GAME_MONEY_BOOST'
                        ? 'Pourcentage de boost'
                        : "Valeur de l'effet"}
                    </label>
                    <Input
                      value={itemForm.effectValue}
                      onChange={(e) => setItemForm((prev) => ({ ...prev, effectValue: e.target.value }))}
                      placeholder={
                        itemForm.effectType === 'CLAN_GAME_MONEY_BOOST' ? 'Ex: 10' : "Valeur de l'effet"
                      }
                      className="bg-transparent"
                    />
                  </div>
                )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={onSaveItem} disabled={savingItem}>
            {savingItem ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {editingItem ? 'Modifier' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
