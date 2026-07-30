import React, { createContext, useContext, useEffect, useState } from 'react';
import './styles/theme-transition.css';
import { getPref, setPref, type Theme } from './utils/userPrefs';

/**
 * Duration (ms) that the theme color transition takes.
 * Matches the `--transition-speed` CSS token (240 ms).
 * Consumers such as ThemeToggle use this to coordinate icon-swap timing so the
 * SVG change happens mid-fade rather than before or after the color animation.
 */
export const THEME_TRANSITION_MS = 240;

interface ThemeContextType {
  theme: Theme;
  actualTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  /** True while the theme color transition is in progress. */
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return getPref('theme');
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>(() => {
    // Initialize from the pre-paint resolved value to prevent flash
    const resolvedTheme = document.documentElement.getAttribute('data-theme');
    return (resolvedTheme === 'light' || resolvedTheme === 'dark') ? resolvedTheme : 'dark';
  });

  // Whether a theme color transition is currently running.
  const [isTransitioning, setIsTransitioning] = useState(false);

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
    setPref('theme', theme);

    const root = window.document.documentElement;

    const applyTheme = (t: 'light' | 'dark') => {
      // Signal the start of transition so UI elements (e.g. ThemeToggle icon)
      // can coordinate their own visual changes.
      setIsTransitioning(true);
      root.setAttribute('data-theme', t);
      setActualTheme(t);

      // Clear the transitioning flag after the CSS transition completes.
      const tid = window.setTimeout(() => {
        setIsTransitioning(false);
      }, THEME_TRANSITION_MS);

      return tid;
    };

    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      cleanupTimer = applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        window.clearTimeout(cleanupTimer);
        cleanupTimer = applyTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handler);
      return () => {
        mediaQuery.removeEventListener('change', handler);
        window.clearTimeout(cleanupTimer);
      };
    } else {
      cleanupTimer = applyTheme(theme);
      return () => window.clearTimeout(cleanupTimer);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme, isTransitioning }}>
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
