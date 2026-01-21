import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, ShieldCheck, Users, X, Check, UserX, Crown } from 'lucide-react';
import { clansApi, ClanDetail, ClanSummary } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';

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

  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) || null,
    [clans, selectedClanId]
  );

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">Communautes</p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">Clans</h1>
          </div>
          <button 
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            <Plus className="h-4 w-4" />
            Creer un clan (100$)
          </button>
        </div>
      </header>

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
              <label className="text-sm font-medium">Nom du clan</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                maxLength={300}
              />
            </div>
            <div className="flex items-center justify-between border border-border/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Clan public</p>
                <p className="text-xs text-muted-foreground">Ouvert a tous sans validation</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
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
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Creer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {message ? (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{message.type === 'error' ? 'Erreur' : 'Info'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">Tous les clans</h2>
            <span className="text-sm text-muted-foreground tabular-nums">{clans.length}</span>
          </div>
          {loading ? (
            <div className="py-10 text-sm text-muted-foreground">Chargement...</div>
          ) : clans.length === 0 ? (
            <div className="py-10 text-sm text-muted-foreground">Aucun clan pour le moment.</div>
          ) : (
            <div className="space-y-3">
              {clans.map((clan) => (
                <div
                  key={clan.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedClanId(clan.id)}
                  className={cn(
                    "cursor-pointer border border-border rounded-lg p-4 transition-colors hover:border-foreground/30",
                    clan.id === selectedClanId && "bg-muted/30 border-foreground/50"
                  )}
                >
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
                          <h3 className="text-base font-semibold">{clan.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Chef: <span style={clan.leader.usernameColor ? { color: clan.leader.usernameColor } : undefined}>
                              {clan.leader.username}
                            </span>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          {clan.isPublic ? 'Public' : 'Prive'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {clan.description || 'Aucune description.'}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
            <h2 className="text-sm text-muted-foreground tracking-wide uppercase">Details du clan</h2>
          {detailLoading ? (
            <div className="py-12 text-sm text-muted-foreground text-center">Chargement...</div>
          ) : selectedClan ? (
            <div className="space-y-6">
              <div className="space-y-4 border border-border rounded-lg p-6">
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
                      <h2 className="text-2xl font-light">{selectedClan.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        Chef: <span style={selectedClan.leader.usernameColor ? { color: selectedClan.leader.usernameColor } : undefined}>
                          {selectedClan.leader.username}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      {selectedClan.isPublic ? 'Public' : 'Prive'}
                    </span>
                    {selectedClan.viewer.isLeader && (
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Chef
                      </span>
                    )}
                    {selectedClan.viewer.isMember && !selectedClan.viewer.isLeader && (
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Membre
                      </span>
                    )}
                    {selectedClan.viewer.hasPendingRequest && (
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Demande en attente
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedClan.description || 'Aucune description.'}
                </p>
                <div className="grid gap-8 sm:grid-cols-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-4xl md:text-5xl font-light tabular-nums">{selectedClan.memberCount}/{selectedClan.maxMembers}</p>
                    <p className="text-sm text-muted-foreground">Membres</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-4xl md:text-5xl font-light tabular-nums">{formatAura(selectedClan.totalAura)}</p>
                    <p className="text-sm text-muted-foreground">Aura totale</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-4xl md:text-5xl font-light tabular-nums">{formatDate(selectedClan.createdAt)}</p>
                    <p className="text-sm text-muted-foreground">Creation</p>
                  </div>
                </div>
                {!selectedClan.viewer.isMember && !selectedClan.viewer.hasPendingRequest && (
                  <button
                    onClick={handleJoin}
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedClan.isPublic ? 'Rejoindre' : 'Demander'}
                  </button>
                )}
              </div>
              <div className="border border-border rounded-lg p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm text-muted-foreground tracking-wide uppercase">Membres (classement aura)</h3>
                  <div className="space-y-3">
                    {selectedClan.members.map((member, index) => (
                      <div
                        key={member.id}
                        className={cn(
                          "flex items-center justify-between border border-border rounded-lg p-4",
                          member.userId === selectedClan.leader.id && "bg-muted/30 border-foreground/50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-xs text-muted-foreground tabular-nums">#{index + 1}</span>
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
                              className="text-sm font-medium"
                              style={member.usernameColor ? { color: member.usernameColor } : undefined}
                            >
                              {member.username}
                              {member.isLeader && <Crown className="ml-2 inline h-3 w-3 text-aura" />}
                            </p>
                            <p className="text-xs text-muted-foreground">Arrive le {formatDate(member.joinedAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {formatAura(member.aura)} aura
                          </span>
                          {selectedClan.viewer.isLeader && !member.isLeader && (
                            <button
                              onClick={() => handleRemoveMember(member.userId)}
                              disabled={actionLoading}
                              className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedClan.viewer.isLeader && (
                  <div className="space-y-4 border border-border rounded-lg p-6">
                    <h3 className="text-sm text-muted-foreground tracking-wide uppercase">Demandes en attente</h3>
                    {selectedClan.joinRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedClan.joinRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-lg p-4"
                          >
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
                                  className="text-sm font-medium"
                                  style={request.usernameColor ? { color: request.usernameColor } : undefined}
                                >
                                  {request.username}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatAura(request.aura)} aura - {formatDate(request.requestedAt)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRequestAction(request.id, 'reject')}
                                disabled={actionLoading}
                                className="px-3 py-1 text-xs border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleRequestAction(request.id, 'accept')}
                                disabled={actionLoading}
                                className="px-3 py-1 text-xs border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : selectedClanSummary ? (
            <div className="py-12 text-sm text-muted-foreground text-center">
              Clique sur un clan pour voir les details.
            </div>
          ) : (
            <div className="py-12 text-sm text-muted-foreground text-center">
              Aucun clan selectionne.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
