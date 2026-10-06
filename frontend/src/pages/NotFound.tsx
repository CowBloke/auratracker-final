import { Link } from 'react-router-dom';
import { AuthShell } from '@/components/layout/AuthShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export default function NotFound() {
  return (
    <AuthShell>
      <Card>
        <CardContent>
          <Empty className="p-0">
            <EmptyHeader>
              <EmptyTitle>
                <h1>Page introuvable</h1>
              </EmptyTitle>
              <EmptyDescription>Cette page n'existe pas ou a été déplacée.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to="/dashboard">Retour au tableau de bord</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
