import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { questsApi, DailyQuest, UserDailyQuest } from '../services/api';
import { toast } from '@/hooks/use-toast';
import { useRewardQueue, type RewardItem } from '../contexts/RewardQueueContext';
import { CheckCircle2, Circle, Search } from 'lucide-react';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewModeSwitcher } from '@/components/ui/view-mode-switcher';

type QuestSortMode = 'recommended' | 'reward-desc' | 'target-asc' | 'title-asc';
type QuestViewMode = 'list' | 'grid';

const QUEST_SORT_OPTIONS: Array<{ value: QuestSortMode; label: string }> = [
  { value: 'recommended', label: 'Recommandé' },
  { value: 'reward-desc', label: 'Récompenses max' },
  { value: 'target-asc', label: 'Objectif le plus simple' },
  { value: 'title-asc', label: 'Nom (A-Z)' },
];

export default function Quests() {
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [myQuests, setMyQuests] = useState<UserDailyQuest[]>([]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<QuestSortMode>('recommended');
  const [viewMode, setViewMode] = useState<QuestViewMode>('grid');
  const { enqueue } = useRewardQueue();

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
      const { money, aura } = res.data.rewards;
      const rewardItems: RewardItem[] = [];
      if (money > 0) rewardItems.push({ id: 'money', type: 'money', amount: money, label: 'Coins' });
      if (aura > 0) rewardItems.push({ id: 'aura', type: 'aura', amount: aura, label: 'Aura' });
      if (rewardItems.length > 0) enqueue(rewardItems);
      await fetchQuests();
    } catch (error: any) {
      console.error('Error claiming quests:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de la réclamation');
    } finally {
      setClaiming(false);
    }
  };

  const hasSelectedQuests = myQuests.length > 0;
  const completedQuests = myQuests.filter((q) => q.isCompleted && !q.isClaimed);
  const canSelectNewQuests = !hasSelectedQuests && dailyQuests.length > 0;
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const displayedMyQuests = useMemo(() => {
    return [...myQuests]
      .filter((userQuest) => {
        if (!normalizedSearch) return true;
        return [userQuest.quest.title, userQuest.quest.description, userQuest.quest.questType]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'reward-desc':
            return (b.quest.moneyReward + b.quest.auraReward) - (a.quest.moneyReward + a.quest.auraReward);
          case 'target-asc':
            return a.quest.targetValue - b.quest.targetValue;
          case 'title-asc':
            return a.quest.title.localeCompare(b.quest.title, 'fr', { sensitivity: 'base' });
          case 'recommended':
          default: {
            const aPriority = a.isCompleted && !a.isClaimed ? 0 : a.isClaimed ? 2 : 1;
            const bPriority = b.isCompleted && !b.isClaimed ? 0 : b.isClaimed ? 2 : 1;
            if (aPriority !== bPriority) return aPriority - bPriority;

            const aProgress = (a.progress?.currentValue || 0) / Math.max(a.quest.targetValue, 1);
            const bProgress = (b.progress?.currentValue || 0) / Math.max(b.quest.targetValue, 1);
            return bProgress - aProgress;
          }
        }
      });
  }, [myQuests, normalizedSearch, sortMode]);

  const displayedDailyQuests = useMemo(() => {
    return [...dailyQuests]
      .filter((quest) => {
        if (!normalizedSearch) return true;
        return [quest.title, quest.description, quest.questType]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'reward-desc':
            return (b.moneyReward + b.auraReward) - (a.moneyReward + a.auraReward);
          case 'target-asc':
            return a.targetValue - b.targetValue;
          case 'title-asc':
            return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
          case 'recommended':
          default: {
            return (b.moneyReward + b.auraReward) - (a.moneyReward + a.auraReward);
          }
        }
      });
  }, [dailyQuests, normalizedSearch, sortMode]);

  const layoutClassName = viewMode === 'grid'
    ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'
    : 'space-y-4';

  if (loading) {
    return (
      <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-6 lg:px-6 lg:pb-8 space-y-8">
      {(completedQuests.length > 0 || canSelectNewQuests) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {completedQuests.length > 0 && (
                <>
                  <span className={TYPOGRAPHY.SMALL}>
                    {completedQuests.length} récompense{completedQuests.length > 1 ? 's' : ''} à réclamer
                  </span>
                  <Button
                    onClick={() => handleClaim(completedQuests.map((q) => q.id))}
                    disabled={claiming}
                    className="w-full sm:w-auto"
                  >
                    Réclamer toutes les récompenses ({completedQuests.length})
                  </Button>
                </>
              )}

              {canSelectNewQuests && (
                <>
                  <span className={TYPOGRAPHY.SMALL}>
                    {selectedQuestIds.length} / 3 quêtes sélectionnées
                  </span>
                  <Button
                    onClick={handleConfirmSelection}
                    disabled={selectedQuestIds.length !== 3 || selecting}
                    className="w-full sm:w-auto"
                  >
                    {selecting ? 'Sélection en cours...' : 'Confirmer la sélection'}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(hasSelectedQuests || canSelectNewQuests) && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher une quête..."
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:w-full lg:w-auto">
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as QuestSortMode)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Trier" />
              </SelectTrigger>
              <SelectContent>
                {QUEST_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ViewModeSwitcher value={viewMode} onChange={(value) => setViewMode(value as QuestViewMode)} />
          </div>
        </div>
      )}

      {hasSelectedQuests && (
        <div className={SPACING.CARD_SPACING}>
          <h2 className={TYPOGRAPHY.H3}>Mes Quêtes</h2>
          {displayedMyQuests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className={TYPOGRAPHY.MUTED}>Aucune quête ne correspond à votre recherche.</p>
              </CardContent>
            </Card>
          ) : (
            <div className={layoutClassName}>
            {displayedMyQuests.map((userQuest) => {
              const progress = userQuest.progress?.currentValue || 0;
              const target = userQuest.quest.targetValue;
              const progressPercent = Math.min((progress / target) * 100, 100);
              const isCompleted = userQuest.isCompleted;
              const isClaimed = userQuest.isClaimed;

              return (
                <Card key={userQuest.id} className={isCompleted && !isClaimed ? 'border-green-500' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
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

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CurrencyIcon type="money" className="w-4 h-4" />
                          <span className="font-semibold">{userQuest.quest.moneyReward}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CurrencyIcon type="aura" className="w-4 h-4" />
                          <span className="font-semibold">{userQuest.quest.auraReward}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
        </div>
      )}

      {canSelectNewQuests && (
        <div className={SPACING.CARD_SPACING}>
          {displayedDailyQuests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className={TYPOGRAPHY.MUTED}>Aucune quête ne correspond à votre recherche.</p>
              </CardContent>
            </Card>
          ) : (
            <div className={layoutClassName}>
            {displayedDailyQuests.map((quest) => {
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
                      <div>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CurrencyIcon type="money" className="w-4 h-4" />
                          <span className="font-semibold">{quest.moneyReward}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <CurrencyIcon type="aura" className="w-4 h-4" />
                          <span className="font-semibold">{quest.auraReward}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
          )}
        </div>
      )}

      {!hasSelectedQuests && !canSelectNewQuests && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className={TYPOGRAPHY.MUTED}>
              Aucune quête disponible pour le moment. Revenez demain pour de nouvelles quêtes !
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
