"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { gsap } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SnippetFormDialog } from "@/components/snippet-form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import type { PromptSnippet } from "@/lib/types";

/* ── Category color system ── */

const CATEGORY_BORDERS: Record<string, string> = {
  lighting: "border-l-amber-400",
  character: "border-l-blue-400",
  style: "border-l-purple-400",
  camera: "border-l-green-400",
  atmosphere: "border-l-cyan-400",
};

const CATEGORY_DOTS: Record<string, string> = {
  lighting: "bg-amber-400",
  character: "bg-blue-400",
  style: "bg-purple-400",
  camera: "bg-green-400",
  atmosphere: "bg-cyan-400",
};

const DEFAULT_BORDER = "border-l-gray-300 dark:border-l-gray-600";
const DEFAULT_DOT = "bg-gray-400";

function getSnippetCategory(snippet: PromptSnippet): string | null {
  if (!snippet.tags || snippet.tags.length === 0) return null;
  const lowerTags = snippet.tags.map((t) => t.toLowerCase());
  for (const cat of Object.keys(CATEGORY_BORDERS)) {
    if (lowerTags.includes(cat)) return cat;
  }
  return null;
}

function getCategoryBorder(snippet: PromptSnippet): string {
  const cat = getSnippetCategory(snippet);
  return cat ? CATEGORY_BORDERS[cat] : DEFAULT_BORDER;
}

function getCategoryDot(snippet: PromptSnippet): string {
  const cat = getSnippetCategory(snippet);
  return cat ? CATEGORY_DOTS[cat] : DEFAULT_DOT;
}

/* ── Tag badge colors ── */

const TAG_BADGE_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_BADGE_COLORS[Math.abs(hash) % TAG_BADGE_COLORS.length];
}

/* ── Main page ── */

