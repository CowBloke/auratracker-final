import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  Heart,
  PenLine,
  Plus,
  Scale,
  ScrollText,
  Stamp,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveImageUrl } from '@/lib/images';
import { cn } from '@/lib/utils';
import {
  type YouContract,
  type YouCourtCase,
  type YouPlayer,
  type YouRelationship,
  type YouState,
  youApi,
} from '@/services/api';
import { NewRelationModal } from '../components/modals';
import { Pill, UserAvatar } from '../components/YouPrimitives';
import { getRelationshipPill, relativeTime, withRouteError } from '../utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ─── Relationships ────────────────────────────────────────────────────────────

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
    <Item asChild size="sm" variant={selected ? 'muted' : 'default'}>
      <button type="button" onClick={onClick} className="w-full text-left">
        <ItemMedia>
          <UserAvatar player={relationship.otherUser} className="size-9" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{relationship.otherUser.username}</ItemTitle>
          <div className="flex items-center gap-1.5">
            <Pill label={pill.label} color={pill.color} />
            {(relationship.pendingProposal || relationship.pendingDivorceProposal) && (
              <span className="size-1.5 rounded-full bg-warning" />
            )}
            {relationship.hasPendingCourtCase && <span className="size-1.5 rounded-full bg-destructive" />}
          </div>
        </ItemContent>
      </button>
    </Item>
  );
}

