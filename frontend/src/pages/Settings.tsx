import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TYPOGRAPHY, SPACING } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { PageHeader, PageShell } from '@/components/layout/page-shell';

const themeOptions = [
  {
    id: 'light',
    label: 'Clair',
    description: 'Interface lumineuse pour la journee.',
    icon: Sun,
  },
  {
    id: 'dark',
    label: 'Sombre',
    description: 'Moins agressif pour les yeux la nuit.',
    icon: Moon,
  },
] as const;

const accentOptions = [
  {
    id: 'neutral',
    label: 'Neutre',
    preview: 'linear-gradient(135deg, #111827, #9ca3af)',
  },
  {
    id: 'aura',
    label: 'Aura',
    preview: 'linear-gradient(135deg, #a855f7, #d946ef)',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    preview: 'linear-gradient(135deg, #22d3ee, #67e8f9)',
  },
  {
    id: 'pink',
    label: 'Rose',
    preview: 'linear-gradient(135deg, #f472b6, #f9a8d4)',
  },
  {
    id: 'orange',
    label: 'Orange',
    preview: 'linear-gradient(135deg, #fb923c, #fdba74)',
  },
  {
    id: 'green',
    label: 'Vert',
    preview: 'linear-gradient(135deg, #4ade80, #86efac)',
  },
] as const;

export default function Settings() {
  const { theme, setTheme, accent, setAccent } = useTheme();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Préférences"
        title="Paramètres"
        description="Même structure, mêmes espacements, une carte par bloc de décision."
      />
      <Card>
        <CardHeader>
          <CardDescription>Thème</CardDescription>
          <CardTitle className={TYPOGRAPHY.H5}>
            Choisis l'ambiance qui te convient le mieux.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.id;

              return (
                <Button
                  key={option.id}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setTheme(option.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-start gap-4 px-4 py-4 text-left h-auto",
                    isActive
                      ? "border-foreground"
                      : "border-border/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center border shrink-0",
                      isActive ? "border-foreground" : "border-border/30 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="space-y-1">
                    <span className={cn("block", TYPOGRAPHY.BODY, "font-medium")}>{option.label}</span>
                    <span className={cn("block", TYPOGRAPHY.SMALL)}>{option.description}</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Couleur d'accent</CardDescription>
          <CardTitle className={TYPOGRAPHY.H5}>
            Change la couleur principale de l'interface.
          </CardTitle>
        </CardHeader>
        <CardContent className={SPACING.CARD_SPACING}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accentOptions.map((option) => {
              const isActive = accent === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setAccent(option.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 text-left h-auto",
                    isActive
                      ? "border-foreground"
                      : "border-border/30"
                  )}
                >
                  <span
                    className="h-10 w-10 border border-border/30 shrink-0"
                    style={{ background: option.preview }}
                  />
                  <span className={cn(TYPOGRAPHY.SMALL, "font-medium")}>{option.label}</span>
                </Button>
              );
            })}
          </div>
          <p className={TYPOGRAPHY.XS}>
            Tes choix sont sauvegardés sur cet appareil.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
