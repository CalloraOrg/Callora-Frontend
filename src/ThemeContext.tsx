import React, { createContext, useContext, useEffect, useState } from 'react';
import './styles/theme-transition.css';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('callora-theme');
    return (saved as Theme) || 'dark';
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    // Initialize from the pre-paint resolved value to prevent flash
    const resolvedTheme = document.documentElement.getAttribute('data-theme');
    return (resolvedTheme === 'light' || resolvedTheme === 'dark') ? resolvedTheme : 'dark';
  });

  // Enable color-token transitions only after the first paint, so the initial
  // theme is applied instantly (no flash) while subsequent switches animate.
  useEffect(() => {
    const root = window.document.documentElement;
    const id = window.requestAnimationFrame(() => {
      root.classList.add('theme-transitions-ready');
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    localStorage.setItem('callora-theme', theme);
    
    const root = window.document.documentElement;
    
    const applyTheme = (t: 'light' | 'dark') => {
      root.setAttribute('data-theme', t);
      setActualTheme(t);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme }}>
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
