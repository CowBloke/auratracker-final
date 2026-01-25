export default function WallaceGromit() {
  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Salle d'attente
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Wallace & Gromit — Compilation cosy
          </h1>
          <p className="text-base text-muted-foreground">
            Installe-toi, baisse la lumiere et lance la compilation pendant que l'equipe termine la maintenance.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/50 bg-muted/20 shadow-sm">
          <div className="border-b border-border/40 bg-background/60 px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Fichier attendu : <span className="font-medium text-foreground">wallace-gromit-compilation.mp4</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Depose-le dans <span className="font-medium text-foreground">frontend/public/media/wallace-gromit</span>.
            </p>
          </div>
          <video
            className="w-full bg-black"
            src="/media/wallace-gromit/wallace-gromit-compilation.mp4"
            controls
          />
        </div>

        <div className="rounded-2xl border border-border/40 bg-muted/20 p-6 text-sm text-muted-foreground">
          Si la video ne se lance pas, verifie bien le nom du fichier et le format .mp4.
        </div>
      </div>
    </div>
  );
}
