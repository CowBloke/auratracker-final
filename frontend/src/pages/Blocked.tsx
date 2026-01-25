import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeftCircle } from 'lucide-react';

interface BlockedProps {
  message?: string;
}

export default function Blocked({ message }: BlockedProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <div className="flex justify-center">
          <ArrowLeftCircle className="h-14 w-14 text-muted-foreground" />
        </div>
        <div className="text-3xl font-semibold text-foreground">
          Page bloquée
        </div>
        <p className="text-muted-foreground">
          Cette page est temporairement inaccessible. Merci de revenir plus tard.
        </p>

        {message && message.trim().length > 0 && (
          <div className="border border-border/40 bg-muted/20 rounded-lg p-4 text-sm text-foreground">
            {message}
          </div>
        )}

        <div className="flex justify-center">
          <Button onClick={handleBack} variant="default">
            Retour
          </Button>
        </div>
      </div>
    </div>
  );
}
