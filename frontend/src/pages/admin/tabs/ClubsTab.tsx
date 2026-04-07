import { type Dispatch, type SetStateAction } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ImagePicker } from '@/components/ui/image-picker';
import { SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { Crown, Edit2, Loader2, Plus, Save, Search, Swords, Trash2 } from 'lucide-react';

type ClubsTabProps = {
  filteredClans: any[];
  clanSearchQuery: string;
  setClanSearchQuery: Dispatch<SetStateAction<string>>;
  loadingClans: boolean;
  startEditingClan: (clan: any) => void;
  deletingClan: string | null;
  deleteClan: (clanId: string) => void;
  editingClanId: string | null;
  clans: any[];
  clanForm: any;
  setClanForm: Dispatch<SetStateAction<any>>;
  uploadItemImageFile: (file: File) => Promise<string>;
  saveClan: (clanId: string) => void;
  savingClan: boolean;
  cancelEditingClan: () => void;
  transferringClanLeader: string | null;
  transferClanLeadership: (clanId: string, userId: string) => void;
  clanEvents: any[];
  loadingClanEvents: boolean;
  resetClanEventForm: () => void;
  startEditingClanEvent: (event: any) => void;
  deletingClanEvent: string | null;
  deleteClanEvent: (eventId: string) => Promise<void>;
  editingClanEventId: string | null;
  clanEventForm: any;
  setClanEventForm: Dispatch<SetStateAction<any>>;
  items: any[];
  saveClanEvent: () => Promise<void>;
  savingClanEvent: boolean;
};

export function ClubsTab(props: ClubsTabProps) {
  const {
    filteredClans,
    clanSearchQuery,
    setClanSearchQuery,
    loadingClans,
    startEditingClan,
    deletingClan,
    deleteClan,
    editingClanId,
    clans,
    clanForm,
    setClanForm,
    uploadItemImageFile,
    saveClan,
    savingClan,
    cancelEditingClan,
    transferringClanLeader,
    transferClanLeadership,
    clanEvents,
    loadingClanEvents,
    resetClanEventForm,
    startEditingClanEvent,
    deletingClanEvent,
    deleteClanEvent,
    editingClanEventId,
    clanEventForm,
    setClanEventForm,
    items,
    saveClanEvent,
    savingClanEvent,
  } = props;

  return (
    <TabsContent value="clubs" className={SPACING.SECTION_SPACING}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardDescription>Gestion des clans</CardDescription>
                <p className="text-sm text-muted-foreground">{filteredClans.length} clan(s) affiché(s)</p>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clanSearchQuery}
                  onChange={(e) => setClanSearchQuery(e.target.value)}
                  placeholder="Rechercher un clan, chef ou membre"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingClans ? (
              <div className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : filteredClans.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aucun clan trouvé.
              </div>
            ) : (
              filteredClans.map((clan) => (
                <div key={clan.id} className="rounded-xl border border-border/50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-medium">{clan.name}</h3>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs',
                          clan.isPublic ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        )}>
                          {clan.isPublic ? 'Public' : 'Privé'}
                        </span>
                        {clan.activeWar && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-400">
                            <Swords className="h-3 w-3" />
                            {clan.activeWar.status === 'ACTIVE' ? 'En guerre' : 'Préparation'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {clan.description || 'Aucune description.'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Chef: {clan.owner.username}</span>
                        <span>Membres: {clan.members.length}/{clan.maxMembers}</span>
                        <span>Créé le {new Date(clan.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditingClan(clan)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        Gérer
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/50 text-destructive hover:bg-destructive/10"
                            disabled={deletingClan === clan.id}
                          >
                            {deletingClan === clan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer {clan.name} ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action supprime le clan, ses membres et ses guerres liées.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteClan(clan.id)} className="bg-destructive hover:bg-destructive/90">
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{editingClanId ? 'Édition du clan' : 'Sélectionne un clan à gérer'}</CardDescription>
          </CardHeader>
          <CardContent>
            {!editingClanId ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Choisis un clan dans la liste pour modifier ses paramètres ou changer son chef.
              </div>
            ) : (
              (() => {
                const clan = clans.find((entry) => entry.id === editingClanId);
                if (!clan) {
                  return <div className="text-sm text-muted-foreground">Clan introuvable.</div>;
                }

                return (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Nom</label>
                      <Input value={clanForm.name} onChange={(e) => setClanForm((prev: any) => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Description</label>
                      <Textarea
                        value={clanForm.description}
                        onChange={(e) => setClanForm((prev: any) => ({ ...prev, description: e.target.value }))}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Image</label>
                      <ImagePicker
                        value={clanForm.imageUrl}
                        onChange={(url) => setClanForm((prev: any) => ({ ...prev, imageUrl: url }))}
                        uploadFn={uploadItemImageFile}
                        hidePreview
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Capacité max</label>
                        <Input
                          type="number"
                          min={clan.members.length}
                          max={12}
                          value={clanForm.maxMembers}
                          onChange={(e) => setClanForm((prev: any) => ({ ...prev, maxMembers: parseInt(e.target.value) || clan.members.length }))}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <div className="text-sm font-medium">Clan public</div>
                          <div className="text-xs text-muted-foreground">Entrée directe ou sur candidature</div>
                        </div>
                        <Switch
                          checked={clanForm.isPublic}
                          onCheckedChange={(checked) => setClanForm((prev: any) => ({ ...prev, isPublic: checked }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={() => saveClan(clan.id)} disabled={savingClan}>
                        {savingClan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Sauvegarder
                      </Button>
                      <Button variant="outline" onClick={cancelEditingClan}>Annuler</Button>
                    </div>

                    <div className="space-y-3 border-t border-border/40 pt-5">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <h3 className="font-medium">Changer le chef</h3>
                      </div>
                      <div className="space-y-2">
                        {clan.members.map((member: any) => (
                          <div key={member.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{member.user.username}</span>
                                {member.isLeader && <span className="text-xs text-amber-500">chef actuel</span>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {Number(member.user.aura).toLocaleString('fr-FR')} aura • membre depuis {new Date(member.joinedAt).toLocaleDateString('fr-FR')}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={member.isLeader ? 'secondary' : 'outline'}
                              disabled={member.isLeader || transferringClanLeader === `${clan.id}:${member.userId}`}
                              onClick={() => transferClanLeadership(clan.id, member.userId)}
                            >
                              {transferringClanLeader === `${clan.id}:${member.userId}` ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Crown className="mr-2 h-4 w-4" />
                              )}
                              Nommer chef
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardDescription>Événements de clan</CardDescription>
                <p className="text-sm text-muted-foreground">{clanEvents.length} événement(s)</p>
              </div>
              <Button size="sm" variant="outline" onClick={resetClanEventForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvel événement
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingClanEvents ? (
              <div className="py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : clanEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Aucun événement de clan configuré.
              </div>
            ) : clanEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-border/50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium">{event.title}</h3>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">{event.status}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{event.quests.length} quête(s)</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{event.miniGames.length} mini-jeu(x)</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{event.description || 'Aucune description.'}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Début: {new Date(event.startsAt).toLocaleString('fr-FR')}</span>
                      <span>Fin: {new Date(event.endsAt).toLocaleString('fr-FR')}</span>
                      <span>Leaderboard: {event.leaderboard.length} clan(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditingClanEvent(event)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Gérer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                      disabled={deletingClanEvent === event.id}
                      onClick={() => { void deleteClanEvent(event.id); }}
                    >
                      {deletingClanEvent === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{editingClanEventId ? 'Édition événement' : 'Créer un événement de clan'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Titre</label>
              <Input value={clanEventForm.title} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea value={clanEventForm.description} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Bannière</label>
              <ImagePicker
                value={clanEventForm.bannerUrl}
                onChange={(url) => setClanEventForm((prev: any) => ({ ...prev, bannerUrl: url }))}
                uploadFn={uploadItemImageFile}
                hidePreview
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Statut</label>
                <Select value={clanEventForm.status} onValueChange={(value) => setClanEventForm((prev: any) => ({ ...prev, status: value as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Brouillon</SelectItem>
                    <SelectItem value="SCHEDULED">Planifié</SelectItem>
                    <SelectItem value="ACTIVE">Actif</SelectItem>
                    <SelectItem value="COMPLETED">Terminé</SelectItem>
                    <SelectItem value="CANCELLED">Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Couleur accent</label>
                <Input value={clanEventForm.highlightColor} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, highlightColor: e.target.value }))} placeholder="#f59e0b" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Début</label>
                <Input type="datetime-local" value={clanEventForm.startsAt} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Fin</label>
                <Input type="datetime-local" value={clanEventForm.endsAt} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, endsAt: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Résumé des règles</label>
              <Textarea value={clanEventForm.rulesSummary} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, rulesSummary: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-3 border-t border-border/40 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Quêtes</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClanEventForm((prev: any) => ({
                    ...prev,
                    quests: [...prev.quests, { title: '', description: '', activityType: 'PLAY_ANY_GAME', targetValue: 5, pointsReward: 25, sortOrder: prev.quests.length, isActive: true }],
                  }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
              {clanEventForm.quests.map((quest: any, index: number) => (
                <div key={`quest-${index}`} className="rounded-xl border border-border/50 p-3 space-y-3">
                  <Input value={quest.title} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, title: e.target.value } : entry) }))} placeholder="Titre de quête" />
                  <Textarea value={quest.description} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, description: e.target.value } : entry) }))} rows={2} placeholder="Description" />
                  <div className="grid gap-3 md:grid-cols-3">
                    <Select value={quest.activityType} onValueChange={(value) => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, activityType: value } : entry) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PLAY_ANY_GAME">Parties jouées</SelectItem>
                        <SelectItem value="WIN_ANY_GAME">Victoires</SelectItem>
                        <SelectItem value="CLAN_CHAT_MESSAGE">Messages clan</SelectItem>
                        <SelectItem value="CLAN_BANK_DEPOSIT">Money déposée</SelectItem>
                        <SelectItem value="CLAN_WAR_ATTACK">Actions guerre attaque</SelectItem>
                        <SelectItem value="CLAN_WAR_SUPPORT">Actions guerre support</SelectItem>
                        <SelectItem value="EVENT_MINIGAME_PLAY">Mini-jeux joués</SelectItem>
                        <SelectItem value="EVENT_MINIGAME_POINTS">Points mini-jeux</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="number" value={quest.targetValue} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, targetValue: parseInt(e.target.value) || 1 } : entry) }))} placeholder="Objectif" />
                    <Input type="number" value={quest.pointsReward} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, pointsReward: parseInt(e.target.value) || 1 } : entry) }))} placeholder="Points" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Active</div>
                    <div className="flex items-center gap-2">
                      <Switch checked={quest.isActive} onCheckedChange={(checked) => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, isActive: checked } : entry) }))} />
                      <Button size="sm" variant="ghost" onClick={() => setClanEventForm((prev: any) => ({ ...prev, quests: prev.quests.filter((_: any, entryIndex: number) => entryIndex !== index) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border/40 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Mini-jeux</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClanEventForm((prev: any) => ({
                    ...prev,
                    miniGames: [...prev.miniGames, { title: '', description: '', type: 'TAP_FRENZY', instructions: '', scoreMultiplier: 1, flatPointsBonus: 0, maxPointsPerAttempt: 100, maxAttemptsPerUser: 3, cooldownMinutes: 10, sortOrder: prev.miniGames.length, isActive: true, config: '{"durationSeconds":8}' }],
                  }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
              {clanEventForm.miniGames.map((miniGame: any, index: number) => (
                <div key={`mini-${index}`} className="rounded-xl border border-border/50 p-3 space-y-3">
                  <Input value={miniGame.title} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, title: e.target.value } : entry) }))} placeholder="Titre du mini-jeu" />
                  <Textarea value={miniGame.description} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, description: e.target.value } : entry) }))} rows={2} placeholder="Description" />
                  <Select value={miniGame.type} onValueChange={(value) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, type: value as any } : entry) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REFLEX">Réflexe</SelectItem>
                      <SelectItem value="TAP_FRENZY">Tap frenzy</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea value={miniGame.instructions} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, instructions: e.target.value } : entry) }))} rows={2} placeholder="Instructions" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input type="number" step="0.1" value={miniGame.scoreMultiplier} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, scoreMultiplier: parseFloat(e.target.value) || 0 } : entry) }))} placeholder="Multiplicateur" />
                    <Input type="number" value={miniGame.flatPointsBonus} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, flatPointsBonus: parseInt(e.target.value) || 0 } : entry) }))} placeholder="Bonus fixe" />
                    <Input type="number" value={miniGame.maxPointsPerAttempt} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, maxPointsPerAttempt: parseInt(e.target.value) || 1 } : entry) }))} placeholder="Cap points" />
                    <Input type="number" value={miniGame.cooldownMinutes} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, cooldownMinutes: parseInt(e.target.value) || 0 } : entry) }))} placeholder="Cooldown" />
                    <Input type="number" value={miniGame.maxAttemptsPerUser ?? ''} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, maxAttemptsPerUser: e.target.value === '' ? null : (parseInt(e.target.value) || 1) } : entry) }))} placeholder="Tentatives max" />
                  </div>
                  <Textarea value={miniGame.config} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, config: e.target.value } : entry) }))} rows={2} placeholder='Config JSON, ex: {"durationSeconds":8}' />
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Actif</div>
                    <div className="flex items-center gap-2">
                      <Switch checked={miniGame.isActive} onCheckedChange={(checked) => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, isActive: checked } : entry) }))} />
                      <Button size="sm" variant="ghost" onClick={() => setClanEventForm((prev: any) => ({ ...prev, miniGames: prev.miniGames.filter((_: any, entryIndex: number) => entryIndex !== index) }))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-border/40 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Récompenses</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClanEventForm((prev: any) => ({
                    ...prev,
                    rewardTiers: [...prev.rewardTiers, { title: '', minRank: prev.rewardTiers.length + 1, maxRank: prev.rewardTiers.length + 1, moneyReward: 0, auraReward: 0, itemId: '' }],
                  }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter
                </Button>
              </div>
              {clanEventForm.rewardTiers.map((tier: any, index: number) => (
                <div key={`reward-${index}`} className="rounded-xl border border-border/50 p-3 space-y-3">
                  <Input value={tier.title} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, title: e.target.value } : entry) }))} placeholder="Titre du palier" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input type="number" value={tier.minRank} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, minRank: parseInt(e.target.value) || 1 } : entry) }))} placeholder="Rang min" />
                    <Input type="number" value={tier.maxRank} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, maxRank: parseInt(e.target.value) || 1 } : entry) }))} placeholder="Rang max" />
                    <Input type="number" value={tier.moneyReward} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, moneyReward: parseInt(e.target.value) || 0 } : entry) }))} placeholder="Money" />
                    <Input type="number" value={tier.auraReward} onChange={(e) => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, auraReward: parseInt(e.target.value) || 0 } : entry) }))} placeholder="Aura" />
                  </div>
                  <Select value={tier.itemId || '__none__'} onValueChange={(value) => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.map((entry: any, entryIndex: number) => entryIndex === index ? { ...entry, itemId: value === '__none__' ? '' : value } : entry) }))}>
                    <SelectTrigger><SelectValue placeholder="Objet bonus" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Aucun objet</SelectItem>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => setClanEventForm((prev: any) => ({ ...prev, rewardTiers: prev.rewardTiers.filter((_: any, entryIndex: number) => entryIndex !== index) }))}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Retirer
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => { void saveClanEvent(); }} disabled={savingClanEvent}>
                {savingClanEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Sauvegarder l&apos;événement
              </Button>
              <Button variant="outline" onClick={resetClanEventForm}>Réinitialiser</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}

