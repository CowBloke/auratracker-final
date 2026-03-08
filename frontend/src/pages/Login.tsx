import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CenteredShell } from '@/components/layout/centered-shell';
import { TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';
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
  const [showLoginMessageModal, setShowLoginMessageModal] = useState(false);
  const [loginMessageModalOpen, setLoginMessageModalOpen] = useState(false);

  useEffect(() => {
    maintenanceApi.getStatus().then((res) => {
      setLoginMessage(res.data.loginMessage ?? '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (loginMessage && showLoginMessageModal) {
      setLoginMessageModalOpen(true);
      return;
    }

    setLoginMessageModalOpen(false);
  }, [loginMessage, showLoginMessageModal]);

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
      setError(err.response?.data?.error || 'Echec de connexion');
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
          <Alert variant="destructive" className="border-2 bg-destructive/10 shadow-sm" aria-live="assertive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Echec de connexion</AlertTitle>
            <AlertDescription className={cn(TYPOGRAPHY.SMALL, 'pr-6')}>
              {error}
            </AlertDescription>
          </Alert>
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

        <p className={cn(TYPOGRAPHY.SMALL, 'text-center text-muted-foreground')}>
          Pas de compte ?{' '}
          <Link to="/register" className="text-foreground hover:underline">
            Creer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );

  if (loginMessage) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center gap-8 p-4">
          <div className="max-w-sm w-full space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="h-4 w-4" />
                Information de connexion
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {loginMessage}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="login-message-modal" className="text-sm font-medium">
                  Afficher aussi en popup
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ouvre cette information dans une fenetre modale a fermer.
                </p>
              </div>
              <Switch
                id="login-message-modal"
                checked={showLoginMessageModal}
                onCheckedChange={setShowLoginMessageModal}
              />
            </div>
          </div>

          <div className="max-w-sm w-full">
            {loginForm}
          </div>
        </div>

        <Dialog open={loginMessageModalOpen} onOpenChange={setLoginMessageModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Information de connexion</DialogTitle>
              <DialogDescription>
                Message affiche a cote du formulaire.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {loginMessage}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setLoginMessageModalOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <CenteredShell widthClassName="max-w-sm">
      {loginForm}
    </CenteredShell>
  );
}
