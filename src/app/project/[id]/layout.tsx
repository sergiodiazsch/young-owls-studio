// DESIGN: Collapsible sidebar with GSAP animations. Groups: Script, Library, Generate, Analyze.

"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from "react";
import { SmartTooltip } from "@/components/onboarding/smart-tooltip";
import { NavIcon } from "@/components/nav-icons";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { gsap } from "@/lib/gsap";
import { BottomNav } from "@/components/mobile/bottom-nav";
import { MobileHeader } from "@/components/mobile/mobile-header";
import type { Project } from "@/lib/types";

const SIDEBAR_W = 256;
const SIDEBAR_W_COLLAPSED = 64;
const COLLAPSED_KEY = "sidebar-collapsed";

/* ── NavLinks ── */
function NavLinks({ projectId, pathname, groupedItems, onNavigate, collapsed }: {
  projectId: string;
  pathname: string;
  groupedItems: ReturnType<typeof useSidebarConfig>["groupedItems"];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-3" data-tour="sidebar">
      {groupedItems.map((group, groupIdx) => {
        const isGenGroup = group.id === "generate";
        const visibleItems = group.items.filter((i) => i.visible);
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.id} className={groupIdx > 0 ? "nav-group-separator" : ""} {...(isGenGroup ? { "data-tour": "ai-tools" } : {})}>
            <p className="sb-label text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground px-3 mb-1.5 whitespace-nowrap overflow-hidden">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((link) => {
                const isActive = pathname === link.href || (link.href !== `/project/${projectId}` && pathname.startsWith(link.href + "/"));
                const linkEl = (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    title={collapsed ? link.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    className={`nav-link-icon-shift flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ease-out relative overflow-hidden whitespace-nowrap focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                      isActive
                        ? "bg-primary/10 text-primary shadow-[0_0_12px_var(--glow-primary)] ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-primary/8 hover:text-foreground hover:translate-x-0.5"
                    }`}
                  >
                    <NavIcon name={link.icon} />
                    <span className="sb-label">{link.label}</span>
                    {isActive && (
                      <span className="sb-label absolute right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--glow-primary)] film-glow" />
                    )}
                  </Link>
                );
                if (isGenGroup) {
                  return (
                    <SmartTooltip
                      key={link.href}
                      id={`sidebar-${link.icon}`}
                      label={link.label}
                      hint={`Use ${link.label} to enhance your screenplay`}
                      side="right"
                      maxHintShows={2}
                    >
                      {linkEl}
                    </SmartTooltip>
                  );
                }
                return linkEl;
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* NavIcon imported from @/components/nav-icons */

/* ── Scroll fade detection ── */
function useScrollFade(ref: React.RefObject<HTMLElement | null>) {
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 8);
    setFadeBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      observer.disconnect();
    };
  }, [ref, checkScroll]);

  return { fadeTop, fadeBottom };
}

/* ── Layout ── */
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const animatingRef = useRef(false);

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  });

  const { groupedItems } = useSidebarConfig(projectId);

  const { fadeTop, fadeBottom } = useScrollFade(scrollRef);

  // Sidebar collapse is user-controlled only (via toggle button)

  /* MOBILE AGENT: Build "More" items for bottom nav — everything not in primary tabs */
  const moreItemsForNav = useMemo(() => {
    const primaryIds = new Set(["overview", "scenes", "generate", "drive"]);
    const items: { id: string; href: string; label: string; icon: string; group: string }[] = [];
    for (const group of groupedItems) {
      for (const item of group.items) {
        if (!item.visible || primaryIds.has(item.id)) continue;
        items.push({ id: item.id, href: item.href, label: item.label, icon: item.icon, group: group.label });
      }
    }
    return items;
  }, [groupedItems]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then(setProject)
      .catch(() => {});
  }, [projectId]);

  // Set initial sidebar width + label state (no animation on mount)
  useLayoutEffect(() => {
    if (!sidebarRef.current) return;
    sidebarRef.current.style.width = `${collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W}px`;
    if (collapsed) {
      sidebarRef.current.querySelectorAll(".sb-label").forEach((el) => {
        (el as HTMLElement).style.opacity = "0";
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GSAP collapse/expand animation
  const handleToggle = useCallback(() => {
    if (animatingRef.current || !sidebarRef.current) return;

    const next = !collapsed;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Skip animation for reduced-motion preference
    if (reducedMotion) {
      if (next) {
        sidebarRef.current.style.width = `${SIDEBAR_W_COLLAPSED}px`;
        setCollapsed(true);
        localStorage.setItem(COLLAPSED_KEY, "true");
      } else {
        sidebarRef.current.style.width = `${SIDEBAR_W}px`;
        setCollapsed(false);
        localStorage.setItem(COLLAPSED_KEY, "false");
      }
      return;
    }

    animatingRef.current = true;
    const labels = sidebarRef.current.querySelectorAll(".sb-label");

    if (next) {
      // ── Collapsing ──
      const tl = gsap.timeline({
        onComplete: () => {
          setCollapsed(true);
          animatingRef.current = false;
        },
      });
      // Fade labels out first
      tl.to(labels, {
        opacity: 0,
        duration: 0.18,
        ease: "power2.in",
        stagger: 0.006,
      });
      // Shrink sidebar
      tl.to(sidebarRef.current, {
        width: SIDEBAR_W_COLLAPSED,
        duration: 0.32,
        ease: "power3.inOut",
      }, "-=0.06");

      localStorage.setItem(COLLAPSED_KEY, "true");
    } else {
      // ── Expanding ──
      setCollapsed(false);
      localStorage.setItem(COLLAPSED_KEY, "false");

      requestAnimationFrame(() => {
        if (!sidebarRef.current) { animatingRef.current = false; return; }
        const newLabels = sidebarRef.current.querySelectorAll(".sb-label");
        gsap.set(newLabels, { opacity: 0, x: -4 });

        const tl = gsap.timeline({
          onComplete: () => { animatingRef.current = false; },
        });
        // Expand sidebar
        tl.to(sidebarRef.current, {
          width: SIDEBAR_W,
          duration: 0.32,
          ease: "power3.inOut",
        });
        // Fade labels in with stagger
        tl.to(newLabels, {
          opacity: 1,
          x: 0,
          duration: 0.22,
          stagger: 0.012,
          ease: "power2.out",
        }, "-=0.1");
      });
    }
  }, [collapsed]);

  return (
    <div className="flex h-screen bg-background">
      {/* Skip to content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>
      {/* ── Desktop sidebar ── */}
      <aside
        ref={sidebarRef}
        role="navigation"
        aria-label="Project sidebar"
        className="hidden md:flex relative shrink-0 flex-col sidebar-glass h-screen"
        style={{ width: collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W }}
      >
        {/* Top gradient accent line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent z-10" />

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header / Brand area */}
          <div className="shrink-0 p-4 overflow-hidden whitespace-nowrap relative">
            <Link
              href="/"
              className="back-link-smooth inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground group"
              title={collapsed ? "All Projects" : undefined}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M10 2L4 8l6 6" />
              </svg>
              <span className="sb-label">All Projects</span>
            </Link>
            <div className="sb-label mt-3">
              <h2 className="font-extrabold text-lg leading-tight truncate tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {project?.title || (
                  <span className="inline-block w-32 h-5 bg-muted/50 rounded animate-pulse" />
                )}
              </h2>
              {project?.subtitle && (
                <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{project.subtitle}</p>
              )}
            </div>
          </div>

          <div className="shrink-0 mx-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

          {/* Scrollable nav */}
          <div className={`relative min-h-0 flex-1 scroll-fade-mask ${fadeTop ? "fade-top" : ""} ${fadeBottom ? "fade-bottom" : ""}`}>
            <div ref={scrollRef} className="p-3 h-full overflow-y-auto overflow-x-hidden">
              <NavLinks projectId={projectId} pathname={pathname} groupedItems={groupedItems} collapsed={collapsed} />
            </div>
          </div>

          <div className="shrink-0 mx-3 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

          {/* Footer — Settings icon only */}
          <div className="shrink-0 p-3 flex items-center justify-center overflow-hidden">
            <Link
              href="/settings"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted/40 transition-all duration-200"
              title="Settings"
              aria-label="Settings"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" />
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Indigo glow edge — right border accent ── */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/0 via-primary/15 to-primary/0 pointer-events-none" />

        {/* ── Collapse toggle button ── */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-7 z-50 w-6 h-6 rounded-full border border-border/40 bg-card/90 backdrop-blur-sm shadow-[0_0_8px_var(--glow-primary)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
            className={`transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`}
          >
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* MOBILE AGENT: iOS-style top bar replaces hamburger menu */}
        <MobileHeader projectId={projectId} projectTitle={project?.title} />

        <main
          id="main-content"
          role="main"
          className="flex-1 overflow-y-auto bg-background mobile-main-content"
        >
          {children}
        </main>

        {/* MOBILE AGENT: Bottom navigation bar — replaces sidebar on mobile */}
        <BottomNav projectId={projectId} moreItems={moreItemsForNav} />
      </div>
    </div>
  );
}
