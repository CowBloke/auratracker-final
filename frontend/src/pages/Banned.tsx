import { loadBanInfo } from '@/services/ban';

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
          <p className="text-sm text-muted-foreground">
            Votre compte est actuellement banni.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-left space-y-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Motif:</span>{' '}
            <span className="text-foreground">{reason}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Duree:</span>{' '}
            <span className="text-foreground">{durationLabel}</span>
          </div>
        </div>

        {banInfo?.message && (
          <p className="text-xs text-muted-foreground">{banInfo.message}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Si vous pensez que c'est une erreur, contactez un administrateur.
        </p>
      </div>
    </div>
  );
}
