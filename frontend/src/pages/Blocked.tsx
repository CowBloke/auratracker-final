import { useNavigate } from 'react-router-dom';
import { ArrowLeftCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { AuthShell } from '@/components/layout/AuthShell';

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
    <AuthShell size="lg">
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArrowLeftCircle />
              </EmptyMedia>
              <EmptyTitle>Page bloquée</EmptyTitle>
              <EmptyDescription>
                Cette page est temporairement inaccessible. Merci de revenir plus tard.
              </EmptyDescription>
            </EmptyHeader>
            {message && message.trim().length > 0 ? <EmptyContent>{message}</EmptyContent> : null}
            <EmptyContent>
              <Button onClick={handleBack}>Retour</Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
