import { useEffect, useState } from 'react';
import { Sun, Moon, Loader2, Check, User, Copy, Sparkles, Ticket, Keyboard, RotateCcw } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { ReferralSummary, authApi, usersApi } from '@/services/api';
import ReferralClaimAnimation from '@/components/referrals/ReferralClaimAnimation';
import { toast } from 'sonner';
import {
  setHideGameLeaderboardsPreference,
  setHideGameLeftInfoPreference,
  useHideGameLeaderboards,
  useHideGameLeftInfo,
} from '@/lib/game-preferences';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcutCombo,
  getShortcutComboFromEvent,
  resetKeyboardShortcuts,
  updateKeyboardShortcut,
  useKeyboardShortcuts,
  type KeyboardShortcutActionId,
} from '@/lib/keyboard-shortcuts';

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
  const { maintenanceStatus } = useFeatures();
  const [colorSchemes, setColorSchemes] = useState<ColorSchemeEntry[]>([
    { id: 'default', label: 'Default' },
  ]);
  const [themeVars, setThemeVars] = useState<Record<string, Record<string, string>>>({});
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [referralClaimOpen, setReferralClaimOpen] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const hideGameLeaderboards = useHideGameLeaderboards();
  const hideGameLeftInfo = useHideGameLeftInfo();
  const keyboardShortcuts = useKeyboardShortcuts();
  const [capturingShortcutId, setCapturingShortcutId] = useState<KeyboardShortcutActionId | null>(null);

  // Name change state
  const [requestedUsername, setRequestedUsername] = useState('');
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [submittingNameChange, setSubmittingNameChange] = useState(false);
  const [nameChangeSuccess, setNameChangeSuccess] = useState(false);
  const [nameChangeError, setNameChangeError] = useState<string | null>(null);
  const referralEnabled = maintenanceStatus.referralEnabled;

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

  useEffect(() => {
    if (!referralEnabled) {
      setReferralSummary(null);
      return;
    }

    let cancelled = false;
    setReferralLoading(true);

    authApi
      .getReferralSummary()
      .then((res) => {
        if (!cancelled) {
          setReferralSummary(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReferralSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReferralLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [referralEnabled]);

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

  const handleReferralCopy = async () => {
    if (!referralSummary?.referralCode) return;

    try {
      await navigator.clipboard.writeText(referralSummary.referralCode);
      toast('Code copie', {
        description: `${referralSummary.referralCode} est pret a etre partage.`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to copy referral code:', error);
      toast('Copie impossible', {
        description: 'Le code est affiche, mais la copie automatique a echoue.',
        duration: 3000,
      });
    }
  };

  const getDefaultShortcut = (shortcutId: KeyboardShortcutActionId) =>
    DEFAULT_KEYBOARD_SHORTCUTS.find((shortcut) => shortcut.id === shortcutId);

  const handleShortcutCapture = (shortcutId: KeyboardShortcutActionId) => {
    setCapturingShortcutId(shortcutId);
  };

  const handleShortcutKeyDown = (
    shortcutId: KeyboardShortcutActionId,
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();

    if (event.key === 'Escape') {
      setCapturingShortcutId(null);
      return;
    }

    const combo = getShortcutComboFromEvent(event);

    if (!combo) {
      toast('Raccourci invalide', {
        description: 'Utilise au moins une touche modificatrice comme Alt, Ctrl, Cmd ou Shift.',
        duration: 3000,
      });
      return;
    }

    updateKeyboardShortcut(shortcutId, { combo, enabled: true });
    setCapturingShortcutId(null);

    toast('Raccourci mis a jour', {
      description: `Nouveau raccourci: ${formatShortcutCombo(combo)}.`,
      duration: 3000,
    });
  };

  const handleShortcutReset = (shortcutId: KeyboardShortcutActionId) => {
    const defaultShortcut = getDefaultShortcut(shortcutId);
    if (!defaultShortcut) {
      return;
    }

    updateKeyboardShortcut(shortcutId, {
      combo: defaultShortcut.combo,
      enabled: defaultShortcut.enabled,
    });
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
          <TabsTrigger
            value="parrainage"
            className="justify-start px-3 py-2 text-sm"
          >
            Parrainage
          </TabsTrigger>
          <TabsTrigger
            value="raccourcis"
            className="justify-start px-3 py-2 text-sm"
          >
            Raccourcis
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

          <section className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Jeux</p>
              <h3 className="text-sm font-medium">Personnalise l'affichage de toutes les pages de jeux.</h3>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setHideGameLeaderboardsPreference(!hideGameLeaderboards)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  hideGameLeaderboards
                    ? 'border-foreground bg-foreground/5 text-foreground'
                    : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <div>
                  <p className="font-medium">Sans classement</p>
                  <p className="text-xs text-muted-foreground">
                    {hideGameLeaderboards ? 'Les classements des jeux sont masqués.' : 'Les classements des jeux restent visibles.'}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {hideGameLeaderboards ? 'Actif' : 'Inactif'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHideGameLeftInfoPreference(!hideGameLeftInfo)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                  hideGameLeftInfo
                    ? 'border-foreground bg-foreground/5 text-foreground'
                    : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                )}
              >
                <div>
                  <p className="font-medium">Sans infos à gauche</p>
                  <p className="text-xs text-muted-foreground">
                    {hideGameLeftInfo ? 'Les panneaux d’infos à gauche sont masqués.' : 'Les panneaux d’infos à gauche restent visibles.'}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {hideGameLeftInfo ? 'Actif' : 'Inactif'}
                </span>
              </button>
            </div>
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

        <TabsContent value="parrainage" className="mt-0 flex-1 space-y-8">
          {!referralEnabled ? (
            <section className="max-w-2xl rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
              <p className="text-sm font-medium">Parrainage desactive pour le moment.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cette fonctionnalite reviendra bientot.
              </p>
            </section>
          ) : referralLoading ? (
            <section className="max-w-2xl rounded-xl border border-border/50 bg-muted/20 px-4 py-6">
              <p className="text-sm text-muted-foreground">Chargement du parrainage...</p>
            </section>
          ) : referralSummary ? (
            <section className="max-w-3xl">
              <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Parrainage</p>
                    <p className="text-sm font-medium">Ton code est pret a etre partage.</p>
                  </div>
                  <Badge variant="secondary" className="border border-border/50 bg-background/70">
                    +{referralSummary.rewardAmount} money chacun
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-muted/40 text-muted-foreground">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Code</p>
                      <p className="font-mono text-base font-medium tracking-[0.28em] text-foreground">{referralSummary.referralCode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="default" size="sm" onClick={() => setReferralClaimOpen(true)}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Reclamer
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleReferralCopy}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Valides</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{referralSummary.successfulReferrals}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">En attente</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{referralSummary.pendingReferrals}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Gagnes</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{referralSummary.totalRewardsEarned}</p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="max-w-2xl rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
              <p className="text-sm text-muted-foreground">Impossible de charger le parrainage pour le moment.</p>
            </section>
          )}
        </TabsContent>

        <TabsContent value="raccourcis" className="mt-0 flex-1 space-y-6">
          <section className="max-w-4xl space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Raccourcis clavier</p>
                <h3 className="text-sm font-medium">Personnalise les actions de base de l'application.</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  resetKeyboardShortcuts();
                  setCapturingShortcutId(null);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reinitialiser
              </Button>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/70">
                  <Keyboard className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Raccourcis de base inclus</p>
                  <p>
                    Cette premiere version permet de naviguer rapidement vers les pages principales. Clique sur
                    “Modifier”, puis presse la combinaison souhaitee.
                  </p>
                  <p className="text-xs">
                    Conseil: utilise au moins une touche modificatrice pour eviter les conflits en jeu.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {keyboardShortcuts.map((shortcut) => {
                const defaultShortcut = getDefaultShortcut(shortcut.id);
                const isCapturing = capturingShortcutId === shortcut.id;
                const isCustomized =
                  shortcut.combo !== defaultShortcut?.combo || shortcut.enabled !== defaultShortcut?.enabled;

                return (
                  <div
                    key={shortcut.id}
                    className="rounded-xl border border-border/50 bg-background/60 px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{shortcut.label}</p>
                          <Badge variant={isCustomized ? 'default' : 'secondary'}>
                            {isCustomized ? 'Personnalise' : 'Par defaut'}
                          </Badge>
                          {!shortcut.enabled && (
                            <Badge variant="outline">Desactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{shortcut.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Actuel:</span>
                          <code className="rounded-md border border-border/50 bg-muted/30 px-2 py-1 font-mono text-foreground">
                            {formatShortcutCombo(shortcut.combo)}
                          </code>
                          {defaultShortcut && (
                            <>
                              <span>Par defaut:</span>
                              <code className="rounded-md border border-border/50 bg-muted/30 px-2 py-1 font-mono">
                                {formatShortcutCombo(defaultShortcut.combo)}
                              </code>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <div className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                          <span className="text-xs text-muted-foreground">Actif</span>
                          <Switch
                            checked={shortcut.enabled}
                            onCheckedChange={(enabled) => updateKeyboardShortcut(shortcut.id, { enabled })}
                          />
                        </div>

                        <Button
                          type="button"
                          variant={isCapturing ? 'default' : 'outline'}
                          onClick={() => handleShortcutCapture(shortcut.id)}
                          onKeyDown={(event) => {
                            if (isCapturing) {
                              handleShortcutKeyDown(shortcut.id, event);
                            }
                          }}
                        >
                          {isCapturing ? 'Appuie sur les touches...' : 'Modifier'}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleShortcutReset(shortcut.id)}
                        >
                          Defaut
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {referralSummary && (
        <ReferralClaimAnimation
          open={referralClaimOpen}
          code={referralSummary.referralCode}
          rewardAmount={referralSummary.rewardAmount}
          successfulReferrals={referralSummary.successfulReferrals}
          onClose={() => setReferralClaimOpen(false)}
        />
      )}
    </PageShell>
  );
}
