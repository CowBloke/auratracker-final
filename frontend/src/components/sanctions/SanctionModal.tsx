import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Gavel, Landmark, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Item } from '@/components/ui/item';

export interface SanctionParty {
  id: string;
  username: string;
}

interface SanctionModalProps {
  open: boolean;
  onClose: () => void;
  /** Who the sanction is issued from (judge or fiscal) */
  issuerRole: 'JUDGE' | 'FISCAL_INSPECTOR';
  /** For judges: parties in the case (plaintiff, defendant, lawyers) */
  parties?: SanctionParty[];
  /** For fiscal inspectors: all players list */
  players?: SanctionParty[];
  /** The court case id (judge only) */
  caseId?: string;
  onSubmit: (data: {
    type: 'AMENDE' | 'PAYMENT';
    targetUserId: string;
    beneficiaryUserId?: string;
    amount: number;
    message: string;
    caseId?: string;
  }) => Promise<void>;
}

export default function SanctionModal({
  open,
  onClose,
  issuerRole,
  parties = [],
  players = [],
  caseId,
  onSubmit,
}: SanctionModalProps) {
  const [type, setType] = useState<'AMENDE' | 'PAYMENT'>('AMENDE');
  const [targetUserId, setTargetUserId] = useState('');
  const [beneficiaryUserId, setBeneficiaryUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleTargets = issuerRole === 'JUDGE' ? parties : players;
  const eligibleBeneficiaries = eligibleTargets.filter((p) => p.id !== targetUserId);

  const handleClose = () => {
    setType('AMENDE');
    setTargetUserId('');
    setBeneficiaryUserId('');
    setAmount('');
    setMessage('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    if (!targetUserId) { setError('Veuillez sélectionner une cible.'); return; }
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) { setError('Montant invalide.'); return; }
    if (type === 'PAYMENT' && !beneficiaryUserId) { setError('Veuillez sélectionner un bénéficiaire.'); return; }
    if (!message.trim()) { setError('Veuillez saisir un message.'); return; }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        targetUserId,
        beneficiaryUserId: type === 'PAYMENT' ? beneficiaryUserId : undefined,
        amount: parsedAmount,
        message: message.trim(),
        caseId,
      });
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-warning" />
            {issuerRole === 'JUDGE' ? 'Proposer une sanction judiciaire' : 'Demande de récupération fiscale'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {issuerRole === 'FISCAL_INSPECTOR' && (
            <p className="text-xs text-muted-foreground border border-warning/30 bg-warning/5 rounded-md px-3 py-2">
              En tant qu'agent du fisc, votre demande sera transmise à l'administration pour validation avant exécution.
            </p>
          )}

          {/* Type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type de sanction</Label>
            <div className="flex gap-2">
              <Item asChild variant="outline" size="sm" className={type === 'AMENDE' ? 'border-primary bg-accent' : undefined}><button onClick={() => setType('AMENDE')} className="flex-1 justify-center text-left">
                <Landmark className="w-3.5 h-3.5" />
                Amende
              </button></Item>
              <Item asChild variant="outline" size="sm" className={type === 'PAYMENT' ? 'border-primary bg-accent' : undefined}><button onClick={() => setType('PAYMENT')} className="flex-1 justify-center text-left">
                <ArrowRight className="w-3.5 h-3.5" />
                Paiement forcé
              </button></Item>
            </div>
          </div>

          {/* Target */}
          <div className="space-y-1.5">
            <Label htmlFor="target" className="text-xs font-medium">
              {type === 'AMENDE' ? 'Joueur condamné' : 'Joueur qui doit payer'}
            </Label>
            <Select
              value={targetUserId || undefined}
              onValueChange={(value) => { setTargetUserId(value); setBeneficiaryUserId(''); }}
            >
              <SelectTrigger id="target" className="w-full">
                <SelectValue placeholder="Sélectionner un joueur" />
              </SelectTrigger>
              <SelectContent>
                {eligibleTargets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Beneficiary (PAYMENT only) */}
          {type === 'PAYMENT' && (
            <div className="space-y-1.5">
              <Label htmlFor="beneficiary" className="text-xs font-medium">Bénéficiaire du paiement</Label>
              <Select value={beneficiaryUserId || undefined} onValueChange={setBeneficiaryUserId}>
                <SelectTrigger id="beneficiary" className="w-full">
                  <SelectValue placeholder="Sélectionner le bénéficiaire" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleBeneficiaries.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs font-medium">Montant (€)</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ex. 500"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="message" className="text-xs font-medium">Motif / message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Expliquez la raison de cette sanction..."
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={submitting}>Annuler</Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Gavel className="w-3.5 h-3.5 mr-1" />}
            {issuerRole === 'JUDGE' ? 'Proposer la sanction' : 'Envoyer la demande'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
