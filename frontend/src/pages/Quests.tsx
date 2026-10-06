import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Gift, LayoutGrid, List, Search } from 'lucide-react';
import { toast } from 'sonner';
import { questsApi, passApi, DailyQuest, UserDailyQuest, type PassStatus, type PassRewardEntry } from '../services/api';
import { useRewardQueue, type RewardItem } from '../contexts/RewardQueueContext';
import { CurrencyIcon } from '@/components/currency/CurrencyIcon';
import { PageHeader, PageShell } from '@/components/layout/PageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { t } from '@/lib/i18n';

type QuestSortMode = 'recommended' | 'reward-desc' | 'target-asc' | 'title-asc';
type QuestViewMode = 'list' | 'grid';

const QUEST_SORT_OPTIONS: Array<{ value: QuestSortMode; label: string }> = [
  { value: 'recommended', label: t('quests_sort_recommended') },
  { value: 'reward-desc', label: t('quests_sort_reward_desc') },
  { value: 'target-asc', label: t('quests_sort_target_asc') },
  { value: 'title-asc', label: t('quests_sort_title_asc') },
];

function Rewards({ money, aura }: { money: number; aura: number }) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <span className="flex items-center gap-1 font-medium">
        <CurrencyIcon type="money" className="size-4" />
        {money}
      </span>
      <span className="flex items-center gap-1 font-medium">
        <CurrencyIcon type="aura" className="size-4" />
        {aura}
      </span>
    </div>
  );
}

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

  const gridClassName = 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3';

  const renderMyQuests = () => {
    if (viewMode === 'list') {
      return (
        <Card className="py-2">
          <ItemGroup>
            {displayedMyQuests.map((userQuest, index) => {
              const progress = userQuest.progress?.currentValue || 0;
              const target = userQuest.quest.targetValue;
              const isReady = userQuest.isCompleted && !userQuest.isClaimed;
              return (
                <div key={userQuest.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <Item>
                    <ItemContent>
                      <ItemTitle>
                        {userQuest.quest.title}
                        {isReady ? <Badge variant="success">{t('quests_completed')}</Badge> : null}
                        {userQuest.isClaimed ? <Badge variant="secondary">{t('quests_claimed')}</Badge> : null}
                      </ItemTitle>
                      <ItemDescription>{userQuest.quest.description}</ItemDescription>
                      <div className="flex items-center gap-3 pt-1">
                        <Progress value={Math.min((progress / target) * 100, 100)} className="max-w-xs" />
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {progress} / {target}
                        </span>
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <Rewards money={userQuest.quest.moneyReward} aura={userQuest.quest.auraReward} />
                      {isReady ? (
                        <Button size="sm" onClick={() => handleClaim([userQuest.id])} disabled={claiming}>
                          {t('quests_claim')}
                        </Button>
                      ) : null}
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </Card>
      );
    }

    return (
      <div className={gridClassName}>
        {displayedMyQuests.map((userQuest) => {
          const progress = userQuest.progress?.currentValue || 0;
          const target = userQuest.quest.targetValue;
          const isReady = userQuest.isCompleted && !userQuest.isClaimed;
          return (
            <Card key={userQuest.id} className={isReady ? 'border-success' : undefined}>
              <CardHeader>
                <CardTitle>{userQuest.quest.title}</CardTitle>
                <CardDescription>{userQuest.quest.description}</CardDescription>
                {isReady || userQuest.isClaimed ? (
                  <CardAction>
                    {isReady ? (
                      <Badge variant="success">
                        <CheckCircle2 />
                        {t('quests_completed')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <CheckCircle2 />
                        {t('quests_claimed')}
                      </Badge>
                    )}
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('quests_progression')}</span>
                    <span className="font-semibold tabular-nums">
                      {progress} / {target}
                    </span>
                  </div>
                  <Progress value={Math.min((progress / target) * 100, 100)} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Rewards money={userQuest.quest.moneyReward} aura={userQuest.quest.auraReward} />
                  {isReady ? (
                    <Button size="sm" onClick={() => handleClaim([userQuest.id])} disabled={claiming}>
                      {t('quests_claim')}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDailyQuests = () => {
    if (viewMode === 'list') {
      return (
        <Card className="py-2">
          <ItemGroup>
            {displayedDailyQuests.map((quest, index) => {
              const isSelected = selectedQuestIds.includes(quest.id);
              return (
                <div key={quest.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <Item asChild variant={isSelected ? 'muted' : 'default'}>
                    <button type="button" aria-pressed={isSelected} onClick={() => handleSelectQuest(quest.id)} className="text-left">
                      <Checkbox checked={isSelected} aria-hidden tabIndex={-1} />
                      <ItemContent>
                        <ItemTitle>{quest.title}</ItemTitle>
                        <ItemDescription>{quest.description}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Rewards money={quest.moneyReward} aura={quest.auraReward} />
                      </ItemActions>
                    </button>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </Card>
      );
    }

    return (
      <div className={gridClassName}>
        {displayedDailyQuests.map((quest) => {
          const isSelected = selectedQuestIds.includes(quest.id);
          return (
            <Card
              key={quest.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              className={isSelected ? 'cursor-pointer border-primary ring-2 ring-primary' : 'cursor-pointer transition-colors hover:bg-accent/40'}
              onClick={() => handleSelectQuest(quest.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleSelectQuest(quest.id);
                }
              }}
            >
              <CardHeader>
                <CardTitle>{quest.title}</CardTitle>
                <CardDescription>{quest.description}</CardDescription>
                <CardAction>
                  <Checkbox checked={isSelected} aria-hidden tabIndex={-1} />
                </CardAction>
              </CardHeader>
              <CardContent>
                <Rewards money={quest.moneyReward} aura={quest.auraReward} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const noMatch = (
    <Empty className="border">
      <EmptyHeader>
        <EmptyDescription>{t('quests_no_match')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  if (loading) {
    return (
      <PageShell>
        <PageHeader />
        <div className={gridClassName}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader />

      <Card>
        <CardHeader>
          <CardTitle>Boîte quotidienne</CardTitle>
          <CardDescription>
            Série : {passStatus?.streak ?? 0} · Réinitialisation dans {passCountdown}
          </CardDescription>
          <CardAction>
            <Button onClick={handleClaimDailyBox} disabled={passLoading || passClaiming || passStatus?.status === 'claimed'}>
              {passLoading || passClaiming ? <Spinner /> : <Gift />}
              {passLoading ? 'Chargement…' : passStatus?.status === 'claimed' ? "Déjà récupérée aujourd'hui" : passClaiming ? 'Ouverture…' : 'Récupérer la boîte'}
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      {completedQuests.length > 0 || canSelectNewQuests ? (
        <Card>
          <CardHeader>
            {completedQuests.length > 0 ? (
              <>
                <CardTitle>
                  {completedQuests.length} {t('quests_rewards_to_claim')}
                </CardTitle>
                <CardAction>
                  <Button onClick={() => handleClaim(completedQuests.map((quest) => quest.id))} disabled={claiming}>
                    {claiming ? <Spinner /> : null}
                    {t('quests_claim_all')} ({completedQuests.length})
                  </Button>
                </CardAction>
              </>
            ) : (
              <>
                <CardTitle>
                  {selectedQuestIds.length} / 3 {t('quests_selected_count')}
                </CardTitle>
                <CardAction>
                  <Button onClick={handleConfirmSelection} disabled={selectedQuestIds.length !== 3 || selecting}>
                    {selecting ? <Spinner /> : null}
                    {selecting ? t('quests_selection_in_progress') : t('quests_confirm_selection')}
                  </Button>
                </CardAction>
              </>
            )}
          </CardHeader>
        </Card>
      ) : null}

      {hasSelectedQuests || canSelectNewQuests ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <InputGroup className="lg:max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('quests_search_placeholder')} />
          </InputGroup>
          <div className="flex flex-col gap-2 sm:flex-row">
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
            <ToggleGroup type="single" variant="outline" value={viewMode} onValueChange={(value) => value && setViewMode(value as QuestViewMode)}>
              <ToggleGroupItem value="list" aria-label="Vue liste">
                <List />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Vue grille">
                <LayoutGrid />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      ) : null}

      {hasSelectedQuests ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t('quests_my_quests')}</h2>
          {displayedMyQuests.length === 0 ? noMatch : renderMyQuests()}
        </section>
      ) : null}

      {canSelectNewQuests ? (
        <section className="flex flex-col gap-4">{displayedDailyQuests.length === 0 ? noMatch : renderDailyQuests()}</section>
      ) : null}

      {!hasSelectedQuests && !canSelectNewQuests ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Aucune quête</EmptyTitle>
            <EmptyDescription>{t('quests_no_available')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
    </PageShell>
  );
}
