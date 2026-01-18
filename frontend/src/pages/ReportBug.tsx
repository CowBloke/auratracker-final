import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bugReportApi } from '../services/api';
import { Loader2 } from 'lucide-react';
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
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground tracking-wide uppercase">
            Merci
          </p>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight">
            Bug signalé
          </h1>
        </header>

        <div className="h-px bg-border" />

        <section className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-base font-medium">Rapport envoyé</h2>
            <p className="text-sm text-muted-foreground">
              Votre rapport de bug a été envoyé aux administrateurs.
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setSubmitted(false)}
              className="px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Signaler un autre bug
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
            >
              Retour au tableau de bord
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-16">
      {/* Header */}
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Signalement
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Reporter un bug
        </h1>
      </header>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="px-4 py-3 border border-border/30 text-sm text-muted-foreground">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Titre du bug
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Le bouton ne fonctionne pas sur la page..."
            className="w-full h-12 bg-transparent border border-border/50 px-4 text-sm focus:outline-none focus:border-foreground/30"
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
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le bug en détail : que faisiez-vous, qu'est-ce qui s'est passé, qu'est-ce qui aurait dû se passer..."
            className="w-full min-h-[200px] bg-transparent border border-border/50 px-4 py-3 text-sm resize-none focus:outline-none focus:border-foreground/30"
            maxLength={2000}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground text-right">
            {description.length}/2000
          </p>
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-border/30 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={submitting}
          >
            Annuler
          </button>
          
          <button
            type="submit"
            disabled={submitting || !title.trim() || !description.trim()}
            className={cn(
              "px-4 py-2 text-sm border transition-colors min-w-[140px]",
              !submitting && title.trim() && description.trim()
                ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                : "border-border/30 text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi...
              </span>
            ) : (
              "Envoyer"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
