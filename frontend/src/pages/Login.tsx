import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CircleAlert, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/components/layout/AuthShell';
import { maintenanceApi } from '@/services/api';
import { normalizeDefaultLandingPage } from '@/lib/default-landing-page';
import { t } from '@/lib/i18n';

const loginSchema = z.object({
  username: z.string().trim().min(1, t('login_username_required')),
  password: z.string().min(1, t('login_password_required')),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [showRegisterCta, setShowRegisterCta] = useState(true);
  const [defaultLandingPage, setDefaultLandingPage] = useState('/dashboard');

  useEffect(() => {
    maintenanceApi
      .getStatus()
      .then((res) => {
        setLoginMessage(res.data.loginMessage ?? '');
        setShowRegisterCta(res.data.loginRegisterCtaEnabled !== false);
        setDefaultLandingPage(normalizeDefaultLandingPage(res.data.defaultLandingPage));
      })
      .catch(() => {});
  }, []);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      setLoading(true);
      await login(data.username.trim(), data.password);
      const statusRes = await maintenanceApi.getStatus().catch(() => null);
      navigate(normalizeDefaultLandingPage(statusRes?.data.defaultLandingPage ?? defaultLandingPage));
    } catch (err: any) {
      setError(err.response?.data?.error || t('login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {loginMessage ? (
        <Alert>
          <Info />
          <AlertDescription className="whitespace-pre-wrap">{loginMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t('login_title')}</CardTitle>
          <CardDescription>{t('login_description')}</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="flex flex-col gap-4">
              {error ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login_username_placeholder')}</FormLabel>
                    <FormControl>
                      <Input type="text" autoComplete="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login_password_placeholder')}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Spinner /> : t('login_submit')}
              </Button>
            </CardContent>
          </form>
        </Form>
        {showRegisterCta ? (
          <CardFooter className="justify-center text-sm text-muted-foreground">
            {t('login_no_account')}&nbsp;
            <Link to="/register" className="text-foreground underline-offset-4 hover:underline">
              {t('login_register_link')}
            </Link>
          </CardFooter>
        ) : null}
      </Card>
    </AuthShell>
  );
}