export default function SnippetsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editSnippet, setEditSnippet] = useState<PromptSnippet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current || loading || snippets.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-snippet-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, snippets.length]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function fetchSnippets(signal?: AbortSignal) {
    fetch(`/api/snippets?projectId=${projectId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((data) => { setSnippets(data); setLoading(false); })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load snippets");
        setLoading(false);
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchSnippets(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleDelete(id: number) {
    await fetch(`/api/snippets/${id}`, { method: "DELETE" });
    setSnippets((prev) => prev.filter((s) => s.id !== id));
    toast.success("Snippet deleted");
  }

  async function handleCopy(content: string) {
    await navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  }

  async function handleDuplicate(snippet: PromptSnippet) {
    const res = await fetch("/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: snippet.projectId ?? Number(projectId),
        name: `${snippet.name} (Copy)`,
        content: snippet.content,
        tags: snippet.tags,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      toast.success("Snippet duplicated");
      setSnippets((prev) => [...prev, created]);
    }
  }

  // Collect unique tags across all snippets
  const allTags = Array.from(
    new Set(snippets.flatMap((s) => s.tags || []))
  ).sort();

  // Filter snippets by search + active tag (uses debounced search)
  const filtered = snippets.filter((s) => {
    const matchesSearch = !debouncedSearch ||
      s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      s.content.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesTag = !activeTag || (s.tags && s.tags.includes(activeTag));
    return matchesSearch && matchesTag;
  });

  // Loading skeleton matching new 2-col layout
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-l-[3px] p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="w-8 h-8 rounded-md shrink-0 ml-3" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const projectSnippets = filtered.filter((s) => s.projectId);
  const globalSnippets = filtered.filter((s) => !s.projectId);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Snippets</h1>
          <p className="text-muted-foreground mt-1">Reusable text blocks for AI prompts across your project</p>
        </div>
        <Button onClick={() => { setEditSnippet(null); setFormOpen(true); }} className="shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-shadow duration-300">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M8 3v10M3 8h10" />
          </svg>
          New Snippet
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-4">
        <label htmlFor="snippet-search" className="sr-only">Search snippets</label>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
          <circle cx="7" cy="7" r="5" /><path d="M12 12l3 3" />
        </svg>
        <Input
          id="snippet-search"
          placeholder="Search snippets by name or content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 focus:shadow-[0_0_10px_var(--glow-primary)] transition-shadow duration-300"
        />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 mb-5 flex-wrap" role="group" aria-label="Filter snippets by tag">
          <button
            onClick={() => setActiveTag(null)}
            aria-pressed={!activeTag}
            className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all duration-200 ${
              !activeTag
                ? "bg-primary/15 text-primary border-primary/30 shadow-[0_0_8px_var(--glow-primary)]"
                : "dark:bg-white/[0.04] dark:hover:bg-white/[0.06] bg-muted text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              aria-pressed={activeTag === tag}
              className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all duration-200 ${
                activeTag === tag
                  ? "bg-primary/15 text-primary border-primary/30 shadow-[0_0_8px_var(--glow-primary)]"
                  : `${tagColor(tag)} border-transparent hover:opacity-80`
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {snippets.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed border-2 backdrop-blur-sm bg-card/80 border-border/40">
          <CardContent className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M8 3H5a2 2 0 00-2 2v3" />
                <path d="M21 8V5a2 2 0 00-2-2h-3" />
                <path d="M3 16v3a2 2 0 002 2h3" />
                <path d="M16 21h3a2 2 0 002-2v-3" />
                <path d="M7 12h10M7 8h6M7 16h8" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-1">No snippets yet</h2>
            <p className="relative text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Save reusable prompt snippets for consistent generation across your project.
            </p>
            <Button onClick={() => { setEditSnippet(null); setFormOpen(true); }} className="relative shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-shadow duration-300">
              Create First Snippet
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">
            No snippets match your {search ? "search" : "filter"}.
          </p>
        </div>
      ) : (
        <div ref={gridRef} className="space-y-8">
          {projectSnippets.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                Project Snippets ({projectSnippets.length})
              </p>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {projectSnippets.map((s) => (
                  <SnippetCard
                    key={s.id}
                    snippet={s}
                    onEdit={() => { setEditSnippet(s); setFormOpen(true); }}
                    onDelete={() => setDeleteTarget(s.id)}
                    onCopy={() => handleCopy(s.content)}
                    onDuplicate={() => handleDuplicate(s)}
                  />
                ))}
              </div>
            </div>
          )}

          {globalSnippets.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                Global Snippets ({globalSnippets.length})
              </p>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {globalSnippets.map((s) => (
                  <SnippetCard
                    key={s.id}
                    snippet={s}
                    isGlobal
                    onEdit={() => { setEditSnippet(s); setFormOpen(true); }}
                    onDelete={() => setDeleteTarget(s.id)}
                    onCopy={() => handleCopy(s.content)}
                    onDuplicate={() => handleDuplicate(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <SnippetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        snippet={editSnippet}
        projectId={projectId}
        onSaved={fetchSnippets}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete snippet"
        description="This snippet will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget !== null) return handleDelete(deleteTarget); }}
      />
    </div>
  );
}

/* ── Snippet Card ── */

function SnippetCard({ snippet, isGlobal, onEdit, onDelete, onCopy, onDuplicate }: {
  snippet: PromptSnippet;
  isGlobal?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
}) {
  const borderClass = getCategoryBorder(snippet);
  const dotClass = getCategoryDot(snippet);
  const category = getSnippetCategory(snippet);

  return (
    <Card data-snippet-card className={`group relative border-l-[3px] ${borderClass} backdrop-blur-sm bg-card/80 border-border/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300`}>
      <CardContent className="p-4">
        {/* Top row: title + shortcut + actions */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {category && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
              )}
              <p className="text-sm font-semibold truncate">{snippet.name}</p>
              {isGlobal && (
                <Badge variant="secondary" className="text-[10px] shrink-0">Global</Badge>
              )}
              {snippet.shortcut && (
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">/{snippet.shortcut}</Badge>
              )}
            </div>

            {/* 2-line content preview */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1 font-mono bg-muted/30 rounded px-1.5 py-1 border border-border/20">{snippet.content}</p>
          </div>

          {/* Quick Copy + overflow menu */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Copy - always visible */}
            <button
              onClick={onCopy}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-2 py-1.5 rounded-md transition-all duration-200 hover:shadow-md active:shadow-[0_0_15px_var(--glow-primary)]"
              title="Quick Copy"
              aria-label="Copy snippet to clipboard"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span className="hidden sm:inline">Copy</span>
            </button>

            {/* Overflow menu - visible on hover */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="More actions"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="5" r="1" />
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onEdit}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
                    <path d="M11 2l3 3L5 14H2v-3L11 2z" />
                  </svg>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                    <rect x="3" y="3" width="13" height="13" rx="2" />
                    <path d="M8 21h10a3 3 0 003-3V8" />
                  </svg>
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tags */}
        {snippet.tags && snippet.tags.length > 0 && (
          <div className="flex gap-1 mt-3 flex-wrap">
            {snippet.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shadow-[0_0_6px_var(--glow-primary)] ${tagColor(tag)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
