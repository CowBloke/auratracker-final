import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTutorial } from './TutorialContext';

export function TutorialWelcomeModal() {
  const { hasSeenWelcome, acknowledgeWelcome, start } = useTutorial();

  if (hasSeenWelcome) return null;

  const handleStart = () => {
    acknowledgeWelcome();
    start();
  };

  const handleDecline = () => {
    acknowledgeWelcome();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" style={{ zIndex: 1000000 }} />
      <div
        className="fixed left-1/2 top-1/2 z-[1000001] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/60 bg-popover p-6 shadow-2xl"
      >
        <button
          onClick={handleDecline}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>

        <h2 className="mb-1 text-lg font-semibold">Bienvenue sur AuraTracker !</h2>
        <p className="mb-1 text-sm text-muted-foreground">
          C'est ta première connexion. Souhaites-tu suivre un tutoriel interactif pour découvrir les bases du jeu ?
        </p>
        <p className="mb-6 text-xs text-muted-foreground">
          Tu pourras le relancer à tout moment depuis la page <strong>Tutoriels</strong>.
        </p>

        <div className="flex flex-col gap-2">
          <Button onClick={handleStart} className="w-full">
            Oui, commencer le tutoriel
          </Button>
          <Button onClick={handleDecline} variant="ghost" className="w-full text-muted-foreground">
            Non merci, je vais explorer seul
          </Button>
        </div>
      </div>
    </>
  );
}
