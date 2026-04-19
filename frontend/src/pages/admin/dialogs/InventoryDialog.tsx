import { AdminInventoryItem, ShopItem } from '@/services/api';
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
import { Loader2, Plus, Save, Trash2, Package, AlertTriangle } from 'lucide-react';
import { resolveImageUrl } from '@/lib/images';
import { ITEM_TYPE_LABELS } from '../constants';
import { EFFECT_TYPES, parseEffect } from '../adminPageModels';
import { humanizeUiLabel } from '@/lib/utils';

interface InventoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryUser: { username: string } | null;
  items: ShopItem[];
  inventoryAddItemId: string;
  setInventoryAddItemId: (id: string) => void;
  inventoryAddQuantity: number;
  setInventoryAddQuantity: (qty: number) => void;
  addingInventoryItem: boolean;
  onAddInventoryItem: () => void;
  loadingInventory: boolean;
  inventoryItems: AdminInventoryItem[];
  inventoryQuantities: Record<string, number>;
  setInventoryQuantities: (quantities: any) => void;
  updatingInventoryItem: string | null;
  onUpdateInventoryQuantity: (id: string) => void;
  removingInventoryItem: string | null;
  onRemoveInventoryItem: (id: string) => void;
  onClose: () => void;
}

export function InventoryDialog({
  isOpen,
  onOpenChange,
  inventoryUser,
  items,
  inventoryAddItemId,
  setInventoryAddItemId,
  inventoryAddQuantity,
  setInventoryAddQuantity,
  addingInventoryItem,
  onAddInventoryItem,
  loadingInventory,
  inventoryItems,
  inventoryQuantities,
  setInventoryQuantities,
  updatingInventoryItem,
  onUpdateInventoryQuantity,
  removingInventoryItem,
  onRemoveInventoryItem,
  onClose,
}: InventoryDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inventaire de {inventoryUser?.username || "l'utilisateur"}</DialogTitle>
          <DialogDescription>Consultez et ajustez les objets détenus par l'utilisateur.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="border border-border/30 rounded p-4 space-y-3">
            <h3 className="text-sm text-muted-foreground">Ajouter un objet</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Objet</label>
                <Select value={inventoryAddItemId} onValueChange={(value) => setInventoryAddItemId(value)}>
                  <SelectTrigger className="bg-transparent">
                    <SelectValue placeholder="Choisir un objet" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.length === 0 ? (
                      <SelectItem value="none" disabled>
                        Aucun objet disponible
                      </SelectItem>
                    ) : (
                      items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} • {ITEM_TYPE_LABELS[item.type] || humanizeUiLabel(item.type)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Quantité</label>
                <Input
                  type="number"
                  min={1}
                  value={inventoryAddQuantity}
                  onChange={(e) => setInventoryAddQuantity(parseInt(e.target.value) || 1)}
                  className="bg-transparent"
                />
              </div>
              <Button
                onClick={onAddInventoryItem}
                disabled={addingInventoryItem || items.length === 0 || !inventoryAddItemId}
                className="h-9"
              >
                {addingInventoryItem ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Ajouter
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm text-muted-foreground">Inventaire actuel</h3>
              <span className="text-xs text-muted-foreground">Définissez 0 pour supprimer un objet</span>
            </div>

            {loadingInventory ? (
              <div className="flex justify-center py-8">
                <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
              </div>
            ) : inventoryItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun objet dans l'inventaire</p>
            ) : (
              <div className="space-y-0">
                {inventoryItems.map((inventoryItem) => {
                  const effect = inventoryItem.item.effect ? parseEffect(inventoryItem.item.effect) : null;
                  const effectLabel = effect
                    ? EFFECT_TYPES.find((effectItem) => effectItem.value === effect.type)?.label ||
                      humanizeUiLabel(effect.type)
                    : null;

                  return (
                    <div key={inventoryItem.id} className="py-4 border-b border-border/30 last:border-0">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          {inventoryItem.item.imageUrl ? (
                            <img
                              src={resolveImageUrl(inventoryItem.item.imageUrl)}
                              alt={inventoryItem.item.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{inventoryItem.item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {ITEM_TYPE_LABELS[inventoryItem.item.type] || humanizeUiLabel(inventoryItem.item.type)}
                              </span>
                            </div>
                            {effectLabel && (
                              <p className="text-xs text-muted-foreground/70">Effet: {effectLabel}</p>
                            )}
                            <p className="text-xs text-muted-foreground/60">
                              Ajouté le{' '}
                              {new Date(inventoryItem.acquiredAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={inventoryQuantities[inventoryItem.id] ?? inventoryItem.quantity}
                            onChange={(e) =>
                              setInventoryQuantities((prev) => ({
                                ...prev,
                                [inventoryItem.id]: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="h-9 w-24 bg-transparent"
                          />
                          <Button
                            size="sm"
                            onClick={() => onUpdateInventoryQuantity(inventoryItem.id)}
                            disabled={updatingInventoryItem === inventoryItem.id}
                            className="h-9"
                          >
                            {updatingInventoryItem === inventoryItem.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 border-destructive/50 text-destructive hover:bg-destructive/10"
                                disabled={removingInventoryItem === inventoryItem.id}
                              >
                                {removingInventoryItem === inventoryItem.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Retirer {inventoryItem.item.name} ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  L'objet sera supprimé de l'inventaire de l'utilisateur.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onRemoveInventoryItem(inventoryItem.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Retirer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
