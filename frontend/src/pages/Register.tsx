import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '../services/api';
import { Loader2, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { CenteredShell } from '@/components/layout/centered-shell';
import { useFeatures } from '@/contexts/FeaturesContext';
import { t } from '@/lib/i18n';

const SCHOOL_LEVELS = [
  { value: 'SECONDE', label: t('register_school_level_second') },
  { value: 'PREMIERE', label: t('register_school_level_premiere') },
  { value: 'TERMINALE', label: t('register_school_level_terminale') },
] as const;

const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const registerSchema = z.object({
  firstName: z.string()
    .trim()
    .min(1, t('register_first_name_required'))
    .max(50, t('register_max_50_chars')),
  schoolLevel: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
  classLetter: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  username: z.string()
    .min(3, t('register_min_3_chars'))
    .max(20, t('register_max_20_chars')),
  email: z.string().email(t('register_email_invalid')).min(1, t('register_email_required')),
  password: z.string().min(6, t('register_min_6_chars')),
  confirmPassword: z.string().min(1, t('register_confirm_required')),
  motivationMessage: z.string()
    .trim()
    .min(10, t('register_min_10_chars'))
    .max(500, t('register_max_500_chars')),
  referralCode: z.string()
    .trim()
    .max(24, t('register_max_24_chars'))
    .optional()
    .or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('register_passwords_mismatch'),
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchParams] = useSearchParams();
  const { maintenanceStatus, maintenanceLoading } = useFeatures();
  const referralEnabled = maintenanceStatus.referralEnabled;

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      schoolLevel: undefined,
      classLetter: undefined,
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      motivationMessage: '',
      referralCode: searchParams.get('ref') || '',
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError('');
      setLoading(true);
      const response = await authApi.register({
        username: data.username,
        firstName: data.firstName,
        schoolLevel: data.schoolLevel,
        classLetter: data.classLetter,
        email: data.email,
        password: data.password,
        motivationMessage: data.motivationMessage,
        referralCode: referralEnabled && data.referralCode?.trim() ? data.referralCode.trim() : undefined,
      });
      setSuccessMessage(response.data.message || '');
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('register_request_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <CenteredShell widthClassName="max-w-sm">
        <Card>
          <CardContent className="space-y-8 pt-6 text-center">
            <div className="space-y-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h1 className={TYPOGRAPHY.H2}>
                {t('register_success_title')}
              </h1>
              <p className={TYPOGRAPHY.MUTED}>
                {successMessage || t('register_success_description')}
              </p>
            </div>

            <Button asChild className="h-12 w-full">
              <Link to="/login">
                {t('register_back_to_login')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </CenteredShell>
    );
  }

  return (
    <CenteredShell widthClassName="max-w-sm">
      <Card>
        <CardHeader className="space-y-2 text-center">
          <CardTitle className={TYPOGRAPHY.H1}>{t('register_title')}</CardTitle>
          <CardDescription>{t('register_description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className={cn(TYPOGRAPHY.SMALL, 'text-destructive text-center')}>{error}</p>
          )}

          <p className={cn(TYPOGRAPHY.XS, 'rounded border border-border/30 p-3 text-center text-muted-foreground')}>
            {t('register_review_notice')}
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t('register_first_name_placeholder')}
                        className="h-12 border-border/50 text-center"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t('register_username_placeholder')}
                        className="h-12 border-border/50 text-center"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="schoolLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-12 border-border/50">
                            <SelectValue placeholder={t('register_school_level_placeholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {SCHOOL_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-center" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="classLetter"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-12 border-border/50">
                            <SelectValue placeholder={t('register_class_letter_placeholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {CLASS_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage className="text-center" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('register_email_placeholder')}
                        className="h-12 border-border/50 text-center"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              {!maintenanceLoading && referralEnabled && (
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="text"
                            placeholder={t('register_referral_placeholder')}
                          className="h-12 border-border/50 text-center uppercase tracking-[0.24em]"
                          {...field}
                          value={field.value || ''}
                          onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage className="text-center" />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="motivationMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder={t('register_motivation_placeholder')}
                        className="min-h-28 border-border/50"
                        maxLength={500}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('register_password_placeholder')}
                        className="h-12 border-border/50 text-center"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('register_confirm_password_placeholder')}
                        className="h-12 border-border/50 text-center"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-center" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t('register_send_request')}
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className={cn(TYPOGRAPHY.SMALL, 'text-center text-muted-foreground')}>
            {t('register_have_account')}{' '}
            <Link to="/login" className="text-foreground hover:underline">
              {t('register_login_link')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
