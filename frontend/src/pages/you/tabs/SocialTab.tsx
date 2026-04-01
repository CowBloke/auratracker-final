import { useState } from 'react';
import { Heart, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type YouState, youApi } from '@/services/api';
import { MarriageModal, MeetModal } from '../components/modals';
import { ActionCard, ActionRow, Pill, ProgressBar, SectionTitle, UserAvatar } from '../components/ui';
import { getRelationshipPill, withRouteError } from '../utils';

export function SocialTab({ data, onReload }: { data: YouState; onReload: () => Promise<void> }) {
  const [meetOpen, setMeetOpen] = useState(false);
  const [marryOpen, setMarryOpen] = useState(false);
  const eligibleForMarriage = data.relationships.filter((relationship) => relationship.canProposeMarriage);
  const incomingProposals = data.relationships.filter((relationship) => relationship.pendingProposal?.canRespond);
  const incomingDivorceProposals = data.relationships.filter((relationship) => relationship.pendingDivorceProposal?.canRespond);

  const respondToProposal = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToMarriageProposal(proposalId, decision), 'Impossible de traiter la demande.');
    toast.success(decision === 'accept' ? 'Mariage valide' : 'Demande refusee');
    await onReload();
  };

  const divorce = async (relationshipId: string) => {
    await withRouteError(() => youApi.divorceRelationship(relationshipId), 'Impossible d enregistrer la demande de divorce.');
    toast.success('Demande de divorce envoyee');
    await onReload();
  };

  const respondToDivorce = async (proposalId: string, decision: 'accept' | 'reject') => {
    await withRouteError(() => youApi.respondToDivorceProposal(proposalId, decision), 'Impossible de traiter la demande de divorce.');
    toast.success(decision === 'accept' ? 'Divorce valide' : 'Divorce refuse');
    await onReload();
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionTitle>Actions</SectionTitle>
          <ActionCard><ActionRow icon={UserPlus} label="Nouvelle relation" sub={`${data.players.filter((player) => !player.alreadyInRelationship).length} joueur(s) disponible(s)`} iconBg="bg-purple-400/15" iconColor="text-purple-400" onClick={() => setMeetOpen(true)} /><ActionRow icon={Heart} label="Demander en mariage" sub={eligibleForMarriage.length > 0 ? `${eligibleForMarriage.length} relation(s) eligible(s)` : 'Relation +70 requise'} iconBg="bg-red-400/15" iconColor="text-red-400" onClick={() => setMarryOpen(true)} /></ActionCard>
          {incomingProposals.length > 0 ? <><SectionTitle>Demandes de mariage</SectionTitle><Card><CardContent className="space-y-3 px-5 py-4">{incomingProposals.map((relationship) => <div key={relationship.id} className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3"><p className="text-sm font-semibold">{relationship.otherUser.username}</p><p className="mt-1 text-xs text-muted-foreground">{relationship.pendingProposal?.message?.trim() || 'Aucun message joint.'}</p><div className="mt-3 flex gap-2"><Button size="sm" className="text-xs" onClick={() => void respondToProposal(relationship.pendingProposal!.id, 'accept')}>Accepter</Button><Button size="sm" variant="outline" className="text-xs" onClick={() => void respondToProposal(relationship.pendingProposal!.id, 'reject')}>Refuser</Button></div></div>)}</CardContent></Card></> : null}
          {incomingDivorceProposals.length > 0 ? <><SectionTitle>Demandes de divorce</SectionTitle><Card><CardContent className="space-y-3 px-5 py-4">{incomingDivorceProposals.map((relationship) => <div key={relationship.id} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3"><p className="text-sm font-semibold">{relationship.otherUser.username}</p><p className="mt-1 text-xs text-muted-foreground">{relationship.pendingDivorceProposal?.message?.trim() || 'Aucun message joint.'}</p><div className="mt-3 flex gap-2"><Button size="sm" className="text-xs" onClick={() => void respondToDivorce(relationship.pendingDivorceProposal!.id, 'accept')}>Valider</Button><Button size="sm" variant="outline" className="text-xs" onClick={() => void respondToDivorce(relationship.pendingDivorceProposal!.id, 'reject')}>Refuser</Button></div></div>)}</CardContent></Card></> : null}
        </div>
        <div className="space-y-4">
          <SectionTitle>Relations ({data.relationships.length})</SectionTitle>
          {data.relationships.length === 0 ? <Card><CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">Aucune relation en base. Cree-en une avec un vrai joueur depuis le panneau de gauche.</CardContent></Card> : data.relationships.map((relationship) => { const pill = getRelationshipPill(relationship.status); return <Card key={relationship.id}><CardContent className="space-y-4 px-5 py-4"><div className="flex items-start gap-3"><UserAvatar player={relationship.otherUser} className="h-11 w-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold">{relationship.otherUser.username}</p><Pill label={pill.label} color={pill.color} />{relationship.pendingProposal ? <Pill label={relationship.pendingProposal.direction === 'sent' ? 'Demande envoyee' : 'Demande recue'} color="bg-amber-400/15 text-amber-400" /> : null}{relationship.pendingDivorceProposal ? <Pill label={relationship.pendingDivorceProposal.direction === 'sent' ? 'Divorce envoye' : 'Divorce recu'} color="bg-rose-400/15 text-rose-300" /> : null}</div><p className="mt-1 text-sm text-muted-foreground">{relationship.otherUser.bio?.trim() || 'Aucune bio renseignee.'}</p></div><span className="text-sm font-bold tabular-nums text-pink-400">{relationship.connectionLevel}%</span></div><div className="space-y-1"><div className="flex justify-between text-[11px] text-muted-foreground"><span>Connexion</span><span>{relationship.status === 'MARRIED' ? 'Statut finalise' : relationship.status === 'DIVORCED' ? 'Relation terminee' : 'Evolution active'}</span></div><ProgressBar value={relationship.connectionLevel} color="bg-pink-400" /></div>{relationship.pendingProposal ? <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">{relationship.pendingProposal.direction === 'sent' ? 'Ta demande en mariage est en attente.' : 'Une demande en mariage attend ta reponse.'}</div> : null}{relationship.pendingDivorceProposal ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-100">{relationship.pendingDivorceProposal.direction === 'sent' ? 'Ta demande de divorce attend une validation mutuelle.' : 'Une demande de divorce attend ta reponse.'}</div> : null}{relationship.canDivorce ? <div className="flex justify-end"><Button size="sm" variant="outline" className="text-xs text-red-300" onClick={() => void divorce(relationship.id)}>Demander le divorce</Button></div> : null}</CardContent></Card>; })}
        </div>
      </div>
      <MeetModal open={meetOpen} onClose={() => setMeetOpen(false)} players={data.players} onSubmitted={onReload} />
      <MarriageModal open={marryOpen} onClose={() => setMarryOpen(false)} relationships={eligibleForMarriage} onSubmitted={onReload} />
    </>
  );
}
