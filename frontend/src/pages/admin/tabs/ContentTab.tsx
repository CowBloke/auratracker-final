import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
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
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn, humanizeUiLabel } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/images';
import { AlertTriangle, Download, Edit2, Gamepad2, Loader2, Package, Plus, Trash2, Upload, X } from 'lucide-react';

export type ContentTabProps = Record<string, unknown>;

export function ContentTab(props: ContentTabProps) {
  const {
    loadingCategories,
    shopCategories,
    removeShopCategory,
    savingCategories,
    newCategoryId,
    setNewCategoryId,
    newCategoryLabel,
    setNewCategoryLabel,
    addShopCategory,
    items,
    djForcedSkinLoading,
    djForcedSkinSelected,
    setDjForcedSkinSelected,
    djForcedSkinId,
    saveDjForcedSkin,
    djForcedSkinSaving,
    itemImportInputRef,
    handleImportItemsFile,
    handleExportItems,
    openImportItemsPicker,
    importingItems,
    openCreateItemDialog,
    loadingItems,
    parseEffect,
    EFFECT_TYPES,
    ITEM_TYPE_LABELS,
    openEditItemDialog,
    deletingItem,
    deleteItem,
  } = props as any;

  return (
    <TabsContent value="content">
      <div className="flex gap-6 items-start">

        <div className="w-72 shrink-0 space-y-4 sticky top-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingCategories ? (
                <div className="flex justify-center py-4">
                  <div className="w-1 h-6 bg-foreground/20 animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    {shopCategories.map((cat: any) => (
                      <div key={cat.id} className="flex items-center justify-between rounded-md border border-border/30 px-2 py-1.5 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{cat.label}</span>
                          <span className="font-mono text-xs text-muted-foreground">{cat.id}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeShopCategory(cat.id)}
                          disabled={savingCategories}
                          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-1 border-t border-border/30">
                    <Input
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                      placeholder="Identifiant"
                      className="bg-transparent h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <Input
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        placeholder="Libelle"
                        className="bg-transparent h-8 text-xs flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && addShopCategory()}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addShopCategory}
                        disabled={savingCategories || !newCategoryId.trim() || !newCategoryLabel.trim()}
                        className="h-8 w-8 p-0 shrink-0"
                      >
                        {savingCategories ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(() => {
            const djRotatingItems = items.filter((item: any) => {
              try {
                const effect = JSON.parse(item.effect || '{}');
                return effect.type === 'DOODLE_JUMP_SKIN' && effect.shopType === 'rotating';
              } catch {
                return false;
              }
            });
            return (
              <Card className="border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-3.5 w-3.5 text-violet-400" />
                    <CardDescription className="text-violet-300">Apparence forcee du jour</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {djForcedSkinLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Chargement...
                    </div>
                  ) : djRotatingItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun skin dans le pool. Creez des skins avec le placement <em>Pool de rotation</em>.</p>
                  ) : (
                    <>
                      <Select value={djForcedSkinSelected} onValueChange={setDjForcedSkinSelected}>
                        <SelectTrigger className="bg-transparent border-violet-500/30 text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Rotation aleatoire</SelectItem>
                          {djRotatingItems.map((item: any) => (
                            <SelectItem key={item.id} value={item.id}>
                              Pool {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {djForcedSkinId && djForcedSkinId !== '__none__' && (
                        <p className="text-xs text-violet-400">
                          Force : {djRotatingItems.find((i: any) => i.id === djForcedSkinId)?.name ?? djForcedSkinId}
                        </p>
                      )}
                      <Button
                        size="sm"
                        onClick={saveDjForcedSkin}
                        disabled={djForcedSkinSaving}
                        className="w-full bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white border-0 h-8 text-xs"
                      >
                        {djForcedSkinSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                        Appliquer
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </div>

        <Card className="flex-1 min-w-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Objets de la boutique</CardDescription>
              <div className="flex items-center gap-2">
                <input
                  ref={itemImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportItemsFile}
                />
                <Button size="sm" variant="outline" onClick={handleExportItems} className="h-8 px-2">
                  <Download className="mr-1.5 h-4 w-4" />
                  Export
                </Button>
                <Button size="sm" variant="outline" onClick={openImportItemsPicker} className="h-8 px-2" disabled={importingItems}>
                  {importingItems ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                  Import
                </Button>
                <Button size="sm" variant="outline" onClick={openCreateItemDialog} className="h-8 w-8 p-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-muted-foreground">
              Import/export au format JSON versionne. Les images restent referencees par URL et les effets sont conserves en structure JSON.
            </p>
            {loadingItems ? (
              <div className="flex justify-center py-12">
                <div className="w-1 h-8 bg-foreground/20 animate-pulse" />
              </div>
            ) : items.length === 0 ? (
              <p className={cn(TYPOGRAPHY.MUTED, 'text-center py-12')}>Aucun objet cree</p>
            ) : (() => {
              const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
                acc[item.type] = acc[item.type] || [];
                acc[item.type].push(item);
                return acc;
              }, {});
              const allTypes = [...shopCategories.map((c: any) => c.id), ...Object.keys(grouped).filter((t) => !shopCategories.find((c: any) => c.id === t))];
              const getCategoryLabel = (typeId: string) => shopCategories.find((c: any) => c.id === typeId)?.label || ITEM_TYPE_LABELS[typeId] || humanizeUiLabel(typeId);
              return (
                <div className="space-y-6">
                  {allTypes.filter((t) => grouped[t]?.length).map((type) => (
                    <div key={type}>
                      <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground">
                        {getCategoryLabel(type)}
                      </p>
                      <div className="divide-y divide-border/30">
                        {grouped[type].map((item: any) => {
                          const { type: effectType } = parseEffect(item.effect);
                          const effectLabel = EFFECT_TYPES.find((e: any) => e.value === effectType)?.label || humanizeUiLabel(effectType);
                          return (
                            <div key={item.id} className="py-3 flex items-center justify-between">
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                {item.imageUrl ? (
                                  <img src={resolveImageUrl(item.imageUrl)} alt={item.name} className="w-10 h-10 object-cover rounded shrink-0" />
                                ) : (
                                  <div className="w-10 h-10 bg-muted/30 flex items-center justify-center rounded shrink-0">
                                    <Package className="w-5 h-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium truncate block">{item.name}</span>
                                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                  <p className="text-xs text-muted-foreground/60">Effet: {effectLabel}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 shrink-0">
                                <span className="text-sm text-muted-foreground tabular-nums">${item.price}</span>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditItemDialog(item)} className="h-8 border-border/50">
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="h-8 border-destructive/50 text-destructive hover:bg-destructive/10" disabled={deletingItem === item.id}>
                                        {deletingItem === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                          <AlertTriangle className="h-5 w-5 text-destructive" />
                                          Supprimer {item.name} ?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          L'objet sera supprime de la boutique. Les utilisateurs qui le possedent le garderont.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteItem(item.id)} className="bg-destructive hover:bg-destructive/90">
                                          Supprimer
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
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
