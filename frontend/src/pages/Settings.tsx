import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
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

      <section className="space-y-6">
        <div>
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Theme
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choisis l ambiance qui te convient le mieux.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
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
                  "flex items-start gap-4 border px-4 py-4 text-left transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border/30 hover:border-foreground/30"
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
                  <span className="block text-base font-medium">{option.label}</span>
                  <span className="block text-sm text-muted-foreground">{option.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px bg-border" />

      <section className="space-y-6">
        <div>
          <h2 className="text-sm text-muted-foreground tracking-wide uppercase">
            Couleur d accent
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Change la couleur principale de l interface.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {accentOptions.map((option) => {
            const isActive = accent === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setAccent(option.id)}
                aria-pressed={isActive}
                className={cn(
                  "flex items-center gap-4 border px-4 py-3 text-left transition-colors",
                  isActive
                    ? "border-foreground"
                    : "border-border/30 hover:border-foreground/30"
                )}
              >
                <span
                  className="h-10 w-10 border border-border/30 shrink-0"
                  style={{ background: option.preview }}
                />
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Tes choix sont sauvegardes sur cet appareil.
        </p>
      </section>
    </div>
  );
}
