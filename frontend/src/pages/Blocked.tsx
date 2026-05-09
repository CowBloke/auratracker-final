import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeftCircle } from 'lucide-react';
import { TYPOGRAPHY } from '@/lib/design-system';
import { CenteredShell } from '@/components/layout/CenteredShell';

interface BlockedProps {
  message?: string;
}

export default function Blocked({ message }: BlockedProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <CenteredShell widthClassName="max-w-2xl">
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <ArrowLeftCircle className="h-14 w-14 text-muted-foreground" />
        </div>
        <div className={TYPOGRAPHY.H2}>
          Page bloquée
        </div>
        <p className={TYPOGRAPHY.MUTED}>
          Cette page est temporairement inaccessible. Merci de revenir plus tard.
        </p>

        {message && message.trim().length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className={TYPOGRAPHY.SMALL}>{message}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center">
          <Button onClick={handleBack} variant="default">
            Retour
          </Button>
        </div>
      </div>
    </CenteredShell>
  );
}
