import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';

interface ColorSchemeEntry {
  id: string;
  label: string;
}

interface SchemePreview {
  bg: string;
  primary: string;
}

function extractVar(css: string, varName: string): string | null {
  const match = css.match(new RegExp(`${varName}:\\s*([^;\\n]+);`));
  return match ? match[1].trim() : null;
}

export default function Settings() {
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();
  const [colorSchemes, setColorSchemes] = useState<ColorSchemeEntry[]>([
    { id: 'default', label: 'Default' },
  ]);
  const [previews, setPreviews] = useState<Record<string, SchemePreview>>({});

  useEffect(() => {
    fetch('/themes/manifest.json')
      .then((r) => r.json())
      .then((data: ColorSchemeEntry[]) => {
        setColorSchemes(data);
        data.forEach(async (scheme) => {
          if (scheme.id === 'default') return;
          try {
            const css = await fetch(`/themes/${scheme.id}.css`).then((r) => r.text());
            const bg = extractVar(css, '--background');
            const primary = extractVar(css, '--primary');
            if (bg && primary) {
              setPreviews((prev) => ({
                ...prev,
                [scheme.id]: {
                  bg: `hsl(${bg})`,
                  primary: `hsl(${primary})`,
                },
              }));
            }
          } catch {
            // ignore fetch errors for individual themes
          }
        });
      })
      .catch(() => {});
  }, []);

  return (
    <PageShell>
      <Tabs
        orientation="vertical"
        defaultValue="personnalisation"
        className="flex gap-8"
      >
        <TabsList className="flex h-auto w-44 shrink-0 flex-col items-stretch justify-start gap-0.5 rounded-lg border border-border/40 bg-muted/20 p-1.5">
          <TabsTrigger
            value="personnalisation"
            className="justify-start px-3 py-2 text-sm"
          >
            Personnalisation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personnalisation" className="mt-0 flex-1 space-y-8">
          {/* Light / Dark */}
          <section className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Thème</p>
              <h3 className="text-sm font-medium">Choisis l'ambiance qui te convient.</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              {(
                [
                  { id: 'light', label: 'Clair', icon: Sun },
                  { id: 'dark', label: 'Sombre', icon: Moon },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors',
                    theme === id
                      ? 'border-foreground bg-foreground/5 font-medium text-foreground'
                      : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Color scheme */}
          <section className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Palette de couleurs</p>
              <h3 className="text-sm font-medium">Choisis un thème tweakcn.</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {colorSchemes.map((scheme) => {
                const isActive = colorScheme === scheme.id;
                const preview = scheme.id !== 'default' ? previews[scheme.id] : null;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => setColorScheme(scheme.id)}
                    className={cn(
                      'flex flex-col gap-2.5 rounded-lg border p-3 text-left transition-colors',
                      isActive
                        ? 'border-foreground ring-1 ring-foreground'
                        : 'border-border/40 hover:border-border'
                    )}
                  >
                    {/* color swatches */}
                    <div className="flex gap-1">
                      {preview ? (
                        <>
                          <span
                            className="h-6 w-6 rounded-md border border-black/10"
                            style={{ background: preview.bg }}
                          />
                          <span
                            className="h-6 w-6 rounded-md border border-black/10"
                            style={{ background: preview.primary }}
                          />
                        </>
                      ) : (
                        <>
                          <span className="h-6 w-6 rounded-md border border-black/10 bg-background" />
                          <span className="h-6 w-6 rounded-md border border-black/10 bg-primary" />
                        </>
                      )}
                    </div>
                    <span className="text-xs font-medium leading-tight">{scheme.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Dépose un fichier CSS tweakcn dans{' '}
              <code className="font-mono">public/themes/</code> et ajoute une entrée dans{' '}
              <code className="font-mono">manifest.json</code>.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
