const articles = [
  {
    title: "L'art de rester curieux pendant la maintenance",
    source: "AuraDigest",
    readTime: "4 min",
    summary: "Une selection d'articles courts pour garder l'esprit en eveil pendant l'attente.",
    href: "https://example.com/aura-digest-curiosite",
    tag: "Focus",
  },
  {
    title: "Design d'interfaces calmantes : le guide express",
    source: "Studio Journal",
    readTime: "6 min",
    summary: "Des astuces simples pour creer des interfaces qui respirent, meme en periode de maintenance.",
    href: "https://example.com/studio-journal-calm-ui",
    tag: "Design",
  },
  {
    title: "Playlist + lecture = flow assure",
    source: "Product Notes",
    readTime: "5 min",
    summary: "Pourquoi associer musique et lecture rend l'attente plus douce et productive.",
    href: "https://example.com/product-notes-flow",
    tag: "Lifestyle",
  },
];

export default function News() {
  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">News lounge</p>
          <h1 className="text-3xl font-semibold">Articles a lire pendant la maintenance</h1>
          <p className="text-base text-muted-foreground">
            Un petit fil d'articles a partager. Remplace les liens par tes propres recommandations.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article) => (
            <a
              key={article.title}
              href={article.href}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col justify-between rounded-2xl border border-border/50 bg-muted/20 p-6 transition hover:-translate-y-1 hover:border-border"
            >
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
            </a>
          ))}
        </div>

        <section className="rounded-2xl border border-border/40 bg-muted/20 p-6">
          <h3 className="text-lg font-semibold">Partager un article</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajoute tes liens preferes dans <span className="font-medium text-foreground">frontend/src/pages/News.tsx</span> pour
            alimenter cette selection.
          </p>
        </section>
      </div>
    </div>
  );
}
