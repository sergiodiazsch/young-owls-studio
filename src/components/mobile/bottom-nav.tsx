"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { NavIcon } from "@/components/nav-icons";

interface BottomNavItem {
  id: string;
  href: string;
  label: string;
  icon: string;
}

interface MoreItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  group: string;
}

/* MOBILE AGENT: Bottom navigation bar — fixed to bottom with iOS safe area */
export function BottomNav({
  projectId,
  moreItems,
}: {
  projectId: string;
  moreItems: MoreItem[];
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems: BottomNavItem[] = [
    { id: "overview", href: `/project/${projectId}`, label: "Home", icon: "grid" },
    { id: "scenes", href: `/project/${projectId}/scenes`, label: "Scenes", icon: "scenes" },
    { id: "generate", href: `/project/${projectId}/generate`, label: "Create", icon: "generate" },
    { id: "drive", href: `/project/${projectId}/drive`, label: "Library", icon: "drive" },
  ];

  const isActive = useCallback(
    (href: string) => {
      if (href === `/project/${projectId}`) return pathname === href;
      return pathname.startsWith(href);
    },
    [pathname, projectId]
  );

  // Check if current path matches any "more" item
  const isMoreActive = moreItems.some((item) => isActive(item.href));

  // Close more sheet on navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    if (!moreOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [moreOpen]);

  return (
    <>
      {/* MOBILE AGENT: Bottom sheet for "More" items */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="button" tabIndex={-1} aria-label="Close menu" onClick={() => setMoreOpen(false)} onKeyDown={(e) => { if (e.key === "Escape") setMoreOpen(false); }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm bottom-nav-backdrop" />
          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bottom-nav-sheet bg-card dark:bg-card border-t border-border/50 rounded-t-[20px] max-h-[70vh] overflow-y-auto"
            style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-8 h-1 rounded-full bg-muted-foreground/20" />
            </div>
            {/* Group items by group */}
            {(() => {
              const groups = new Map<string, MoreItem[]>();
              for (const item of moreItems) {
                const existing = groups.get(item.group) || [];
                existing.push(item);
                groups.set(item.group, existing);
              }
              return Array.from(groups.entries()).map(([group, items]) => (
                <div key={group} className="px-4 pb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50 px-2 mb-1.5">
                    {group}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium transition-colors active:scale-[0.98] active:duration-75 ${
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-foreground/80 active:bg-accent/50"
                          }`}
                        >
                          <NavIcon name={item.icon} />
                          <span>{item.label}</span>
                          {active && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* MOBILE AGENT: Fixed bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bottom-nav-bar"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-end justify-around px-2 pt-1.5 h-[60px]">
          {primaryItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1.5 rounded-lg transition-colors active:scale-90 active:duration-75 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className={`relative transition-transform ${active ? "scale-110" : ""}`}>
                  <NavIcon name={item.icon} />
                  {active && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                  )}
                </span>
                <span className={`text-[11px] font-medium leading-tight ${active ? "text-primary" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1.5 rounded-lg transition-colors active:scale-90 active:duration-75 ${
              moreOpen || isMoreActive ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <span className="relative">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-70">
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
              {isMoreActive && !moreOpen && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </span>
            <span className={`text-[11px] font-medium leading-tight ${moreOpen || isMoreActive ? "text-primary" : ""}`}>
              More
            </span>
          </button>
        </div>
        {/* MOBILE AGENT: Safe area spacer for iOS home indicator */}
        <div className="bg-transparent" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </nav>
    </>
  );
}
