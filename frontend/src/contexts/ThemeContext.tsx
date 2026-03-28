import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  buildCustomThemeCss,
  CUSTOM_THEME_STORAGE_KEY,
  CustomThemeConfig,
  readStoredCustomTheme,
  sanitizeCustomTheme,
} from '@/lib/custom-theme';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  colorScheme: string;
  customTheme: CustomThemeConfig;
  setTheme: (theme: Theme) => void;
  setColorScheme: (id: string) => void;
  setCustomTheme: (theme: CustomThemeConfig) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Takes raw tweakcn CSS and returns only the :root / .dark variable blocks,
 * stripped of @layer wrappers so they are unlayered and win the cascade.
 */
function unwrapLayers(css: string): string {
  // Remove @tailwind directives
  let src = css.replace(/@tailwind\s+\w+;\s*/g, '');
  let output = '';
  let i = 0;
  while (i < src.length) {
    // Match @layer <name> {
    const ahead = src.slice(i);
    const layerMatch = ahead.match(/^@layer\s+\w+\s*\{/);
    if (layerMatch) {
      i += layerMatch[0].length;
      // Extract inner content by tracking brace depth
      let depth = 1;
      const innerStart = i;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
      }
      const inner = src.slice(innerStart, i - 1);
      // Drop @apply lines (not valid in browser)
      output += inner.replace(/[^\n]*@apply[^\n]*/g, '');
    } else {
      output += src[i];
      i++;
    }
  }
  return output;
}

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
  const [customTheme, setCustomTheme] = useState<CustomThemeConfig>(() => readStoredCustomTheme());

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
    let cancelled = false;
    document.getElementById(STYLE_ID)?.remove();

    if (colorScheme === 'default') {
      localStorage.setItem('colorScheme', 'default');
      return () => {
        cancelled = true;
      };
    }

    if (colorScheme === 'custom') {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      if (!cancelled) {
        style.textContent = buildCustomThemeCss(customTheme);
        document.head.appendChild(style);
      }
      localStorage.setItem('colorScheme', 'custom');
      return () => {
        cancelled = true;
      };
    }

    fetch(`/themes/${colorScheme}.css`)
      .then((r) => r.text())
      .then((css) => {
        if (cancelled) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = unwrapLayers(css);
        document.head.appendChild(style);
        localStorage.setItem('colorScheme', colorScheme);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [colorScheme, customTheme]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(sanitizeCustomTheme(customTheme)));
  }, [customTheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colorScheme,
        customTheme,
        setTheme,
        setColorScheme,
        setCustomTheme,
        toggleTheme,
      }}
    >
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
