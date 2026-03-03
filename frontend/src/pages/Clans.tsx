import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X, Check, UserX, Crown, LogOut } from 'lucide-react';
import { clansApi, ClanDetail, ClanSummary, uploadUserImage } from '@/services/api';
import { ImagePicker } from '@/components/ui/image-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { toast } from '@/hooks/use-toast';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { UsernameDisplay } from '@/components/ui/username-display';

const formatAura = (value: number | string) => {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(numericValue)) return '0';
  return numericValue.toLocaleString();
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });

export default function Clans() {
  const [clans, setClans] = useState<ClanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClanId, setSelectedClanId] = useState<string | null>(null);
  const [selectedClan, setSelectedClan] = useState<ClanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [userBelongsToAnyClan, setUserBelongsToAnyClan] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchClans();
  }, []);

  useEffect(() => {
    if (!selectedClanId && clans.length > 0) {
      setSelectedClanId(clans[0].id);
    }
  }, [clans, selectedClanId]);

  useEffect(() => {
    if (!selectedClanId) return;
    fetchClanDetail(selectedClanId);
  }, [selectedClanId]);

  useEffect(() => {
    if (selectedClan?.viewer?.isMember || selectedClan?.viewer?.isLeader) {
      setUserBelongsToAnyClan(true);
    }
  }, [selectedClan]);

  const fetchClans = async () => {
    try {
      setLoading(true);
      const res = await clansApi.list();
      setClans(res.data.clans || []);
    } catch (error) {
      console.error('Failed to fetch clans:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les clans.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClanDetail = async (clanId: string) => {
    try {
      setDetailLoading(true);
      const res = await clansApi.getById(clanId);
      setSelectedClan(res.data.clan);
    } catch (error) {
      console.error('Failed to fetch clan detail:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger ce clan.',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setIsPublic(true);
    setImageUrl('');
    setFormError(null);
  };


  const uploadClanImageFile = async (file: File): Promise<string> => {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = typeof reader.result === 'string' ? reader.result : '';
        const payload = raw.includes(',') ? raw.split(',')[1] : '';
        if (!payload) reject(new Error('Invalid file'));
        else resolve(payload);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await uploadUserImage({ base64Data, mimeType: file.type });
    return res.data.imageUrl;
  };

  const handleCreateClan = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Le nom est obligatoire.');
      return;
    }

    setCreating(true);
    try {
      const finalImageUrl = imageUrl.trim() || undefined;

      const res = await clansApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        imageUrl: finalImageUrl,
        isPublic,
      });

      setDialogOpen(false);
      resetForm();
      toast({
        title: 'Clan créé',
        description: 'Le clan a été créé avec succès.',
      });
      await fetchClans();
      setSelectedClanId(res.data.clan.id);
    } catch (error: any) {
      console.error('Failed to create clan:', error);
      setFormError(error.response?.data?.error || 'Impossible de creer le clan.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      const res = await clansApi.join(selectedClan.id);
      if (res.data.status === 'joined') {
        toast({
          title: 'Clan rejoint',
          description: 'Tu as rejoint le clan.',
        });
      } else {
        toast({
          title: 'Demande envoyée',
          description: 'Ta demande a été envoyée au chef du clan.',
        });
      }
      await Promise.all([fetchClans(), fetchClanDetail(selectedClan.id)]);
    } catch (error: any) {
      console.error('Failed to join clan:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de rejoindre le clan.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      if (action === 'accept') {
        await clansApi.acceptRequest(selectedClan.id, requestId);
        toast({
          title: 'Demande acceptée',
          description: 'Le joueur a été ajouté au clan.',
        });
      } else {
        await clansApi.rejectRequest(selectedClan.id, requestId);
        toast({
          title: 'Demande refusée',
          description: 'La demande a été refusée.',
        });
      }
      await Promise.all([fetchClans(), fetchClanDetail(selectedClan.id)]);
    } catch (error: any) {
      console.error('Failed to update request:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de traiter la demande.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    try {
      await clansApi.removeMember(selectedClan.id, userId);
      toast({
        title: 'Membre retiré',
        description: 'Le membre a été retiré du clan.',
      });
      await Promise.all([fetchClans(), fetchClanDetail(selectedClan.id)]);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de retirer ce membre.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!selectedClan) return;
    if (!confirm('Es-tu sur de vouloir quitter ce clan ?')) return;
    setActionLoading(true);
    try {
      await clansApi.leave(selectedClan.id);
      toast({
        title: 'Clan quitté',
        description: 'Tu as quitté le clan.',
      });
      await fetchClans();
      setSelectedClanId(null);
      setSelectedClan(null);
    } catch (error: any) {
      console.error('Failed to leave clan:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de quitter le clan.',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) || null,
    [clans, selectedClanId]
  );

  const selectedClanStatus = selectedClan
    ? selectedClan.viewer.isLeader
      ? 'Chef'
      : selectedClan.viewer.isMember
        ? 'Membre'
        : selectedClan.viewer.hasPendingRequest
          ? 'En attente'
          : null
    : null;

  return (
    <>
      <PageShell>
        <div className={SPACING.PAGE_CONTENT}>
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardContent className="space-y-2 p-3">
              <div className="flex items-center justify-between px-1 py-2">
                <CardTitle className="text-base">Clans</CardTitle>
                <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>{clans.length}</span>
              </div>
              {loading ? (
                <div className={cn(TYPOGRAPHY.MUTED, "py-10")}>Chargement...</div>
              ) : (
                <div className="space-y-1">
                  {!userBelongsToAnyClan && (
                    <button
                      type="button"
                      onClick={() => setDialogOpen(true)}
                      className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40 border border-dashed border-border/40"
                    >
                      <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Créer un clan</span>
                    </button>
                  )}
                  {clans.length === 0 && (
                    <div className={cn(TYPOGRAPHY.MUTED, "py-6")}>Aucun clan pour le moment.</div>
                  )}
                  {clans.map((clan) => (
                    <button
                      key={clan.id}
                      type="button"
                      onClick={() => setSelectedClanId(clan.id)}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40",
                        clan.id === selectedClanId && "bg-muted"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className={cn(TYPOGRAPHY.SMALL, "truncate")}>{clan.name}</h3>
                          <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                            {clan.memberCount}/{clan.maxMembers} • {formatAura(clan.totalAura)}
                          </p>
                        </div>
                        <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                          {clan.isPublic ? 'Public' : 'Privé'}
                        </span>
                      </div>
                      <div className="mt-1 min-w-0">
                        <div className={cn(TYPOGRAPHY.XS, "truncate text-muted-foreground")}>
                          <UsernameDisplay username={clan.leader.username} usernameColor={clan.leader.usernameColor} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              {detailLoading ? (
                <div className={cn(TYPOGRAPHY.MUTED, "py-12 text-center")}>Chargement...</div>
              ) : selectedClan ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {selectedClan.imageUrl ? (
                              <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                            ) : null}
                            <AvatarFallback className="bg-muted text-sm font-semibold">
                              {selectedClan.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <h2 className={TYPOGRAPHY.H3}>{selectedClan.name}</h2>
                        </div>
                        <div className={TYPOGRAPHY.SMALL}>
                          <UsernameDisplay username={selectedClan.leader.username} usernameColor={selectedClan.leader.usernameColor} />
                        </div>
                        {selectedClan.description ? (
                          <p className={cn(TYPOGRAPHY.SMALL, "max-w-2xl text-muted-foreground")}>
                            {selectedClan.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                          {selectedClan.isPublic ? 'Public' : 'Privé'}
                        </span>
                        {selectedClanStatus && (
                          <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                            {selectedClanStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={cn("flex flex-wrap gap-4 border-y py-3", TYPOGRAPHY.SMALL, "text-muted-foreground")}>
                      <span>{selectedClan.memberCount}/{selectedClan.maxMembers} membres</span>
                      <span>{formatAura(selectedClan.totalAura)} aura</span>
                      <span>{formatDate(selectedClan.createdAt)}</span>
                    </div>
                    <div className="flex gap-2">
                      {!selectedClan.viewer.isMember && !selectedClan.viewer.hasPendingRequest && (
                        <Button
                          onClick={handleJoin}
                          disabled={actionLoading}
                          variant="outline"
                          size="sm"
                        >
                          {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          {selectedClan.isPublic ? 'Rejoindre' : 'Demander'}
                        </Button>
                      )}
                      {selectedClan.viewer.isMember && (
                        <Button
                          onClick={handleLeave}
                          disabled={actionLoading}
                          variant="destructive"
                          size="sm"
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <LogOut className="h-4 w-4 mr-2" />
                          )}
                          Quitter le clan
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Membres</h3>
                    <div className="divide-y">
                        {selectedClan.members.map((member, index) => (
                          <div
                            key={member.id}
                            className={cn(
                              "flex flex-wrap items-center justify-between gap-3 py-3",
                              member.userId === selectedClan.leader.id && "bg-muted/20"
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-3 px-1">
                              <span className={cn("w-6", TYPOGRAPHY.XS, "text-muted-foreground tabular-nums")}>#{index + 1}</span>
                              <div className="min-w-0">
                                <p className={cn(TYPOGRAPHY.SMALL, "truncate")}>
                                  <UsernameDisplay username={member.username} usernameColor={member.usernameColor} />
                                  {member.isLeader && <Crown className="ml-2 inline h-3 w-3 text-aura" />}
                                </p>
                                <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>Arrivé le {formatDate(member.joinedAt)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 px-1">
                              <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground tabular-nums")}>
                                {formatAura(member.aura)} aura
                              </span>
                              {selectedClan.viewer.isLeader && !member.isLeader && (
                                <Button
                                  onClick={() => handleRemoveMember(member.userId)}
                                  disabled={actionLoading}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <UserX className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {selectedClan.viewer.isLeader && (
                    <div className="space-y-2">
                      <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground")}>Demandes en attente</h3>
                      {selectedClan.joinRequests.length === 0 ? (
                        <p className={TYPOGRAPHY.SMALL}>Aucune demande pour le moment.</p>
                      ) : (
                        <div className="divide-y">
                            {selectedClan.joinRequests.map((request) => (
                              <div
                                key={request.id}
                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                              >
                                <div className="min-w-0 px-1">
                                  <div className="min-w-0">
                                    <p className={cn(TYPOGRAPHY.SMALL, "truncate")}>
                                      <UsernameDisplay username={request.username} usernameColor={request.usernameColor} />
                                    </p>
                                    <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground")}>
                                      {formatAura(request.aura)} aura • {formatDate(request.requestedAt)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 px-1">
                                  <Button
                                    onClick={() => handleRequestAction(request.id, 'reject')}
                                    disabled={actionLoading}
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    onClick={() => handleRequestAction(request.id, 'accept')}
                                    disabled={actionLoading}
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
            ) : selectedClanSummary ? (
              <div className={cn(TYPOGRAPHY.MUTED, "py-12 text-center")}>
                Clique sur un clan pour voir le détail.
              </div>
            ) : (
              <div className={cn(TYPOGRAPHY.MUTED, "py-12 text-center")}>
                Aucun clan sélectionné.
              </div>
            )}
            </CardContent>
          </Card>
        </div>
        </div>
      </PageShell>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Creer un clan</DialogTitle>
            <DialogDescription>
              Cree un nouveau clan pour rassembler des joueurs. Le cout est de 100$ aura.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateClan} className="space-y-4">
            <div className="space-y-2">
              <label className={TYPOGRAPHY.SMALL}>Nom du clan</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} />
            </div>
            <div className="space-y-2">
              <label className={TYPOGRAPHY.SMALL}>Description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={TYPOGRAPHY.SMALL}>Clan public</p>
                    <p className={TYPOGRAPHY.XS}>Ouvert a tous sans validation</p>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Logo (optionnel)</label>
              <ImagePicker
                value={imageUrl}
                onChange={setImageUrl}
                uploadFn={uploadClanImageFile}
              />
            </div>
            {formError ? (
              <Alert variant="destructive">
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Creer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
