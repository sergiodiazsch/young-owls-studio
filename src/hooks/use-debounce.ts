"use client";

import { useState, useEffect } from "react";

/**
 * Debounces a value by the specified delay.
 *
 * Replaces the repeated inline pattern found in:
 *   - src/app/project/[id]/page.tsx (search debounce, 300ms)
 *   - src/app/project/[id]/characters/page.tsx (search debounce, 300ms)
 *   - src/app/project/[id]/snippets/page.tsx (search debounce, 300ms)
 *
 * @example
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebounce(search, 300);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
