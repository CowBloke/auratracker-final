import { useEffect, useMemo, useState } from 'react';
import { Crown, Globe, ImageIcon, Loader2, Lock, Plus, ShieldCheck, Users, X, Check } from 'lucide-react';
import { clansApi, ClanDetail, ClanSummary, uploadsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { readFileAsDataUrl } from '@/lib/uploads';
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
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [imageDataUrl, setImageDataUrl] = useState('');
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
    setImageInputMode('upload');
    setImageDataUrl('');
    setImageUrl('');
    setFormError(null);
  };

  const handleImageFile = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setFormError(null);
    } catch (error) {
      console.error('Failed to read image:', error);
      setFormError("L'image est trop lourde ou invalide.");
    }
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
      let finalImageUrl: string | undefined;
      if (imageInputMode === 'upload' && imageDataUrl) {
        const uploadResponse = await uploadsApi.uploadImage({ purpose: 'profile', imageData: imageDataUrl });
        finalImageUrl = uploadResponse.data.url;
      }
      if (imageInputMode === 'url' && imageUrl.trim()) {
        finalImageUrl = imageUrl.trim();
      }

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

  const selectedClanSummary = useMemo(
    () => clans.find((clan) => clan.id === selectedClanId) || null,
    [clans, selectedClanId]
  );

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 space-y-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground tracking-wide uppercase">Communautes</p>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight">Clans</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Creer un clan (100$)
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
            <DialogTitle>Creer un clan</DialogTitle>
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
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Clan public</p>
                  <p className="text-xs text-muted-foreground">Ouvert a tous sans validation</p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={imageInputMode === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageInputMode('upload')}
                  >
                    Upload
                  </Button>
                  <Button
                    type="button"
                    variant={imageInputMode === 'url' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setImageInputMode('url')}
                  >
                    URL
                  </Button>
                </div>
                {imageInputMode === 'upload' ? (
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) handleImageFile(file);
                      }}
                    />
                    {imageDataUrl ? (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                        Image chargee
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(event) => setImageUrl(event.target.value)}
                  />
                )}
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
      </header>

      {message ? (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{message.type === 'error' ? 'Erreur' : 'Info'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Tous les clans</h2>
            <Badge variant="outline">{clans.length}</Badge>
          </div>
          {loading ? (
            <div className="py-10 text-sm text-muted-foreground">Chargement...</div>
          ) : clans.length === 0 ? (
            <div className="py-10 text-sm text-muted-foreground">Aucun clan pour le moment.</div>
          ) : (
            <div className="space-y-3">
              {clans.map((clan) => (
                <Card
                  key={clan.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedClanId(clan.id)}
                  className={cn(
                    "cursor-pointer border-border/60 transition hover:border-aura/50 hover:shadow-sm",
                    clan.id === selectedClanId && "border-aura/80 shadow-sm"
                  )}
                >
                  <CardContent className="flex items-start gap-4 py-4">
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
                        <Badge variant={clan.isPublic ? 'default' : 'secondary'}>
                          {clan.isPublic ? 'Public' : 'Prive'}
                        </Badge>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
            <h2 className="text-lg font-medium">Details du clan</h2>
          {detailLoading ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">Chargement...</CardContent>
            </Card>
          ) : selectedClan ? (
            <Card>
              <CardHeader className="space-y-4">
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
                      <CardTitle className="text-2xl">{selectedClan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Chef: <span style={selectedClan.leader.usernameColor ? { color: selectedClan.leader.usernameColor } : undefined}>
                          {selectedClan.leader.username}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={selectedClan.isPublic ? 'default' : 'secondary'}>
                      {selectedClan.isPublic ? (
                        <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Public</span>
                      ) : (
                        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Prive</span>
                      )}
                    </Badge>
                    {selectedClan.viewer.isLeader ? (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Crown className="h-3 w-3" /> Chef
                      </Badge>
                    ) : selectedClan.viewer.isMember ? (
                      <Badge variant="outline">Membre</Badge>
                    ) : selectedClan.viewer.hasPendingRequest ? (
                      <Badge variant="outline">Demande en attente</Badge>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedClan.description || 'Aucune description.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Membres</p>
                    <p className="text-lg font-semibold">{selectedClan.memberCount}/{selectedClan.maxMembers}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Aura totale</p>
                    <p className="text-lg font-semibold">{formatAura(selectedClan.totalAura)}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Creation</p>
                    <p className="text-lg font-semibold">{formatDate(selectedClan.createdAt)}</p>
                  </div>
                </div>
                {!selectedClan.viewer.isMember && !selectedClan.viewer.hasPendingRequest ? (
                  <Button onClick={handleJoin} disabled={actionLoading}>
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedClan.isPublic ? 'Rejoindre' : 'Demander'}
                  </Button>
                ) : null}
              </CardHeader>
              <Separator />
              <CardContent className="space-y-6 py-6">
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">Membres (classement aura)</h3>
                  <div className="space-y-2">
                    {selectedClan.members.map((member, index) => (
                      <div
                        key={member.id}
                        className={cn(
                          "flex items-center justify-between rounded-md border border-border/60 px-3 py-2",
                          member.userId === selectedClan.leader.id && "border-aura/60 bg-aura/10"
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
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {formatAura(member.aura)} aura
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedClan.viewer.isLeader ? (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold">Demandes en attente</h3>
                    {selectedClan.joinRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedClan.joinRequests.map((request) => (
                          <div
                            key={request.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRequestAction(request.id, 'reject')}
                                disabled={actionLoading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleRequestAction(request.id, 'accept')}
                                disabled={actionLoading}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : selectedClanSummary ? (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">
                Clique sur un clan pour voir les details.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-10 text-sm text-muted-foreground">
                Aucun clan selectionne.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
