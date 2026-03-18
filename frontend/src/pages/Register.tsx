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

const SCHOOL_LEVELS = [
  { value: 'SECONDE', label: 'Seconde' },
  { value: 'PREMIERE', label: 'Premiere' },
  { value: 'TERMINALE', label: 'Terminale' },
] as const;

const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const registerSchema = z.object({
  firstName: z.string()
    .trim()
    .min(1, 'Prenom requis')
    .max(50, 'Maximum 50 caracteres'),
  schoolLevel: z.enum(['SECONDE', 'PREMIERE', 'TERMINALE']),
  classLetter: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']),
  username: z.string()
    .min(3, 'Minimum 3 caracteres')
    .max(20, 'Maximum 20 caracteres'),
  email: z.string().email('Email invalide').min(1, 'Email requis'),
  password: z.string().min(6, 'Minimum 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirmation requise'),
  motivationMessage: z.string()
    .trim()
    .min(10, 'Minimum 10 caracteres')
    .max(500, 'Maximum 500 caracteres'),
  referralCode: z.string()
    .trim()
    .max(24, 'Maximum 24 caracteres')
    .optional()
    .or(z.literal('')),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
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
      setError(err.response?.data?.error || 'Echec de l\'envoi de la demande');
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
                Demande envoyee !
              </h1>
              <p className={TYPOGRAPHY.MUTED}>
                {successMessage || 'Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.'}
              </p>
            </div>

            <Button asChild className="h-12 w-full">
              <Link to="/login">
                Retour a la connexion
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
          <CardTitle className={TYPOGRAPHY.H1}>AuraTracker</CardTitle>
          <CardDescription>Demande d&apos;inscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className={cn(TYPOGRAPHY.SMALL, 'text-destructive text-center')}>{error}</p>
          )}

          <p className={cn(TYPOGRAPHY.XS, 'rounded border border-border/30 p-3 text-center text-muted-foreground')}>
            Votre demande sera examinee par un administrateur avant d&apos;etre approuvee.
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
                        placeholder="Prenom (reel)"
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
                        placeholder="Pseudo"
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
                            <SelectValue placeholder="Niveau" />
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
                            <SelectValue placeholder="Lettre" />
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
                        placeholder="Email"
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
                          placeholder="Code de parrainage (optionnel)"
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
                        placeholder="Message de motivation: explique pourquoi on devrait t'accepter"
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
                        placeholder="Mot de passe"
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
                        placeholder="Confirmer le mot de passe"
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
                    Envoyer la demande
                  </>
                )}
              </Button>
            </form>
          </Form>

          <p className={cn(TYPOGRAPHY.SMALL, 'text-center text-muted-foreground')}>
            Deja un compte ?{' '}
            <Link to="/login" className="text-foreground hover:underline">
              Connexion
            </Link>
          </p>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
