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
import { AlertTriangle, Download, Gamepad2, Loader2, LogIn, MessageCircle, Save, Sparkles, Terminal, Trash2, Trophy } from 'lucide-react';
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

  return (
    <TabsContent value="settings" className={SPACING.SECTION_SPACING}>
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Systeme de presence</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Utilisateurs en ligne fictifs</div>
              <div className="text-xs text-muted-foreground">Complete la liste des connectes avec des utilisateurs hors-ligne pour maintenir un minimum de 10 % affiches.</div>
            </div>
            <Switch checked={fakeOnlineEnabled} disabled={savingFakeOnline} onCheckedChange={saveFakeOnline} />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Parrainage</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Matchmaking duel</div>
              <div className="text-xs text-muted-foreground">Affiche le bouton cote joueur et autorise l&apos;entree dans la file de matchmaking duel.</div>
            </div>
            <Switch checked={duelMatchmakingEnabled} disabled={savingDuelMatchmakingEnabled} onCheckedChange={saveDuelMatchmakingEnabled} />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Systeme de parrainage</div>
              <div className="text-xs text-muted-foreground">Coupe l&apos;usage des codes de parrainage sur l&apos;inscription et masque le module cote joueur.</div>
            </div>
            <Switch checked={referralEnabled} disabled={savingReferralEnabled} onCheckedChange={saveReferralEnabled} />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Carte de parrainage sur le dashboard</div>
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
              <div className="text-sm font-medium">Recompense par inscription</div>
              <div className="text-xs text-muted-foreground">Montant verse au parrain et au filleul quand un compte parraine est approuve.</div>
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
              <Button size="sm" onClick={saveReferralReward} disabled={savingReferralReward || !referralEnabled}>
                {savingReferralReward ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Aura distribuable par jour</div>
              <div className="text-xs text-muted-foreground">Quota global disponible pour chaque joueur a chaque reset de minuit. Valeur par defaut: 100.</div>
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
              <Button size="sm" onClick={saveDailyAuraDistributionLimit} disabled={savingDailyAuraDistributionLimit}>
                {savingDailyAuraDistributionLimit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Salle de marche</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Frais Aura Coin</div>
              <div className="text-xs text-muted-foreground">Taux applique sur les achats et ventes AuraCoin (0 = 0 %, 0.5 = 50 %).</div>
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
              <Button size="sm" onClick={saveAuraCoinBuyFee} disabled={savingAuraCoinBuyFee}>
                {savingAuraCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Frais Aura Stable</div>
              <div className="text-xs text-muted-foreground">Stable coin a faible volatilite. Meme logique de frais modifiable depuis l&apos;admin.</div>
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
              <Button size="sm" onClick={saveStableCoinBuyFee} disabled={savingStableCoinBuyFee}>
                {savingStableCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Frais Chaos Coin</div>
              <div className="text-xs text-muted-foreground">Coin tres instable avec frais separes pour equilibrer le risque et les spreads.</div>
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
              <Button size="sm" onClick={saveChaosCoinBuyFee} disabled={savingChaosCoinBuyFee}>
                {savingChaosCoinBuyFee ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Clash Village</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Temps de recharge d&apos;attaque</div>
              <div className="text-xs text-muted-foreground">Temps d&apos;attente applique apres un raid reussi ou rate. Mettre `0` pour desactiver ce temps de recharge.</div>
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
              <Button size="sm" onClick={saveClashAttackCooldown} disabled={savingClashAttackCooldown}>
                {savingClashAttackCooldown ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Communication</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="px-4 py-3.5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Blocage du chat</div>
                <div className="text-xs text-muted-foreground">
                  Coupe l&apos;envoi de messages pour les joueurs. Les admins gardent l&apos;acces pour moderer.
                </div>
              </div>
              <Switch checked={chatBlockEnabled} onCheckedChange={setChatBlockEnabled} disabled={savingChatBlockSettings} />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Message affiche aux joueurs
                </label>
                <Textarea
                  value={chatBlockMessage}
                  onChange={(event) => setChatBlockMessage(event.target.value)}
                  placeholder="Ex: Le chat est ferme pendant les heures de cours."
                  className="min-h-[88px]"
                  maxLength={CHAT_BLOCK_MESSAGE_MAX_LENGTH}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Visible dans le chat et au moment d&apos;une tentative d&apos;envoi.</span>
                  <span>{chatBlockMessage.length}/{CHAT_BLOCK_MESSAGE_MAX_LENGTH}</span>
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-xs text-muted-foreground md:w-64">
                <p className="font-medium text-foreground">Etat actuel</p>
                <p className="mt-1">
                  {chatBlockEnabled
                    ? 'Blocage manuel active'
                    : chatAutoBlockEnabled
                      ? `Blocage auto configure de ${chatAutoBlockStart} a ${chatAutoBlockEnd}`
                      : 'Chat ouvert'}
                </p>
                <p className="mt-1">Fuseau horaire: {CHAT_BLOCK_TIMEZONE}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border/40 bg-background/30 p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">Blocage automatique quotidien</div>
                  <div className="text-xs text-muted-foreground">
                    Active un blocage chaque jour sur un creneau fixe. Gere aussi les plages qui passent minuit.
                  </div>
                </div>
                <Switch checked={chatAutoBlockEnabled} onCheckedChange={setChatAutoBlockEnabled} disabled={savingChatBlockSettings} />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Debut
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
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
              <Button onClick={saveChatBlockSettings} disabled={savingChatBlockSettings}>
                {savingChatBlockSettings ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Sauvegarder le chat
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Annonce topbar</div>
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
              <div className="text-sm font-medium">Page de connexion</div>
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
              <div className="text-sm font-medium">Page principale du site</div>
              <div className="text-xs text-muted-foreground">
                {DEFAULT_LANDING_PAGE_OPTIONS.find((option) => option.value === defaultLandingPage)?.label ?? 'Tableau de bord'} ouvre quand un utilisateur connecte arrive sur `auratracker.xyz`.
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
              <Button size="sm" onClick={saveDefaultLandingPage} disabled={savingDefaultLandingPage}>
                {savingDefaultLandingPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Logo sidebar → acces a Moi reserve aux admins</div>
              <div className="text-xs text-muted-foreground">
                Quand active, seul un admin peut ouvrir la section Moi en cliquant sur le logo en haut a gauche.
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
              <div className="text-sm font-medium">Dashboard et mises a jour</div>
              <div className="text-xs text-muted-foreground">
                Une seule interface pour composer les mises a jour visibles sur le dashboard.
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUpdatesOpen(true)} className="shrink-0">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Ouvrir
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Maintenance</div>
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

          <div className="mx-4 border-t border-border/30 pt-3 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entreprises</p>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Creation d'entreprise</div>
              <div className="text-xs text-muted-foreground">
                Quand desactive, les joueurs ne peuvent plus creer de nouvelles entreprises.
              </div>
            </div>
            <Switch
              checked={businessCreationEnabled}
              onCheckedChange={saveBusinessCreationEnabled}
              disabled={savingBusinessCreation}
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Purger toutes les entreprises</div>
              <div className="text-xs text-muted-foreground">
                Supprime toutes les entreprises et rembourse chaque proprietaire.
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void purgeAllBusinesses()} disabled={purgingBusinesses} className="shrink-0 border-red-400/30 text-red-300 hover:bg-red-500/10">
              {purgingBusinesses ? 'Purge...' : 'Purger'}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Reinitialiser les niveaux debloques</div>
              <div className="text-xs text-muted-foreground">
                Remet le niveau debloque de tous les joueurs a 0 (niveau 1 accessible a nouveau).
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void resetBusinessUnlockLevels()} disabled={resettingUnlockLevels} className="shrink-0">
              {resettingUnlockLevels ? 'Reset...' : 'Reinitialiser'}
            </Button>
          </div>
        </div>
      </div>

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

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Fonctionnalites</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium">Pages du site</div>
              <div className="text-xs text-muted-foreground">
                {blockedPages.length > 0
                  ? `${blockedPages.length} page${blockedPages.length > 1 ? 's' : ''} desactivee${blockedPages.length > 1 ? 's' : ''}`
                  : 'Toutes les pages sont actives'}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFonctionnalitesOpen(true)} className="shrink-0">
              <Gamepad2 className="h-3.5 w-3.5 mr-1.5" />
              Gerer
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Actions sensibles</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-sm font-medium text-destructive">Vider le chat</div>
              <div className="text-xs text-muted-foreground">Masque visuellement tous les messages du chat global, sans supprimer l&apos;historique stocke.</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => void exportChat()} disabled={exportingChat}>
                {exportingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                Exporter
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive/10" disabled={clearingChat}>
                    {clearingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Vider le chat ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Tous les messages du chat seront masques visuellement pour les joueurs. L&apos;historique restera disponible dans l&apos;onglet Historique chat.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={clearChat} className="bg-destructive hover:bg-destructive/90">
                      Vider le chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">Deploiement</p>
        <div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <div className="text-sm font-medium">Deployer la derniere version</div>
              <div className="text-xs text-muted-foreground">Execute <code className="font-mono bg-muted/40 px-1 rounded">/var/scripts/deploy.sh</code> sur le serveur pour mettre en ligne les derniers changements Git.</div>
              {deployOutput && (
                <button
                  onClick={() => setDeployModalOpen(true)}
                  className={`mt-1.5 text-xs font-medium underline-offset-2 hover:underline ${deployOutput.success ? 'text-green-500' : 'text-destructive'}`}
                >
                  {deployOutput.success ? 'Succes - voir la sortie' : 'Echec - voir la sortie'}
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
                    title: 'Lancer le deploiement ?',
                    description: 'Le serveur va pull les changements Git puis redemarrer.',
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
