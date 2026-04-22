import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { questsApi, passApi, DailyQuest, UserDailyQuest, type PassStatus, type PassRewardEntry } from '../services/api';
import { toast } from '@/hooks/use-toast';
import { useRewardQueue, type RewardItem } from '../contexts/RewardQueueContext';
import { CheckCircle2, Circle, Gift, Search } from 'lucide-react';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewModeSwitcher } from '@/components/ui/view-mode-switcher';
import { PageShell } from '@/components/layout/page-shell';
import { t } from '@/lib/i18n';

type QuestSortMode = 'recommended' | 'reward-desc' | 'target-asc' | 'title-asc';
type QuestViewMode = 'list' | 'grid';

const QUEST_SORT_OPTIONS: Array<{ value: QuestSortMode; label: string }> = [
  { value: 'recommended', label: t('quests_sort_recommended') },
  { value: 'reward-desc', label: t('quests_sort_reward_desc') },
  { value: 'target-asc', label: t('quests_sort_target_asc') },
  { value: 'title-asc', label: t('quests_sort_title_asc') },
];

export default function Quests() {
  const [dailyQuests, setDailyQuests] = useState<DailyQuest[]>([]);
  const [myQuests, setMyQuests] = useState<UserDailyQuest[]>([]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [passStatus, setPassStatus] = useState<PassStatus | null>(null);
  const [passLoading, setPassLoading] = useState(true);
  const [passClaiming, setPassClaiming] = useState(false);
  const [now, setNow] = useState(Date.now());
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
      setDailyQuests(dailyRes.data.quests || []);
      setMyQuests(myQuestsRes.data.userQuests || []);
    } catch (error: any) {
      console.error('Error fetching quests:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || t('quests_error_load'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPassStatus = async () => {
    try {
      setPassLoading(true);
      const response = await passApi.getStatus();
      setPassStatus(response.data);
    } catch (error) {
      console.error('Error fetching pass status:', error);
      toast.error('Impossible de charger la boite quotidienne.');
    } finally {
      setPassLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
    fetchPassStatus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleSelectQuest = (questId: string) => {
    if (selectedQuestIds.includes(questId)) {
      setSelectedQuestIds(selectedQuestIds.filter((id) => id !== questId));
    } else {
      if (selectedQuestIds.length >= 3) {
        toast.error(t('quests_error_select_limit'));
        return;
      }
      setSelectedQuestIds([...selectedQuestIds, questId]);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedQuestIds.length !== 3) {
      toast.error(t('quests_error_select_exact'));
      return;
    }

    try {
      setSelecting(true);
      await questsApi.select(selectedQuestIds);
      toast.success(t('quests_success_selected'));
      setSelectedQuestIds([]);
      await fetchQuests();
    } catch (error: any) {
      console.error('Error selecting quests:', error);
      toast.error(error.response?.data?.error || t('quests_error_select'));
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
      if (money > 0) rewardItems.push({ id: 'money', type: 'money', amount: money, label: t('quests_reward_money') });
      if (aura > 0) rewardItems.push({ id: 'aura', type: 'aura', amount: aura, label: t('quests_reward_aura') });
      if (rewardItems.length > 0) enqueue(rewardItems);
      await fetchQuests();
    } catch (error: any) {
      console.error('Error claiming quests:', error);
      toast.error(error.response?.data?.error || t('quests_error_claim'));
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimDailyBox = async () => {
    if (!passStatus || passStatus.status === 'claimed') return;

    try {
      setPassClaiming(true);
      const response = await passApi.claim();

      const rewardItems: RewardItem[] = response.data.rewards.map((reward: PassRewardEntry, index: number) => ({
        id: `pass-${index}`,
        type: reward.type,
        amount: reward.amount ?? reward.quantity ?? 1,
        label: reward.label,
        rarity: reward.rarity,
      }));

      if (rewardItems.length > 0) {
        enqueue(rewardItems);
      }

      toast.success('Boite quotidienne ouverte.');
      await fetchPassStatus();
    } catch (error) {
      console.error('Error claiming daily box:', error);
      toast.error("Impossible d'ouvrir la boite quotidienne.");
    } finally {
      setPassClaiming(false);
    }
  };

  const passCountdown = useMemo(() => {
    if (!passStatus?.nextReset) return '--:--:--';
    const diff = new Date(passStatus.nextReset).getTime() - now;
    if (diff <= 0) return '00:00:00';

    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1_000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [passStatus?.nextReset, now]);

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
      <PageShell>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Quetes + boite quotidienne</p>
              <p className={TYPOGRAPHY.SMALL}>
                Streak: {passStatus?.streak ?? 0} · Reset dans {passCountdown}
              </p>
            </div>
            <Button
              onClick={handleClaimDailyBox}
              disabled={passLoading || passClaiming || passStatus?.status === 'claimed'}
              className="w-full sm:w-auto"
            >
              <Gift className="mr-2 h-4 w-4" />
              {passLoading
                ? 'Loading...'
                : passStatus?.status === 'claimed'
                  ? 'Already claimed today'
                  : passClaiming
                    ? 'Claiming...'
                    : 'Claim your daily box'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(completedQuests.length > 0 || canSelectNewQuests) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {completedQuests.length > 0 && (
                <>
                  <span className={TYPOGRAPHY.SMALL}>
                    {completedQuests.length} {t('quests_rewards_to_claim')}
                  </span>
                  <Button
                    onClick={() => handleClaim(completedQuests.map((q) => q.id))}
                    disabled={claiming}
                    className="w-full sm:w-auto"
                  >
                    {t('quests_claim_all')} ({completedQuests.length})
                  </Button>
                </>
              )}

              {canSelectNewQuests && (
                <>
                  <span className={TYPOGRAPHY.SMALL}>
                    {selectedQuestIds.length} / 3 {t('quests_selected_count')}
                  </span>
                  <Button
                    onClick={handleConfirmSelection}
                    disabled={selectedQuestIds.length !== 3 || selecting}
                    className="w-full sm:w-auto"
                  >
                    {selecting ? t('quests_selection_in_progress') : t('quests_confirm_selection')}
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
              placeholder={t('quests_search_placeholder')}
              className="pl-9"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:w-full lg:w-auto">
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as QuestSortMode)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder={t('quests_sort_placeholder')} />
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
          <h2 className={TYPOGRAPHY.H3}>{t('quests_my_quests')}</h2>
          {displayedMyQuests.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className={TYPOGRAPHY.MUTED}>{t('quests_no_match')}</p>
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
                          {t('quests_completed')}
                        </Badge>
                      )}
                      {isClaimed && (
                        <Badge variant="secondary">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {t('quests_claimed')}
                        </Badge>
                      )}
                      {isCompleted && !isClaimed && (
                        <Button
                          size="sm"
                          onClick={() => handleClaim([userQuest.id])}
                          disabled={claiming}
                        >
                          {t('quests_claim')}
                        </Button>
                      )}
                    </div>
                    <CardDescription>{userQuest.quest.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{t('quests_progression')}</span>
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
                <p className={TYPOGRAPHY.MUTED}>{t('quests_no_match')}</p>
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
              {t('quests_no_available')}
            </p>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
