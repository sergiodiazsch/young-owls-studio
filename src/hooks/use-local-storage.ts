"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * A hook that syncs state with localStorage, handling JSON serialization.
 *
 * Multiple hooks in the codebase follow the same get/set pattern with
 * localStorage and JSON parse/stringify:
 *   - src/hooks/use-workspace-cover.ts
 *   - src/hooks/use-sidebar-config.ts
 *   - src/hooks/use-walkthrough.ts
 *   - src/lib/theme/context.tsx
 *   - src/components/onboarding-checklist.tsx
 *   - src/components/theme-toggle.tsx
 *
 * @example
 *   const [config, setConfig] = useLocalStorage("sidebar-config", defaultItems);
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(defaultValue);

  // Read from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        queueMicrotask(() => setStoredValue(parsed));
      }
    } catch {
      // Storage unavailable or corrupt JSON -- use default
    }
  }, [key]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage full or unavailable -- silently ignore
        }
        return next;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
