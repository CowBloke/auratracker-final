import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
import { maintenanceApi } from '@/services/api';

const loginSchema = z.object({
  username: z.string().min(1, 'Pseudo requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [showRegisterCta, setShowRegisterCta] = useState(true);

  useEffect(() => {
    maintenanceApi.getStatus().then((res) => {
      setLoginMessage(res.data.loginMessage ?? '');
      setShowRegisterCta(res.data.loginRegisterCtaEnabled !== false);
    }).catch(() => {});
  }, []);
  
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      setLoading(true);
      await login(data.username, data.password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Échec de connexion');
    } finally {
      setLoading(false);
    }
  };

  const loginForm = (
    <Card>
      <CardHeader className="space-y-2 text-center">
        <CardTitle className={TYPOGRAPHY.H1}>AuraTracker</CardTitle>
        <CardDescription>Connexion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className={cn(TYPOGRAPHY.SMALL, "text-destructive text-center")}>{error}</p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connexion'}
            </Button>
          </form>
        </Form>

        {showRegisterCta && (
          <Button
            asChild
            size="lg"
            className={cn(
              "group relative h-auto w-full overflow-hidden rounded-2xl border border-amber-200/50",
              "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 px-6 py-6 text-lg font-black tracking-[0.08em] text-white",
              "shadow-[0_18px_50px_rgba(251,146,60,0.45)] transition-transform duration-300 hover:scale-[1.02] hover:shadow-[0_24px_70px_rgba(244,114,182,0.45)]",
              "animate-pulse"
            )}
          >
            <Link to="/register">
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.38)_50%,transparent_80%)] bg-[length:220%_100%] animate-[shimmer_2.8s_linear_infinite]" />
              <span className="relative flex w-full items-center justify-center gap-3 text-center">
                <Sparkles className="h-6 w-6 animate-bounce" />
                <span>Creer un compte</span>
                <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </Button>
        )}

        <p className={cn(TYPOGRAPHY.SMALL, "text-center text-muted-foreground")}>
          Pas de compte ?{' '}
          <Link to="/register" className="text-foreground hover:underline">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );

  if (loginMessage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 gap-8">
        <div className="max-w-sm w-full text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
          {loginMessage}
        </div>
        <div className="max-w-sm w-full">
          {loginForm}
        </div>
      </div>
    );
  }

  return (
    <CenteredShell widthClassName="max-w-sm">
      {loginForm}
    </CenteredShell>
  );
}
