import { useState } from 'react';
import { Building2, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type YouBusiness, type YouPlayer, type YouState, youApi } from '@/services/api';
import { BUSINESS_ICON_MAP } from '../constants';
import { CreateBusinessModal, InvitePlayersModal, ManageBusinessModal } from '../components/modals';
import { ActionCard, ActionRow, Pill, SectionTitle } from '../components/ui';
import { formatMoney } from '../utils';

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

export function TravailTab({ data, players, onReload }: { data: YouState; players: YouPlayer[]; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteBusinessId, setInviteBusinessId] = useState<string | null>(null);
  const [managedBusinessId, setManagedBusinessId] = useState<string | null>(null);
  const [cancellingOfferId, setCancellingOfferId] = useState<string | null>(null);
  const canCreateBusiness = data.ownedBusinesses.length < data.businessSlots;
  const unlockedLevel = data.unlockedBusinessLevel ?? 0;
  const allBusinesses = [...data.ownedBusinesses, ...data.memberBusinesses];
  const inviteBusiness = inviteBusinessId ? allBusinesses.find((business) => business.id === inviteBusinessId) ?? null : null;
  const managedBusiness = managedBusinessId ? allBusinesses.find((business) => business.id === managedBusinessId) ?? null : null;

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

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard>
            <ActionRow icon={Building2} label="Creer une entreprise" sub={`${data.ownedBusinesses.length}/${data.businessSlots} slot(s) · Niveau debloque : ${unlockedLevel}`} iconBg="bg-emerald-400/15" iconColor="text-emerald-400" onClick={() => { if (canCreateBusiness) setCreateOpen(true); else toast.error('Monte Affaires pour debloquer un nouveau slot business.'); }} />
          </ActionCard>
        </div>
        <div className="space-y-6">
          <div className="space-y-4">
            <SectionTitle>Mes entreprises ({data.ownedBusinesses.length}/{data.businessSlots})</SectionTitle>
            {data.ownedBusinesses.length === 0
              ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune entreprise creee. Ouvre-en une depuis cette page pour utiliser ton argent reel du site.</CardContent></Card>
              : data.ownedBusinesses.map((business) => <BusinessCard key={business.id} business={business} onOpen={(entry) => setManagedBusinessId(entry.id)} />)
            }
          </div>
          {data.memberBusinesses.length > 0 && (
            <div className="space-y-4">
              <SectionTitle>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Employe dans ({data.memberBusinesses.length})
                </span>
              </SectionTitle>
              {data.memberBusinesses.map((business) => {
                const myMembership = business.members.find((m) => m.user.id === undefined);
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
                          Proprietaire: {business.owner.username} · Revenue: +{formatMoney(business.monthlyRevenue)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setManagedBusinessId(business.id)}>Gerer</Button>
                    </CardContent>
                  </Card>
                );
              })}
              <p className="text-xs text-muted-foreground/60 px-1">Ces entreprises ne comptent pas dans ton quota de slots.</p>
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
        </div>
      </div>
      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} businessTypes={data.businessTypes} unlockedBusinessLevel={data.unlockedBusinessLevel ?? 0} onCreated={() => onReload(true)} />
      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusinessId(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
      <ManageBusinessModal open={Boolean(managedBusiness)} onClose={() => setManagedBusinessId(null)} business={managedBusiness} onInviteRequested={(business) => setInviteBusinessId(business.id)} onSubmitted={onReload} />
    </>
  );
}
