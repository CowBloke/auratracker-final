import { Sun, Moon, Palette } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-12">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">
          Preferences
        </p>
        <h1 className="text-5xl md:text-7xl font-light tracking-tight">
          Reglages
        </h1>
      </header>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choisis l ambiance qui te convient le mieux.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "group flex items-start gap-4 rounded-lg border px-4 py-4 text-left transition",
                    isActive
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border",
                      isActive ? "border-primary/60 text-primary" : "border-border/60 text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-base font-medium">{option.label}</span>
                    <span className="block text-sm text-muted-foreground">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            Couleur d accent
          </CardTitle>
          <CardDescription>
            Change la couleur principale de l interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accentOptions.map((option) => {
              const isActive = accent === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAccent(option.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition",
                    isActive
                      ? "border-primary/60 bg-primary/5"
                      : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                  )}
                >
                  <span
                    className="h-10 w-10 rounded-full border border-border/60 shadow-sm"
                    style={{ background: option.preview }}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Tes choix sont sauvegardes sur cet appareil.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
