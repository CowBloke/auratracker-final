import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { cemantixApi } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Trophy, Clock, Users, TrendingUp, Target, BarChart3, Award } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface Attempt {
  guess: string;
  similarity: number;
  attemptNumber: number;
}

interface Stats {
  id: string;
  userId: string;
  totalGames: number;
  totalWins: number;
  currentStreak: number;
  longestStreak: number;
  averageAttempts: number;
  totalAttempts: number;
  lastPlayedDate: string | null;
  user: {
    id: string;
    username: string;
  };
}

export default function Cemantix() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [hasFound, setHasFound] = useState(false);
  const [word, setWord] = useState<string | null>(null);
  const [foundCount, setFoundCount] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<Stats[]>([]);
  const [activeTab, setActiveTab] = useState('play');

  // Load today's word info
  const loadToday = async () => {
    try {
      const response = await cemantixApi.getToday();
      setAttempts(response.data.attempts);
      setHasFound(response.data.hasFound);
      setWord(response.data.word);
      setFoundCount(response.data.foundCount);
      setCountdown(response.data.countdown);
    } catch (error: any) {
      console.error('Error loading today:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de charger les informations du jour',
        variant: 'destructive',
      });
    }
  };

  // Load stats
  const loadStats = async () => {
    if (!user) return;
    try {
      const response = await cemantixApi.getStats(user.id);
      setStats(response.data.stats);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    }
  };

  // Load leaderboard
  const loadLeaderboard = async () => {
    try {
      const response = await cemantixApi.getLeaderboard({ limit: 20, sortBy: 'totalWins' });
      setLeaderboard(response.data.rankings);
    } catch (error: any) {
      console.error('Error loading leaderboard:', error);
    }
  };

  useEffect(() => {
    loadToday();
    if (user) {
      loadStats();
    }
    loadLeaderboard();
    
    // Update countdown every second
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1000) {
          // Reload when countdown reaches 0
          loadToday();
          loadLeaderboard();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Format countdown
  const formatCountdown = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get similarity color
  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 90) return 'text-green-500';
    if (similarity >= 70) return 'text-yellow-500';
    if (similarity >= 50) return 'text-orange-500';
    return 'text-red-500';
  };

  // Get similarity background color
  const getSimilarityBgColor = (similarity: number) => {
    if (similarity >= 90) return 'bg-green-500/20 border-green-500/50';
    if (similarity >= 70) return 'bg-yellow-500/20 border-yellow-500/50';
    if (similarity >= 50) return 'bg-orange-500/20 border-orange-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  // Submit guess
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || loading || hasFound) return;

    setLoading(true);
    try {
      const response = await cemantixApi.submitGuess(guess.trim());
      
      if (response.data.isCorrect) {
        setHasFound(true);
        setWord(response.data.word || null);
        setAttempts(prev => [...prev, {
          guess: guess.trim(),
          similarity: 100,
          attemptNumber: response.data.attemptNumber,
        }]);
        
        toast({
          title: 'Bravo! 🎉',
          description: `Vous avez trouvé le mot en ${response.data.attemptNumber} tentative${response.data.attemptNumber > 1 ? 's' : ''}! +${response.data.auraReward} Aura, +${response.data.moneyReward} Money`,
        });
        
        // Reload stats and leaderboard
        loadStats();
        loadLeaderboard();
        loadToday(); // Refresh found count
      } else {
        setAttempts(prev => [...prev, {
          guess: guess.trim(),
          similarity: response.data.similarity,
          attemptNumber: response.data.attemptNumber,
        }]);
      }
      
      setGuess('');
    } catch (error: any) {
      console.error('Error submitting guess:', error);
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Impossible de soumettre votre tentative',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cemantix</h1>
        <p className="text-muted-foreground">
          Devinez le mot du jour en proposant des mots et en recevant des indices de similarité sémantique.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="play">Jouer</TabsTrigger>
          <TabsTrigger value="stats">Statistiques</TabsTrigger>
          <TabsTrigger value="leaderboard">Classement</TabsTrigger>
        </TabsList>

        <TabsContent value="play" className="space-y-4">
          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Nouveau mot dans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCountdown(countdown)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Ont trouvé aujourd'hui
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{foundCount}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Vos tentatives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attempts.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Game area */}
          <Card>
            <CardHeader>
              <CardTitle>Devinez le mot</CardTitle>
              <CardDescription>
                {hasFound 
                  ? `Félicitations! Le mot était "${word}". Revenez demain pour un nouveau défi!`
                  : 'Proposez un mot et découvrez sa similarité avec le mot secret.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasFound && word && (
                <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                  <p className="text-lg font-semibold text-green-500">Mot trouvé: {word}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value.toLowerCase())}
                  placeholder="Entrez un mot..."
                  disabled={loading || hasFound}
                  maxLength={12}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || hasFound || !guess.trim()}>
                  {loading ? 'Envoi...' : 'Deviner'}
                </Button>
              </form>

              {attempts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Vos tentatives:</h3>
                  <div className="space-y-2">
                    {attempts.map((attempt, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${getSimilarityBgColor(attempt.similarity)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm text-muted-foreground">
                              #{attempt.attemptNumber}
                            </span>
                            <span className="font-semibold">{attempt.guess}</span>
                          </div>
                          <span className={`font-bold ${getSimilarityColor(attempt.similarity)}`}>
                            {attempt.similarity.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    Victoires
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalWins}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    sur {stats.totalGames} parties
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Série actuelle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.currentStreak}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Meilleure série: {stats.longestStreak}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Moyenne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.averageAttempts > 0 ? stats.averageAttempts.toFixed(1) : '-'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    tentatives par mot
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Total tentatives
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalAttempts}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    depuis le début
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Aucune statistique disponible
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Classement</CardTitle>
              <CardDescription>
                Classement par nombre de victoires
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{entry.user.username}</div>
                          <div className="text-xs text-muted-foreground">
                            {entry.totalWins} victoire{entry.totalWins > 1 ? 's' : ''} • 
                            Série: {entry.currentStreak} • 
                            Moyenne: {entry.averageAttempts > 0 ? entry.averageAttempts.toFixed(1) : '-'}
                          </div>
                        </div>
                      </div>
                      {index < 3 && (
                        <Award className={`h-5 w-5 ${
                          index === 0 ? 'text-yellow-500' :
                          index === 1 ? 'text-gray-400' :
                          'text-orange-600'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Aucun classement disponible
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
