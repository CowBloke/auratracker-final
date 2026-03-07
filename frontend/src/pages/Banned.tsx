import { useState } from 'react';
import { loadBanInfo } from '@/services/ban';
import { publicApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TYPOGRAPHY } from '@/lib/design-system';
import { CenteredShell } from '@/components/layout/centered-shell';
import { Loader2, Send, Check } from 'lucide-react';

const APPEAL_SUBMITTED_KEY = 'banAppealSubmitted';

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

  const [appealMessage, setAppealMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(() => !!localStorage.getItem(APPEAL_SUBMITTED_KEY));
  const [appealError, setAppealError] = useState<string | null>(null);

  const canAppeal = !!(banInfo?.banId && banInfo?.userId);

  const handleSubmitAppeal = async () => {
    if (!banInfo?.banId || !banInfo?.userId) return;
    if (appealMessage.trim().length < 10) {
      setAppealError('Le message doit faire au moins 10 caractères.');
      return;
    }

    setSubmitting(true);
    setAppealError(null);
    try {
      await publicApi.submitBanAppeal({
        banId: banInfo.banId,
        userId: banInfo.userId,
        message: appealMessage.trim(),
      });
      localStorage.setItem(APPEAL_SUBMITTED_KEY, '1');
      setSubmitted(true);
    } catch (err: any) {
      setAppealError(err.response?.data?.error || 'Erreur lors de l\'envoi. Réessaie plus tard.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CenteredShell widthClassName="max-w-2xl">
      <div className="space-y-4">
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
          </CardContent>
        </Card>

        {canAppeal && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Faire appel</CardTitle>
              <CardDescription>
                Si tu penses que ce bannissement est injustifié, envoie un message aux admins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitted ? (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <Check className="h-4 w-4" />
                  Ton appel a été envoyé. Les admins le traiteront prochainement.
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder="Explique pourquoi tu penses que ce ban est injustifié..."
                    value={appealMessage}
                    onChange={(e) => setAppealMessage(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    className="resize-none bg-transparent border-border/50"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{appealMessage.length}/1000</span>
                    {appealError && (
                      <span className="text-xs text-destructive">{appealError}</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSubmitAppeal}
                    disabled={submitting || appealMessage.trim().length < 10}
                    className="h-8"
                  >
                    {submitting
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><Send className="h-4 w-4 mr-1.5" />Envoyer l'appel</>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!canAppeal && (
          <p className={TYPOGRAPHY.XS}>
            Si vous pensez que c'est une erreur, contactez un administrateur.
          </p>
        )}
      </div>
    </CenteredShell>
  );
}
