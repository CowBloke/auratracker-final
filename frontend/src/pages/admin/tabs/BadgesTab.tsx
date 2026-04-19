import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ImagePicker } from '@/components/ui/image-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
import { BadgeIcon } from '@/components/badges/BadgeIcon';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { Award, Edit2, Loader2, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';

export type BadgesTabProps = Record<string, unknown>;

export function BadgesTab(props: BadgesTabProps) {
  const {
    handleCheckAutoBadges,
    openCreateBadge,
    badges,
    badgesLoading,
    openEditBadge,
    handleDeleteBadge,
    awardBadgeUserId,
    setAwardBadgeUserId,
    awardBadgeId,
    setAwardBadgeId,
    awardBadgeReason,
    setAwardBadgeReason,
    handleAwardBadge,
    badgeFormOpen,
    setBadgeFormOpen,
    editingBadge,
    badgeForm,
    setBadgeForm,
    uploadItemImageFile,
    handleSaveBadge,
  } = props as any;

  return (
    <TabsContent value="badges" className={SPACING.SECTION_SPACING}>
      <div className="space-y-6">

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className={TYPOGRAPHY.H3}>Gestion des Badges</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCheckAutoBadges}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Verifier auto-badges
            </Button>
            <Button size="sm" onClick={openCreateBadge}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau badge
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardDescription>Tous les badges ({badges.length})</CardDescription>
          </CardHeader>
          <CardContent className={SPACING.CARD_SPACING}>
            {badgesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : badges.length === 0 ? (
              <p className={TYPOGRAPHY.MUTED}>Aucun badge. Clique sur "Nouveau badge" pour en creer un.</p>
            ) : (
              <div className="space-y-2">
                {badges.map((badge: any) => (
                  <div key={badge.id} className="flex items-center gap-3 p-3 rounded-md border border-border/40 hover:bg-muted/30">
                    <BadgeIcon badge={badge} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{badge.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                          badge.rarity === 'legendary' ? 'border-yellow-500/40 text-yellow-400' :
                          badge.rarity === 'epic' ? 'border-purple-500/40 text-purple-400' :
                          badge.rarity === 'rare' ? 'border-blue-500/40 text-blue-400' :
                          badge.rarity === 'uncommon' ? 'border-green-500/40 text-green-400' :
                          'border-border/40 text-muted-foreground'
                        }`}>{badge.rarity}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground">{badge.category}</span>
                        {badge.isAutomatic && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground">
                            auto: {badge.autoConditionKey}
                          </span>
                        )}
                        {!badge.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/30">inactif</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBadge(badge)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer le badge</AlertDialogTitle>
                            <AlertDialogDescription>
                              Supprimer le badge "{badge.name}" ? Cette action est irreversible et retirera le badge de tous les utilisateurs.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteBadge(badge.id)} className="bg-destructive hover:bg-destructive/90">
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

        <Card>
          <CardHeader>
            <CardDescription>Attribuer un badge a un utilisateur</CardDescription>
          </CardHeader>
          <CardContent className={SPACING.CARD_SPACING}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className={TYPOGRAPHY.XS}>ID utilisateur</label>
                <Input
                  placeholder="user-id ou username"
                  value={awardBadgeUserId}
                  onChange={(e) => setAwardBadgeUserId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={TYPOGRAPHY.XS}>Badge</label>
                <Select value={awardBadgeId} onValueChange={setAwardBadgeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un badge..." />
                  </SelectTrigger>
                  <SelectContent>
                    {badges.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        <div className="flex items-center gap-2">
                          <BadgeIcon badge={b} size="xs" />
                          <span>{b.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className={TYPOGRAPHY.XS}>Raison (optionnel)</label>
                <Input
                  placeholder="Raison de l'attribution..."
                  value={awardBadgeReason}
                  onChange={(e) => setAwardBadgeReason(e.target.value)}
                />
              </div>
            </div>
            <Button className="mt-3" onClick={handleAwardBadge} disabled={!awardBadgeUserId || !awardBadgeId}>
              <Award className="w-4 h-4 mr-2" />
              Attribuer
            </Button>
          </CardContent>
        </Card>

        <Dialog open={badgeFormOpen} onOpenChange={setBadgeFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBadge ? 'Modifier le badge' : 'Nouveau badge'}</DialogTitle>
              <DialogDescription>
                Personnalise l&apos;apparence et les proprietes du badge.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="flex gap-4 items-start p-4 rounded-lg bg-muted/20 border border-border/40">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <BadgeIcon badge={{
                    id: 'preview',
                    name: badgeForm.name || 'Apercu',
                    description: badgeForm.description || '',
                    backgroundType: badgeForm.backgroundType || 'solid',
                    backgroundColor: badgeForm.backgroundColor || '#374151',
                    backgroundGradient: badgeForm.backgroundGradient || null,
                    backgroundImage: badgeForm.backgroundImage || null,
                    icon: badgeForm.icon || '*',
                    iconColor: badgeForm.iconColor || '#ffffff',
                    borderColor: badgeForm.borderColor || '#6b7280',
                    category: badgeForm.category || 'special',
                    rarity: badgeForm.rarity || 'common',
                  }} size="lg" />
                  <p className="text-[11px] text-muted-foreground text-center w-20 truncate">{badgeForm.name || 'Apercu'}</p>
                </div>
                <div className="flex-1 space-y-2.5 min-w-0">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1 min-w-0">
                      <label className={TYPOGRAPHY.XS}>Nom *</label>
                      <Input value={badgeForm.name ?? ''} onChange={(e) => setBadgeForm((f: any) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className={TYPOGRAPHY.XS}>Icone</label>
                      <Input value={badgeForm.icon ?? '*'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, icon: e.target.value }))} maxLength={4} className="w-16 text-center text-lg" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Description *</label>
                    <Textarea value={badgeForm.description ?? ''} onChange={(e) => setBadgeForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Comment l&apos;obtenir</label>
                    <Input value={badgeForm.howToObtain ?? ''} onChange={(e) => setBadgeForm((f: any) => ({ ...f, howToObtain: e.target.value }))} placeholder="Ex: Etre dans le top 5 de l'aura" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Apparence</p>

                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    {(['solid', 'gradient', 'image'] as const).map((t) => (
                      <Button key={t} variant={badgeForm.backgroundType === t ? 'default' : 'outline'} size="sm"
                        onClick={() => setBadgeForm((f: any) => ({ ...f, backgroundType: t }))}>
                        {t === 'solid' ? 'Couleur unie' : t === 'gradient' ? 'Degrade' : 'Image'}
                      </Button>
                    ))}
                  </div>

                  {badgeForm.backgroundType === 'solid' && (
                    <div className="space-y-1">
                      <label className={TYPOGRAPHY.XS}>Couleur de fond</label>
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer shrink-0">
                          <div className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: badgeForm.backgroundColor ?? '#374151' }} />
                          <input type="color" value={badgeForm.backgroundColor ?? '#374151'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, backgroundColor: e.target.value }))} className="sr-only" />
                        </label>
                        <Input value={badgeForm.backgroundColor ?? '#374151'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, backgroundColor: e.target.value }))} className="flex-1 font-mono" placeholder="#374151" />
                      </div>
                    </div>
                  )}

                  {badgeForm.backgroundType === 'gradient' && (() => {
                    const _g = (() => { try { return JSON.parse(badgeForm.backgroundGradient ?? '{}'); } catch { return {}; } })();
                    const gradFrom = (_g.from as string) ?? '#374151';
                    const gradTo = (_g.to as string) ?? '#6b7280';
                    const gradDir = (_g.direction as string) ?? 'to bottom right';
                    const setGrad = (field: string, val: string) => {
                      const cur = (() => { try { return JSON.parse(badgeForm.backgroundGradient ?? '{}'); } catch { return {}; } })();
                      setBadgeForm((f: any) => ({ ...f, backgroundGradient: JSON.stringify({ ...cur, [field]: val }) }));
                    };
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div className="space-y-1">
                            <label className={TYPOGRAPHY.XS}>Depuis</label>
                            <div className="flex items-center gap-1.5">
                              <label className="cursor-pointer shrink-0">
                                <div className="h-8 w-8 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: gradFrom }} />
                                <input type="color" value={gradFrom} onChange={(e) => setGrad('from', e.target.value)} className="sr-only" />
                              </label>
                              <Input value={gradFrom} onChange={(e) => setGrad('from', e.target.value)} className="font-mono text-xs min-w-0" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className={TYPOGRAPHY.XS}>Vers</label>
                            <div className="flex items-center gap-1.5">
                              <label className="cursor-pointer shrink-0">
                                <div className="h-8 w-8 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: gradTo }} />
                                <input type="color" value={gradTo} onChange={(e) => setGrad('to', e.target.value)} className="sr-only" />
                              </label>
                              <Input value={gradTo} onChange={(e) => setGrad('to', e.target.value)} className="font-mono text-xs min-w-0" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className={TYPOGRAPHY.XS}>Direction</label>
                            <Select value={gradDir} onValueChange={(v) => setGrad('direction', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="to right">Droite</SelectItem>
                                <SelectItem value="to left">Gauche</SelectItem>
                                <SelectItem value="to bottom">Bas</SelectItem>
                                <SelectItem value="to top">Haut</SelectItem>
                                <SelectItem value="to bottom right">Bas droite</SelectItem>
                                <SelectItem value="to bottom left">Bas gauche</SelectItem>
                                <SelectItem value="to top right">Haut droite</SelectItem>
                                <SelectItem value="to top left">Haut gauche</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="h-6 rounded-md border border-border/40" style={{ background: `linear-gradient(${gradDir}, ${gradFrom}, ${gradTo})` }} />
                      </div>
                    );
                  })()}

                  {badgeForm.backgroundType === 'image' && (
                    <ImagePicker
                      value={badgeForm.backgroundImage ?? ''}
                      onChange={(url) => setBadgeForm((f: any) => ({ ...f, backgroundImage: url }))}
                      uploadFn={uploadItemImageFile}
                      placeholder="URL de l'image de fond..."
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Couleur de l&apos;icone</label>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer shrink-0">
                        <div className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: badgeForm.iconColor ?? '#ffffff' }} />
                        <input type="color" value={badgeForm.iconColor ?? '#ffffff'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, iconColor: e.target.value }))} className="sr-only" />
                      </label>
                      <Input value={badgeForm.iconColor ?? '#ffffff'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, iconColor: e.target.value }))} className="flex-1 font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Couleur de bordure</label>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer shrink-0">
                        <div className="h-9 w-9 rounded-md border border-border shadow-sm transition-transform hover:scale-105" style={{ backgroundColor: badgeForm.borderColor ?? '#6b7280' }} />
                        <input type="color" value={badgeForm.borderColor ?? '#6b7280'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, borderColor: e.target.value }))} className="sr-only" />
                      </label>
                      <Input value={badgeForm.borderColor ?? '#6b7280'} onChange={(e) => setBadgeForm((f: any) => ({ ...f, borderColor: e.target.value }))} className="flex-1 font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parametres</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Categorie</label>
                    <Select value={badgeForm.category ?? 'special'} onValueChange={(v) => setBadgeForm((f: any) => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leaderboard">Classement</SelectItem>
                        <SelectItem value="achievement">Succes</SelectItem>
                        <SelectItem value="special">Special</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className={TYPOGRAPHY.XS}>Rarete</label>
                    <Select value={badgeForm.rarity ?? 'common'} onValueChange={(v) => setBadgeForm((f: any) => ({ ...f, rarity: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="common">Commun</SelectItem>
                        <SelectItem value="uncommon">Peu commun</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                        <SelectItem value="epic">Epique</SelectItem>
                        <SelectItem value="legendary">Legendaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editingBadge?.isAutomatic ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40 text-xs text-muted-foreground">
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                    <span>Badge automatique - condition : <span className="font-mono text-foreground">{editingBadge.autoConditionKey}</span></span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={badgeForm.isAutomatic ?? false}
                        onCheckedChange={(v) => setBadgeForm((f: any) => ({ ...f, isAutomatic: v }))}
                      />
                      <label className={TYPOGRAPHY.XS}>Attribution automatique</label>
                    </div>
                    {badgeForm.isAutomatic && (
                      <div className="space-y-1">
                        <label className={TYPOGRAPHY.XS}>Condition</label>
                        <Select value={badgeForm.autoConditionKey ?? ''} onValueChange={(v) => setBadgeForm((f: any) => ({ ...f, autoConditionKey: v }))}>
                          <SelectTrigger><SelectValue placeholder="Choisir une condition..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TOP_1_AURA">Top 1 Aura</SelectItem>
                            <SelectItem value="TOP_3_AURA">Top 3 Aura</SelectItem>
                            <SelectItem value="TOP_5_AURA">Top 5 Aura</SelectItem>
                            <SelectItem value="TOP_10_AURA">Top 10 Aura</SelectItem>
                            <SelectItem value="TOP_1_MONEY">Top 1 Argent</SelectItem>
                            <SelectItem value="TOP_3_MONEY">Top 3 Argent</SelectItem>
                            <SelectItem value="TOP_5_MONEY">Top 5 Argent</SelectItem>
                            <SelectItem value="TOP_10_MONEY">Top 10 Argent</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_doodle_jump">Champion Doodle Jump</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_doodle_jump_mort_subite">Champion Doodle Jump Mort Subite</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_flappy_bird">Champion Flappy Bird</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_game_2048">Champion 2048</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_geometry_dash">Champion Geometry Dash</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_solitaire">Champion Solitaire</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_racer">Champion Racer (meilleur temps)</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_tetris">Champion Tetris</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_knife_hit">Champion Knife Hit</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_goyave_empire">Champion Goyave Empire</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_logic_lab">Champion Logic Lab</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_minesweeper">Champion Demineur</SelectItem>
                            <SelectItem value="GAME_HIGHSCORE_casino">Champion Casino</SelectItem>
                            <SelectItem value="BOMBPARTY_TOP_WINS">Champion Bombe de mots (victoires)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Switch
                    checked={badgeForm.isActive ?? true}
                    onCheckedChange={(v) => setBadgeForm((f: any) => ({ ...f, isActive: v }))}
                  />
                  <label className={TYPOGRAPHY.XS}>Badge actif (visible et attribuable)</label>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={badgeForm.isHidden ?? false}
                    onCheckedChange={(v) => setBadgeForm((f: any) => ({ ...f, isHidden: v }))}
                  />
                  <label className={TYPOGRAPHY.XS}>Achievement cache - s'affiche comme ??? sur les profils avant d'etre obtenu</label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBadgeFormOpen(false)}>Annuler</Button>
              <Button onClick={handleSaveBadge} disabled={!badgeForm.name || !badgeForm.description}>
                <Save className="w-4 h-4 mr-2" />
                {editingBadge ? 'Mettre a jour' : 'Creer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TabsContent>
  );
}
