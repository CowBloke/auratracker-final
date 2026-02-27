import { loadBanInfo } from '@/services/ban';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TYPOGRAPHY } from '@/lib/design-system';
import { CenteredShell } from '@/components/layout/centered-shell';

const formatExpiry = (expiresAt: string | null) => {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  return date.toLocaleString('fr-FR');
};

export default function Banned() {
  const banInfo = loadBanInfo();
  const reason = banInfo?.reason?.trim() || 'Non specifie';
  const expiresAt = banInfo?.expiresAt ?? null;
  const durationLabel = banInfo?.type === 'PERMANENT'
    ? 'Permanent'
    : expiresAt
      ? `Jusqu'au ${formatExpiry(expiresAt)}`
      : 'Temporaire';

  return (
    <CenteredShell widthClassName="max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <CardDescription>Accès restreint</CardDescription>
          <CardTitle>Compte banni</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-left">
          <div className="space-y-2 rounded-lg border border-border/40 bg-muted/20 p-4">
            <div className={TYPOGRAPHY.SMALL}>
              <span className="text-muted-foreground">Motif:</span>{' '}
              <span className="text-foreground">{reason}</span>
            </div>
            <div className={TYPOGRAPHY.SMALL}>
              <span className="text-muted-foreground">Durée:</span>{' '}
              <span className="text-foreground">{durationLabel}</span>
            </div>
          </div>
          {banInfo?.message && (
            <p className={TYPOGRAPHY.XS}>{banInfo.message}</p>
          )}
          <p className={TYPOGRAPHY.XS}>
            Si vous pensez que c'est une erreur, contactez un administrateur.
          </p>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
