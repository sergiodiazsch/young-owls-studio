"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { gsap } from "@/lib/gsap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ScreenplayBranch, DiffResult } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VersionRow {
  id: number;
  projectId: number;
  branchId: number | null;
  versionNumber: number;
  label: string | null;
  triggerType: string;
  triggerDetail: string | null;
  stats: string | null;
  createdAt: string;
}

interface ParsedStats {
  sceneCount: number;
  dialogueCount: number;
  directionCount: number;
  characterCount: number;
  wordCount: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseStats(statsStr: string | null): ParsedStats | null {
  if (!statsStr) return null;
  try {
    return JSON.parse(statsStr) as ParsedStats;
  } catch {
    return null;
  }
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

function localeTimestamp(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr;
  }
}

/** Color classes for timeline dots by trigger type (#4) */
function getTriggerDotColor(type: string): string {
  const map: Record<string, string> = {
    manual_save: "border-primary bg-primary shadow-[0_0_10px_var(--glow-primary)]",
    manual_edit: "border-primary bg-primary shadow-[0_0_10px_var(--glow-primary)]",
    ai_modify: "border-violet-500 bg-violet-500 shadow-md",
    ai_polish: "border-violet-500 bg-violet-500 shadow-md",
    revert: "border-orange-500 bg-orange-500 shadow-md",
    import: "border-emerald-500 bg-emerald-500 shadow-md",
    branch_switch: "border-cyan-400 bg-cyan-400 shadow-md",
  };
  return map[type] || "border-primary bg-primary shadow-[0_0_10px_var(--glow-primary)]";
}

/** Badge classes for trigger type */
function getTriggerBadge(type: string) {
  const colors: Record<string, string> = {
    manual_edit: "bg-primary/15 text-primary",
    manual_save: "bg-muted text-muted-foreground",
    ai_modify: "bg-violet-500/15 text-violet-400",
    ai_polish: "bg-violet-500/15 text-violet-400",
    revert: "bg-orange-500/15 text-orange-400",
    import: "bg-emerald-500/15 text-emerald-400",
    branch_switch: "bg-cyan-400/15 text-cyan-300",
  };
  return colors[type] || "bg-muted text-muted-foreground";
}

/** Trigger type filter categories (#5) */
type TriggerFilter = "all" | "manual" | "ai" | "revert";

const TRIGGER_FILTERS: { value: TriggerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "ai", label: "AI" },
  { value: "revert", label: "Revert" },
];

function matchesTriggerFilter(triggerType: string, filter: TriggerFilter): boolean {
  if (filter === "all") return true;
  if (filter === "manual") return triggerType === "manual_save" || triggerType === "manual_edit" || triggerType === "import" || triggerType === "branch_switch";
  if (filter === "ai") return triggerType === "ai_modify" || triggerType === "ai_polish";
  if (filter === "revert") return triggerType === "revert";
  return true;
}

/* ------------------------------------------------------------------ */
/*  Stats chips component (#1)                                         */
/* ------------------------------------------------------------------ */

