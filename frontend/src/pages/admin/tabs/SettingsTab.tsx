import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DashboardUpdatesManagerDialog } from '@/features/dashboard-updates/DashboardUpdatesManagerDialog';
import { BLOCKABLE_PAGES } from '@/config/blockedPages';
import { SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { AlertTriangle, Download, Gamepad2, Loader2, LogIn, MessageCircle, Save, Sparkles, Terminal, Trash2, Trophy, Search, ShieldAlert, Sparkle, Ban } from 'lucide-react';
import { ANNOUNCEMENT_MAX_LENGTH, CHAT_BLOCK_MESSAGE_MAX_LENGTH, CHAT_BLOCK_TIMEZONE } from '../constants';
import { DEFAULT_LANDING_PAGE_OPTIONS } from '@/lib/default-landing-page';

export type SettingsTabProps = Record<string, unknown>;

export function SettingsTab(props: SettingsTabProps) {
  const {
    fakeOnlineEnabled,
    savingFakeOnline,
    saveFakeOnline,
    duelMatchmakingEnabled,
    savingDuelMatchmakingEnabled,
    saveDuelMatchmakingEnabled,
    referralEnabled,
    savingReferralEnabled,
    saveReferralEnabled,
    referralDashboardCardEnabled,
    savingReferralDashboardCardEnabled,
    saveReferralDashboardCardEnabled,
    referralRewardAmount,
    setReferralRewardAmount,
    saveReferralReward,
    savingReferralReward,
    dailyAuraDistributionLimit,
    setDailyAuraDistributionLimit,
    saveDailyAuraDistributionLimit,
    savingDailyAuraDistributionLimit,
    auraCoinBuyFeePercentage,
    setAuraCoinBuyFeePercentage,
    saveAuraCoinBuyFee,
    savingAuraCoinBuyFee,
    stableCoinBuyFeePercentage,
    setStableCoinBuyFeePercentage,
    saveStableCoinBuyFee,
    savingStableCoinBuyFee,
    chaosCoinBuyFeePercentage,
    setChaosCoinBuyFeePercentage,
    saveChaosCoinBuyFee,
    savingChaosCoinBuyFee,
    clashAttackCooldownMinutes,
    setClashAttackCooldownMinutes,
    saveClashAttackCooldown,
    savingClashAttackCooldown,
    chatBlockEnabled,
    setChatBlockEnabled,
    savingChatBlockSettings,
    chatBlockMessage,
    setChatBlockMessage,
    chatAutoBlockEnabled,
    setChatAutoBlockEnabled,
    chatAutoBlockStart,
    setChatAutoBlockStart,
    chatAutoBlockEnd,
    setChatAutoBlockEnd,
    saveChatBlockSettings,
    trustedSharedIpAddresses,
    setTrustedSharedIpAddresses,
    saveTrustedSharedIps,
    savingTrustedSharedIps,
    announcementMessage,
    setAnnouncementMessage,
    setAnnouncementOpen,
    announcementOpen,
    saveAnnouncement,
    savingAnnouncement,
    loginMessage,
    loginRegisterCtaEnabled,
    setLoginCommOpen,
    loginCommOpen,
    saveLoginMessage,
    savingLoginMessage,
    setLoginMessage,
    saveLoginRegisterCta,
    savingLoginRegisterCta,
    defaultLandingPage,
    setDefaultLandingPage,
    saveDefaultLandingPage,
    savingDefaultLandingPage,
    youLogoAdminOnly,
    saveYouLogoAdminOnly,
    savingYouLogoAdminOnly,
    updatesOpen,
    setUpdatesOpen,
    maintenanceEnabled,
    maintenanceAutoWeekendEnabled,
    setMaintenanceOpen,
    maintenanceOpen,
    loadingSettings,
    setMaintenanceEnabled,
    setMaintenanceAutoWeekendEnabled,
    maintenanceMessage,
    setMaintenanceMessage,
    maintenanceEndDate,
    setMaintenanceEndDate,
    saveMaintenance,
    savingMaintenance,
    businessCreationEnabled,
    saveBusinessCreationEnabled,
    savingBusinessCreation,
    purgeAllBusinesses,
    purgingBusinesses,
    purgeAllMarketplaceListings,
    purgingMarketplaceListings,
    purgeAllResourceMarketListings,
    purgingResourceMarketListings,
    resetBusinessUnlockLevels,
    resettingUnlockLevels,
    deployOutput,
    setDeployModalOpen,
    deployModalOpen,
    deploying,
    confirm,
    setDeploying,
    setDeployOutput,
    adminApi,
    user,
    backfillResult,
    backfillLoading,
    setBackfillLoading,
    setBackfillResult,
    alert,
    fonctionnalitesOpen,
    setFonctionnalitesOpen,
    blockedPages,
    blockedMessage,
    setBlockedMessage,
    blockedPageMessages,
    toggleBlockedPage,
    updateBlockedPageMessage,
    saveBlockedPages,
    savingBlocks,
    exportChat,
    exportingChat,
    clearingChat,
    clearChat,
  } = props as any;

  const [searchQuery, setSearchQuery] = useState('');

  const matchesSearch = (terms: string[]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return terms.some(term => term.toLowerCase().includes(q));
  };

  const showPresence = matchesSearch(['presence', 'utilisateurs en ligne fictifs', 'connectes', 'fake online']);
  const showReferral = matchesSearch(['parrainage', 'matchmaking duel', 'code de parrainage', 'recompense', 'aura distribuable par jour', 'limits']);
  const showMarket = matchesSearch(['frais', 'aura coin', 'stable coin', 'chaos coin', 'salle de marche', 'crypto']);
  const showClash = matchesSearch(['clash', 'village', 'temps de recharge', 'raid', 'cooldown']);
  const showComm = matchesSearch(['chat block', 'communication', 'blocage du chat', 'message', 'annonce topbar', 'page de connexion', 'landing page', 'logo sidebar', 'updates', 'maintenance', 'anti alt', 'ip stdo', 'lycee']);
  const showFeatures = matchesSearch(['fonctionnalites', 'pages du site', 'bloquer']);
  const showDeploy = matchesSearch(['deploiement', 'deploy', 'version', 'git']);
  const showDanger = matchesSearch(['danger', 'zone de danger', 'vider le chat', 'purger toutes les entreprises', 'reinitialiser les niveaux', 'purger la marketplace', 'purger le marche de ressources', 'cancel listings', 'delete offers', 'delete listings']);

  return (
    <TabsContent value="settings" className={cn(SPACING.SECTION_SPACING, "space-y-6")}>
      {/* Dynamic Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un paramètre... (ex: chat, frais, marketplace, parrainage...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 py-5 bg-card/40 border-border/40 focus-visible:ring-primary focus-visible:bg-card/75 transition-all rounded-xl text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 hover:bg-transparent text-muted-foreground hover:text-foreground text-xs"
          >
            Effacer
          </Button>
        )}
      </div>

      {/* Presence Section */}
      {showPresence && (
        <div className="space-y-2 border-l-4 border-l-cyan-500/80 bg-cyan-950/5 dark:bg-cyan-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-cyan-950/10">
          <div className="flex items-center gap-2 px-1">
            <Sparkle className="h-4 w-4 text-cyan-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Système de présence</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-cyan-200/90">Utilisateurs en ligne fictifs</div>
                <div className="text-xs text-muted-foreground">Complète la liste des connectés avec des utilisateurs hors-ligne pour maintenir un minimum de 10 % affichés.</div>
              </div>
              <Switch checked={fakeOnlineEnabled} disabled={savingFakeOnline} onCheckedChange={saveFakeOnline} />
            </div>
          </div>
        </div>
      )}

      {/* Referral & Limits Section */}
      {showReferral && (
        <div className="space-y-2 border-l-4 border-l-indigo-500/80 bg-indigo-950/5 dark:bg-indigo-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-indigo-950/10">
          <div className="flex items-center gap-2 px-1">
            <Trophy className="h-4 w-4 text-indigo-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">Parrainage & Quotas</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-indigo-200/90">Matchmaking duel</div>
                <div className="text-xs text-muted-foreground">Affiche le bouton côté joueur et autorise l'entrée dans la file de matchmaking duel.</div>
              </div>
              <Switch checked={duelMatchmakingEnabled} disabled={savingDuelMatchmakingEnabled} onCheckedChange={saveDuelMatchmakingEnabled} />
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-indigo-200/90">Système de parrainage</div>
                <div className="text-xs text-muted-foreground">Coupe l'usage des codes de parrainage sur l'inscription et masque le module côté joueur.</div>
              </div>
              <Switch checked={referralEnabled} disabled={savingReferralEnabled} onCheckedChange={saveReferralEnabled} />
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-indigo-200/90">Carte de parrainage sur le dashboard</div>
                <div className="text-xs text-muted-foreground">Affiche la carte de suivi du parrainage sur la page dashboard des joueurs.</div>
              </div>
              <Switch
                checked={referralDashboardCardEnabled}
                disabled={savingReferralDashboardCardEnabled}
                onCheckedChange={saveReferralDashboardCardEnabled}
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-indigo-200/90">Récompense par inscription</div>
                <div className="text-xs text-muted-foreground">Montant versé au parrain et au filleul quand un compte parrainé est approuvé.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id="referral-reward-amount"
                  type="number"
                  min={0}
                  step={1}
                  value={referralRewardAmount}
                  disabled={!referralEnabled}
                  onChange={(event) => setReferralRewardAmount(event.target.value)}
                  className="w-24 h-8 text-sm"
                />
                <Button size="sm" onClick={saveReferralReward} disabled={savingReferralReward || !referralEnabled} className="bg-indigo-600 hover:bg-indigo-700">
                  {savingReferralReward ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-indigo-200/90">Aura distribuable par jour</div>
                <div className="text-xs text-muted-foreground">Quota global disponible pour chaque joueur à chaque reset de minuit. Valeur par défaut: 100.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id="daily-aura-distribution-limit"
                  type="number"
                  min={0}
                  max={10000}
                  step={1}
                  value={dailyAuraDistributionLimit}
                  onChange={(event) => setDailyAuraDistributionLimit(event.target.value)}
                  className="w-24 h-8 text-sm"
                />
                <Button size="sm" onClick={saveDailyAuraDistributionLimit} disabled={savingDailyAuraDistributionLimit} className="bg-indigo-600 hover:bg-indigo-700">
                  {savingDailyAuraDistributionLimit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Market Section */}
      {showMarket && (
        <div className="space-y-2 border-l-4 border-l-emerald-500/80 bg-emerald-950/5 dark:bg-emerald-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-emerald-950/10">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Salle de marché (Frais & Cryptos)</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-emerald-200/90">Frais Aura Coin</div>
                <div className="text-xs text-muted-foreground">Taux appliqué sur les achats et ventes AuraCoin (0 = 0 %, 0.5 = 50 %).</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id="auracoin-buy-fee"
                  type="number"
                  min={0}
                  max={0.5}
                  step={0.0001}
                  value={auraCoinBuyFeePercentage}
                  onChange={(event) => setAuraCoinBuyFeePercentage(event.target.value)}
                  className="w-28 h-8 text-sm"
                />
                <Button size="sm" onClick={saveAuraCoinBuyFee} disabled={savingAuraCoinBuyFee} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingAuraCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-emerald-200/90">Frais Aura Stable</div>
                <div className="text-xs text-muted-foreground">Stable coin à faible volatilité. Même logique de frais modifiable depuis l'admin.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id="stable-coin-buy-fee"
                  type="number"
                  min={0}
                  max={0.5}
                  step={0.0001}
                  value={stableCoinBuyFeePercentage}
                  onChange={(event) => setStableCoinBuyFeePercentage(event.target.value)}
                  className="w-28 h-8 text-sm"
                />
                <Button size="sm" onClick={saveStableCoinBuyFee} disabled={savingStableCoinBuyFee} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingStableCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-emerald-200/90">Frais Chaos Coin</div>
                <div className="text-xs text-muted-foreground">Coin très instable avec frais séparés pour équilibrer le risque et les spreads.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id="chaos-coin-buy-fee"
                  type="number"
                  min={0}
                  max={1}
                  step={0.0001}
                  value={chaosCoinBuyFeePercentage}
                  onChange={(event) => setChaosCoinBuyFeePercentage(event.target.value)}
                  className="w-28 h-8 text-sm"
                />
                <Button size="sm" onClick={saveChaosCoinBuyFee} disabled={savingChaosCoinBuyFee} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingChaosCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clash Section */}
      {showClash && (
        <div className="space-y-2 border-l-4 border-l-amber-500/80 bg-amber-950/5 dark:bg-amber-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-amber-950/10">
          <div className="flex items-center gap-2 px-1">
            <Gamepad2 className="h-4 w-4 text-amber-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Clash Village</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-amber-200/90">Temps de recharge d'attaque</div>
                <div className="text-xs text-muted-foreground">Temps d'attente appliqué après un raid réussi ou raté. Mettre `0` pour désactiver ce temps de recharge.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  id="clash-attack-cooldown"
                  type="number"
                  min={0}
                  max={1440}
                  step={1}
                  value={clashAttackCooldownMinutes}
                  onChange={(event) => setClashAttackCooldownMinutes(event.target.value)}
                  className="w-24 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">min</span>
                <Button size="sm" onClick={saveClashAttackCooldown} disabled={savingClashAttackCooldown} className="bg-amber-600 hover:bg-amber-700 text-black font-semibold">
                  {savingClashAttackCooldown ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Communication Section */}
      {showComm && (
        <div className="space-y-2 border-l-4 border-l-violet-500/80 bg-violet-950/5 dark:bg-violet-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-violet-950/10">
          <div className="flex items-center gap-2 px-1">
            <MessageCircle className="h-4 w-4 text-violet-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400">Communication & Contenu</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="px-4 py-3.5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-violet-200/90">Blocage du chat</div>
                  <div className="text-xs text-muted-foreground">
                    Coupe l'envoi de messages pour les joueurs. Les admins gardent l'accès pour modérer.
                  </div>
                </div>
                <Switch checked={chatBlockEnabled} onCheckedChange={setChatBlockEnabled} disabled={savingChatBlockSettings} />
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Message affiché aux joueurs
                  </label>
                  <Textarea
                    value={chatBlockMessage}
                    onChange={(event) => setChatBlockMessage(event.target.value)}
                    placeholder="Ex: Le chat est fermé pendant les heures de cours."
                    className="min-h-[88px]"
                    maxLength={CHAT_BLOCK_MESSAGE_MAX_LENGTH}
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Visible dans le chat et au moment d'une tentative d'envoi.</span>
                    <span>{chatBlockMessage.length}/{CHAT_BLOCK_MESSAGE_MAX_LENGTH}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/20 bg-background/40 p-3 text-xs text-muted-foreground md:w-64">
                  <p className="font-medium text-foreground">État actuel</p>
                  <p className="mt-1">
                    {chatBlockEnabled
                      ? 'Blocage manuel activé'
                      : chatAutoBlockEnabled
                        ? `Blocage auto configuré de ${chatAutoBlockStart} à ${chatAutoBlockEnd}`
                        : 'Chat ouvert'}
                  </p>
                  <p className="mt-1">Fuseau horaire: {CHAT_BLOCK_TIMEZONE}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/20 bg-background/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">Blocage automatique quotidien</div>
                    <div className="text-xs text-muted-foreground">
                      Active un blocage chaque jour sur un créneau fixe. Gère aussi les plages qui passent minuit.
                    </div>
                  </div>
                  <Switch checked={chatAutoBlockEnabled} onCheckedChange={setChatAutoBlockEnabled} disabled={savingChatBlockSettings} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                      Début
                    </label>
                    <Input
                      type="time"
                      step={60}
                      value={chatAutoBlockStart}
                      disabled={!chatAutoBlockEnabled || savingChatBlockSettings}
                      onChange={(event) => setChatAutoBlockStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                      Fin
                    </label>
                    <Input
                      type="time"
                      step={60}
                      value={chatAutoBlockEnd}
                      disabled={!chatAutoBlockEnabled || savingChatBlockSettings}
                      onChange={(event) => setChatAutoBlockEnd(event.target.value)}
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Exemple: `22:00` → `07:00` bloque le chat toute la nuit.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveChatBlockSettings} disabled={savingChatBlockSettings} className="bg-violet-600 hover:bg-violet-700">
                  {savingChatBlockSettings ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                  Sauvegarder le chat
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-violet-200/90">Annonce topbar</div>
                <div className="text-xs text-muted-foreground">
                  {announcementMessage.trim()
                    ? `"${announcementMessage.trim().slice(0, 48)}${announcementMessage.trim().length > 48 ? '…' : ''}"`
                    : 'Aucune annonce active'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAnnouncementOpen(true)} className="shrink-0">
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                Configurer
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-violet-200/90">Page de connexion</div>
                <div className="text-xs text-muted-foreground">
                  {loginMessage.trim()
                    ? `Message actif · CTA ${loginRegisterCtaEnabled ? 'active' : 'desactive'}`
                    : `Pas de message · CTA ${loginRegisterCtaEnabled ? 'active' : 'desactive'}`}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLoginCommOpen(true)} className="shrink-0">
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Configurer
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-violet-200/90">Page principale du site</div>
                <div className="text-xs text-muted-foreground">
                  {DEFAULT_LANDING_PAGE_OPTIONS.find((option) => option.value === defaultLandingPage)?.label ?? 'Tableau de bord'} s'ouvre quand un utilisateur connecté arrive sur `auratracker.xyz`.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={defaultLandingPage} onValueChange={setDefaultLandingPage}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Choisir une page" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_LANDING_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={saveDefaultLandingPage} disabled={savingDefaultLandingPage} className="bg-violet-600 hover:bg-violet-700">
                  {savingDefaultLandingPage ? <Loader2 className="h-3.5 w-3.5 animate-pulse" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-violet-200/90">Logo sidebar → accès à Moi réservé aux admins</div>
                <div className="text-xs text-muted-foreground">
                  Quand activé, seul un admin peut ouvrir la section Moi en cliquant sur le logo en haut à gauche.
                </div>
              </div>
              <Switch
                checked={youLogoAdminOnly}
                onCheckedChange={saveYouLogoAdminOnly}
                disabled={savingYouLogoAdminOnly}
              />
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-violet-200/90">Dashboard et mises à jour</div>
                <div className="text-xs text-muted-foreground">
                  Une seule interface pour composer les mises à jour visibles sur le dashboard.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setUpdatesOpen(true)} className="shrink-0">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Ouvrir
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-violet-200/90">Maintenance</div>
                <div className={cn('text-xs', maintenanceEnabled ? 'text-amber-500' : 'text-muted-foreground')}>
                  {maintenanceEnabled
                    ? 'Maintenance globale active'
                    : maintenanceAutoWeekendEnabled
                      ? 'Activation automatique le week-end'
                      : 'Site accessible normalement'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)} className="shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Configurer
              </Button>
            </div>

            <div className="gap-4 px-4 py-3.5">
              <div className="mb-2">
                <div className="text-sm font-medium text-violet-200/90">IP STDO ignorees pour le ban rapide</div>
                <div className="text-xs text-muted-foreground">
                  Une IP par ligne. Si une IP est ici, la popup "meme IP" n'affichera pas les autres comptes lies.
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Textarea
                  value={trustedSharedIpAddresses}
                  onChange={(e) => setTrustedSharedIpAddresses(e.target.value)}
                  placeholder="Ex: 203.0.113.42"
                  className="min-h-[78px] text-xs font-mono"
                />
                <Button size="sm" onClick={saveTrustedSharedIps} disabled={savingTrustedSharedIps} className="shrink-0 sm:self-start">
                  {savingTrustedSharedIps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Annonce topbar</DialogTitle>
            <DialogDescription>Ce message s&apos;affiche pour tous les utilisateurs dans la barre du haut.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Message</label>
              <span className={cn('text-xs', announcementMessage.length >= ANNOUNCEMENT_MAX_LENGTH ? 'text-amber-400' : 'text-muted-foreground')}>
                {announcementMessage.length}/{ANNOUNCEMENT_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              placeholder="Ex: Maintenance prevue ce soir a 23h."
              className="min-h-[90px]"
              maxLength={ANNOUNCEMENT_MAX_LENGTH}
            />
            <p className="text-xs text-muted-foreground">Laisser vide pour masquer l&apos;annonce.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnouncementOpen(false)}>Annuler</Button>
            <Button onClick={async () => { await saveAnnouncement(); setAnnouncementOpen(false); }} disabled={savingAnnouncement}>
              {savingAnnouncement ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loginCommOpen} onOpenChange={setLoginCommOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Page de connexion</DialogTitle>
            <DialogDescription>Personnalisez le message et le bouton d&apos;inscription visibles sur la page de connexion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <div className="text-sm font-medium">Bouton &ldquo;Creer un compte&rdquo;</div>
                  <div className="text-xs text-muted-foreground">Affiche ou masque le gros bouton anime sur la page de connexion.</div>
                </div>
                <Switch checked={loginRegisterCtaEnabled} onCheckedChange={saveLoginRegisterCta} disabled={savingLoginRegisterCta} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={loginMessage}
                onChange={(e) => setLoginMessage(e.target.value)}
                placeholder="Ex: Bienvenue ! Le serveur est ouvert."
                className="min-h-[90px]"
              />
              <p className="text-xs text-muted-foreground">Laisser vide pour masquer le message.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginCommOpen(false)}>Annuler</Button>
            <Button onClick={async () => { await saveLoginMessage(); setLoginCommOpen(false); }} disabled={savingLoginMessage}>
              {savingLoginMessage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DashboardUpdatesManagerDialog open={updatesOpen} onOpenChange={setUpdatesOpen} />

      <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Maintenance</DialogTitle>
            <DialogDescription>Quand activee, toutes les pages affichent la maintenance sauf /admin, /login et /register.</DialogDescription>
          </DialogHeader>
          {loadingSettings ? (
            <div className="flex justify-center py-8"><div className="w-1 h-8 bg-foreground/20 animate-pulse" /></div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium">Maintenance globale</div>
                    <div className="text-xs text-muted-foreground">Active la page de maintenance sur tout le site.</div>
                  </div>
                  <Switch checked={maintenanceEnabled} onCheckedChange={setMaintenanceEnabled} />
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                  <div>
                    <div className="text-sm font-medium">Maintenance auto le week-end</div>
                    <div className="text-xs text-muted-foreground">Active automatiquement la maintenance les samedis et dimanches.</div>
                  </div>
                  <Switch checked={maintenanceAutoWeekendEnabled} onCheckedChange={setMaintenanceAutoWeekendEnabled} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Raison</label>
                <Textarea
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="Ex: Mise a jour technique en cours."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">Ce texte s&apos;affichera sur la page de maintenance.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fin de maintenance (optionnel)</label>
                <Input
                  type="datetime-local"
                  value={maintenanceEndDate}
                  onChange={(e) => setMaintenanceEndDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Si definie, un compte a rebours s&apos;affichera sur la page de maintenance.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceOpen(false)}>Annuler</Button>
            <Button onClick={async () => { await saveMaintenance(); setMaintenanceOpen(false); }} disabled={savingMaintenance}>
              {savingMaintenance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Features Section */}
      {showFeatures && (
        <div className="space-y-2 border-l-4 border-l-teal-500/80 bg-teal-950/5 dark:bg-teal-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-teal-950/10">
          <div className="flex items-center gap-2 px-1">
            <Gamepad2 className="h-4 w-4 text-teal-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-teal-400">Fonctionnalités</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium text-teal-200/90">Pages du site</div>
                <div className="text-xs text-muted-foreground">
                  {blockedPages.length > 0
                    ? `${blockedPages.length} page${blockedPages.length > 1 ? 's' : ''} désactivée${blockedPages.length > 1 ? 's' : ''}`
                    : 'Toutes les pages sont actives'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setFonctionnalitesOpen(true)} className="shrink-0">
                <Gamepad2 className="h-3.5 w-3.5 mr-1.5" />
                Gérer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Section */}
      {showDeploy && (
        <div className="space-y-2 border-l-4 border-l-slate-500/80 bg-slate-950/5 dark:bg-slate-950/10 pl-4 py-2.5 rounded-r-xl border border-border/40 transition-all hover:bg-slate-950/10">
          <div className="flex items-center gap-2 px-1">
            <Terminal className="h-4 w-4 text-slate-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Déploiement</p>
          </div>
          <div className="rounded-xl border border-border/20 overflow-hidden bg-card divide-y divide-border/20">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-200/90">Déployer la dernière version</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-1 items-center">
                  Exécute <code className="font-mono bg-muted/40 px-1 rounded text-slate-300">/var/scripts/deploy.sh</code> sur le serveur pour mettre en ligne les derniers changements Git.
                </div>
                {deployOutput && (
                  <button
                    onClick={() => setDeployModalOpen(true)}
                    className={`mt-1.5 text-xs font-semibold underline-offset-2 hover:underline ${deployOutput.success ? 'text-green-500' : 'text-destructive'}`}
                  >
                    {deployOutput.success ? 'Succès - voir la sortie' : 'Échec - voir la sortie'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={deploying}
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Lancer le déploiement ?',
                      description: 'Le serveur va pull les changements Git puis redémarrer.',
                      confirmLabel: 'Lancer',
                      cancelLabel: 'Annuler',
                      variant: 'destructive',
                    });
                    if (!confirmed) return;
                    setDeploying(true);
                    setDeployOutput(null);
                    try {
                      const res = await adminApi.deploy();
                      setDeployOutput({ success: true, stdout: res.data.stdout || '', stderr: res.data.stderr || '', message: res.data.message });
                      setDeployModalOpen(true);
                    } catch (err: unknown) {
                      const d = (err as { response?: { data?: { message?: string; stdout?: string; stderr?: string } } })?.response?.data;
                      setDeployOutput({ success: false, stdout: d?.stdout || '', stderr: d?.stderr || '', message: d?.message || String(err) });
                      setDeployModalOpen(true);
                    } finally {
                      setDeploying(false);
                    }
                  }}
                >
                  {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Terminal className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone Section */}
      {showDanger && (
        <div className="space-y-3 border-2 border-red-500/30 bg-red-950/5 dark:bg-red-950/10 p-4 rounded-2xl transition-all shadow-lg shadow-red-950/20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-500">Zone de Danger (Actions Destructives)</p>
              <p className="text-[10px] text-red-400/70">Ces actions ont un impact irréversible sur la base de données et l'expérience de jeu.</p>
            </div>
          </div>
          <div className="rounded-xl border border-red-500/20 overflow-hidden bg-card/60 backdrop-blur-sm divide-y divide-red-500/10">
            {/* Vider le chat */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-red-200">Vider le chat global</div>
                <div className="text-xs text-muted-foreground">Masque visuellement tous les messages du chat global pour les joueurs, sans supprimer l'historique stocké.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => void exportChat()} disabled={exportingChat}>
                  {exportingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                  Exporter
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-red-500/40 text-red-400 hover:bg-red-500/10" disabled={clearingChat}>
                      {clearingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Vider le chat ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tous les messages du chat seront masqués visuellement pour les joueurs. L'historique restera disponible dans l'onglet Historique chat.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={clearChat} className="bg-red-600 hover:bg-red-700">
                        Vider le chat
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Entreprises */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-red-200">Création d'entreprise</div>
                <div className="text-xs text-muted-foreground">Active ou désactive la possibilité pour les joueurs de fonder de nouvelles entreprises.</div>
              </div>
              <Switch
                checked={businessCreationEnabled}
                onCheckedChange={saveBusinessCreationEnabled}
                disabled={savingBusinessCreation}
              />
            </div>

            {/* Purger toutes les entreprises */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-red-200">Purger toutes les entreprises</div>
                <div className="text-xs text-muted-foreground">Supprime définitivement toutes les entreprises en cours et rembourse les propriétaires.</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void purgeAllBusinesses()} disabled={purgingBusinesses} className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10">
                {purgingBusinesses ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Purger les entreprises
              </Button>
            </div>

            {/* Reinitialiser les niveaux */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-red-200">Réinitialiser les niveaux débloqués</div>
                <div className="text-xs text-muted-foreground">Remet le niveau débloqué de tous les joueurs à 0 (tous devront repartir du niveau 1).</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void resetBusinessUnlockLevels()} disabled={resettingUnlockLevels} className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10">
                {resettingUnlockLevels ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Réinitialiser les niveaux
              </Button>
            </div>

            {/* Purger Marketplace d'objets */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-red-200">Purger la marketplace d'objets</div>
                <div className="text-xs text-muted-foreground">Supprime/annule toutes les offres d'objets en cours et restitue la totalité des items aux vendeurs.</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void purgeAllMarketplaceListings()} disabled={purgingMarketplaceListings} className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10">
                {purgingMarketplaceListings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                Annuler toutes les offres d'objets
              </Button>
            </div>

            {/* Purger Marché de ressources */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-semibold text-red-200">Purger le marché de ressources</div>
                <div className="text-xs text-muted-foreground">Désactive/annule toutes les offres de ressources actives et restitue les stocks aux entreprises.</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => void purgeAllResourceMarketListings()} disabled={purgingResourceMarketListings} className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10">
                {purgingResourceMarketListings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                Annuler toutes les offres de ressources
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={deployModalOpen} onOpenChange={setDeployModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Sortie du deploiement
            </DialogTitle>
            <DialogDescription>
              {deployOutput?.success ? 'Le script s\'est termine avec succes.' : 'Le script a echoue.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4">
            <pre className="text-[11px] font-mono bg-black/80 text-green-400 rounded-lg p-4 whitespace-pre-wrap break-all leading-relaxed min-h-[200px]">
              {deployOutput
                ? [deployOutput.stdout, deployOutput.stderr].filter(Boolean).join('\n') || deployOutput.message
                : ''}
            </pre>
          </div>
          <div className="px-6 py-4 border-t border-border/40 shrink-0 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setDeployModalOpen(false)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {user?.isSuperAdmin && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Classements par periode</p>
          <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <div className="text-sm font-medium">Backfill historique des scores</div>
                <div className="text-xs text-muted-foreground">
                  Importe les scores passes dans GameScoreHistory pour alimenter les classements journalier / hebdo / mensuel. A lancer une seule fois.
                </div>
                {backfillResult && (
                  <p className="text-xs text-green-500 mt-1">{backfillResult.inserted} importes, {backfillResult.skipped} ignores.</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={backfillLoading}
                className="shrink-0"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: 'Lancer le backfill des scores ?',
                    description: 'Cette operation peut prendre quelques secondes.',
                    confirmLabel: 'Lancer',
                    cancelLabel: 'Annuler',
                    variant: 'destructive',
                  });
                  if (!confirmed) return;
                  setBackfillLoading(true);
                  setBackfillResult(null);
                  try {
                    const res = await adminApi.backfillScoreHistory();
                    setBackfillResult({ inserted: res.data.inserted, skipped: res.data.skipped });
                  } catch {
                    await alert({
                      title: 'Erreur',
                      description: 'Erreur lors du backfill.',
                      confirmLabel: 'Fermer',
                      variant: 'destructive',
                    });
                  } finally {
                    setBackfillLoading(false);
                  }
                }}
              >
                {backfillLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={fonctionnalitesOpen} onOpenChange={setFonctionnalitesOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
            <DialogTitle>Fonctionnalites</DialogTitle>
            <DialogDescription>
              Activez ou desactivez chaque page. Une page desactivee disparait de la navigation et redirige vers un message.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 border-b border-border/40 space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Message d&apos;erreur
              </label>
              <Textarea
                value={blockedMessage}
                onChange={(e) => setBlockedMessage(e.target.value)}
                placeholder="Ex: Cette page est momentanement desactivee."
                className="min-h-[70px] text-sm"
              />
              <p className="text-xs text-muted-foreground">Laisser vide pour le message par defaut.</p>
            </div>

            {Object.entries(
              BLOCKABLE_PAGES.reduce<Record<string, typeof BLOCKABLE_PAGES>>((acc, page) => {
                acc[page.category] = acc[page.category] || [];
                acc[page.category].push(page);
                return acc;
              }, {} as Record<string, typeof BLOCKABLE_PAGES>)
            ).map(([category, pages]) => (
              <div key={category}>
                <div className="px-6 pt-5 pb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">{category}</span>
                  <span className="text-[11px] text-muted-foreground/50">
                    {pages.filter((p) => !blockedPages.includes(p.key)).length}/{pages.length}
                  </span>
                </div>
                <div className="mx-4 rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
                  {pages.map((page) => {
                    const isBlocked = blockedPages.includes(page.key);
                    const blockedReason = blockedPageMessages[page.key] || '';
                    return (
                      <div key={page.key} className="px-4 py-3 hover:bg-muted/30 transition-colors cursor-default space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className={cn('text-sm font-medium', isBlocked && 'text-muted-foreground/50 line-through')}>
                            {page.label}
                          </div>
                          <Switch checked={!isBlocked} onCheckedChange={() => toggleBlockedPage(page.key)} />
                        </div>
                        {isBlocked && (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                              Raison specifique
                            </label>
                            <Textarea
                              value={blockedReason}
                              onChange={(e) => updateBlockedPageMessage(page.key, e.target.value)}
                              placeholder={`Ex: ${page.label} est bloquee temporairement pour maintenance ciblee.`}
                              className="min-h-[64px] text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="h-4" />
          </div>

          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between shrink-0 bg-background">
            <span className="text-sm text-muted-foreground">
              {blockedPages.length > 0
                ? `${blockedPages.length} desactivee${blockedPages.length > 1 ? 's' : ''}`
                : 'Tout active'}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setFonctionnalitesOpen(false)}>Annuler</Button>
              <Button onClick={async () => { const ok = await saveBlockedPages(); if (ok) setFonctionnalitesOpen(false); }} disabled={savingBlocks}>
                {savingBlocks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
