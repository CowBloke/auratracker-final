import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import SanctionModal from '@/components/sanctions/SanctionModal';
import { Loader2, Gavel } from 'lucide-react';
import { sanctionsApi } from '@/services/api';
import { SPACING } from '@/lib/design-system';

export type FiscalTabProps = Record<string, unknown>;

export function FiscalTab(props: FiscalTabProps) {
  const {
    showFiscalSanctionModal,
    setShowFiscalSanctionModal,
    fiscalUsers,
    showMessage,
    user,
    fiscalFundRatePercent,
    fiscalFundBalance,
    fiscalPaymentSource,
    savingFiscalPaymentSource,
    saveFiscalPaymentSource,
    loadingFiscalUsers,
  } = props as any;

  return (
    <TabsContent value="fiscal" className={SPACING.SECTION_SPACING}>
      <div className="space-y-6">
        <SanctionModal
          open={showFiscalSanctionModal}
          onClose={() => setShowFiscalSanctionModal(false)}
          issuerRole="FISCAL_INSPECTOR"
          players={fiscalUsers.map((u: any) => ({ id: u.id, username: u.username }))}
          onSubmit={async (data) => {
            await sanctionsApi.submitFiscalSanction({
              type: data.type,
              targetUserId: data.targetUserId,
              beneficiaryUserId: data.beneficiaryUserId,
              amount: data.amount,
              message: data.message,
            });
            showMessage('success', 'Demande de sanction transmise a l\'administration');
          }}
        />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Inspection fiscale - Patrimoine des joueurs</p>
            <p className="text-xs text-muted-foreground mt-0.5">Vue lecture seule. Utilisez le bouton ci-dessous pour soumettre une demande de recuperation fiscale.</p>
          </div>
          <Button size="sm" onClick={() => setShowFiscalSanctionModal(true)} className="gap-1.5">
            <Gavel className="w-3.5 h-3.5" />
            Demande de sanction
          </Button>
        </div>

        {user?.isFiscalInspector && (
          <div className="rounded-lg border border-border/60 p-4 bg-muted/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Fonds du fisc</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fiscalFundRatePercent}% de chaque sanction fiscale approuvee sont ajoutes a cette cagnotte.</p>
                <p className="text-lg font-semibold mt-2 tabular-nums">{fiscalFundBalance.toLocaleString('fr-FR')}EUR</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Source de paiement</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={fiscalPaymentSource === 'ACCOUNT' ? 'default' : 'outline'}
                    disabled={savingFiscalPaymentSource}
                    onClick={() => saveFiscalPaymentSource('ACCOUNT')}
                  >
                    Compte principal
                  </Button>
                  <Button
                    size="sm"
                    variant={fiscalPaymentSource === 'FONDS_DU_FISC' ? 'default' : 'outline'}
                    disabled={savingFiscalPaymentSource}
                    onClick={() => saveFiscalPaymentSource('FONDS_DU_FISC')}
                  >
                    Fonds du fisc
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loadingFiscalUsers ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : fiscalUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun joueur trouve.</p>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Joueur</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Compte (EUR)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Compte partage (EUR)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Aura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {fiscalUsers.map((u: any) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 font-medium">{u.username}{u.firstName ? ` (${u.firstName})` : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{u.money.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {u.sharedMoney
                        ? <span title={`Compte partage avec ${u.sharedMoney.partner.username}`}>{u.sharedMoney.coupleBalance.toLocaleString('fr-FR')}</span>
                        : <span className="text-muted-foreground/50">-</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-500">{u.aura.toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TabsContent>
  );
}
