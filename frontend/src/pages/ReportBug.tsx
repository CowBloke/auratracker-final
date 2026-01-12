import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugReportApi } from '../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Bug, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportBug() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !description.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    if (title.length > 100) {
      setError('Le titre doit faire moins de 100 caractères');
      return;
    }
    
    if (description.length > 2000) {
      setError('La description doit faire moins de 2000 caractères');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      await bugReportApi.create({ title: title.trim(), description: description.trim() });
      setSubmitted(true);
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-16">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Merci
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">
            Bug signalé
          </h1>
        </header>

        <div className="p-8 border border-green-500/30 bg-green-500/5 space-y-6">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <h2 className="text-xl font-medium text-green-400">Rapport envoyé</h2>
              <p className="text-muted-foreground">
                Votre rapport de bug a été envoyé aux administrateurs.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setSubmitted(false)}
              className="border-border/50"
            >
              Signaler un autre bug
            </Button>
            <Button
              onClick={() => navigate('/')}
            >
              Retour au tableau de bord
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Bug className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Signalement
          </p>
        </div>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Reporter un bug
        </h1>
        <p className="text-muted-foreground text-lg mt-4">
          Vous avez trouvé un bug ? Décrivez-le ci-dessous et nous nous en occuperons.
        </p>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="px-4 py-3 border border-destructive/30 bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Titre du bug
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Le bouton ne fonctionne pas sur la page..."
            className="bg-transparent h-12 text-lg"
            maxLength={100}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {title.length}/100
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Description détaillée
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le bug en détail : que faisiez-vous, qu'est-ce qui s'est passé, qu'est-ce qui aurait dû se passer..."
            className="bg-transparent min-h-[200px] resize-none text-base"
            maxLength={2000}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {description.length}/2000
          </p>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            className="border-border/50"
            disabled={submitting}
          >
            Annuler
          </Button>
          
          <Button
            type="submit"
            disabled={submitting || !title.trim() || !description.trim()}
            className={cn(
              "min-w-[140px]",
              submitting && "opacity-80"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Envoyer
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
