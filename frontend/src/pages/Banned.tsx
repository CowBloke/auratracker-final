import { loadBanInfo } from '@/services/ban';
import { Card, CardContent } from '@/components/ui/card';
import { TYPOGRAPHY } from '@/lib/design-system';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <p className={TYPOGRAPHY.SMALL}>
            Votre compte est actuellement banni.
          </p>
        </div>

        <Card className="border-border/40">
          <CardContent className="p-4 text-left space-y-2">
            <div className={TYPOGRAPHY.SMALL}>
              <span className="text-muted-foreground">Motif:</span>{' '}
              <span className="text-foreground">{reason}</span>
            </div>
            <div className={TYPOGRAPHY.SMALL}>
              <span className="text-muted-foreground">Durée:</span>{' '}
              <span className="text-foreground">{durationLabel}</span>
            </div>
          </CardContent>
        </Card>

        {banInfo?.message && (
          <p className={TYPOGRAPHY.XS}>{banInfo.message}</p>
        )}

        <p className={TYPOGRAPHY.XS}>
          Si vous pensez que c'est une erreur, contactez un administrateur.
        </p>
      </div>
    </div>
  );
}
