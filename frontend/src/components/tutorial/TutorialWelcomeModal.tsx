import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTutorial } from './TutorialContext';

export function TutorialWelcomeModal() {
  const { hasSeenWelcome, acknowledgeWelcome, start } = useTutorial();

  if (hasSeenWelcome) return null;

  const handleStart = () => {
    acknowledgeWelcome();
    start();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && acknowledgeWelcome()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/15">
            <BookOpen className="size-6 text-primary" />
          </div>
          <DialogTitle>Bienvenue sur AuraTracker !</DialogTitle>
          <DialogDescription>
            C'est ta première connexion. Souhaites-tu suivre un tutoriel interactif pour découvrir les bases du jeu ?
            Tu pourras le relancer à tout moment depuis la page Tutoriels.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col">
          <Button onClick={handleStart} className="w-full">
            Oui, commencer le tutoriel
          </Button>
          <Button onClick={acknowledgeWelcome} variant="ghost" className="w-full text-muted-foreground">
            Non merci, je vais explorer seul
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
