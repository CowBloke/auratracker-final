import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Gavel, Landmark, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
            <Gavel className="w-4 h-4 text-amber-500" />
            {issuerRole === 'JUDGE' ? 'Proposer une sanction judiciaire' : 'Demande de récupération fiscale'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {issuerRole === 'FISCAL_INSPECTOR' && (
            <p className="text-xs text-muted-foreground border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2">
              En tant qu'agent du fisc, votre demande sera transmise à l'administration pour validation avant exécution.
            </p>
          )}

          {/* Type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type de sanction</Label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('AMENDE')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
                  type === 'AMENDE'
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-600 font-medium'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/50'
                )}
              >
                <Landmark className="w-3.5 h-3.5" />
                Amende
              </button>
              <button
                onClick={() => setType('PAYMENT')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors',
                  type === 'PAYMENT'
                    ? 'border-sky-500/60 bg-sky-500/10 text-sky-600 font-medium'
                    : 'border-border/60 text-muted-foreground hover:bg-muted/50'
                )}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Paiement forcé
              </button>
            </div>
          </div>

          {/* Target */}
          <div className="space-y-1.5">
            <Label htmlFor="target" className="text-xs font-medium">
              {type === 'AMENDE' ? 'Joueur condamné' : 'Joueur qui doit payer'}
            </Label>
            <select
              id="target"
              value={targetUserId}
              onChange={(e) => { setTargetUserId(e.target.value); setBeneficiaryUserId(''); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Sélectionner un joueur —</option>
              {eligibleTargets.map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
          </div>

          {/* Beneficiary (PAYMENT only) */}
          {type === 'PAYMENT' && (
            <div className="space-y-1.5">
              <Label htmlFor="beneficiary" className="text-xs font-medium">Bénéficiaire du paiement</Label>
              <select
                id="beneficiary"
                value={beneficiaryUserId}
                onChange={(e) => setBeneficiaryUserId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Sélectionner le bénéficiaire —</option>
                {eligibleBeneficiaries.map((p) => (
                  <option key={p.id} value={p.id}>{p.username}</option>
                ))}
              </select>
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
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Expliquez la raison de cette sanction..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
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
