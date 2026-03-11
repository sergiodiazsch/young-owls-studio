"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

/* ── Icon SVGs ── */

const Icons = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 10V2M8 2L5 5M8 2L11 5" />
      <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
    </svg>
  ),
  versions: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3h12M2 8h12M2 13h8" />
      <path d="M12 11l2 2-2 2" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.5 2-4.5 5-4.5s5 2 5 4.5" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M12 9.5c2 .5 3.5 2 3.5 4.5" />
    </svg>
  ),
  locations: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8z" />
      <circle cx="8" cy="6" r="1.5" />
    </svg>
  ),
  drive: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
    </svg>
  ),
  moodboards: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="4" rx="1" />
      <rect x="1" y="9" width="6" height="4" rx="1" />
      <rect x="9" y="7" width="6" height="8" rx="1" />
    </svg>
  ),
  colorscript: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="3" height="8" rx="0.5" />
      <rect x="5" y="2" width="3" height="10" rx="0.5" />
      <rect x="9" y="5" width="3" height="7" rx="0.5" />
      <rect x="13" y="3" width="2" height="9" rx="0.5" />
    </svg>
  ),
  snippets: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 3h8a1 1 0 011 1v8a1 1 0 01-1 1H5" />
      <path d="M2 5h8a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
    </svg>
  ),
  generate: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  ),
  cameraangles: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12l4-3 3 2 4-4 3 3" />
      <circle cx="12" cy="4" r="2" />
      <rect x="1" y="2" width="14" height="12" rx="2" />
    </svg>
  ),
  video: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="11" height="10" rx="1.5" />
      <path d="M12 6l3-2v8l-3-2" />
    </svg>
  ),
  audio: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v14" />
      <path d="M4 4v8" />
      <path d="M12 4v8" />
      <path d="M2 6v4" />
      <path d="M6 3v10" />
      <path d="M10 3v10" />
      <path d="M14 6v4" />
    </svg>
  ),
  upscale: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 14l5-5M2 10v4h4" />
      <path d="M14 2l-5 5M14 6V2h-4" />
    </svg>
  ),
  scriptdoctor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 2v12M4 2l8 6-8 6" />
    </svg>
  ),
  dialoguepolish: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h8M2 12h10" />
      <circle cx="13" cy="12" r="2" />
    </svg>
  ),
  breakdown: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="14" height="3" rx="1" />
      <rect x="1" y="6" width="14" height="3" rx="1" />
      <rect x="1" y="11" width="14" height="3" rx="1" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v12M2 8h12" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" />
    </svg>
  ),
  palette: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="7" />
      <circle cx="6" cy="5" r="1" fill="currentColor" />
      <circle cx="10" cy="5" r="1" fill="currentColor" />
      <circle cx="5" cy="8.5" r="1" fill="currentColor" />
      <path d="M9.5 9.5a2 2 0 013 0c.6.8.2 2.5-1.5 2.5H8a6 6 0 01-1-4" />
    </svg>
  ),
  home: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8l6-6 6 6" />
      <path d="M3 7.5V14h4v-4h2v4h4V7.5" />
    </svg>
  ),
  props: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1l6 3.5v7L8 15l-6-3.5v-7L8 1z" />
      <path d="M8 8v7M8 8l6-3.5M8 8L2 4.5" />
    </svg>
  ),
  shared: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="4" r="2" />
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 7l4-2M6 9l4 2" />
    </svg>
  ),
  present: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M6 7l5 3-5 3V7z" fill="currentColor" stroke="none" />
    </svg>
  ),
} as const;

/* ── Navigation items definition ── */

interface CommandPaletteItem {
  id: string;
  label: string;
  icon: keyof typeof Icons;
  category: "Navigation" | "Actions" | "Quick";
  shortcut?: string;
  /** If true, only shows when inside a project route */
  projectOnly?: boolean;
  /** For project items, the path suffix after /project/[id] */
  pathSuffix?: string;
  /** For non-project items, the absolute href */
  href?: string;
  /** Custom action instead of navigation */
  action?: string;
}

