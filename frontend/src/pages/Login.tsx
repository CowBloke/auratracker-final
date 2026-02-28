import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
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

  return (
    <CenteredShell widthClassName="max-w-sm">
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

          <p className={cn(TYPOGRAPHY.SMALL, "text-center text-muted-foreground")}>
            Pas de compte ?{' '}
            <Link to="/register" className="text-foreground hover:underline">
              Créer un compte
            </Link>
          </p>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
