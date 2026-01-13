import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { authApi } from '../services/api';
import { Loader2, CheckCircle2, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

const registerSchema = z.object({
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-light tracking-tight">
              Demande envoyée !
            </h1>
            <p className="text-muted-foreground">
              Un administrateur doit approuver votre compte avant que vous puissiez vous connecter.
            </p>
          </div>
          
          <Link 
            to="/login" 
            className="inline-block w-full h-12 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors flex items-center justify-center"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-12">
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-light tracking-tight">
            aura
          </h1>
          <p className="text-sm text-muted-foreground">Demande d'inscription</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center border border-border/30 p-3 rounded">
          Votre demande sera examinée par un administrateur avant d'être approuvée.
        </p>

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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Email"
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

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Confirmer le mot de passe"
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
              className="w-full h-12 border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Envoyer la demande
                </>
              )}
            </button>
          </form>
        </Form>

        {/* Link */}
        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-foreground hover:underline">
            Connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
