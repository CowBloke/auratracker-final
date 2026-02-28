import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';

export default function WallaceGromit() {
  return (
    <PageShell padTop>
      <PageHeader
        title="Wallace & Gromit"
        description="Lecture continue, sans distraction, pendant l'indisponibilité du site."
      />
      <Card>
        <CardHeader>
          <CardTitle>Projection</CardTitle>
          <CardDescription>Une seule carte, un seul player, aucune surcharge visuelle.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border/40 bg-black">
            <iframe
              className="h-[70vh] w-full"
              src="https://www.youtube-nocookie.com/embed/K7gdWIY9R4s?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&playsinline=1"
              title="Wallace & Gromit"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
