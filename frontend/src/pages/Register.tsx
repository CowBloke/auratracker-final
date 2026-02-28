import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '../services/api';
import { Loader2, CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { CenteredShell } from '@/components/layout/centered-shell';

const registerSchema = z.object({
  firstName: z.string()
    .trim()
    .min(1, 'Prénom requis')
    .max(50, 'Maximum 50 caractères'),
  username: z.string()
    .min(3, 'Minimum 3 caractères')
    .max(20, 'Maximum 20 caractères'),
  email: z.string().email('Email invalide').min(1, 'Email requis'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  confirmPassword: z.string().min(1, 'Confirmation requise'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError('');
      setLoading(true);
      await authApi.register({
        username: data.username,
        firstName: data.firstName,
        email: data.email,
        password: data.password,
      });
      // Account created successfully, show success message
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Échec de l\'envoi de la demande');
    } finally {
      setLoading(false);
    }
  };

  // Success state - show confirmation message
  if (success) {
    return (
      <CenteredShell widthClassName="max-w-sm">
        <Card>
          <CardContent className="space-y-8 pt-6 text-center">
            <div className="space-y-4">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h1 className={TYPOGRAPHY.H2}>
                Demande envoyée !
              </h1>
              <p className={TYPOGRAPHY.MUTED}>
                Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.
              </p>
            </div>
          
            <Button asChild className="h-12 w-full">
              <Link to="/login">
                Retour à la connexion
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
          <CardDescription>Demande d'inscription</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className={cn(TYPOGRAPHY.SMALL, "text-destructive text-center")}>{error}</p>
          )}

          <p className={cn(TYPOGRAPHY.XS, "text-muted-foreground text-center border border-border/30 p-3 rounded")}>
            Votre demande sera examinée par un administrateur avant d'être approuvée.
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
                        placeholder="Prénom (réel)"
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

          <p className={cn(TYPOGRAPHY.SMALL, "text-center text-muted-foreground")}>
            Déjà un compte ?{' '}
            <Link to="/login" className="text-foreground hover:underline">
              Connexion
            </Link>
          </p>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
