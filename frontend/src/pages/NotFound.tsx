import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Page introuvable</EmptyTitle>
          <EmptyDescription>Cette page n'existe pas ou a été déplacée.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/dashboard">Retour au tableau de bord</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
