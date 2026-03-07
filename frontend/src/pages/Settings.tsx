import { useEffect, useState } from 'react';
import { Sun, Moon, Loader2, Check, User } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { usersApi } from '@/services/api';

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
  const { user } = useAuth();
  const [colorSchemes, setColorSchemes] = useState<ColorSchemeEntry[]>([
    { id: 'default', label: 'Default' },
  ]);
  const [themeVars, setThemeVars] = useState<Record<string, Record<string, string>>>({});

  // Name change state
  const [requestedUsername, setRequestedUsername] = useState('');
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [submittingNameChange, setSubmittingNameChange] = useState(false);
  const [nameChangeSuccess, setNameChangeSuccess] = useState(false);
  const [nameChangeError, setNameChangeError] = useState<string | null>(null);

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

  const handleNameChangeSubmit = async () => {
    if (!requestedUsername.trim()) return;
    setSubmittingNameChange(true);
    setNameChangeError(null);
    try {
      await usersApi.requestNameChange({
        requestedUsername: requestedUsername.trim(),
        reason: nameChangeReason.trim() || undefined,
      });
      setNameChangeSuccess(true);
      setRequestedUsername('');
      setNameChangeReason('');
    } catch (err: any) {
      setNameChangeError(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSubmittingNameChange(false);
    }
  };

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
          <TabsTrigger
            value="compte"
            className="justify-start px-3 py-2 text-sm"
          >
            Compte
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
                    <div style={{ height: '5px', backgroundColor: 'hsl(var(--primary))' }} />
                    <div style={{ padding: '10px 12px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', alignItems: 'center' }}>
                        <div style={{ height: '8px', width: '32px', borderRadius: '9999px', backgroundColor: 'hsl(var(--primary))' }} />
                        <div style={{ height: '8px', flex: 1, borderRadius: '9999px', backgroundColor: 'hsl(var(--muted))' }} />
                      </div>
                      <div style={{ height: '6px', width: '70%', borderRadius: '9999px', backgroundColor: 'hsl(var(--muted))', marginBottom: '10px' }} />
                      <span style={{ fontSize: '11px', fontWeight: 600, display: 'block', color: 'hsl(var(--card-foreground))' }}>
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

        <TabsContent value="compte" className="mt-0 flex-1 space-y-8">
          {/* Current account info */}
          <section className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Compte</p>
              <h3 className="text-sm font-medium">Informations de ton compte.</h3>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3 max-w-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Pseudo actuel</p>
                <p className="text-sm font-medium">{user?.username ?? '—'}</p>
              </div>
            </div>
          </section>

          {/* Name change request */}
          <section className="space-y-3 max-w-sm">
            <div>
              <p className="text-xs text-muted-foreground">Changement de pseudo</p>
              <h3 className="text-sm font-medium">Demande un nouveau pseudo aux admins.</h3>
            </div>

            {nameChangeSuccess ? (
              <div className="flex items-center gap-2 text-green-500 text-sm rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3">
                <Check className="h-4 w-4 shrink-0" />
                Demande envoyée ! Les admins la traiteront prochainement.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Nouveau pseudo souhaité</label>
                  <Input
                    value={requestedUsername}
                    onChange={(e) => setRequestedUsername(e.target.value)}
                    placeholder="Entre ton nouveau pseudo..."
                    maxLength={20}
                    className="h-9 bg-transparent border-border/50"
                  />
                  <p className="text-[11px] text-muted-foreground/60">
                    3–20 caractères, lettres, chiffres et underscores uniquement.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Raison (optionnel)</label>
                  <Textarea
                    value={nameChangeReason}
                    onChange={(e) => setNameChangeReason(e.target.value)}
                    placeholder="Pourquoi souhaites-tu changer de pseudo ?"
                    maxLength={300}
                    rows={3}
                    className="resize-none bg-transparent border-border/50"
                  />
                </div>

                {nameChangeError && (
                  <p className="text-xs text-destructive">{nameChangeError}</p>
                )}

                <Button
                  size="sm"
                  onClick={handleNameChangeSubmit}
                  disabled={submittingNameChange || requestedUsername.trim().length < 3}
                  className="h-8"
                >
                  {submittingNameChange
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : 'Envoyer la demande'}
                </Button>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
