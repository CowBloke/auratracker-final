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

/** Parse all CSS custom properties from the first :root { } block in the CSS text. */
function parseRootVars(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const rootStart = css.indexOf(':root');
  if (rootStart === -1) return vars;
  const braceOpen = css.indexOf('{', rootStart);
  if (braceOpen === -1) return vars;
  let depth = 1;
  let i = braceOpen + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  const inner = css.slice(braceOpen + 1, i - 1);
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

export default function Settings() {
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();
  const [colorSchemes, setColorSchemes] = useState<ColorSchemeEntry[]>([
    { id: 'default', label: 'Default' },
  ]);
  const [themeVars, setThemeVars] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    fetch('/themes/manifest.json')
      .then((r) => r.json())
      .then((data: ColorSchemeEntry[]) => {
        setColorSchemes(data);
        data.forEach(async (scheme) => {
          if (scheme.id === 'default') return;
          try {
            const css = await fetch(`/themes/${scheme.id}.css`).then((r) => r.text());
            const vars = parseRootVars(css);
            if (Object.keys(vars).length > 0) {
              setThemeVars((prev) => ({ ...prev, [scheme.id]: vars }));
            }
          } catch {
            // ignore
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
                const vars = scheme.id !== 'default' ? themeVars[scheme.id] : undefined;
                const loaded = scheme.id === 'default' || vars !== undefined;

                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => setColorScheme(scheme.id)}
                    // Spread all CSS vars so every hsl(var(--x)) inside resolves to this theme
                    style={
                      vars
                        ? ({
                            ...vars,
                            backgroundColor: 'hsl(var(--card))',
                            color: 'hsl(var(--card-foreground))',
                            borderRadius: 'var(--radius)',
                            fontFamily: 'var(--font-sans)',
                            border: isActive
                              ? '2px solid hsl(var(--primary))'
                              : '1px solid hsl(var(--border))',
                            outline: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            overflow: 'hidden',
                            padding: '0',
                            opacity: loaded ? 1 : 0,
                            transition: 'opacity 0.15s, border-color 0.15s',
                            boxShadow: isActive
                              ? '0 0 0 1px hsl(var(--primary))'
                              : undefined,
                          } as React.CSSProperties)
                        : {
                            // Default theme: uses live document vars (no override)
                            overflow: 'hidden',
                            padding: '0',
                            cursor: 'pointer',
                            textAlign: 'left',
                            border: isActive
                              ? '2px solid hsl(var(--primary))'
                              : '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius)',
                            backgroundColor: 'hsl(var(--card))',
                            color: 'hsl(var(--card-foreground))',
                            fontFamily: 'var(--font-sans)',
                            boxShadow: isActive
                              ? '0 0 0 1px hsl(var(--primary))'
                              : undefined,
                          } as React.CSSProperties
                    }
                  >
                    {/* Primary color bar */}
                    <div
                      style={{
                        height: '5px',
                        backgroundColor: 'hsl(var(--primary))',
                      }}
                    />
                    {/* Content */}
                    <div style={{ padding: '10px 12px 12px' }}>
                      {/* Mini UI mock */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '4px',
                          marginBottom: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            height: '8px',
                            width: '32px',
                            borderRadius: '9999px',
                            backgroundColor: 'hsl(var(--primary))',
                          }}
                        />
                        <div
                          style={{
                            height: '8px',
                            flex: 1,
                            borderRadius: '9999px',
                            backgroundColor: 'hsl(var(--muted))',
                          }}
                        />
                      </div>
                      <div
                        style={{
                          height: '6px',
                          width: '70%',
                          borderRadius: '9999px',
                          backgroundColor: 'hsl(var(--muted))',
                          marginBottom: '10px',
                        }}
                      />
                      {/* Label */}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'block',
                          color: 'hsl(var(--card-foreground))',
                        }}
                      >
                        {scheme.label}
                      </span>
                    </div>
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
