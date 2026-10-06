import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TabsContent } from '@/components/ui/tabs';
import SanctionModal from '@/components/sanctions/SanctionModal';
import { Loader2, Gavel } from 'lucide-react';
import { sanctionsApi } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';

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
    <TabsContent value="fiscal" className="space-y-6">
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
            <p className="text-xs text-muted-foreground mt-0.5">Vue lecture seule. Utilisez le bouton ci-dessous pour soumettre une demande de récupération fiscale.</p>
          </div>
          <Button size="sm" onClick={() => setShowFiscalSanctionModal(true)} className="gap-1.5">
            <Gavel className="w-3.5 h-3.5" />
            Demande de sanction
          </Button>
        </div>

        {user?.isFiscalInspector && (
          <Card className="gap-0 py-0 shadow-none"><CardContent className="p-4">
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
          </CardContent></Card>
        )}

        {loadingFiscalUsers ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : fiscalUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun joueur trouve.</p>
        ) : (
          <Card className="gap-0 py-0 shadow-none overflow-hidden"><CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Joueur</TableHead>
                  <TableHead className="text-right">Compte (€)</TableHead>
                  <TableHead className="text-right">Compte partagé (€)</TableHead>
                  <TableHead className="text-right">Aura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fiscalUsers.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.username}{u.firstName ? ` (${u.firstName})` : ''}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.money.toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {u.sharedMoney
                        ? <span title={`Compte partagé avec ${u.sharedMoney.partner.username}`}>{u.sharedMoney.coupleBalance.toLocaleString('fr-FR')}</span>
                        : <span className="text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-warning">{u.aura.toLocaleString('fr-FR')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>
    </TabsContent>
  );
}
