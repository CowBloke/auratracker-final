import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type YouBusiness, type YouPlayer, type YouState } from '@/services/api';
import { BUSINESS_ICON_MAP } from '../constants';
import { CreateBusinessModal, InvitePlayersModal, ManageBusinessModal } from '../components/modals';
import { ActionCard, ActionRow, Pill, SectionTitle } from '../components/ui';
import { formatMoney } from '../utils';

export function TravailTab({ data, players, onReload }: { data: YouState; players: YouPlayer[]; onReload: (refreshBalance?: boolean) => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteBusiness, setInviteBusiness] = useState<YouBusiness | null>(null);
  const [managedBusiness, setManagedBusiness] = useState<YouBusiness | null>(null);
  const canCreateBusiness = data.ownedBusinesses.length < data.businessSlots;

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard><ActionRow icon={Building2} label="Creer une entreprise" sub={`${data.ownedBusinesses.length}/${data.businessSlots} slot(s) utilises`} iconBg="bg-emerald-400/15" iconColor="text-emerald-400" onClick={() => { if (canCreateBusiness) setCreateOpen(true); else toast.error('Monte Affaires pour debloquer un nouveau slot business.'); }} /></ActionCard>
        </div>
        <div className="space-y-4">
          <SectionTitle>Mes entreprises ({data.ownedBusinesses.length}/{data.businessSlots})</SectionTitle>
          {data.ownedBusinesses.length === 0 ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune entreprise creee. Ouvre-en une depuis cette page pour utiliser ton argent reel du site.</CardContent></Card> : data.ownedBusinesses.map((business) => { const Icon = BUSINESS_ICON_MAP[business.typeKey as keyof typeof BUSINESS_ICON_MAP] ?? Building2; return <Card key={business.id}><CardContent className="flex items-center gap-4 px-5 py-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/20"><Icon className="h-5 w-5 text-foreground" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{business.name}</p>{business.type ? <Pill label={business.type.label} color="bg-sky-400/15 text-sky-400" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">Revenue: +{formatMoney(business.monthlyRevenue)}</p></div><Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setManagedBusiness(business)}>Ouvrir</Button></CardContent></Card>; })}
        </div>
      </div>
      <CreateBusinessModal open={createOpen} onClose={() => setCreateOpen(false)} businessTypes={data.businessTypes} onCreated={() => onReload(true)} />
      <InvitePlayersModal open={Boolean(inviteBusiness)} onClose={() => setInviteBusiness(null)} business={inviteBusiness} players={players} onSubmitted={() => onReload()} />
      <ManageBusinessModal open={Boolean(managedBusiness)} onClose={() => setManagedBusiness(null)} business={managedBusiness} onInviteRequested={setInviteBusiness} onSubmitted={onReload} />
    </>
  );
}
