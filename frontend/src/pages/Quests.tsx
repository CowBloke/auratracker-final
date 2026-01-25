import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import PageLayout from '@/components/layout/PageLayout';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { questsApi, DailyQuest, UserDailyQuest } from '../services/api';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Coins, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Quests() {
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [myQuests, setMyQuests] = useState<UserDailyQuest[]>([]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const fetchQuests = async () => {
    try {
      setLoading(true);
      const [dailyRes, myQuestsRes] = await Promise.all([
        questsApi.getDaily(),
        questsApi.getMyQuests(),
      ]);
      console.log('Daily quests:', dailyRes.data.quests);
      console.log('My quests:', myQuestsRes.data.userQuests);
      setDailyQuests(dailyRes.data.quests || []);
      setMyQuests(myQuestsRes.data.userQuests || []);
    } catch (error: any) {
      console.error('Error fetching quests:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Erreur lors du chargement des quêtes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, []);

  const handleSelectQuest = (questId: string) => {
    if (selectedQuestIds.includes(questId)) {
      setSelectedQuestIds(selectedQuestIds.filter((id) => id !== questId));
    } else {
      if (selectedQuestIds.length >= 3) {
        toast.error('Vous ne pouvez sélectionner que 3 quêtes maximum');
        return;
      }
      setSelectedQuestIds([...selectedQuestIds, questId]);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedQuestIds.length !== 3) {
      toast.error('Vous devez sélectionner exactement 3 quêtes');
      return;
    }

    try {
      setSelecting(true);
      await questsApi.select(selectedQuestIds);
      toast.success('Quêtes sélectionnées avec succès !');
      setSelectedQuestIds([]);
      await fetchQuests();
    } catch (error: any) {
      console.error('Error selecting quests:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la sélection des quêtes');
    } finally {
      setSelecting(false);
    }
  };

  const handleClaim = async (questIds: string[]) => {
    try {
      setClaiming(true);
      const res = await questsApi.claim(questIds);
      toast.success(
        `Récompenses réclamées ! +${res.data.rewards.money} 💰 +${res.data.rewards.aura} ✨`
      );
      await fetchQuests();
    } catch (error: any) {
      console.error('Error claiming quests:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la réclamation');
    } finally {
      setClaiming(false);
    }
  };

  const getQuestIcon = (questType: string) => {
    switch (questType) {
      case 'JOIN_PARTIES':
        return '👥';
      case 'DOODLE_JUMP_SCORE':
      case 'GAME_2048_SCORE':
      case 'FLAPPY_BIRD_SCORE':
        return '🎮';
      case 'BOMB_PARTY_PLAYS':
        return '💣';
      case 'POKER_PLAYS':
        return '🃏';
      case 'PETIT_BAC_PLAYS':
        return '📝';
      case 'BATTLESHIP_PLAYS':
        return '🚢';
      case 'WIN_GAMES':
        return '🏆';
      case 'PLAY_GAMES':
        return '🎯';
      default:
        return '📋';
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  const hasSelectedQuests = myQuests.length > 0;
  const completedQuests = myQuests.filter((q) => q.isCompleted && !q.isClaimed);
  const canSelectNewQuests = !hasSelectedQuests && dailyQuests.length > 0;

  return (
    <PageLayout>
      <div className="flex items-center justify-between">
        <div>
          <p className={cn(TYPOGRAPHY.MUTED, "mt-2")}>
            Sélectionnez 3 quêtes parmi 10 disponibles chaque jour et gagnez des récompenses !
          </p>
        </div>
      </div>

      {hasSelectedQuests && (
        <div className={SPACING.CARD_SPACING}>
          <h2 className={TYPOGRAPHY.H3}>Mes Quêtes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myQuests.map((userQuest) => {
              const progress = userQuest.progress?.currentValue || 0;
              const target = userQuest.quest.targetValue;
              const progressPercent = Math.min((progress / target) * 100, 100);
              const isCompleted = userQuest.isCompleted;
              const isClaimed = userQuest.isClaimed;

              return (
                <Card key={userQuest.id} className={isCompleted && !isClaimed ? 'border-green-500' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={TYPOGRAPHY.H3}>{getQuestIcon(userQuest.quest.questType)}</span>
                        <CardTitle className={TYPOGRAPHY.H5}>{userQuest.quest.title}</CardTitle>
                      </div>
                      {isCompleted && !isClaimed && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Terminée
                        </Badge>
                      )}
                      {isClaimed && (
                        <Badge variant="secondary">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Réclamée
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{userQuest.quest.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progression</span>
                        <span className="font-semibold">
                          {progress} / {target}
                        </span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Coins className="w-4 h-4" />
                          <span className="font-semibold">{userQuest.quest.moneyReward}</span>
                        </div>
                        <div className="flex items-center gap-1 text-purple-600">
                          <Sparkles className="w-4 h-4" />
                          <span className="font-semibold">{userQuest.quest.auraReward}</span>
                        </div>
                      </div>
                      {isCompleted && !isClaimed && (
                        <Button
                          size="sm"
                          onClick={() => handleClaim([userQuest.id])}
                          disabled={claiming}
                        >
                          Réclamer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {completedQuests.length > 0 && (
            <div className="mt-4">
              <Button
                onClick={() => handleClaim(completedQuests.map((q) => q.id))}
                disabled={claiming}
                className="w-full"
              >
                Réclamer toutes les récompenses ({completedQuests.length})
              </Button>
            </div>
          )}
        </div>
      )}

      {canSelectNewQuests && (
        <div className={SPACING.CARD_SPACING}>
          <h2 className={TYPOGRAPHY.H3}>Sélectionnez 3 Quêtes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dailyQuests.map((quest) => {
              const isSelected = selectedQuestIds.includes(quest.id);

              return (
                <Card
                  key={quest.id}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleSelectQuest(quest.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={TYPOGRAPHY.H3}>{getQuestIcon(quest.questType)}</span>
                        <CardTitle className={TYPOGRAPHY.H5}>{quest.title}</CardTitle>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <CardDescription>{quest.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-yellow-600">
                          <Coins className="w-4 h-4" />
                          <span className="font-semibold">{quest.moneyReward}</span>
                        </div>
                        <div className="flex items-center gap-1 text-purple-600">
                          <Sparkles className="w-4 h-4" />
                          <span className="font-semibold">{quest.auraReward}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedQuestIds.length > 0 && (
            <Card className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className={TYPOGRAPHY.SMALL}>
                    {selectedQuestIds.length} / 3 quêtes sélectionnées
                  </span>
                  <Button
                    onClick={handleConfirmSelection}
                    disabled={selectedQuestIds.length !== 3 || selecting}
                  >
                    {selecting ? 'Sélection en cours...' : 'Confirmer la sélection'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!hasSelectedQuests && !canSelectNewQuests && (
        <Card className="border-border/40">
          <CardContent className="p-6 text-center">
            <p className={TYPOGRAPHY.MUTED}>
              Aucune quête disponible pour le moment. Revenez demain pour de nouvelles quêtes !
            </p>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}
