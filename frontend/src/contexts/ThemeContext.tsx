import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  colorScheme: string;
  setTheme: (theme: Theme) => void;
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
    const STYLE_ID = 'tweakcn-theme-style';
    document.getElementById(STYLE_ID)?.remove();

    if (colorScheme === 'default') {
      localStorage.setItem('colorScheme', 'default');
      return;
    }

    fetch(`/themes/${colorScheme}.css`)
      .then((r) => r.text())
      .then((css) => {
        const stripped = css
          .replace(/@tailwind\s+\w+;\s*/g, '')
          .replace(/\s*@apply[^;]+;/g, '');
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = stripped;
        document.head.appendChild(style);
        localStorage.setItem('colorScheme', colorScheme);
      })
      .catch(() => {});
  }, [colorScheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, colorScheme, setTheme, setColorScheme, toggleTheme }}>
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
