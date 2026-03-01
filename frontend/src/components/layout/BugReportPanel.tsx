import { useState, type FormEvent, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { bugReportApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SPACING, TYPOGRAPHY } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface BugReportPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
}

export default function BugReportPanel({ open, onOpenChange, trigger }: BugReportPanelProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSubmitting(false);
    setSubmitted(false);
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Reporter un bug</SheetTitle>
          <SheetDescription>
            Décris précisément le problème pour aider l’équipe à le reproduire.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {submitted ? (
            <div className={SPACING.SECTION_SPACING}>
              <div className={SPACING.CARD_SPACING}>
                <h3 className={TYPOGRAPHY.BODY}>Rapport envoyé</h3>
                <p className={TYPOGRAPHY.SMALL}>
                  Votre rapport de bug a été envoyé aux administrateurs.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Signaler un autre bug
                </Button>
                <Button onClick={() => handleOpenChange(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={SPACING.SECTION_SPACING}>
              {error ? (
                <div className={cn('border border-border/30 px-4 py-3', TYPOGRAPHY.SMALL)}>
                  {error}
                </div>
              ) : null}

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>Titre du bug</label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Le bouton ne fonctionne pas sur la page..."
                  maxLength={100}
                  disabled={submitting}
                />
                <p className={cn(TYPOGRAPHY.XS, 'text-right')}>
                  {title.length}/100
                </p>
              </div>

              <div className={SPACING.CARD_SPACING}>
                <label className={TYPOGRAPHY.SMALL}>Description détaillée</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez le bug en détail : que faisiez-vous, qu'est-ce qui s'est passé, qu'est-ce qui aurait dû se passer..."
                  className="min-h-[220px]"
                  maxLength={2000}
                  disabled={submitting}
                />
                <p className={cn(TYPOGRAPHY.XS, 'text-right')}>
                  {description.length}/2000
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
                >
                  Annuler
                </Button>

                <Button
                  type="submit"
                  disabled={submitting || !title.trim() || !description.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi...
                    </>
                  ) : (
                    'Envoyer'
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
