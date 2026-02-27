import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-shell';

const articles = [
  {
    title: "L'art de rester curieux pendant la maintenance",
    source: 'AuraDigest',
    readTime: '4 min',
    summary: "Une selection d'articles courts pour garder l'esprit en eveil pendant l'attente.",
    href: 'https://example.com/aura-digest-curiosite',
    tag: 'Focus',
  },
  {
    title: "Design d'interfaces calmantes : le guide express",
    source: 'Studio Journal',
    readTime: '6 min',
    summary: 'Des astuces simples pour creer des interfaces qui respirent, meme en periode de maintenance.',
    href: 'https://example.com/studio-journal-calm-ui',
    tag: 'Design',
  },
  {
    title: 'Playlist + lecture = flow assure',
    source: 'Product Notes',
    readTime: '5 min',
    summary: "Pourquoi associer musique et lecture rend l'attente plus douce et productive.",
    href: 'https://example.com/product-notes-flow',
    tag: 'Lifestyle',
  },
];

export default function News() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Maintenance"
        title="News Lounge"
        description="Une sélection courte, rangée en cartes, pour garder la même lecture visuelle que le reste du site."
      />
      <Card>
        <CardContent className="pt-6">
          <p className="text-base text-muted-foreground">
            Un petit fil d'articles a partager. Remplace les liens par tes propres recommandations.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {articles.map((article) => (
          <a
            key={article.title}
            href={article.href}
            target="_blank"
            rel="noreferrer"
            className="group block h-full"
          >
            <Card className="h-full bg-muted/20 transition hover:-translate-y-1 hover:border-foreground/40">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div className="space-y-4">
                  <div className="inline-flex w-fit items-center rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {article.tag}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                      {article.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">{article.summary}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{article.source}</span>
                  <span>{article.readTime}</span>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      <Card className="bg-muted/20">
        <CardHeader>
          <CardTitle className="text-lg">Partager un article</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ajoute tes liens preferes dans <span className="font-medium text-foreground">frontend/src/pages/News.tsx</span> pour
            alimenter cette selection.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
