"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type { ThemeState, ThemeAppearance, ThemeColors, CustomTheme } from './types';
import { DEFAULT_APPEARANCE } from './types';
import { THEME_PRESETS, DEFAULT_PRESET_ID } from './presets';
import { applyThemeColors, applyAppearance } from './apply-theme';

const STORAGE_KEY = 'yos-theme';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  state: ThemeState;
  /** Resolved mode – "system" is resolved to the actual value */
  mode: 'light' | 'dark';
  /** Resolved current color set */
  colors: ThemeColors;
  /** Current preset object */
  preset: (typeof THEME_PRESETS)[0];
  setMode: (mode: 'light' | 'dark' | 'system') => void;
  setPreset: (presetId: string) => void;
  setAppearance: (appearance: Partial<ThemeAppearance>) => void;
  setCustomTheme: (theme: CustomTheme | null) => void;
  presets: typeof THEME_PRESETS;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSystemMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function loadState(): ThemeState {
  if (typeof window === 'undefined') {
    return {
      mode: 'dark',
      presetId: DEFAULT_PRESET_ID,
      customTheme: null,
      appearance: { ...DEFAULT_APPEARANCE },
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ThemeState>;
      return {
        mode: parsed.mode ?? 'system',
        presetId: parsed.presetId ?? DEFAULT_PRESET_ID,
        customTheme: parsed.customTheme ?? null,
        appearance: { ...DEFAULT_APPEARANCE, ...parsed.appearance },
      };
    }
  } catch {
    // Ignore corrupt storage
  }

  return {
    mode: 'system',
    presetId: DEFAULT_PRESET_ID,
    customTheme: null,
    appearance: { ...DEFAULT_APPEARANCE },
  };
}

function saveState(state: ThemeState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable – silently ignore
  }
}

function resolvePreset(presetId: string) {
  return THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[0];
}

function resolveColors(
  preset: (typeof THEME_PRESETS)[0],
  resolvedMode: 'light' | 'dark',
  customTheme: CustomTheme | null,
): ThemeColors {
  const base = resolvedMode === 'dark' ? preset.dark : preset.light;
  if (!customTheme) return base;

  const overrides = resolvedMode === 'dark' ? customTheme.dark : customTheme.light;
  return { ...base, ...overrides } as ThemeColors;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(loadState);
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>(getSystemMode);

  // Listen for system color-scheme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedMode: 'light' | 'dark' =
    state.mode === 'system' ? systemMode : state.mode;

  const preset = useMemo(() => resolvePreset(state.presetId), [state.presetId]);

  const colors = useMemo(
    () => resolveColors(preset, resolvedMode, state.customTheme),
    [preset, resolvedMode, state.customTheme],
  );

  const mergedAppearance = useMemo<ThemeAppearance>(
    () => ({ ...DEFAULT_APPEARANCE, ...preset.appearance, ...state.appearance }),
    [preset.appearance, state.appearance],
  );

  // Apply CSS variables + class whenever resolved values change
  useEffect(() => {
    applyThemeColors(colors);
    applyAppearance(mergedAppearance);

    // Toggle dark/light class on <html>
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedMode === 'dark');
    root.classList.toggle('light', resolvedMode === 'light');
  }, [colors, mergedAppearance, resolvedMode]);

  // Persist state
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ---- Actions ----------------------------------------------------------

  const setMode = useCallback((mode: 'light' | 'dark' | 'system') => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const setPreset = useCallback((presetId: string) => {
    setState((prev) => ({ ...prev, presetId, customTheme: null }));
  }, []);

  const setAppearance = useCallback((partial: Partial<ThemeAppearance>) => {
    setState((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...partial },
    }));
  }, []);

  const setCustomTheme = useCallback((theme: CustomTheme | null) => {
    setState((prev) => ({ ...prev, customTheme: theme }));
  }, []);

  // ---- Context value ----------------------------------------------------

  const value = useMemo<ThemeContextValue>(
    () => ({
      state,
      mode: resolvedMode,
      colors,
      preset,
      setMode,
      setPreset,
      setAppearance,
      setCustomTheme,
      presets: THEME_PRESETS,
    }),
    [state, resolvedMode, colors, preset, setMode, setPreset, setAppearance, setCustomTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a <ThemeProvider>');
  }
  return ctx;
}
