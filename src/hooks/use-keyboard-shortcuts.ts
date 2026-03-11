"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface KeyboardShortcutsOptions {
  onToggleCommandPalette: () => void;
}

export function useKeyboardShortcuts({ onToggleCommandPalette }: KeyboardShortcutsOptions) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K / Ctrl+K — Toggle command palette
      if (mod && e.key === "k") {
        e.preventDefault();
        onToggleCommandPalette();
        return;
      }

      // Cmd+S / Ctrl+S — Prevent default browser save
      if (mod && e.key === "s") {
        e.preventDefault();
        return;
      }

      // Cmd+N / Ctrl+N — New project (only on home page)
      if (mod && e.key === "n" && pathname === "/") {
        e.preventDefault();
        // Focus the new project dialog trigger if it exists
        const trigger = document.querySelector<HTMLButtonElement>('[data-new-project-trigger]');
        if (trigger) {
          trigger.click();
        }
        return;
      }

      // Cmd+, / Ctrl+, — Go to Settings
      if (mod && e.key === ",") {
        e.preventDefault();
        router.push("/settings");
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleCommandPalette, router, pathname]);
}