function CourtCaseItem({ courtCase, onReload }: { courtCase: YouCourtCase; onReload: () => Promise<void> }) {
  const [loading, setLoading] = useState(false);

  const respond = async (decision: 'court' | 'drop') => {
    setLoading(true);
    try {
      await withRouteError(() => youApi.respondToCourtCase(courtCase.id, decision), 'Impossible de repondre.');
      if (decision === 'court') toast.success('Jugement rendu - tu as recupere tout l argent');
      else toast.success('Accusation ignoree');
      await onReload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Alert variant="destructive">
      <Gavel />
      <AlertTitle>Suspicion de tricherie</AlertTitle>
      <AlertDescription>
        <p>
          <span className="font-medium text-foreground">{courtCase.accuser.username}</span> te soupçonne de tricherie.
          Aller en justice te permet de prendre tout son argent si la suspicion est infondée.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="destructive" disabled={loading} onClick={() => void respond('court')}>
            <Scale />
            Aller en justice
          </Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void respond('drop')}>
            Ignorer
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function RelationActions({ relationship, onReload }: { relationship: YouRelationship; onReload: () => Promise<void> }) {
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
      if (result?.data?.correct) toast.success('Tricherie prouvee ! Tu as recupere tout l argent.');
      else toast.info('Suspicion envoyee. Ton conjoint peut aller en justice.');
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
                color="bg-warning/15 text-warning"
              />
            )}
            {relationship.pendingDivorceProposal && (
              <Pill
                label={relationship.pendingDivorceProposal.direction === 'sent' ? 'Divorce envoye' : 'Divorce recu'}
                color="bg-destructive/15 text-destructive"
              />
            )}
          </div>
        </div>
      </div>

      {relationship.otherUser.bio?.trim() && (
        <p className="text-sm text-muted-foreground">{relationship.otherUser.bio}</p>
      )}

      {relationship.status === 'MARRIED' && (
        <Card className="gap-0 py-0 shadow-none"><CardContent className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Compte commun</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{relationship.coupleBalance.toLocaleString()} M</span>
          </div>
          <div className="flex gap-2">
            <Input type="number" min={1} placeholder="Montant" value={coupleAmount} onChange={(e) => setCoupleAmount(e.target.value)} className="h-7 text-xs" />
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-success" disabled={!!loading || !coupleAmount || parseInt(coupleAmount, 10) <= 0} onClick={() => void coupleDeposit()}>
              <ArrowUpRight className="h-3.5 w-3.5" />Déposer
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-warning" disabled={!!loading || !coupleAmount || parseInt(coupleAmount, 10) <= 0} onClick={() => void coupleWithdraw()}>
              <ArrowDownLeft className="h-3.5 w-3.5" />Retirer
            </Button>
          </div>
        </CardContent></Card>
      )}

      {relationship.pendingProposal?.canRespond && (
        <Alert variant="destructive" className="space-y-2">
          <p className="text-sm font-semibold text-destructive">Demande en mariage</p>
          {relationship.pendingProposal.message?.trim() && (
            <p className="text-xs text-muted-foreground">{relationship.pendingProposal.message}</p>
          )}
          {confirmMarriage ? (
            <div className="space-y-2">
              <Alert variant="warning" className="space-y-1">
                <p className="font-semibold">Consequences du mariage :</p>
                <p>· Compte bancaire commun partage avec ton conjoint</p>
                <p>· En cas de divorce, le compte commun est divise en deux</p>
                <p>· Si ton conjoint triche, il peut perdre tout son argent au tribunal</p>
              </Alert>
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
        </Alert>
      )}

      {relationship.pendingProposal && !relationship.pendingProposal.canRespond && (
        <Alert><AlertDescription>
          Ta demande en mariage est en attente de reponse.
        </AlertDescription></Alert>
      )}

      {relationship.pendingDivorceProposal?.canRespond && (
        <Alert variant="destructive">
          <p className="text-sm font-semibold text-destructive">Demande de divorce</p>
          {relationship.pendingDivorceProposal.message?.trim() && (
            <p className="mt-1 text-xs text-muted-foreground">{relationship.pendingDivorceProposal.message}</p>
          )}
          <p className="mt-1 text-xs text-warning">Le divorce partage l argent du foyer en deux.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="text-xs" disabled={!!loading} onClick={() => void respondToDivorce(relationship.pendingDivorceProposal!.id, 'accept')}>Accepter</Button>
            <Button size="sm" variant="outline" className="text-xs" disabled={!!loading} onClick={() => void respondToDivorce(relationship.pendingDivorceProposal!.id, 'reject')}>Refuser</Button>
          </div>
        </Alert>
      )}

      {relationship.pendingDivorceProposal && !relationship.pendingDivorceProposal.canRespond && (
        <Alert variant="destructive"><AlertDescription>
          Ta demande de divorce attend une validation mutuelle.
        </AlertDescription></Alert>
      )}

      <div className="space-y-2">
        {relationship.canProposeMarriage && !relationship.pendingProposal && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs" variant="outline" disabled={!!loading} onClick={() => void proposeMarriage()}>
            <Heart className="h-3.5 w-3.5 text-destructive" />Demander en mariage
          </Button>
        )}
        {relationship.canDivorce && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-destructive" variant="outline" disabled={!!loading} onClick={() => void divorce()}>
            <Heart className="h-3.5 w-3.5" />Demander le divorce
          </Button>
        )}
        {relationship.canMakeMistress && !confirmMistress && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-primary" variant="outline" disabled={!!loading} onClick={() => setConfirmMistress(true)}>
            <Heart className="h-3.5 w-3.5" />Faire une liaison
          </Button>
        )}
        {confirmMistress && (
          <Alert variant="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-warning">Attention : ton/ta conjoint(e) peut te soupçonner de tricherie. Si la suspicion est confirmee, il/elle recupere TOUT l argent du foyer et vous divorcez automatiquement.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="text-xs" disabled={!!loading} onClick={() => { setConfirmMistress(false); void makeMistress(); }}>Confirmer</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmMistress(false)}>Annuler</Button>
            </div>
          </Alert>
        )}
        {relationship.canSuspectCheating && !confirmSuspect && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-warning" variant="outline" disabled={!!loading} onClick={() => setConfirmSuspect(true)}>
            <AlertTriangle className="h-3.5 w-3.5" />Suspicion de tricherie
          </Button>
        )}
        {confirmSuspect && (
          <Alert variant="warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-xs text-warning">Si ton/ta conjoint(e) a une liaison, tu recuperes tout l argent du foyer et vous divorcez automatiquement. Si tu as tort, il/elle peut aller en justice et prendre tout ton argent.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs" disabled={!!loading} onClick={() => { setConfirmSuspect(false); void suspectCheating(); }}>Confirmer</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmSuspect(false)}>Annuler</Button>
            </div>
          </Alert>
        )}
        {relationship.canForget && !confirmForget && (
          <Button size="sm" className="w-full justify-start gap-2 text-xs text-muted-foreground" variant="ghost" disabled={!!loading} onClick={() => setConfirmForget(true)}>
            <Trash2 className="h-3.5 w-3.5" />Oublier
          </Button>
        )}
        {confirmForget && (
          <Card className="gap-0 py-0 shadow-none"><CardContent className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Supprimer cette relation definitivement ?</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs" disabled={!!loading} onClick={() => { setConfirmForget(false); void forget(); }}>Oublier</Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setConfirmForget(false)}>Annuler</Button>
            </div>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ─── Contracts ────────────────────────────────────────────────────────────────

function ParticipantAvatar({ user }: { user: YouContract['participants'][number]['user'] }) {
  const initials = (user.firstName?.[0] ?? user.username[0]).toUpperCase();
  return (
    <Avatar className="size-8">
      <AvatarImage src={user.profilePicture ? resolveImageUrl(user.profilePicture) : undefined} alt={user.username} />
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

function ContractDocument({ contract, currentUserId, onSign, onDelete, signing }: {
  contract: YouContract;
  currentUserId: string;
  onSign: () => void;
  onDelete: () => void;
  signing: boolean;
}) {
  const allSigned = contract.participants.every((p) => p.signedAt !== null);
  const myParticipation = contract.participants.find((p) => p.userId === currentUserId);
  const iSigned = !!myParticipation?.signedAt;
  const isCreator = contract.creatorId === currentUserId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{contract.title}</CardTitle>
        <CardDescription>
          Établi le {new Date(contract.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </CardDescription>
        <CardAction>
          <Badge variant={allSigned ? 'success' : 'warning'}>
            {allSigned ? <Stamp /> : <PenLine />}
            {allSigned ? 'Signé' : 'En attente'}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{contract.content}</p>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Signatures des parties</p>
          <ItemGroup className="grid gap-2 sm:grid-cols-2">
            {contract.participants.map((p) => (
              <Item key={p.id} variant="outline" size="sm">
                <ItemMedia>
                  <ParticipantAvatar user={p.user} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{p.user.username}</ItemTitle>
                  <ItemDescription className={p.signedAt ? 'text-success' : undefined}>
                    {p.signedAt
                      ? `Signé le ${new Date(p.signedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                      : 'En attente'}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {p.signedAt ? <CheckCircle2 className="size-4 text-success" /> : <Clock className="size-4 text-warning" />}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </div>

        {allSigned && (
          <Alert variant="success">
            <Stamp />
            <AlertDescription>Contrat signé par toutes les parties</AlertDescription>
          </Alert>
        )}
      </CardContent>

      {((!iSigned && myParticipation) || isCreator) && (
        <CardFooter className="justify-between">
          {!iSigned && myParticipation ? (
            <Button size="sm" disabled={signing} onClick={onSign}>
              <PenLine />
              Signer ce contrat
            </Button>
          ) : <span />}
          {isCreator && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 />
              Supprimer
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function ContractListItem({ contract, selected, onClick }: {
  contract: YouContract;
  selected: boolean;
  onClick: () => void;
}) {
  const allSigned = contract.participants.every((p) => p.signedAt !== null);
  const pendingCount = contract.participants.filter((p) => !p.signedAt).length;

  return (
    <Item asChild size="sm" variant={selected ? 'muted' : 'default'}>
      <button type="button" onClick={onClick} className="w-full text-left">
        <ItemMedia variant="icon">
          {allSigned ? <Stamp /> : <FileText />}
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{contract.title}</ItemTitle>
          <ItemDescription className={allSigned ? 'text-success' : 'text-warning'}>
            {allSigned
              ? 'Signé par tous'
              : `${pendingCount} signature${pendingCount > 1 ? 's' : ''} manquante${pendingCount > 1 ? 's' : ''}`}
          </ItemDescription>
        </ItemContent>
      </button>
    </Item>
  );
}

function CreateContractModal({ open, onClose, players, currentUserId, onCreated }: {
  open: boolean;
  onClose: () => void;
  players: YouPlayer[];
  currentUserId: string;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const reset = () => { setTitle(''); setContent(''); setSelectedIds([]); };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    if (!title.trim() || !content.trim() || selectedIds.length === 0) return;
    setLoading(true);
    try {
      await withRouteError(
        () => youApi.createContract({ title: title.trim(), content: content.trim(), participantIds: selectedIds }),
        'Impossible de créer le contrat.',
      );
      toast.success('Contrat créé');
      await onCreated();
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-warning" />
            Nouveau contrat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Titre du contrat</Label>
            <Input
              placeholder="ex: Accord de partenariat commercial"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Contenu du contrat</Label>
            <Textarea
              placeholder="Rédigez les termes et conditions du contrat. Chaque partie signataire s'engage à respecter les clauses ci-dessous..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              rows={6}
              className="resize-none text-sm"
            />
            <p className="text-right text-xs text-muted-foreground">{content.length}/5000</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Autres signataires</Label>
            {players.filter((p) => p.id !== currentUserId).length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun joueur disponible.</p>
            ) : (
              <Card className="max-h-40 gap-0 overflow-y-auto py-1 shadow-none"><CardContent className="flex flex-col gap-1 px-1">
                {players.filter((p) => p.id !== currentUserId).map((p) => {
                  const checked = selectedIds.includes(p.id);
                  return (
                    <Item asChild size="sm" key={p.id} className={checked ? 'bg-accent' : undefined}><button type="button" onClick={() => toggle(p.id)} className="w-full text-left">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={p.profilePicture ? resolveImageUrl(p.profilePicture) : undefined} />
                        <AvatarFallback className="text-xs">{(p.firstName?.[0] ?? p.username[0]).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-xs font-medium">{p.username}</span>
                      {checked && <CheckCircle2 className="h-3.5 w-3.5 text-warning" />}
                    </button></Item>
                  );
                })}
              </CardContent></Card>
            )}
            {selectedIds.length > 0 && (
              <p className="text-xs text-warning">{selectedIds.length} signataire{selectedIds.length > 1 ? 's' : ''} sélectionné{selectedIds.length > 1 ? 's' : ''} (+ toi)</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={handleClose}>Annuler</Button>
            <Button
              size="sm"
              className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90"
              disabled={loading || !title.trim() || !content.trim() || selectedIds.length === 0}
              onClick={() => void submit()}
            >
              <ScrollText className="h-3.5 w-3.5" />
              Créer le contrat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContractsSection({ data, currentUserId }: { data: YouState; currentUserId?: string }) {
  const [contracts, setContracts] = useState<YouContract[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [signing, setSigning] = useState(false);

  const load = async () => {
    const res = await youApi.getContracts();
    setContracts(res.data.contracts);
    setSelectedId((prev) => {
      if (!prev && res.data.contracts.length > 0) return res.data.contracts[0].id;
      return prev;
    });
  };

  useEffect(() => {
    void load();
  }, []);

  const selected = contracts.find((c) => c.id === selectedId) ?? null;

  const handleSign = async () => {
    if (!selected) return;
    setSigning(true);
    try {
      await withRouteError(() => youApi.signContract(selected.id), 'Impossible de signer.');
      toast.success('Contrat signé !');
      await load();
    } finally {
      setSigning(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    await withRouteError(() => youApi.deleteContract(selected.id), 'Impossible de supprimer.');
    toast.success('Contrat supprimé');
    setSelectedId(null);
    await load();
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left: list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Contrats ({contracts.length})</h2>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nouveau
            </Button>
          </div>

          {contracts.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
                <EmptyDescription>Aucun contrat. Crée le premier avec le bouton ci-dessus.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-0.5 px-2">
                {contracts.map((c) => (
                  <ContractListItem key={c.id} contract={c} selected={selected?.id === c.id} onClick={() => setSelectedId(c.id)} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: viewer */}
        <div>
          {selected ? (
            <ContractDocument
              contract={selected}
              currentUserId={currentUserId ?? ''}
              onSign={() => void handleSign()}
              onDelete={() => void handleDelete()}
              signing={signing}
            />
          ) : (
            <Empty className="min-h-64 border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ScrollText /></EmptyMedia>
                <EmptyDescription>Sélectionne un contrat pour le consulter.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <CreateContractModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        players={data.players}
        currentUserId={currentUserId ?? ''}
        onCreated={load}
      />
    </>
  );
}

// ─── Main SocialTab ───────────────────────────────────────────────────────────

export function SocialTab({ data, userId, onReload }: { data: YouState; userId?: string; onReload: () => Promise<void> }) {
  const [tab, setTab] = useState<'relations' | 'contracts'>('relations');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const availablePlayers = data.players.filter((p) => !p.alreadyInRelationship);

  const sortedRelationships = [...data.relationships].sort((a, b) => {
    if (a.status === 'MARRIED' && b.status !== 'MARRIED') return -1;
    if (a.status !== 'MARRIED' && b.status === 'MARRIED') return 1;
    return 0;
  });

  const selected = sortedRelationships.find((r) => r.id === selectedId) ?? sortedRelationships[0] ?? null;

  return (
    <>
      <Tabs value={tab} onValueChange={(value) => setTab(value as 'relations' | 'contracts')}>
        <TabsList>
          <TabsTrigger value="relations">
            <Users />
            Relations
            {data.relationships.length > 0 && <Badge variant="secondary">{data.relationships.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contracts">
            <ScrollText />
            Contrats
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'relations' && (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left: List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Relations ({data.relationships.length})</h2>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>

            {data.courtCases.length > 0 && (
              <div className="space-y-2">
                {data.courtCases.map((c) => (
                  <CourtCaseItem key={c.id} courtCase={c} onReload={onReload} />
                ))}
              </div>
            )}

            {sortedRelationships.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyDescription>Aucune relation. Ajoute quelqu&apos;un avec le bouton ci-dessus.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Card>
                <CardContent className="flex flex-col gap-0.5 px-2">
                  {sortedRelationships.map((r) => (
                    <RelationListItem key={r.id} relationship={r} selected={selected?.id === r.id} onClick={() => setSelectedId(r.id)} />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Actions */}
          <div className="space-y-4">
            {selected ? (
              <>
                <h2 className="text-sm font-semibold">Actions</h2>
                <Card>
                  <CardContent className="px-5 py-4">
                    <RelationActions relationship={selected} onReload={onReload} />
                  </CardContent>
                </Card>
              </>
            ) : (
              <Empty className="min-h-64 border">
                <EmptyHeader>
                  <EmptyDescription>Sélectionne une relation pour voir les actions disponibles.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </div>
      )}

      {tab === 'contracts' && (
        <ContractsSection data={data} currentUserId={userId} />
      )}

      <NewRelationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        players={availablePlayers}
        onSubmitted={onReload}
      />
    </>
  );
}
