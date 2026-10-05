import { useState } from 'react';
import { loadBanInfo } from '@/services/ban';
import { publicApi } from '@/services/api';
import { Ban, Check, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { AuthShell } from '@/components/layout/AuthShell';
import { t } from '@/lib/i18n';

const APPEAL_SUBMITTED_KEY = 'banAppealSubmitted';

const formatExpiry = (expiresAt: string | null) => {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  return date.toLocaleString('fr-FR');
};

export default function Banned() {
  const banInfo = loadBanInfo();
  const reason = banInfo?.reason?.trim() || t('banned_reason_not_specified');
  const expiresAt = banInfo?.expiresAt ?? null;
  const durationLabel = banInfo?.type === 'PERMANENT'
    ? t('banned_duration_permanent')
    : expiresAt
      ? `${t('banned_duration_until_prefix')} ${formatExpiry(expiresAt)}`
      : t('banned_duration_temporary');

  const [appealMessage, setAppealMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(() => !!localStorage.getItem(APPEAL_SUBMITTED_KEY));
  const [appealError, setAppealError] = useState<string | null>(null);

  const canAppeal = !!(banInfo?.banId && banInfo?.userId);

  const handleSubmitAppeal = async () => {
    if (!banInfo?.banId || !banInfo?.userId) return;
    if (appealMessage.trim().length < 10) {
      setAppealError(t('banned_appeal_length_error'));
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
      setAppealError(err.response?.data?.error || t('banned_appeal_send_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell size="lg">
      <Card>
        <CardHeader>
          <CardDescription>{t('banned_access_restricted')}</CardDescription>
          <CardTitle>{t('banned_account_title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ItemGroup>
            <Item variant="outline">
              <ItemContent>
                <ItemDescription>{t('banned_reason_label')}</ItemDescription>
                <ItemTitle>{reason}</ItemTitle>
              </ItemContent>
            </Item>
            <ItemSeparator className="my-0" />
            <Item variant="outline">
              <ItemContent>
                <ItemDescription>{t('banned_duration_label')}</ItemDescription>
                <ItemTitle>{durationLabel}</ItemTitle>
              </ItemContent>
            </Item>
          </ItemGroup>
          {banInfo?.message ? (
            <Alert>
              <Ban />
              <AlertDescription>{banInfo.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {canAppeal ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('banned_appeal_title')}</CardTitle>
            <CardDescription>{t('banned_appeal_description')}</CardDescription>
          </CardHeader>
          {submitted ? (
            <CardContent>
              <Alert>
                <Check />
                <AlertTitle>{t('banned_appeal_submitted')}</AlertTitle>
              </Alert>
            </CardContent>
          ) : (
            <>
              <CardContent>
                <Field data-invalid={Boolean(appealError)}>
                  <FieldLabel htmlFor="appeal-message">{t('banned_appeal_title')}</FieldLabel>
                  <Textarea
                    id="appeal-message"
                    placeholder={t('banned_appeal_placeholder')}
                    value={appealMessage}
                    onChange={(event) => setAppealMessage(event.target.value)}
                    maxLength={1000}
                    rows={4}
                  />
                  <FieldDescription>{appealMessage.length}/1000</FieldDescription>
                  {appealError ? <FieldError>{appealError}</FieldError> : null}
                </Field>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSubmitAppeal} disabled={submitting || appealMessage.trim().length < 10}>
                  {submitting ? <Spinner /> : <Send />}
                  {t('banned_appeal_send')}
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t('banned_contact_admin')}</p>
      )}
    </AuthShell>
  );
}
