import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type Accent = 'neutral' | 'aura' | 'cyan' | 'pink' | 'orange' | 'green';

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  colorScheme: string;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setColorScheme: (id: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored) return stored;
      return 'light';
    }
    return 'light';
  });
  const [accent, setAccent] = useState<Accent>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('accent') as Accent | null;
      if (stored) return stored;
      return 'neutral';
    }
    return 'neutral';
  });
  const [colorScheme, setColorScheme] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('colorScheme') || 'default';
    }
    return 'default';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (accent === 'neutral') {
      root.removeAttribute('data-accent');
    } else {
      root.setAttribute('data-accent', accent);
    }
    localStorage.setItem('accent', accent);
  }, [accent]);

  useEffect(() => {
    const LINK_ID = 'tweakcn-theme-link';
    let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;

    if (colorScheme === 'default') {
      link?.remove();
      localStorage.setItem('colorScheme', 'default');
      return;
    }

    if (!link) {
      link = document.createElement('link');
      link.id = LINK_ID;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `/themes/${colorScheme}.css`;
    localStorage.setItem('colorScheme', colorScheme);
  }, [colorScheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, accent, colorScheme, setTheme, setAccent, setColorScheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