const ITEMS: CommandPaletteItem[] = [
  // Navigation — sidebar items (project-only)
  { id: "nav-overview",        label: "Overview",         icon: "grid",           category: "Navigation", projectOnly: true, pathSuffix: "" },
  { id: "nav-upload",          label: "Upload",           icon: "upload",         category: "Navigation", projectOnly: true, pathSuffix: "/upload" },
  { id: "nav-versions",        label: "Versions",         icon: "versions",       category: "Navigation", projectOnly: true, pathSuffix: "/versions" },
  { id: "nav-characters",      label: "Characters",       icon: "users",          category: "Navigation", projectOnly: true, pathSuffix: "/characters" },
  { id: "nav-locations",       label: "Locations",        icon: "locations",       category: "Navigation", projectOnly: true, pathSuffix: "/locations" },
  { id: "nav-props",           label: "Props",            icon: "props",          category: "Navigation", projectOnly: true, pathSuffix: "/props" },
  { id: "nav-drive",           label: "Asset Library",    icon: "drive",          category: "Navigation", projectOnly: true, pathSuffix: "/drive" },
  { id: "nav-moodboards",      label: "Moodboards",       icon: "moodboards",     category: "Navigation", projectOnly: true, pathSuffix: "/moodboards" },
  { id: "nav-color-script",    label: "Color Script",     icon: "colorscript",    category: "Navigation", projectOnly: true, pathSuffix: "/color-script" },
  { id: "nav-snippets",        label: "Snippets",         icon: "snippets",       category: "Navigation", projectOnly: true, pathSuffix: "/snippets" },
  { id: "nav-generate",        label: "Image Gen",        icon: "generate",       category: "Navigation", projectOnly: true, pathSuffix: "/generate" },
  { id: "nav-camera-angles",   label: "Camera Angles",    icon: "cameraangles",   category: "Navigation", projectOnly: true, pathSuffix: "/camera-angles" },
  { id: "nav-video",           label: "Video Gen",        icon: "video",          category: "Navigation", projectOnly: true, pathSuffix: "/generate-video" },
  { id: "nav-audio",           label: "Audio Studio",     icon: "audio",          category: "Navigation", projectOnly: true, pathSuffix: "/audio-studio" },
  { id: "nav-upscale",         label: "Upscale",          icon: "upscale",        category: "Navigation", projectOnly: true, pathSuffix: "/upscale" },
  { id: "nav-script-doctor",   label: "Script Doctor",    icon: "scriptdoctor",   category: "Navigation", projectOnly: true, pathSuffix: "/script-doctor" },
  { id: "nav-dialogue-polish", label: "Dialogue Polish",  icon: "dialoguepolish", category: "Navigation", projectOnly: true, pathSuffix: "/dialogue-polish" },
  { id: "nav-breakdowns",      label: "Breakdown",        icon: "breakdown",      category: "Navigation", projectOnly: true, pathSuffix: "/breakdowns" },
  { id: "nav-present",         label: "Present",          icon: "present",        category: "Navigation", projectOnly: true, pathSuffix: "/present" },

  // Actions
  { id: "act-new-project",     label: "New Project",      icon: "plus",     category: "Actions", shortcut: "\u2318N", action: "new-project" },
  { id: "act-settings",        label: "Settings",         icon: "settings", category: "Actions", shortcut: "\u2318,", href: "/settings" },
  { id: "act-theme",           label: "Theme Customizer", icon: "palette",  category: "Actions", action: "theme-customizer" },

  // Quick
  { id: "quick-home",          label: "Go Home",          icon: "home",     category: "Quick", href: "/" },
  { id: "quick-settings",      label: "Go to Settings",   icon: "settings", category: "Quick", shortcut: "\u2318,", href: "/settings" },
];

/* ── Component ── */

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Extract project ID from URL if we're inside a project
  const projectMatch = pathname.match(/^\/project\/([^/]+)/);
  const projectId = projectMatch ? projectMatch[1] : null;

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Register global keyboard shortcuts
  useKeyboardShortcuts({ onToggleCommandPalette: toggle });

  // Filter items based on context
  const visibleItems = useMemo(() => {
    return ITEMS.filter((item) => {
      if (item.projectOnly && !projectId) return false;
      return true;
    });
  }, [projectId]);

  // Group items by category
  const groups = useMemo(() => {
    const map = new Map<string, CommandPaletteItem[]>();
    for (const item of visibleItems) {
      const existing = map.get(item.category) || [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return map;
  }, [visibleItems]);

  function handleSelect(item: CommandPaletteItem) {
    setOpen(false);

    // Custom actions
    if (item.action === "new-project") {
      if (pathname === "/") {
        // Click the new project trigger on home page
        const trigger = document.querySelector<HTMLButtonElement>('[data-new-project-trigger]');
        if (trigger) {
          trigger.click();
        }
      } else {
        // Navigate home first, then trigger
        router.push("/");
      }
      return;
    }

    if (item.action === "theme-customizer") {
      // Click the theme customizer button if it exists
      const btn = document.querySelector<HTMLButtonElement>('[data-tour="theme-toggle"] button');
      if (btn) {
        btn.click();
      }
      return;
    }

    // Navigation
    if (item.href) {
      router.push(item.href);
      return;
    }

    if (item.projectOnly && projectId && item.pathSuffix !== undefined) {
      router.push(`/project/${projectId}${item.pathSuffix}`);
      return;
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands..." />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {Array.from(groups.entries()).map(([category, items], idx) => (
          <div key={category}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={category}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.category}`}
                  onSelect={() => handleSelect(item)}
                  className="group"
                >
                  <span className="shrink-0 opacity-70">
                    {Icons[item.icon]}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="hidden sm:inline-flex items-center rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.category}
                  </span>
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground/60">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5 text-[10px] font-mono">
              &uarr;&darr;
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5 text-[10px] font-mono">
              &crarr;
            </kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5 text-[10px] font-mono">
              esc
            </kbd>
            close
          </span>
        </div>
      </div>
    </CommandDialog>
  );
}
