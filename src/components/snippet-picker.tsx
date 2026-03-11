"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PromptSnippet } from "@/lib/types";

interface SnippetPickerProps {
  projectId: string;
  onInsert: (content: string) => void;
}

export function SnippetPicker({ projectId, onInsert }: SnippetPickerProps) {
  const [snippets, setSnippets] = useState<PromptSnippet[]>([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const snippetsLoaded = useRef(false);
  const [loadingSnippets, setLoadingSnippets] = useState(false);

  // Lazy-load snippets on first open; cached after that
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !snippetsLoaded.current) {
      setLoadingSnippets(true);
      fetch(`/api/snippets?projectId=${projectId}`)
        .then((r) => r.json())
        .then((data: PromptSnippet[]) => {
          setSnippets(Array.isArray(data) ? data : []);
          snippetsLoaded.current = true;
        })
        .catch(() => {})
        .finally(() => setLoadingSnippets(false));
    }
    if (!nextOpen) {
      setFilter("");
    }
  }

  const filtered = useMemo(() => {
    if (!filter.trim()) return snippets;
    const q = filter.toLowerCase();
    return snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        (s.shortcut && s.shortcut.toLowerCase().includes(q))
    );
  }, [snippets, filter]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1">
            <path d="M5 3h8a1 1 0 011 1v8a1 1 0 01-1 1H5" />
            <path d="M2 5h8a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
          </svg>
          Snippets
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {loadingSnippets ? (
          <div className="flex items-center justify-center p-4">
            <div className="loader-spin loader-spin-sm" />
          </div>
        ) : snippets.length === 0 ? (
          <div className="p-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No snippets saved.</p>
            <Link
              href={`/project/${projectId}/snippets`}
              className="text-xs text-primary hover:underline"
            >
              Create them in the Snippets page
            </Link>
          </div>
        ) : (
          <>
            {/* Search/filter input */}
            <div className="p-2 border-b border-border/40">
              <input
                type="text"
                placeholder="Filter snippets..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                autoFocus
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No snippets match &ldquo;{filter}&rdquo;
                </div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/20 last:border-b-0 group"
                    onClick={() => {
                      onInsert(s.content);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {s.name}
                      </span>
                      {s.shortcut && (
                        <span className="shrink-0 text-[10px] text-muted-foreground font-mono bg-muted/50 rounded px-1 py-px">
                          /{s.shortcut}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {s.content}
                    </p>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
