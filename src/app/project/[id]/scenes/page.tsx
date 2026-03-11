"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { gsap } from "@/lib/gsap";
import type { Scene, Dialogue, Direction } from "@/lib/types";

interface FullScene extends Scene {
  dialogues: Dialogue[];
  directions: Direction[];
}

export default function ScenesPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [scenes, setScenes] = useState<FullScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // GSAP stagger animation on mount
  useEffect(() => {
    if (!listRef.current || loading || scenes.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = listRef.current.querySelectorAll("[data-scene-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, scenes.length]);

  useEffect(() => {
    fetch(`/api/scenes?projectId=${projectId}&full=true`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch scenes (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setScenes(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("[Scenes] fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const headingTypes = useMemo(
    () => [...new Set(scenes.map((s) => s.headingType).filter(Boolean))],
    [scenes]
  );

  const filtered = useMemo(() => {
    return scenes.filter((s) => {
      if (filter !== "all" && s.headingType !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.heading.toLowerCase().includes(q) ||
          s.location?.toLowerCase().includes(q) ||
          s.synopsis?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scenes, filter, search]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 md:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">
          Scenes
        </h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {filtered.length}
          {filtered.length !== scenes.length ? ` / ${scenes.length}` : ""}{" "}
          scene{scenes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative sm:max-w-xs flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            placeholder="Search scenes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 focus:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-shadow duration-300"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 md:px-2.5 md:py-1 text-xs rounded-md transition-all duration-300 shrink-0 min-h-[36px] md:min-h-0 ${
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-[0_0_12px_oklch(0.585_0.233_264/0.25)]"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {headingTypes.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t!)}
              className={`px-3 py-1.5 md:px-2.5 md:py-1 text-xs rounded-md transition-all duration-300 shrink-0 min-h-[36px] md:min-h-0 ${
                filter === t
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_oklch(0.585_0.233_264/0.25)]"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Scene list — single-column layout */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="inline-block mb-3 opacity-40">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
            </svg>
          </div>
          <p>{search
            ? "No scenes match your search"
            : "No scenes yet -- upload a screenplay to get started"}</p>
        </div>
      ) : (
        <div ref={listRef} className="space-y-2">
          {filtered.map((scene) => (
            <div key={scene.id} data-scene-card>
              <SceneCard
                scene={scene}
                projectId={projectId}
                isExpanded={expandedId === scene.id}
                onToggle={() =>
                  setExpandedId(expandedId === scene.id ? null : scene.id)
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene Card                                                         */
/* ------------------------------------------------------------------ */

function SceneCard({
  scene,
  projectId,
  isExpanded,
  onToggle,
}: {
  scene: FullScene;
  projectId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Unique characters in scene
  const characters = useMemo(() => {
    if (!scene.dialogues || scene.dialogues.length === 0) return [];
    const names = new Set(scene.dialogues.map((d) => d.character));
    return [...names].sort();
  }, [scene.dialogues]);

  // Merge and sort elements by sortOrder for full screenplay display
  const elements = useMemo(() => {
    const els: {
      type: string;
      sortOrder: number;
      character?: string;
      parenthetical?: string | null;
      line?: string;
      content?: string;
    }[] = [];

    if (scene.dialogues) {
      for (const d of scene.dialogues) {
        els.push({
          type: "dialogue",
          sortOrder: d.sortOrder,
          character: d.character,
          parenthetical: d.parenthetical,
          line: d.line,
        });
      }
    }
    if (scene.directions) {
      for (const d of scene.directions) {
        els.push({
          type: d.type,
          sortOrder: d.sortOrder,
          content: d.content,
        });
      }
    }
    els.sort((a, b) => a.sortOrder - b.sortOrder);
    return els;
  }, [scene.dialogues, scene.directions]);

  const isInt = scene.headingType?.toUpperCase() === "INT";
  const isExt = scene.headingType?.toUpperCase() === "EXT";

  return (
    <div
      className={`rounded-lg border transition-all duration-300 backdrop-blur-sm ${
        isExpanded
          ? "border-l-[3px] border-l-amber-500 border-t border-r border-b border-border bg-muted/30 shadow-[0_0_15px_oklch(0.585_0.233_264/0.08)]"
          : "border-border/40 bg-card/80 hover:bg-muted/20 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)]"
      }`}
    >
      {/* Collapsed card — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left py-3 px-4 flex items-start gap-3 group"
      >
        {/* Scene number square */}
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_8px_oklch(0.585_0.233_264/0.1)]">
          <span className="font-mono text-sm font-bold text-primary">
            {scene.sceneNumber}
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* INT / EXT badge */}
            {scene.headingType && (
              <Badge
                variant="secondary"
                className={`text-[10px] font-mono font-semibold px-1.5 py-0 leading-5 rounded ${
                  isInt
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 shadow-[0_0_8px_oklch(0.795_0.184_86/0.15)]"
                    : isExt
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25 shadow-[0_0_8px_oklch(0.585_0.233_264/0.15)]"
                    : ""
                }`}
              >
                {scene.headingType}
              </Badge>
            )}

            {/* Location */}
            <span className="text-sm font-medium truncate">
              {scene.location || scene.heading}
            </span>

            {/* Time of day badge */}
            {scene.timeOfDay && (
              <Badge
                variant="outline"
                className="text-[10px] font-mono text-muted-foreground px-1.5 py-0 leading-5"
              >
                {scene.timeOfDay}
              </Badge>
            )}
          </div>

          {/* Synopsis */}
          {scene.synopsis && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {scene.synopsis}
            </p>
          )}

          {/* Character count */}
          {characters.length > 0 && (
            <span className="text-[11px] text-muted-foreground/70 mt-1 block">
              {characters.length} character{characters.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Characters list */}
          {characters.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Characters
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {characters.map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="text-[11px] font-mono"
                  >
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Full scene text */}
          {elements.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Scene Content
              </h4>
              <div className="rounded-md bg-background border border-border/60 p-3 space-y-2 max-h-[400px] overflow-y-auto">
                {/* Scene heading */}
                <div className="font-mono text-xs font-bold uppercase tracking-wide text-foreground">
                  {scene.heading}
                </div>

                {/* Scene elements */}
                {elements.map((el, i) => {
                  if (el.type === "dialogue") {
                    return (
                      <div key={i} className="ml-8 mr-4">
                        <div className="font-mono text-xs font-semibold uppercase text-center text-foreground/80">
                          {el.character}
                        </div>
                        {el.parenthetical && (
                          <div className="font-mono text-xs italic text-muted-foreground text-center">
                            ({el.parenthetical})
                          </div>
                        )}
                        <div className="font-mono text-xs text-foreground/70 text-center max-w-[280px] mx-auto leading-relaxed">
                          {el.line}
                        </div>
                      </div>
                    );
                  }
                  if (el.type === "transition") {
                    return (
                      <div
                        key={i}
                        className="font-mono text-xs uppercase text-muted-foreground text-right"
                      >
                        {el.content}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="font-mono text-xs text-foreground/60 leading-relaxed"
                    >
                      {el.content}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick-generate action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/project/${projectId}/generate?sceneId=${scene.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-[0_0_12px_oklch(0.585_0.233_264/0.15)] transition-all duration-300"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              Generate Image
            </Link>
            <Link
              href={`/project/${projectId}/generate-video`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-[0_0_12px_oklch(0.585_0.233_264/0.15)] transition-all duration-300"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="15" height="14" rx="2" />
                <path d="M17 8l5-3v14l-5-3" />
              </svg>
              Generate Video
            </Link>
            <Link
              href={`/project/${projectId}/scenes/${scene.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:bg-muted/50 transition-colors ml-auto"
            >
              Open Scene
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
