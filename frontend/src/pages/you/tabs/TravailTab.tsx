import { useEffect, useState } from 'react';
import { Building2, Megaphone, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAppDialog } from '@/contexts/AppDialogContext';
import { type Ad, adsApi, type YouBusiness, type YouBusinessShareProposal, type YouPlayer, type YouState, youApi } from '@/services/api';
import { AdBanner } from '@/components/ads/AdBanner';
import { BUSINESS_ICON_MAP } from '../constants';
import { CreateBusinessModal, InvitePlayersModal, ManageBusinessModal } from '../components/modals';
import { ActionCard, ActionRow, Pill, SectionTitle } from '../components/YouPrimitives';
import { formatMoney, withRouteError } from '../utils';

function BusinessCard({ business, onOpen }: { business: YouBusiness; onOpen: (b: YouBusiness) => void }) {
  const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 px-5 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/20">
          <Icon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{business.name}</p>
            {business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}
            {business.isShared ? <Pill label={`Partagee · ${business.ownerSharePercent.toFixed(0)}% fondateur`} color="bg-amber-400/15 text-amber-300" /> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue: +{formatMoney(business.monthlyRevenue)}
            {business.ownerKind === 'player' ? <span className="ml-2 text-muted-foreground/60">· {business.owner.username}</span> : null}
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => onOpen(business)}>Ouvrir</Button>
      </CardContent>
    </Card>
  );
}

