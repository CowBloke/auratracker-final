import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, ShieldCheck, Users, X, Check, UserX, Crown, LogOut } from 'lucide-react';
import { clansApi, ClanDetail, ClanSummary } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';

type ActionMessage = { type: 'success' | 'error'; text: string };

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
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
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

  const fetchClans = async () => {
    try {
      setLoading(true);
      const res = await clansApi.list();
      setClans(res.data.clans || []);
    } catch (error) {
      console.error('Failed to fetch clans:', error);
      setMessage({ type: 'error', text: 'Impossible de charger les clans.' });
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
      setMessage({ type: 'error', text: 'Impossible de charger ce clan.' });
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


  const handleCreateClan = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setMessage(null);

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
      setMessage({ type: 'success', text: 'Clan cree avec succes.' });
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
    setMessage(null);
    try {
      const res = await clansApi.join(selectedClan.id);
      if (res.data.status === 'joined') {
        setMessage({ type: 'success', text: 'Tu as rejoint le clan.' });
      } else {
        setMessage({ type: 'success', text: 'Demande envoyee au chef du clan.' });
      }
      await Promise.all([fetchClans(), fetchClanDetail(selectedClan.id)]);
    } catch (error: any) {
      console.error('Failed to join clan:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Impossible de rejoindre le clan.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    if (!selectedClan) return;
    setActionLoading(true);
    setMessage(null);
    try {
      if (action === 'accept') {
        await clansApi.acceptRequest(selectedClan.id, requestId);
        setMessage({ type: 'success', text: 'Demande acceptee.' });
      } else {
        await clansApi.rejectRequest(selectedClan.id, requestId);
        setMessage({ type: 'success', text: 'Demande refusee.' });
      }
      await Promise.all([fetchClans(), fetchClanDetail(selectedClan.id)]);
    } catch (error: any) {
      console.error('Failed to update request:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Impossible de traiter la demande.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedClan) return;
    setActionLoading(true);
    setMessage(null);
    try {
      await clansApi.removeMember(selectedClan.id, userId);
      setMessage({ type: 'success', text: 'Membre retire du clan.' });
      await Promise.all([fetchClans(), fetchClanDetail(selectedClan.id)]);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Impossible de retirer ce membre.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!selectedClan) return;
    if (!confirm('Es-tu sur de vouloir quitter ce clan ?')) return;
    setActionLoading(true);
    setMessage(null);
    try {
      await clansApi.leave(selectedClan.id);
      setMessage({ type: 'success', text: 'Tu as quitte le clan.' });
      await fetchClans();
      setSelectedClanId(null);
      setSelectedClan(null);
    } catch (error: any) {
      console.error('Failed to leave clan:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Impossible de quitter le clan.' });
    } finally {
      setActionLoading(false);
    }
  };

  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) || null,
    [clans, selectedClanId]
  );

  return (
    <>
      <PageShell>
        <div className={SPACING.PAGE_CONTENT}>
          <div className="flex items-center justify-between gap-3">
            <p className={TYPOGRAPHY.SMALL}>Crée un clan ou consulte les groupes existants.</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer
            </Button>
          </div>

          {message ? (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>{message.type === 'error' ? 'Erreur' : 'Info'}</AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <div className={SPACING.CARD_SPACING}>
            <div className="flex items-center justify-between">
              <h2 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>Tous les clans</h2>
              <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>{clans.length}</span>
            </div>
            {loading ? (
              <div className={cn(TYPOGRAPHY.MUTED, "py-10")}>Chargement...</div>
            ) : clans.length === 0 ? (
              <div className={cn(TYPOGRAPHY.MUTED, "py-10")}>Aucun clan pour le moment.</div>
            ) : (
              <div className="space-y-3">
                {clans.map((clan) => (
                  <Card
                    key={clan.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedClanId(clan.id)}
                    className={cn(
                      "cursor-pointer transition-colors hover:border-foreground/30",
                      clan.id === selectedClanId && "bg-muted/30 border-foreground/50"
                    )}
                  >
                    <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      {clan.imageUrl ? (
                        <AvatarImage src={resolveImageUrl(clan.imageUrl)} alt={clan.name} />
                      ) : null}
                      <AvatarFallback className="bg-muted text-sm font-semibold">
                        {clan.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className={TYPOGRAPHY.H6}>{clan.name}</h3>
                            <p className={TYPOGRAPHY.XS}>
                              Chef: <span style={clan.leader.usernameColor ? { color: clan.leader.usernameColor } : undefined}>
                                {clan.leader.username}
                              </span>
                            </p>
                          </div>
                          <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>
                            {clan.isPublic ? 'Public' : 'Prive'}
                          </span>
                        </div>
                        <p className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground line-clamp-2")}>
                          {clan.description || 'Aucune description.'}
                        </p>
                        <div className={cn("flex flex-wrap gap-3", TYPOGRAPHY.XS, "text-muted-foreground")}>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {clan.memberCount}/{clan.maxMembers}
                          </span>
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> {formatAura(clan.totalAura)} aura
                          </span>
                          <span>{formatDate(clan.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className={SPACING.SECTION_SPACING}>
            <h2 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>Details du clan</h2>
            {detailLoading ? (
              <div className={cn(TYPOGRAPHY.MUTED, "py-12 text-center")}>Chargement...</div>
            ) : selectedClan ? (
              <div className={SPACING.SECTION_SPACING}>
                <Card>
                  <CardContent className={`p-6 ${SPACING.CARD_SPACING}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14">
                          {selectedClan.imageUrl ? (
                            <AvatarImage src={resolveImageUrl(selectedClan.imageUrl)} alt={selectedClan.name} />
                          ) : null}
                          <AvatarFallback className="bg-muted text-lg font-semibold">
                            {selectedClan.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h2 className={TYPOGRAPHY.H2}>{selectedClan.name}</h2>
                          <p className={TYPOGRAPHY.SMALL}>
                            Chef: <span style={selectedClan.leader.usernameColor ? { color: selectedClan.leader.usernameColor } : undefined}>
                              {selectedClan.leader.username}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>
                          {selectedClan.isPublic ? 'Public' : 'Prive'}
                        </span>
                        {selectedClan.viewer.isLeader && (
                          <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>
                            Chef
                          </span>
                        )}
                        {selectedClan.viewer.isMember && !selectedClan.viewer.isLeader && (
                          <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>
                            Membre
                          </span>
                        )}
                        {selectedClan.viewer.hasPendingRequest && (
                          <span className={cn(TYPOGRAPHY.XS, "text-muted-foreground  ")}>
                            Demande en attente
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={TYPOGRAPHY.SMALL}>
                      {selectedClan.description || 'Aucune description.'}
                    </p>
                    <div className="grid gap-8 sm:grid-cols-3">
                      <div className="space-y-1">
                        <p className={cn(TYPOGRAPHY.H1, "tabular-nums")}>{selectedClan.memberCount}/{selectedClan.maxMembers}</p>
                        <p className={TYPOGRAPHY.SMALL}>Membres</p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn(TYPOGRAPHY.H1, "tabular-nums")}>{formatAura(selectedClan.totalAura)}</p>
                        <p className={TYPOGRAPHY.SMALL}>Aura totale</p>
                      </div>
                      <div className="space-y-1">
                        <p className={cn(TYPOGRAPHY.H1, "tabular-nums")}>{formatDate(selectedClan.createdAt)}</p>
                        <p className={TYPOGRAPHY.SMALL}>Creation</p>
                      </div>
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
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className={`p-6 ${SPACING.SECTION_SPACING}`}>
                    <div className={SPACING.CARD_SPACING}>
                      <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>Membres (classement aura)</h3>
                      <div className="space-y-3">
                        {selectedClan.members.map((member, index) => (
                          <Card
                            key={member.id}
                            className={cn(
                              "",
                              member.userId === selectedClan.leader.id && "bg-muted/30 border-foreground/50"
                            )}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className={cn("w-6", TYPOGRAPHY.XS, "text-muted-foreground tabular-nums")}>#{index + 1}</span>
                                  <Avatar className="h-9 w-9">
                                    {member.profilePicture ? (
                                      <AvatarImage src={resolveImageUrl(member.profilePicture)} alt={member.username} />
                                    ) : null}
                                    <AvatarFallback className="bg-muted">
                                      {member.username.slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p
                                      className={TYPOGRAPHY.SMALL}
                                      style={member.usernameColor ? { color: member.usernameColor } : undefined}
                                    >
                                      {member.username}
                                      {member.isLeader && <Crown className="ml-2 inline h-3 w-3 text-aura" />}
                                    </p>
                                    <p className={TYPOGRAPHY.XS}>Arrive le {formatDate(member.joinedAt)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground tabular-nums")}>
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
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {selectedClan.viewer.isLeader && (
                      <div className={SPACING.CARD_SPACING}>
                        <h3 className={cn(TYPOGRAPHY.SMALL, "text-muted-foreground  ")}>Demandes en attente</h3>
                        {selectedClan.joinRequests.length === 0 ? (
                          <p className={TYPOGRAPHY.SMALL}>Aucune demande pour le moment.</p>
                        ) : (
                          <div className="space-y-3">
                            {selectedClan.joinRequests.map((request) => (
                              <Card
                                key={request.id}
                               
                              >
                                <CardContent className="p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-8 w-8">
                                        {request.profilePicture ? (
                                          <AvatarImage src={resolveImageUrl(request.profilePicture)} alt={request.username} />
                                        ) : null}
                                        <AvatarFallback className="bg-muted">
                                          {request.username.slice(0, 1).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p
                                          className={TYPOGRAPHY.SMALL}
                                          style={request.usernameColor ? { color: request.usernameColor } : undefined}
                                        >
                                          {request.username}
                                        </p>
                                        <p className={TYPOGRAPHY.XS}>
                                          {formatAura(request.aura)} aura - {formatDate(request.requestedAt)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : selectedClanSummary ? (
              <div className={cn(TYPOGRAPHY.MUTED, "py-12 text-center")}>
                Clique sur un clan pour voir les details.
              </div>
            ) : (
              <div className={cn(TYPOGRAPHY.MUTED, "py-12 text-center")}>
                Aucun clan selectionne.
              </div>
            )}
          </div>
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
            <div className="space-y-3">
              <Input
                placeholder="https://..."
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
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
