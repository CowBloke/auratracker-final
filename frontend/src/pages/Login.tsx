import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-12">
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-tight">
            aura
          </h1>
          <p className="text-sm text-muted-foreground">Connexion</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Form */}
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
                      className="h-12 bg-transparent border-border/50 text-center"
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
                      className="h-12 bg-transparent border-border/50 text-center"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connexion'}
            </button>
          </form>
        </Form>

        {/* Link */}
        <p className="text-center text-sm text-muted-foreground">
          Pas de compte ?{' '}
          <Link to="/register" className="text-foreground hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