export function TravailTab({ data, players, currentUserId, adblockActive, onReload }: { data: YouState; players: YouPlayer[]; currentUserId: string; adblockActive: boolean; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteBusinessId, setInviteBusinessId] = useState<string | null>(null);
  const [managedBusinessId, setManagedBusinessId] = useState<string | null>(null);
  const [cancellingOfferId, setCancellingOfferId] = useState<string | null>(null);
  const [cancellingProposalId, setCancellingProposalId] = useState<string | null>(null);
  const [leavingBusinessId, setLeavingBusinessId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const canCreateBusiness = isAdmin || data.ownedBusinesses.length < data.businessSlots;
  const unlockedLevel = data.unlockedBusinessLevel ?? 0;
  const slotLabel = isAdmin ? 'Illimite' : `${data.ownedBusinesses.length}/${data.businessSlots} slot(s)`;
  const allBusinesses = [...data.ownedBusinesses, ...data.memberBusinesses, ...data.shareholderBusinesses];
  const inviteBusiness = inviteBusinessId ? allBusinesses.find((business) => business.id === inviteBusinessId) ?? null : null;
  const managedBusiness = managedBusinessId ? allBusinesses.find((business) => business.id === managedBusinessId) ?? null : null;

  const respondToJobOffer = async (offerId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToBusinessInvitation(offerId, decision), 'Impossible de traiter ce contrat.');
    toast.success(decision === 'accept' ? 'Contrat mis a jour' : 'Contrat refuse');
    await onReload(true);
  };

  const [bannerAd, setBannerAd] = useState<Ad | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (adblockActive) {
      setBannerAd(null);
      return;
    }
    void adsApi.listPublic({ limit: 1 }).then((res) => setBannerAd(res.data.ads[0] ?? null)).catch(() => {});
  }, [adblockActive]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const cancelBuyoutOffer = async (offerId: string) => {
    setCancellingOfferId(offerId);
    try {
      await youApi.cancelBuyoutOffer(offerId);
      toast.success('Offre de rachat annulee');
      await onReload(true);
    } catch {
      toast.error('Impossible d annuler cette offre.');
    } finally {
      setCancellingOfferId(null);
    }
  };

  const cancelShareholderProposal = async (proposalId: string) => {
    setCancellingProposalId(proposalId);
    try {
      await withRouteError(() => youApi.cancelShareholderProposal(proposalId), 'Impossible d annuler cette proposition.');
      toast.success('Proposition annulee');
      await onReload(true);
    } catch {
      // withRouteError already shows contextual message
    } finally {
      setCancellingProposalId(null);
    }
  };

  const canCancelShareProposal = (proposal: YouBusinessShareProposal) => now >= new Date(proposal.cancelAvailableAt).getTime();

  const getShareProposalCancelCountdown = (proposal: YouBusinessShareProposal) => {
    const remainingMs = new Date(proposal.cancelAvailableAt).getTime() - now;
    if (remainingMs <= 0) {
      return null;
    }

    const remainingMinutes = Math.ceil(remainingMs / 60_000);
    const days = Math.floor(remainingMinutes / (24 * 60));
    const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
    const minutes = remainingMinutes % 60;

    if (days > 0) {
      return `${days}j ${hours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }

    return `${minutes}min`;
  };

  const leaveBusiness = async (business: YouBusiness) => {
    if (!(await confirm(`Quitter ton poste chez ${business.name} ?`))) return;
    setLeavingBusinessId(business.id);
    try {
      await withRouteError(() => youApi.leaveBusiness(business.id), 'Impossible de quitter ce travail.');
      toast.success('Tu as quitte ce travail.');
      await onReload(true);
    } finally {
      setLeavingBusinessId(null);
    }
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard>
            <ActionRow
              icon={Building2}
              label="Creer une entreprise"
              sub={`${slotLabel} · Niveau debloque : ${unlockedLevel}`}
              iconBg="bg-emerald-400/15"
              iconColor="text-emerald-400"
              dataTutorialId="travail-create-business-action"
              onClick={() => { if (canCreateBusiness) setCreateOpen(true); else toast.error('Monte Affaires pour debloquer un nouveau slot business.'); }}
            />
            <ActionRow
              icon={Megaphone}
              label="Gerer mes publicites"
              sub="Cree des annonces pour tes entreprises"
              iconBg="bg-violet-400/15"
              iconColor="text-violet-400"
              onClick={() => { window.location.href = '?tab=publicites'; }}
            />
          </ActionCard>
        </div>
        <div className="space-y-6">
          <div className="space-y-4" data-tutorial-id="travail-owned-businesses">
            <SectionTitle>Mes entreprises ({isAdmin ? `${data.ownedBusinesses.length}/Illimite` : `${data.ownedBusinesses.length}/${data.businessSlots}`})</SectionTitle>
            {data.ownedBusinesses.length === 0
              ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune entreprise creee. Ouvre-en une depuis cette page pour utiliser ton argent reel du site.</CardContent></Card>
              : data.ownedBusinesses.map((business) => <BusinessCard key={business.id} business={business} onOpen={(entry) => setManagedBusinessId(entry.id)} />)
            }
          </div>
          {!adblockActive && bannerAd && !bannerDismissed ? <AdBanner ad={bannerAd} onDismiss={() => setBannerDismissed(true)} /> : null}

          {data.jobOffers.length > 0 && (
            <div className="space-y-4">
              <SectionTitle>Contrats en attente ({data.jobOffers.length})</SectionTitle>
              {data.jobOffers.map((offer) => (
                <Card key={offer.id}>
                  <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">{offer.business.name}</p>
                        <Pill
                          label={offer.initiatedByRole === 'EMPLOYER' ? 'Offre' : 'Candidature'}
                          color="bg-violet-400/15 text-violet-300"
                        />
                        <Pill label={`${offer.salary.toLocaleString('fr-FR')} / jour`} color="bg-emerald-400/15 text-emerald-300" />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {offer.initiatedByRole === 'EMPLOYER'
                          ? `${offer.employer.username} propose le role ${offer.role}`
                          : `${offer.employee.username} candidate comme ${offer.role}`}
                      </p>
                      {offer.message ? <p className="mt-1 text-xs text-muted-foreground/80">"{offer.message}"</p> : null}
                      {!offer.needsViewerAcceptance ? (
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          En attente de validation par {offer.waitingOn === 'EMPLOYER' ? "l'employeur" : offer.waitingOn === 'EMPLOYEE' ? "l'employe" : "l'autre partie"}.
                        </p>
                      ) : null}
                    </div>
                    {offer.needsViewerAcceptance ? (
                      <div className="flex gap-2">
                        <Button size="sm" className="text-xs" onClick={() => void respondToJobOffer(offer.id, 'accept')}>Accepter</Button>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => void respondToJobOffer(offer.id, 'reject')}>Refuser</Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {data.memberBusinesses.length > 0 && (
            <div className="space-y-4">
              <SectionTitle>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Employe dans ({data.memberBusinesses.length})
                </span>
              </SectionTitle>
              {data.memberBusinesses.map((business) => {
                const myMembership = business.members.find((m) => m.user.id === currentUserId);
                const roleLabel = myMembership?.role ?? 'employe';
                return (
                  <Card key={business.id}>
                    <CardContent className="flex items-center gap-4 px-5 py-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/20">
                        {(() => { const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <Icon className="h-5 w-5 text-foreground" />; })()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold">{business.name}</p>
                          {business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}
                          <Pill label={roleLabel} color="bg-violet-400/15 text-violet-400" />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Proprietaire: {business.owner.username} · Salaire: {formatMoney(myMembership?.salary ?? 0)} / jour
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => setManagedBusinessId(business.id)}>Gerer</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-rose-300 hover:text-rose-200"
                          onClick={() => void leaveBusiness(business)}
                          disabled={leavingBusinessId !== null}
                        >
                          Quitter
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              <p className="text-xs text-muted-foreground/60 px-1">Ces entreprises ne comptent pas dans ton quota de slots.</p>
            </div>
          )}
          {data.shareholderBusinesses.length > 0 && (
            <div className="space-y-4">
              <SectionTitle>Participations actionnaires ({data.shareholderBusinesses.length})</SectionTitle>
              {data.shareholderBusinesses.map((business) => (
                <Card key={business.id}>
                  <CardContent className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/20">
                      {(() => { const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <Icon className="h-5 w-5 text-foreground" />; })()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold">{business.name}</p>
                        <Pill label={`${business.viewerSharePercent.toFixed(0)}% a toi`} color="bg-amber-400/15 text-amber-300" />
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Proprietaire: {business.owner.username} · Investi: {formatMoney(business.viewerInvestedAmount)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setManagedBusinessId(business.id)}>Voir</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {data.sentBuyoutOffers.length > 0 && (
            <div className="space-y-4">
              <SectionTitle>Offres de rachat envoyees ({data.sentBuyoutOffers.length})</SectionTitle>
              {data.sentBuyoutOffers.map((offer) => (
                <Card key={offer.id}>
                  <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{offer.business?.name ?? 'Business'}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatMoney(offer.amount)} money · {offer.status}</p>
                      {offer.message ? <p className="mt-1 text-xs text-muted-foreground/80">"{offer.message}"</p> : null}
                    </div>
                    {offer.status === 'PENDING' ? <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => void cancelBuyoutOffer(offer.id)} disabled={cancellingOfferId !== null}>Annuler</Button> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {data.sentShareholderProposals.length > 0 && (
            <div className="space-y-4">
              <SectionTitle>Propositions actionnaires envoyees ({data.sentShareholderProposals.length})</SectionTitle>
              {data.sentShareholderProposals.map((proposal) => (
                <Card key={proposal.id}>
                  <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-base font-semibold">{proposal.business?.name ?? 'Business'}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {proposal.sharePercent.toLocaleString('fr-FR')}% · {formatMoney(proposal.amount)} · {proposal.status}
                      </p>
                      {proposal.message ? <p className="mt-1 text-xs text-muted-foreground/80">"{proposal.message}"</p> : null}
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right">
                      <p>Suggestion: {formatMoney(proposal.suggestedAmount)}</p>
                      <p>Proprio: {proposal.owner.username}</p>
                      {proposal.status === 'PENDING' && !canCancelShareProposal(proposal) ? (
                        <p className="mt-1">Annulable dans {getShareProposalCancelCountdown(proposal) ?? 'moins d une minute'} (minimum 1 semaine in game)</p>
                      ) : null}
                      {proposal.status === 'PENDING' && canCancelShareProposal(proposal) ? (
                        <p className="mt-1 text-emerald-300">Tu peux la laisser active ou la retirer maintenant.</p>
                      ) : null}
                    </div>
                  </CardContent>
                  {proposal.status === 'PENDING' && canCancelShareProposal(proposal) ? (
                    <div className="flex justify-end px-5 pb-4">
                      <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => void cancelShareholderProposal(proposal.id)} disabled={cancellingProposalId !== null}>
                        Retirer la proposition et recuperer l argent
                      </Button>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} businessTypes={data.businessTypes} unlockedBusinessLevel={data.unlockedBusinessLevel ?? 0} onCreated={() => onReload(true)} />
      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusinessId(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
      <ManageBusinessModal open={Boolean(managedBusiness)} onClose={() => setManagedBusinessId(null)} business={managedBusiness} players={players} currentUserId={currentUserId} onInviteRequested={(business) => setInviteBusinessId(business.id)} onSubmitted={onReload} />
    </>
  );
}
