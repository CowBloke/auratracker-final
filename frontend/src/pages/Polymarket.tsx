import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { polymarketApi, uploadsApi, PolymarketEvent, PolymarketSuggestion, PolymarketBet } from '../services/api';
import {
  Loader2, Plus, Calendar,
  CheckCircle2, XCircle, DollarSign, Users,
  Check, X
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { readFileAsDataUrl } from '@/lib/uploads';
import { resolveImageUrl } from '@/lib/images';
import { toast } from '@/hooks/use-toast';

export default function Polymarket() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PolymarketEvent[]>([]);
  const [suggestions, setSuggestions] = useState<PolymarketSuggestion[]>([]);
  const [bets, setBets] = useState<PolymarketBet[]>([]);
  const [allBets, setAllBets] = useState<PolymarketBet[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'suggest' | 'history' | 'admin'>('events');
  const [betHistoryTab, setBetHistoryTab] = useState<'my' | 'all'>('my');
  
  // Suggestion dialog
  const [suggestionDialogOpen, setSuggestionDialogOpen] = useState(false);
  const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [eventDate, setEventDate] = useState('');
  
  // Bet dialog
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PolymarketEvent | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [betPrediction, setBetPrediction] = useState<'YES' | 'NO'>('YES');
  const [betSubmitting, setBetSubmitting] = useState(false);
  
  // Admin dialogs
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PolymarketSuggestion | null>(null);
  const [selectedEventForResolve, setSelectedEventForResolve] = useState<PolymarketEvent | null>(null);
  const [yesOdds, setYesOdds] = useState('');
  const [noOdds, setNoOdds] = useState('');
  const [resolution, setResolution] = useState<'YES' | 'NO'>('YES');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsRes, suggestionsRes, betsRes, allBetsRes] = await Promise.all([
        polymarketApi.getEvents(),
        polymarketApi.getSuggestions(),
        polymarketApi.getBets(),
        polymarketApi.getAllBets(50),
      ]);
      setEvents(eventsRes.data.events);
      setSuggestions(suggestionsRes.data.suggestions);
      setBets(betsRes.data.bets);
      setAllBets(allBetsRes.data.bets);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !eventDate) return;

    setSuggestionSubmitting(true);
    try {
      let uploadedUrl: string | undefined;
      if (imageInputMode === 'upload' && imageDataUrl) {
        const uploadRes = await uploadsApi.uploadImage({
          purpose: 'suggestion',
          imageData: imageDataUrl,
        });
        uploadedUrl = uploadRes.data.url;
      }
      if (imageInputMode === 'url' && imageUrl.trim()) {
        uploadedUrl = imageUrl.trim();
      }

      await polymarketApi.createSuggestion({
        title: title.trim(),
        description: description.trim(),
        imageUrl: uploadedUrl,
        eventDate,
      });
      
      toast({
        title: 'Suggestion créée',
        description: 'Votre suggestion a été soumise avec succès',
      });
      
      setTitle('');
      setDescription('');
      setImageDataUrl('');
      setImageUrl('');
      setEventDate('');
      setSuggestionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de créer la suggestion',
        variant: 'destructive',
      });
    } finally {
      setSuggestionSubmitting(false);
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedEvent || !betAmount || parseInt(betAmount) <= 0) return;

    setBetSubmitting(true);
    try {
      await polymarketApi.placeBet({
        eventId: selectedEvent.id,
        prediction: betPrediction,
        amount: parseInt(betAmount),
      });
      
      toast({
        title: 'Pari placé',
        description: `Vous avez parié ${betAmount} sur ${betPrediction === 'YES' ? 'Oui' : 'Non'}`,
      });
      
      setBetDialogOpen(false);
      setSelectedEvent(null);
      setBetAmount('');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de placer le pari',
        variant: 'destructive',
      });
    } finally {
      setBetSubmitting(false);
    }
  };

  const handleApproveSuggestion = async () => {
    if (!selectedSuggestion || !yesOdds || !noOdds) return;

    try {
      await polymarketApi.approveSuggestion(selectedSuggestion.id, {
        yesOdds: parseFloat(yesOdds),
        noOdds: parseFloat(noOdds),
      });
      
      toast({
        title: 'Suggestion approuvée',
        description: 'L\'événement a été créé avec succès',
      });
      
      setApproveDialogOpen(false);
      setSelectedSuggestion(null);
      setYesOdds('');
      setNoOdds('');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible d\'approuver la suggestion',
        variant: 'destructive',
      });
    }
  };

  const handleRejectSuggestion = async (id: string) => {
    try {
      await polymarketApi.rejectSuggestion(id);
      toast({
        title: 'Suggestion rejetée',
      });
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de rejeter la suggestion',
        variant: 'destructive',
      });
    }
  };

  const handleResolveEvent = async () => {
    if (!selectedEventForResolve) return;

    try {
      await polymarketApi.resolveEvent(selectedEventForResolve.id, resolution);
      toast({
        title: 'Événement résolu',
        description: `Résolution: ${resolution === 'YES' ? 'Oui' : 'Non'}`,
      });
      
      setResolveDialogOpen(false);
      setSelectedEventForResolve(null);
      setResolution('YES');
      fetchData();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de résoudre l\'événement',
        variant: 'destructive',
      });
    }
  };

  const openEvents = events.filter((e) => e.status === 'OPEN');
  const resolvedEvents = events.filter((e) => e.status === 'RESOLVED');
  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">
              Marché de prédiction
            </p>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight">
              Polymarket
            </h1>
          </div>
        </div>
      </header>

      <div className="h-px bg-border" />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="events">Événements</TabsTrigger>
          <TabsTrigger value="suggest">Suggérer</TabsTrigger>
          <TabsTrigger value="history">Mes paris</TabsTrigger>
          {user?.isAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="events" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Événements ouverts</h2>
            {user?.isAdmin && (
              <Button onClick={() => setCreateEventDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un événement
              </Button>
            )}
          </div>

          {openEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun événement ouvert pour le moment
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {openEvents.map((event) => {
                const userBet = bets.find((b) => b.eventId === event.id);
                const canBet = !userBet && event.status === 'OPEN' && new Date(event.eventDate) > new Date();
                
                return (
                  <Card key={event.id} className="overflow-hidden">
                    {event.imageUrl && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={resolveImageUrl(event.imageUrl)}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-xl">{event.title}</CardTitle>
                        <Badge variant={event.status === 'OPEN' ? 'default' : 'secondary'}>
                          {event.status === 'OPEN' ? 'Ouvert' : event.status}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {event.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(event.eventDate).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Oui</span>
                            <span className="font-semibold">{event.yesOdds.toFixed(2)}x</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{
                                width: `${(event.totalYes || 0) / ((event.totalVolume || 1) || 1) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {event.totalYes || 0} misé
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Non</span>
                            <span className="font-semibold">{event.noOdds.toFixed(2)}x</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500"
                              style={{
                                width: `${(event.totalNo || 0) / ((event.totalVolume || 1) || 1) * 100}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {event.totalNo || 0} misé
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          <span>{event.betCount || 0} paris</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          <span>{event.totalVolume || 0} total</span>
                        </div>
                      </div>

                      {userBet && (
                        <div className="p-3 bg-muted rounded-md">
                          <div className="text-sm font-medium">Votre pari</div>
                          <div className="text-xs text-muted-foreground">
                            {userBet.prediction === 'YES' ? 'Oui' : 'Non'} - {userBet.amount} misé
                          </div>
                        </div>
                      )}

                      {canBet && (
                        <Button
                          className="w-full"
                          onClick={() => {
                            setSelectedEvent(event);
                            setBetDialogOpen(true);
                          }}
                        >
                          Parier
                        </Button>
                      )}

                      {user?.isAdmin && event.status === 'OPEN' && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setSelectedEventForResolve(event);
                            setResolveDialogOpen(true);
                          }}
                        >
                          Résoudre
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {resolvedEvents.length > 0 && (
            <div className="space-y-4 mt-8">
              <h2 className="text-2xl font-semibold">Événements résolus</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {resolvedEvents.slice(0, 6).map((event) => (
                  <Card key={event.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{event.title}</CardTitle>
                        <Badge variant="secondary">
                          {event.resolution === 'YES' ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {event.resolution}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Résolu le {new Date(event.resolvedAt!).toLocaleDateString('fr-FR')}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggest" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Suggérer un événement</h2>
            <Button onClick={() => setSuggestionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle suggestion
            </Button>
          </div>

          <div className="space-y-4">
            {suggestions.filter((s) => s.userId === user?.id).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Vous n'avez pas encore de suggestions
                </CardContent>
              </Card>
            ) : (
              suggestions
                .filter((s) => s.userId === user?.id)
                .map((suggestion) => (
                  <Card key={suggestion.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{suggestion.title}</CardTitle>
                          <CardDescription>{suggestion.description}</CardDescription>
                        </div>
                        <Badge
                          variant={
                            suggestion.status === 'APPROVED'
                              ? 'default'
                              : suggestion.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {suggestion.status === 'PENDING' && 'En attente'}
                          {suggestion.status === 'APPROVED' && 'Approuvée'}
                          {suggestion.status === 'REJECTED' && 'Rejetée'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        Date de l'événement: {new Date(suggestion.eventDate).toLocaleDateString('fr-FR')}
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Historique des paris</h2>
          </div>

          <div className="flex gap-4 border-b border-border/30">
            <button
              onClick={() => setBetHistoryTab('my')}
              className={cn(
                "pb-2 text-sm transition-colors",
                betHistoryTab === 'my'
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mes paris
            </button>
            <button
              onClick={() => setBetHistoryTab('all')}
              className={cn(
                "pb-2 text-sm transition-colors",
                betHistoryTab === 'all'
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tous les paris
            </button>
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {(betHistoryTab === 'my' ? bets : allBets).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {betHistoryTab === 'my' 
                    ? 'Vous n\'avez pas encore de paris'
                    : 'Aucun pari'}
                </CardContent>
              </Card>
            ) : (
              (betHistoryTab === 'my' ? bets : allBets).map((bet) => {
                const isResolved = bet.event?.status === 'RESOLVED';
                const isWinner = bet.event?.resolution === bet.prediction;
                const potentialPayout = bet.prediction === 'YES' 
                  ? Math.floor(bet.amount * (bet.event?.yesOdds || 1))
                  : Math.floor(bet.amount * (bet.event?.noOdds || 1));

                return (
                  <div
                    key={bet.id}
                    className="flex items-center justify-between py-3 border-b border-border/10"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={cn(
                        "w-8 h-8 flex items-center justify-center border rounded",
                        bet.prediction === 'YES'
                          ? "border-green-500/30 text-green-500"
                          : "border-red-500/30 text-red-500"
                      )}>
                        {bet.prediction === 'YES' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {betHistoryTab === 'all' && bet.user && (
                            <span
                              className="text-sm font-medium"
                              style={{ color: bet.user.usernameColor || undefined }}
                            >
                              {bet.user.username}
                            </span>
                          )}
                          <span className={cn(
                            "text-xs uppercase",
                            bet.prediction === 'YES' ? "text-green-500" : "text-red-500"
                          )}>
                            {bet.prediction === 'YES' ? 'Oui' : 'Non'}
                          </span>
                          <span className="text-sm text-muted-foreground truncate">
                            {bet.event?.title || 'Événement supprimé'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(bet.createdAt).toLocaleString('fr-FR')}
                        </p>
                        {isResolved && (
                          <p className={cn(
                            "text-xs font-medium mt-1",
                            isWinner ? "text-green-500" : "text-red-500"
                          )}>
                            {isWinner ? (
                              <>✓ Gagné: {bet.payout} reçu</>
                            ) : (
                              <>✗ Perdu: {bet.amount} perdu</>
                            )}
                          </p>
                        )}
                        {!isResolved && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Gain potentiel: {potentialPayout} ({potentialPayout - bet.amount} de profit)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm tabular-nums font-medium">
                        {bet.amount}
                      </p>
                      {bet.event && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          @ {bet.prediction === 'YES' ? bet.event.yesOdds.toFixed(2) : bet.event.noOdds.toFixed(2)}x
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        {user?.isAdmin && (
          <TabsContent value="admin" className="space-y-6 mt-6">
            <h2 className="text-2xl font-semibold">Administration</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Suggestions en attente</h3>
                {pendingSuggestions.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Aucune suggestion en attente
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingSuggestions.map((suggestion) => (
                      <Card key={suggestion.id}>
                        <CardHeader>
                          <CardTitle>{suggestion.title}</CardTitle>
                          <CardDescription>{suggestion.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {suggestion.imageUrl && (
                            <img
                              src={resolveImageUrl(suggestion.imageUrl)}
                              alt={suggestion.title}
                              className="w-full h-48 object-cover rounded-md"
                            />
                          )}
                          <div className="text-sm text-muted-foreground">
                            Date: {new Date(suggestion.eventDate).toLocaleDateString('fr-FR')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Par: {suggestion.user.username}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedSuggestion(suggestion);
                                setApproveDialogOpen(true);
                              }}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectSuggestion(suggestion.id)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Rejeter
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Suggestion Dialog */}
      <Dialog open={suggestionDialogOpen} onOpenChange={setSuggestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle suggestion</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSuggestion} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Le Bitcoin atteindra 100k$ en 2024"
                maxLength={200}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'événement..."
                maxLength={2000}
                rows={4}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Date de réalisation</label>
              <Input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Image (optionnel)</label>
              <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as any)}>
                <TabsList>
                  <TabsTrigger value="upload">Upload</TabsTrigger>
                  <TabsTrigger value="url">URL</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const dataUrl = await readFileAsDataUrl(file);
                        setImageDataUrl(dataUrl);
                      }
                    }}
                  />
                  {imageDataUrl && (
                    <img src={imageDataUrl} alt="Preview" className="w-full h-48 object-cover rounded-md" />
                  )}
                </TabsContent>
                <TabsContent value="url" className="space-y-2">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </TabsContent>
              </Tabs>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSuggestionDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={suggestionSubmitting}>
                {suggestionSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  'Soumettre'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bet Dialog */}
      <Dialog open={betDialogOpen} onOpenChange={setBetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Placer un pari</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div>
                <div className="font-semibold">{selectedEvent.title}</div>
                <div className="text-sm text-muted-foreground">{selectedEvent.description}</div>
              </div>
              <div>
                <label className="text-sm font-medium">Prédiction</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    type="button"
                    variant={betPrediction === 'YES' ? 'default' : 'outline'}
                    onClick={() => setBetPrediction('YES')}
                    className="w-full"
                  >
                    Oui ({selectedEvent.yesOdds.toFixed(2)}x)
                  </Button>
                  <Button
                    type="button"
                    variant={betPrediction === 'NO' ? 'default' : 'outline'}
                    onClick={() => setBetPrediction('NO')}
                    className="w-full"
                  >
                    Non ({selectedEvent.noOdds.toFixed(2)}x)
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Montant</label>
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="Montant à miser"
                  min={1}
                  max={user?.money || 0}
                  required
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Solde disponible: {user?.money || 0}
                </div>
                {betAmount && parseInt(betAmount) > 0 && (
                  <div className="text-sm mt-2">
                    Gain potentiel: {Math.floor(parseInt(betAmount) * (betPrediction === 'YES' ? selectedEvent.yesOdds : selectedEvent.noOdds))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setBetDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handlePlaceBet} disabled={betSubmitting || !betAmount || parseInt(betAmount) <= 0}>
                  {betSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Parier'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Suggestion Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver la suggestion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Cote Oui</label>
              <Input
                type="number"
                value={yesOdds}
                onChange={(e) => setYesOdds(e.target.value)}
                placeholder="1.5"
                step="0.1"
                min="1.01"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cote Non</label>
              <Input
                type="number"
                value={noOdds}
                onChange={(e) => setNoOdds(e.target.value)}
                placeholder="2.0"
                step="0.1"
                min="1.01"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleApproveSuggestion} disabled={!yesOdds || !noOdds}>
                Approuver
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resolve Event Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Résoudre l'événement</DialogTitle>
          </DialogHeader>
          {selectedEventForResolve && (
            <div className="space-y-4">
              <div>
                <div className="font-semibold">{selectedEventForResolve.title}</div>
              </div>
              <div>
                <label className="text-sm font-medium">Résolution</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button
                    type="button"
                    variant={resolution === 'YES' ? 'default' : 'outline'}
                    onClick={() => setResolution('YES')}
                    className="w-full"
                  >
                    Oui
                  </Button>
                  <Button
                    type="button"
                    variant={resolution === 'NO' ? 'default' : 'outline'}
                    onClick={() => setResolution('NO')}
                    className="w-full"
                  >
                    Non
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setResolveDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleResolveEvent}>
                  Résoudre
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog (Admin) */}
      <Dialog open={createEventDialogOpen} onOpenChange={setCreateEventDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un événement</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = {
                title: formData.get('title') as string,
                description: formData.get('description') as string,
                imageUrl: formData.get('imageUrl') as string || undefined,
                eventDate: formData.get('eventDate') as string,
                yesOdds: parseFloat(formData.get('yesOdds') as string),
                noOdds: parseFloat(formData.get('noOdds') as string),
              };
              try {
                await polymarketApi.createEvent(data);
                toast({
                  title: 'Événement créé',
                  description: 'L\'événement a été créé avec succès',
                });
                setCreateEventDialogOpen(false);
                fetchData();
              } catch (error: any) {
                toast({
                  title: 'Erreur',
                  description: error.response?.data?.error || 'Impossible de créer l\'événement',
                  variant: 'destructive',
                });
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input name="title" required maxLength={200} />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea name="description" required maxLength={2000} rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium">Date de réalisation</label>
              <Input name="eventDate" type="datetime-local" required />
            </div>
            <div>
              <label className="text-sm font-medium">Image URL (optionnel)</label>
              <Input name="imageUrl" type="url" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cote Oui</label>
                <Input name="yesOdds" type="number" step="0.1" min="1.01" required />
              </div>
              <div>
                <label className="text-sm font-medium">Cote Non</label>
                <Input name="noOdds" type="number" step="0.1" min="1.01" required />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateEventDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
