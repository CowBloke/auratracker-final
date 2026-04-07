import { useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Gavel, Heart, Scale, Trash2, UserPlus, Wallet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type YouCourtCase, type YouRelationship, type YouState, youApi } from '@/services/api';
import { NewRelationModal } from '../components/modals';
import { Pill, SectionTitle, UserAvatar } from '../components/ui';
import { getRelationshipPill, withRouteError } from '../utils';

function RelationListItem({
  relationship,
  selected,
  onClick,
}: {
  relationship: YouRelationship;
  selected: boolean;
  onClick: () => void;
}) {
  const pill = getRelationshipPill(relationship.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${selected ? 'bg-muted/30 ring-1 ring-border/60' : 'hover:bg-muted/20'}`}
    >
      <UserAvatar player={relationship.otherUser} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{relationship.otherUser.username}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <Pill label={pill.label} color={pill.color} />
          {(relationship.pendingProposal || relationship.pendingDivorceProposal) && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          )}
          {relationship.hasPendingCourtCase && (
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          )}
        </div>
      </div>
    </button>
  );
}

function CourtCaseItem({
  courtCase,
  onReload,
}: {
  courtCase: YouCourtCase;
  onReload: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const respond = async (decision: 'court' | 'drop') => {
    setLoading(true);
    try {
      await withRouteError(() => youApi.respondToCourtCase(courtCase.id, decision), 'Impossible de repondre.');
      if (decision === 'court') {
        toast.success('Jugement rendu - tu as recupere tout l argent');
      } else {
        toast.success('Accusation ignoree');
      }
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-rose-400" />
        <p className="text-sm font-semibold text-rose-300">Suspicion de tricherie</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{courtCase.accuser.username}</span> te soupçonne de tricherie.
        Aller en justice te permet de prendre tout son argent si la suspicion est infondee.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="destructive" className="text-xs" disabled={loading} onClick={() => void respond('court')}>
          <Scale className="mr-1.5 h-3.5 w-3.5" />
          Aller en justice
        </Button>
        <Button size="sm" variant="outline" className="text-xs" disabled={loading} onClick={() => void respond('drop')}>
          Ignorer
        </Button>
      </div>
    </div>
  );
}

function RelationActions({
  relationship,
  onReload,
}: {
  relationship: YouRelationship;
  onReload: () => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmMarriage, setConfirmMarriage] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const [confirmMistress, setConfirmMistress] = useState(false);
  const [confirmSuspect, setConfirmSuspect] = useState(false);
  const [coupleAmount, setCoupleAmount] = useState('');

  const run = async (key: string, fn: () => Promise<void>) => {
    setLoading(key);
    try {
      await fn();
      await onReload();
    } finally {
      setLoading(null);
    }
  };

  const coupleDeposit = () =>
    run('coupleDeposit', async () => {
      const amt = parseInt(coupleAmount, 10);
      await withRouteError(() => youApi.coupleDeposit(relationship.id, amt), 'Impossible de deposer.');
      setCoupleAmount('');
      toast.success(`+${amt} deposé sur le compte commun`);
    });

  const coupleWithdraw = () =>
    run('coupleWithdraw', async () => {
      const amt = parseInt(coupleAmount, 10);
      await withRouteError(() => youApi.coupleWithdraw(relationship.id, amt), 'Impossible de retirer.');
      setCoupleAmount('');
      toast.success(`${amt} retiré du compte commun`);
    });

  const respondToProposal = (proposalId: string, decision: 'accept' | 'reject') =>
    run('proposal', async () => {
      await withRouteError(() => youApi.respondToMarriageProposal(proposalId, decision), 'Impossible de traiter la demande.');
      toast.success(decision === 'accept' ? 'Mariage valide' : 'Demande refusee');
    });

  const divorce = () =>
    run('divorce', async () => {
      await withRouteError(() => youApi.divorceRelationship(relationship.id), 'Impossible d enregistrer la demande de divorce.');
      toast.success('Demande de divorce envoyee');
    });

  const respondToDivorce = (proposalId: string, decision: 'accept' | 'reject') =>
    run('divorceRespond', async () => {
      await withRouteError(() => youApi.respondToDivorceProposal(proposalId, decision), 'Impossible de traiter la demande de divorce.');
      toast.success(decision === 'accept' ? 'Divorce valide - argent partage' : 'Divorce refuse');
    });

  const proposeMarriage = () =>
    run('proposeMarriage', async () => {
      await withRouteError(() => youApi.proposeMarriage(relationship.id), 'Impossible d envoyer la demande.');
      toast.success('Demande en mariage envoyee');
    });

  const forget = () =>
    run('forget', async () => {
      await withRouteError(() => youApi.forgetRelationship(relationship.id), 'Impossible d oublier cette relation.');
      toast.success('Relation supprimee');
    });

  const makeMistress = () =>
    run('mistress', async () => {
      await withRouteError(() => youApi.makeMistress(relationship.id), 'Impossible de modifier la relation.');
      toast.success('Liaison creee');
    });

  const suspectCheating = () =>
    run('suspect', async () => {
      const result = await withRouteError(() => youApi.suspectCheating(relationship.id), 'Impossible d envoyer la suspicion.');
      if (result?.data?.correct) {
        toast.success('Tricherie prouvee ! Tu as recupere tout l argent.');
      } else {
        toast.info('Suspicion envoyee. Ton conjoint peut aller en justice.');
      }
    });

  const pill = getRelationshipPill(relationship.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UserAvatar player={relationship.otherUser} className="h-12 w-12" />
        <div>
          <p className="text-base font-semibold">{relationship.otherUser.username}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pill label={pill.label} color={pill.color} />
            {relationship.pendingProposal && (
              <Pill
                label={relationship.pendingProposal.direction === 'sent' ? 'Demande envoyee' : 'Demande recue'}
                color="bg-amber-400/15 text-amber-400"
              />
            )}
            {relationship.pendingDivorceProposal && (
              <Pill
                label={relationship.pendingDivorceProposal.direction === 'sent' ? 'Divorce envoye' : 'Divorce recu'}
                color="bg-rose-400/15 text-rose-300"
              />
            )}
          </div>
        </div>
      </div>

      {relationship.otherUser.bio?.trim() && (
        <p className="text-sm text-muted-foreground">{relationship.otherUser.bio}</p>
      )}

      {/* Couple account */}
      {relationship.status === 'MARRIED' && (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Compte commun</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{relationship.coupleBalance.toLocaleString()} M</span>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              placeholder="Montant"
              value={coupleAmount}
              onChange={(e) => setCoupleAmount(e.target.value)}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-emerald-400"
              disabled={!!loading || !coupleAmount || parseInt(coupleAmount, 10) <= 0}
              onClick={() => void coupleDeposit()}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Déposer
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs text-amber-400"
              disabled={!!loading || !coupleAmount || parseInt(coupleAmount, 10) <= 0}
              onClick={() => void coupleWithdraw()}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Retirer
            </Button>
          </div>
        </div>
      )}

      {/* Marriage proposal received */}
      {relationship.pendingProposal?.canRespond && (
        <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-red-300">Demande en mariage</p>
          {relationship.pendingProposal.message?.trim() && (
            <p className="text-xs text-muted-foreground">{relationship.pendingProposal.message}</p>
          )}
          {confirmMarriage ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 space-y-1">
                <p className="font-semibold">Consequences du mariage :</p>
                <p>· Compte bancaire commun partage avec ton conjoint</p>
                <p>· En cas de divorce, le compte commun est divise en deux</p>
                <p>· Si ton conjoint triche, il peut perdre tout son argent au tribunal</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" disabled={!!loading} onClick={() => void respondToProposal(relationship.pendingProposal!.id, 'accept')}>Confirmer</Button>
                <Button size="sm" variant="outline" className="text-xs" disabled={!!loading} onClick={() => setConfirmMarriage(false)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" className="text-xs" disabled={!!loading} onClick={() => setConfirmMarriage(true)}>Accepter</Button>
              <Button size="sm" variant="outline" className="text-xs" disabled={!!loading} onClick={() => void respondToProposal(relationship.pendingProposal!.id, 'reject')}>Refuser</Button>
            </div>
          )}
        </div>
      )}

      {/* Marriage proposal sent */}
      {relationship.pendingProposal && !relationship.pendingProposal.canRespond && (
        <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
          Ta demande en mariage est en attente de reponse.
        </div>
      )}

      {/* Divorce received */}
      {relationship.pendingDivorceProposal?.canRespond && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
          <p className="text-sm font-semibold text-rose-300">Demande de divorce</p>
          {relationship.pendingDivorceProposal.message?.trim() && (
            <p className="mt-1 text-xs text-muted-foreground">{relationship.pendingDivorceProposal.message}</p>
          )}
          <p className="mt-1 text-xs text-amber-400">Le divorce partage l argent du foyer en deux.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="text-xs" disabled={!!loading} onClick={() => void respondToDivorce(relationship.pendingDivorceProposal!.id, 'accept')}>Accepter</Button>
            <Button size="sm" variant="outline" className="text-xs" disabled={!!loading} onClick={() => void respondToDivorce(relationship.pendingDivorceProposal!.id, 'reject')}>Refuser</Button>
          </div>
        </div>
      )}

      {/* Divorce sent */}
      {relationship.pendingDivorceProposal && !relationship.pendingDivorceProposal.canRespond && (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs text-rose-100">
          Ta demande de divorce attend une validation mutuelle.
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {relationship.canProposeMarriage && !relationship.pendingProposal && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs" variant="outline" disabled={!!loading} onClick={() => void proposeMarriage()}>
            <Heart className="h-3.5 w-3.5 text-red-400" />
            Demander en mariage
          </Button>
        )}

        {relationship.canDivorce && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-red-300" variant="outline" disabled={!!loading} onClick={() => void divorce()}>
            <Heart className="h-3.5 w-3.5" />
            Demander le divorce
          </Button>
        )}

        {relationship.canMakeMistress && !confirmMistress && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-purple-300" variant="outline" disabled={!!loading} onClick={() => setConfirmMistress(true)}>
            <Heart className="h-3.5 w-3.5" />
            Faire une liaison
          </Button>
        )}

        {confirmMistress && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-200">
                Attention : ton/ta conjoint(e) peut te soupçonner de tricherie. Si la suspicion est confirmee, il/elle recupere TOUT l argent du foyer et vous divorcez automatiquement.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="text-xs" disabled={!!loading} onClick={() => { setConfirmMistress(false); void makeMistress(); }}>Confirmer</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmMistress(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {relationship.canSuspectCheating && !confirmSuspect && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-amber-300" variant="outline" disabled={!!loading} onClick={() => setConfirmSuspect(true)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Suspicion de tricherie
          </Button>
        )}

        {confirmSuspect && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-xs text-amber-200">
                Si ton/ta conjoint(e) a une liaison, tu recuperes tout l argent du foyer et vous divorcez automatiquement.
                Si tu as tort, il/elle peut aller en justice et prendre tout ton argent.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs" disabled={!!loading} onClick={() => { setConfirmSuspect(false); void suspectCheating(); }}>Confirmer</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmSuspect(false)}>Annuler</Button>
            </div>
          </div>
        )}

        {relationship.canForget && !confirmForget && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-muted-foreground" variant="ghost" disabled={!!loading} onClick={() => setConfirmForget(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Oublier
          </Button>
        )}

        {confirmForget && (
          <div className="rounded-xl border border-border/40 bg-muted/10 px-4 py-3">
            <p className="text-xs text-muted-foreground">Supprimer cette relation definitivement ?</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs" disabled={!!loading} onClick={() => { setConfirmForget(false); void forget(); }}>Oublier</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmForget(false)}>Annuler</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SocialTab({ data, onReload }: { data: YouState; onReload: () => Promise<void> }) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const availablePlayers = data.players.filter((p) => !p.alreadyInRelationship);

  // Sort: MARRIED first, then rest
  const sortedRelationships = [...data.relationships].sort((a, b) => {
    if (a.status === 'MARRIED' && b.status !== 'MARRIED') return -1;
    if (a.status !== 'MARRIED' && b.status === 'MARRIED') return 1;
    return 0;
  });

  const selected = sortedRelationships.find((r) => r.id === selectedId) ?? sortedRelationships[0] ?? null;
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left: List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle>Relations ({data.relationships.length})</SectionTitle>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>

          {/* Court cases for me (I'm the accused) */}
          {data.courtCases.length > 0 && (
            <div className="space-y-2">
              {data.courtCases.map((c) => (
                <CourtCaseItem key={c.id} courtCase={c} onReload={onReload} />
              ))}
            </div>
          )}

          {sortedRelationships.length === 0 ? (
            <Card>
              <CardContent className="px-5 py-8 text-center text-sm text-muted-foreground">
                Aucune relation. Ajoute quelqu un avec le bouton ci-dessus.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-0.5 px-2 py-2">
                {sortedRelationships.map((r) => (
                  <RelationListItem
                    key={r.id}
                    relationship={r}
                    selected={selected?.id === r.id}
                    onClick={() => setSelectedId(r.id)}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Actions */}
        <div className="space-y-4">
          {selected ? (
            <>
              <SectionTitle>Actions</SectionTitle>
              <Card>
                <CardContent className="px-5 py-4">
                  <RelationActions relationship={selected} onReload={onReload} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="px-5 py-10 text-center text-sm text-muted-foreground">
                Selectionne une relation pour voir les actions disponibles.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <NewRelationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        players={availablePlayers}
        onSubmitted={onReload}
      />
    </>
  );
}