function StatsChips({ stats }: { stats: ParsedStats }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1">
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-border/50">
        {stats.sceneCount} scene{stats.sceneCount !== 1 ? "s" : ""}
      </Badge>
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-border/50">
        {stats.dialogueCount} dialogue{stats.dialogueCount !== 1 ? "s" : ""}
      </Badge>
      {stats.characterCount > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-border/50">
          {stats.characterCount} character{stats.characterCount !== 1 ? "s" : ""}
        </Badge>
      )}
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal border-border/50">
        {formatCount(stats.wordCount)} words
      </Badge>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline diff chips component (#2)                                   */
/* ------------------------------------------------------------------ */

function InlineDiffChips({ current, previous }: { current: ParsedStats; previous: ParsedStats }) {
  const diffs: { label: string; delta: number }[] = [];

  const sceneDiff = current.sceneCount - previous.sceneCount;
  const dialogueDiff = current.dialogueCount - previous.dialogueCount;
  const wordDiff = current.wordCount - previous.wordCount;

  if (sceneDiff !== 0) diffs.push({ label: `${sceneDiff > 0 ? "+" : ""}${sceneDiff} scene${Math.abs(sceneDiff) !== 1 ? "s" : ""}`, delta: sceneDiff });
  if (dialogueDiff !== 0) diffs.push({ label: `${dialogueDiff > 0 ? "+" : ""}${dialogueDiff} dialogue${Math.abs(dialogueDiff) !== 1 ? "s" : ""}`, delta: dialogueDiff });
  if (wordDiff !== 0) diffs.push({ label: `${wordDiff > 0 ? "+" : ""}${formatCount(wordDiff)} words`, delta: wordDiff });

  if (diffs.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
      {diffs.map((d, i) => (
        <span
          key={i}
          className={`text-[10px] font-medium ${
            d.delta > 0
              ? "text-emerald-400"
              : "text-destructive"
          }`}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats summary string for restore dialog (#3)                       */
/* ------------------------------------------------------------------ */

function statsSummary(stats: ParsedStats | null): string {
  if (!stats) return "No stats available";
  return `${stats.sceneCount} scene${stats.sceneCount !== 1 ? "s" : ""}, ${stats.dialogueCount} dialogue${stats.dialogueCount !== 1 ? "s" : ""}, ${formatCount(stats.wordCount)} words`;
}

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */

export default function VersionsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [branches, setBranches] = useState<ScreenplayBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");

  // Save version dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // New branch dialog
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchDesc, setBranchDesc] = useState("");

  // Diff view
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffFrom, setDiffFrom] = useState<number | null>(null);
  const [diffTo, setDiffTo] = useState<number | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Revert
  const [reverting, setReverting] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // UX AUDIT FIX: confirmation dialogs for destructive actions
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; versionNumber: number } | null>(null);
  const [revertTarget, setRevertTarget] = useState<{ id: number; versionNumber: number } | null>(null);

  // (#5) Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [triggerFilter, setTriggerFilter] = useState<TriggerFilter>("all");

  // (#6) Comparison picker
  const [compareSelection, setCompareSelection] = useState<number[]>([]);

  const timelineRef = useRef<HTMLDivElement>(null);

  /* -------------------------------------------------------------- */
  /*  GSAP entrance animation                                        */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    if (!timelineRef.current || loading || versions.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = timelineRef.current.querySelectorAll("[data-version-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, versions.length]);

  /* -------------------------------------------------------------- */
  /*  Keyboard shortcuts (#8)                                        */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input / textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSaveDialogOpen(true);
      }
      if (e.key === "Escape") {
        setSaveDialogOpen(false);
        setBranchDialogOpen(false);
        setDiffResult(null);
        setDiffFrom(null);
        setDiffTo(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* -------------------------------------------------------------- */
  /*  Data fetching                                                   */
  /* -------------------------------------------------------------- */

  const fetchVersions = useCallback(() => {
    const branchParam = selectedBranch !== "all" ? `&branchId=${selectedBranch}` : "";
    fetch(`/api/versions?projectId=${projectId}${branchParam}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data) ? data : (data.versions || []);
        // API returns snake_case, map to camelCase
        const mapped: VersionRow[] = raw.map((v: Record<string, unknown>) => ({
          id: v.id as number,
          projectId: (v.projectId ?? v.project_id) as number,
          branchId: (v.branchId ?? v.branch_id ?? null) as number | null,
          versionNumber: (v.versionNumber ?? v.version_number) as number,
          label: (v.label ?? null) as string | null,
          triggerType: (v.triggerType ?? v.trigger_type ?? "manual_save") as string,
          triggerDetail: (v.triggerDetail ?? v.trigger_detail ?? null) as string | null,
          stats: (v.stats ?? null) as string | null,
          createdAt: (v.createdAt ?? v.created_at ?? "") as string,
        }));
        setVersions(mapped);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, selectedBranch]);

  const fetchBranches = useCallback(() => {
    fetch(`/api/branches?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
    fetchBranches();
  }, [fetchVersions, fetchBranches]);

  /* -------------------------------------------------------------- */
  /*  Actions                                                         */
  /* -------------------------------------------------------------- */

  async function handleSaveVersion() {
    setSaving(true);
    try {
      const res = await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId), label: saveLabel || undefined }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Version saved");
      setSaveDialogOpen(false);
      setSaveLabel("");
      fetchVersions();
    } catch {
      toast.error("Failed to save version");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateBranch() {
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          name: branchName,
          description: branchDesc || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Branch created");
      setBranchDialogOpen(false);
      setBranchName("");
      setBranchDesc("");
      fetchBranches();
    } catch {
      toast.error("Failed to create branch");
    }
  }

  async function handleRevert(versionId: number) {
    setReverting(versionId);
    try {
      const res = await fetch(`/api/versions/${versionId}/revert`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Reverted to this version");
      fetchVersions();
    } catch {
      toast.error("Failed to revert");
    } finally {
      setReverting(null);
    }
  }

  async function handleDiff(fromId: number, toId: number) {
    setDiffLoading(true);
    setDiffFrom(fromId);
    setDiffTo(toId);
    try {
      const res = await fetch(`/api/versions/diff?from=${fromId}&to=${toId}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDiffResult(data);
    } catch {
      toast.error("Failed to compute diff");
    } finally {
      setDiffLoading(false);
    }
  }

  // UX AUDIT FIX: delete now uses ConfirmDialog instead of native confirm()
  async function handleDeleteVersion(id: number) {
    try {
      await fetch(`/api/versions/${id}`, { method: "DELETE" });
      toast.success("Version deleted");
      fetchVersions();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleExportPDF() {
    setExporting(true);
    try {
      // Fetch project info
      const projRes = await fetch(`/api/projects/${projectId}`);
      if (!projRes.ok) throw new Error("Failed to fetch project");
      const project = await projRes.json();

      // Fetch all scenes with elements
      const scenesRes = await fetch(`/api/scenes?projectId=${projectId}`);
      if (!scenesRes.ok) throw new Error("Failed to fetch scenes");
      const scenesData = await scenesRes.json();

      // Fetch each scene's elements
      const fullScenes = [];
      for (const scene of scenesData) {
        const elRes = await fetch(`/api/scenes/${scene.id}`);
        if (elRes.ok) {
          fullScenes.push(await elRes.json());
        }
      }

      // Build formatted screenplay HTML
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Please allow pop-ups to export PDF");
        return;
      }

      interface SceneDialogue { character: string; parenthetical: string | null; line: string; sortOrder: number }
      interface SceneDirection { type: string; content: string; sortOrder: number }
      interface FullScene { heading: string; dialogues: SceneDialogue[]; directions: SceneDirection[] }

      const sceneHtml = fullScenes.map((scene: FullScene) => {
        const elements = [
          ...(scene.dialogues || []).map((d: SceneDialogue) => ({ ...d, _kind: "dialogue" as const })),
          ...(scene.directions || []).map((d: SceneDirection) => ({ ...d, _kind: "direction" as const })),
        ].sort((a, b) => a.sortOrder - b.sortOrder);

        const elementsHtml = elements.map((el) => {
          if (el._kind === "dialogue") {
            const d = el as SceneDialogue & { _kind: "dialogue" };
            return `
              <div class="dialogue-block">
                <div class="character-name">${d.character}</div>
                ${d.parenthetical ? `<div class="parenthetical">${d.parenthetical}</div>` : ""}
                <div class="dialogue-line">${d.line}</div>
              </div>
            `;
          } else {
            const d = el as SceneDirection & { _kind: "direction" };
            if (d.type === "transition") {
              return `<div class="transition">${d.content}</div>`;
            }
            return `<div class="action">${d.content}</div>`;
          }
        }).join("");

        return `
          <div class="scene">
            <div class="scene-heading">${scene.heading}</div>
            ${elementsHtml}
          </div>
        `;
      }).join("");

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${project.title || "Screenplay"}</title>
          <style>
            @page {
              size: letter;
              margin: 1in 1in 1in 1.5in;
            }
            body {
              font-family: "Courier New", Courier, monospace;
              font-size: 12pt;
              line-height: 1.1;
              color: #000;
              background: #fff;
            }
            .title-page {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              page-break-after: always;
              text-align: center;
            }
            .title-page h1 {
              font-size: 24pt;
              text-transform: uppercase;
              margin-bottom: 12pt;
              font-weight: bold;
            }
            .title-page .subtitle {
              font-size: 14pt;
              margin-bottom: 24pt;
            }
            .title-page .meta {
              font-size: 10pt;
              color: #666;
            }
            .scene {
              margin-bottom: 24pt;
            }
            .scene-heading {
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 12pt;
              text-decoration: underline;
            }
            .action {
              margin-bottom: 12pt;
              max-width: 6in;
            }
            .dialogue-block {
              margin-bottom: 12pt;
              margin-left: 1.5in;
              max-width: 3.5in;
            }
            .character-name {
              text-transform: uppercase;
              font-weight: bold;
              margin-left: 1in;
              margin-bottom: 0;
            }
            .parenthetical {
              margin-left: 0.5in;
              margin-bottom: 0;
              font-style: italic;
            }
            .dialogue-line {
              margin-bottom: 0;
            }
            .transition {
              text-align: right;
              text-transform: uppercase;
              margin-bottom: 12pt;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="title-page">
            <h1>${project.title || "Untitled Screenplay"}</h1>
            ${project.subtitle ? `<div class="subtitle">${project.subtitle}</div>` : ""}
            <div class="meta">Exported from Screenplay Studio</div>
          </div>
          ${sceneHtml}
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);

      toast.success("Export ready - use Print to save as PDF");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export");
    } finally {
      setExporting(false);
    }
  }

  /* -------------------------------------------------------------- */
  /*  Derived data                                                    */
  /* -------------------------------------------------------------- */

  function getBranchLabel(branchId: number | null): string | null {
    if (branchId === null) return null;
    const branch = branches.find((b) => b.id === branchId);
    return branch ? branch.name : null;
  }

  // Branch tab options
  const branchTabs = [
    { value: "all", label: "All branches" },
    ...branches.map((b) => ({
      value: String(b.id),
      label: `${b.name}${b.isActive ? " (active)" : ""}`,
    })),
  ];

  // (#5) Filtered versions
  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const labelMatch = v.label?.toLowerCase().includes(q);
        const versionMatch = `v${v.versionNumber}`.includes(q);
        const triggerMatch = v.triggerType.replace(/_/g, " ").toLowerCase().includes(q);
        if (!labelMatch && !versionMatch && !triggerMatch) return false;
      }
      // Trigger type filter
      if (!matchesTriggerFilter(v.triggerType, triggerFilter)) return false;
      return true;
    });
  }, [versions, searchQuery, triggerFilter]);

  // (#6) Comparison picker handler
  function toggleCompareSelection(versionId: number) {
    setCompareSelection((prev) => {
      if (prev.includes(versionId)) return prev.filter((id) => id !== versionId);
      if (prev.length >= 2) return [prev[1], versionId];
      return [...prev, versionId];
    });
  }

  // (#3) Restore dialog description with stats comparison
  function getRestoreDescription(): string {
    if (!revertTarget) return "";
    const currentLatest = versions[0];
    const targetVersion = versions.find((v) => v.id === revertTarget.id);
    const currentStats = currentLatest ? parseStats(currentLatest.stats) : null;
    const targetStats = targetVersion ? parseStats(targetVersion.stats) : null;

    let desc = `Restore the screenplay to version v${revertTarget.versionNumber}? Current changes since this version will remain in version history.`;

    if (currentStats && targetStats) {
      desc += `\n\nCurrent: ${statsSummary(currentStats)}\nRestoring to: ${statsSummary(targetStats)}`;
    }

    return desc;
  }

  /* -------------------------------------------------------------- */
  /*  Loading skeleton (#9 — uses bg-muted for theme support)        */
  /* -------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-48 bg-muted" />
            <Skeleton className="h-4 w-28 bg-muted" />
          </div>
          <Skeleton className="h-11 w-40 rounded-lg bg-muted" />
        </div>
        {/* Branch tabs skeleton */}
        <div className="flex gap-1">
          <Skeleton className="h-8 w-24 rounded-md bg-muted" />
          <Skeleton className="h-8 w-20 rounded-md bg-muted" />
        </div>
        {/* Timeline skeleton */}
        <div className="relative pl-8">
          <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-muted" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="relative flex items-start gap-4 pb-8">
              <Skeleton className="absolute left-[-21px] top-1 h-3 w-3 rounded-full shrink-0 bg-muted" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24 bg-muted" />
                  <Skeleton className="h-5 w-14 rounded-full bg-muted" />
                </div>
                <Skeleton className="h-3 w-32 bg-muted" />
                <Skeleton className="h-3 w-48 bg-muted" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-7 w-16 rounded-md bg-muted" />
                <Skeleton className="h-7 w-16 rounded-md bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------- */
  /*  Render                                                          */
  /* -------------------------------------------------------------- */

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Version History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {versions.length} version{versions.length !== 1 ? "s" : ""} saved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting || versions.length === 0}
            title="Export screenplay as PDF"
          >
            {exporting ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mr-1.5">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                <path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
                <path d="M10 1v4h4" />
                <path d="M6 9h4M6 12h4" />
              </svg>
            )}
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBranchDialogOpen(true)}>
            + Branch
          </Button>
          <Button
            size="default"
            onClick={() => setSaveDialogOpen(true)}
            className="font-semibold px-5 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
              <path d="M2 2h9l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
              <path d="M5 2v4h5V2" /><rect x="4" y="10" width="8" height="4" rx="0.5" />
            </svg>
            Save Version
          </Button>
        </div>
      </div>

      {/* Branch filter tabs */}
      {branches.length > 0 && (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1" role="tablist" aria-label="Filter by branch">
          {branchTabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={selectedBranch === tab.value}
              onClick={() => setSelectedBranch(tab.value)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all duration-300
                ${selectedBranch === tab.value
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--glow-primary)]"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* (#5) Search & trigger filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3.5 3.5" />
          </svg>
          <Input
            placeholder="Search versions by label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {TRIGGER_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTriggerFilter(f.value)}
              className={`
                px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-200
                ${triggerFilter === f.value
                  ? "bg-primary/15 text-primary"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* (#6) Comparison picker action bar */}
      {compareSelection.length === 2 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm text-primary font-medium">
            Comparing v{versions.find((v) => v.id === compareSelection[0])?.versionNumber} and v{versions.find((v) => v.id === compareSelection[1])?.versionNumber}
          </span>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              const [a, b] = compareSelection;
              const va = versions.find((v) => v.id === a);
              const vb = versions.find((v) => v.id === b);
              if (va && vb) {
                // older first
                const fromId = va.versionNumber < vb.versionNumber ? a : b;
                const toId = va.versionNumber < vb.versionNumber ? b : a;
                handleDiff(fromId, toId);
              }
              setCompareSelection([]);
            }}
          >
            Compare
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setCompareSelection([])}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Version Timeline */}
      {filteredVersions.length === 0 && versions.length > 0 ? (
        /* No results from search/filter */
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">No versions match your search or filter.</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => {
              setSearchQuery("");
              setTriggerFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : filteredVersions.length === 0 ? (
        /* Empty state — timeline illustration */
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative w-8 mb-6" style={{ height: 120 }}>
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-muted-foreground/20 shadow-[0_0_4px_var(--glow-primary)]" />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-muted-foreground/25 bg-background"
                style={{ top: i * 36, boxShadow: i === 0 ? '0 0 8px var(--glow-primary)' : undefined }}
              />
            ))}
          </div>
          <h2 className="text-lg font-semibold mb-2 text-center">
            Your script&apos;s history lives here
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
            Save a version before making big changes. Each version
            becomes a point on your timeline you can always return to.
          </p>
          <Button
            onClick={() => setSaveDialogOpen(true)}
            className="font-semibold px-5 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-all duration-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
              <path d="M2 2h9l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
              <path d="M5 2v4h5V2" /><rect x="4" y="10" width="8" height="4" rx="0.5" />
            </svg>
            Save Version
          </Button>
        </div>
      ) : (
        /* Timeline list */
        <div ref={timelineRef} className="relative pl-8">
          {/* Vertical connecting line */}
          <div
            className="absolute left-[11px] top-1.5 w-[2px] bg-border shadow-[0_0_6px_var(--glow-primary)]"
            style={{ bottom: filteredVersions.length > 1 ? 24 : 0, height: filteredVersions.length === 1 ? 0 : undefined }}
          />

          {filteredVersions.map((v, i) => {
            const stats = parseStats(v.stats);
            const branchLabel = getBranchLabel(v.branchId);
            const isLatest = i === 0 && triggerFilter === "all" && !searchQuery.trim();
            const isSelected = compareSelection.includes(v.id);

            // (#2) Find older version for diff chips (use the full versions array for accurate comparison)
            const fullIndex = versions.findIndex((fv) => fv.id === v.id);
            const olderVersion = fullIndex < versions.length - 1 ? versions[fullIndex + 1] : null;
            const olderStats = olderVersion ? parseStats(olderVersion.stats) : null;

            return (
              <div key={v.id} data-version-card className="relative pb-8 last:pb-0 group">
                {/* (#4) Timeline dot — color-coded by trigger type */}
                <div
                  className={`
                    absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border-2 z-10 transition-all duration-300
                    ${isLatest
                      ? getTriggerDotColor(v.triggerType)
                      : `border-border bg-background group-hover:border-primary/50 group-hover:shadow-md`
                    }
                  `}
                  style={
                    !isLatest
                      ? undefined
                      : undefined
                  }
                />

                {/* Color indicator on hover for non-latest */}
                {!isLatest && (
                  <div
                    className={`
                      absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border-2 z-10 transition-all duration-300 opacity-0 group-hover:opacity-100
                      ${getTriggerDotColor(v.triggerType)}
                    `}
                  />
                )}

                {/* Entry content */}
                <div className="flex items-start justify-between gap-4 min-w-0">
                  {/* (#6) Comparison checkbox */}
                  <button
                    onClick={() => toggleCompareSelection(v.id)}
                    className={`
                      mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all duration-200
                      ${isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/50"
                      }
                    `}
                    title={isSelected ? "Deselect for comparison" : "Select for comparison"}
                    aria-label={`${isSelected ? "Deselect" : "Select"} version ${v.versionNumber} for comparison`}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 8l4 4 6-7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {/* Version name row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold leading-tight">
                        v{v.versionNumber}
                        {v.label && <span className="text-foreground"> &mdash; {v.label}</span>}
                      </span>
                      {isLatest && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20 shadow-[0_0_8px_var(--glow-primary)]">
                          LATEST
                        </Badge>
                      )}
                      <Badge className={`text-[10px] px-1.5 py-0 ${getTriggerBadge(v.triggerType)}`}>
                        {v.triggerType.replace(/_/g, " ")}
                      </Badge>
                      {branchLabel && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {branchLabel}
                        </Badge>
                      )}
                    </div>

                    {/* (#7) Timestamp with tooltip */}
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight" title={localeTimestamp(v.createdAt)}>
                      {timeAgo(v.createdAt)}
                    </p>

                    {/* (#1) Stats chips */}
                    {stats && <StatsChips stats={stats} />}

                    {/* (#2) Inline diff preview */}
                    {stats && olderStats && (
                      <InlineDiffChips current={stats} previous={olderStats} />
                    )}

                    {/* Trigger detail */}
                    {v.triggerDetail && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5 truncate leading-tight">
                        {v.triggerDetail}
                      </p>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {/* Restore */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={reverting === v.id || isLatest}
                      onClick={() => setRevertTarget({ id: v.id, versionNumber: v.versionNumber })}
                    >
                      {reverting === v.id ? "Restoring..." : "Restore"}
                    </Button>

                    {/* Diff with previous */}
                    {versions.length > 1 && fullIndex < versions.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={diffLoading}
                        onClick={() => handleDiff(versions[fullIndex + 1].id, v.id)}
                      >
                        {diffLoading && diffFrom === versions[fullIndex + 1]?.id && diffTo === v.id ? "..." : "Diff"}
                      </Button>
                    )}

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget({ id: v.id, versionNumber: v.versionNumber })}
                      aria-label={`Delete version ${v.versionNumber}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 10a1 1 0 001 1h6a1 1 0 001-1l1-10" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Diff View */}
      {diffResult && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">
              Diff: v{versions.find((v) => v.id === diffFrom)?.versionNumber} → v{versions.find((v) => v.id === diffTo)?.versionNumber}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => { setDiffResult(null); setDiffFrom(null); setDiffTo(null); }}>
              Close
            </Button>
          </div>
          <Card className="backdrop-blur-sm bg-card/80 border-border/40 shadow-[0_0_15px_var(--glow-primary)]">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4">{diffResult.summary.description}</p>

              {/* Modified dialogues */}
              {diffResult.dialogues.modified.length > 0 && (
                <div className="flex flex-col gap-3 mb-6">
                  <h3 className="text-sm font-semibold">Modified Dialogues</h3>
                  {diffResult.dialogues.modified.map((d, i) => (
                    <div key={i} className="rounded-lg border p-3 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider">{d.character}</span>
                        <Badge variant="outline" className="text-[10px]">Scene {d.sceneNumber}</Badge>
                      </div>
                      <div className="font-mono text-sm flex flex-col gap-0.5">
                        {d.diffs.map((seg, j) => (
                          <span
                            key={j}
                            className={
                              seg.type === "removed"
                                ? "bg-destructive/20 line-through text-destructive"
                                : seg.type === "added"
                                ? "bg-primary/20 text-primary"
                                : ""
                            }
                          >
                            {seg.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Added dialogues */}
              {diffResult.dialogues.added.length > 0 && (
                <div className="flex flex-col gap-2 mb-6">
                  <h3 className="text-sm font-semibold text-primary">
                    + {diffResult.dialogues.added.length} Added Dialogues
                  </h3>
                  {diffResult.dialogues.added.map((d, i) => (
                    <div key={i} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <span className="text-xs font-bold uppercase">{d.character}</span>
                      <span className="text-xs text-muted-foreground ml-2">Scene {d.sceneNumber}</span>
                      <p className="text-sm mt-1">{d.line}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Removed dialogues */}
              {diffResult.dialogues.removed.length > 0 && (
                <div className="flex flex-col gap-2 mb-6">
                  <h3 className="text-sm font-semibold text-destructive">
                    - {diffResult.dialogues.removed.length} Removed Dialogues
                  </h3>
                  {diffResult.dialogues.removed.map((d, i) => (
                    <div key={i} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <span className="text-xs font-bold uppercase">{d.character}</span>
                      <span className="text-xs text-muted-foreground ml-2">Scene {d.sceneNumber}</span>
                      <p className="text-sm mt-1 line-through">{d.line}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Modified directions */}
              {diffResult.directions.modified.length > 0 && (
                <div className="flex flex-col gap-3 mb-6">
                  <h3 className="text-sm font-semibold">Modified Directions</h3>
                  {diffResult.directions.modified.map((d, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase">{d.type}</Badge>
                        <span className="text-xs text-muted-foreground">Scene {d.sceneNumber}</span>
                      </div>
                      <div className="font-mono text-sm">
                        {d.diffs.map((seg, j) => (
                          <span
                            key={j}
                            className={
                              seg.type === "removed"
                                ? "bg-destructive/20 line-through text-destructive"
                                : seg.type === "added"
                                ? "bg-primary/20 text-primary"
                                : ""
                            }
                          >
                            {seg.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Scene changes */}
              {(diffResult.scenes.added.length > 0 || diffResult.scenes.removed.length > 0) && (
                <div className="flex flex-col gap-2">
                  {diffResult.scenes.added.map((s, i) => (
                    <div key={`sa-${i}`} className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <Badge className="text-[10px] bg-primary/20 text-primary">NEW SCENE</Badge>
                      <span className="text-sm ml-2">Scene {s.sceneNumber}: {s.heading}</span>
                    </div>
                  ))}
                  {diffResult.scenes.removed.map((s, i) => (
                    <div key={`sr-${i}`} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <Badge className="text-[10px] bg-destructive/20 text-destructive">REMOVED</Badge>
                      <span className="text-sm ml-2 line-through">Scene {s.sceneNumber}: {s.heading}</span>
                    </div>
                  ))}
                </div>
              )}

              {diffResult.summary.totalChanges === 0 && (
                <p className="text-center text-muted-foreground py-8">No changes between these versions</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Version Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save Version</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Label htmlFor="version-label" className="sr-only">Version label</Label>
            <Input
              id="version-label"
              placeholder='Optional label (e.g. "Before AI rewrite")'
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) handleSaveVersion();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveVersion} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Branch Dialog */}
      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Branch</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                placeholder="Branch name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-desc">Description (optional)</Label>
              <Input
                id="branch-desc"
                placeholder="Description (optional)"
                value={branchDesc}
                onChange={(e) => setBranchDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateBranch} disabled={!branchName.trim()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* UX AUDIT FIX: confirmation dialogs for destructive actions */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete version"
        description={`Permanently delete version v${deleteTarget?.versionNumber}? This action cannot be undone.`}
        confirmLabel="Delete Version"
        onConfirm={() => { if (deleteTarget) return handleDeleteVersion(deleteTarget.id); }}
      />

      {/* (#3) Restore confirm with stats comparison */}
      <ConfirmDialog
        open={revertTarget !== null}
        onOpenChange={(open) => { if (!open) setRevertTarget(null); }}
        title="Restore this version"
        description={getRestoreDescription()}
        confirmLabel="Restore"
        variant="default"
        onConfirm={() => { if (revertTarget) return handleRevert(revertTarget.id); }}
      />

      {/* (#8) Keyboard shortcuts hint */}
      <div className="mt-12 text-center">
        <p className="text-[11px] text-muted-foreground">
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">S</kbd> Save version
          {" "}&middot;{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">Esc</kbd> Close dialogs
        </p>
      </div>
    </div>
  );
}
