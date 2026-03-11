"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timelineRef.current || loading || versions.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = timelineRef.current.querySelectorAll("[data-version-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, versions.length]);

  const fetchVersions = useCallback(() => {
    const branchParam = selectedBranch !== "all" ? `&branchId=${selectedBranch}` : "";
    fetch(`/api/versions?projectId=${projectId}${branchParam}`)
      .then((r) => r.json())
      .then((data) => {
        setVersions(Array.isArray(data) ? data : (data.versions || []));
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

  function getTriggerBadge(type: string) {
    const colors: Record<string, string> = {
      manual_edit: "bg-primary/15 text-primary",
      ai_modify: "bg-primary/10 text-primary",
      ai_polish: "bg-primary/10 text-primary",
      revert: "bg-destructive/15 text-destructive",
      manual_save: "bg-muted text-muted-foreground",
      import: "bg-muted text-muted-foreground",
    };
    return colors[type] || "bg-muted text-muted-foreground";
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

  function parseStats(statsStr: string | null): { scenes: number; dialogues: number; wordCount: number } | null {
    if (!statsStr) return null;
    try { return JSON.parse(statsStr); } catch { return null; }
  }

  function buildDiffSummary(v: VersionRow, index: number): string | null {
    const stats = parseStats(v.stats);
    if (!stats) return null;
    // For the first (latest) version or when we only have absolute stats, show counts
    if (index === versions.length - 1) {
      return `Initial: ${stats.scenes} scene${stats.scenes !== 1 ? "s" : ""}, ${stats.dialogues} dialogue${stats.dialogues !== 1 ? "s" : ""}, ${(stats.wordCount || 0).toLocaleString()} words`;
    }
    // Compare with the next (older) version
    const olderVersion = versions[index + 1];
    const olderStats = parseStats(olderVersion?.stats);
    if (!olderStats) {
      return `${stats.scenes} scene${stats.scenes !== 1 ? "s" : ""}, ${stats.dialogues} dialogue${stats.dialogues !== 1 ? "s" : ""}, ${(stats.wordCount || 0).toLocaleString()} words`;
    }
    const parts: string[] = [];
    const sceneDiff = stats.scenes - olderStats.scenes;
    const dialogueDiff = stats.dialogues - olderStats.dialogues;
    const wordDiff = (stats.wordCount || 0) - (olderStats.wordCount || 0);
    if (sceneDiff > 0) parts.push(`Added ${sceneDiff} scene${sceneDiff !== 1 ? "s" : ""}`);
    else if (sceneDiff < 0) parts.push(`Removed ${Math.abs(sceneDiff)} scene${Math.abs(sceneDiff) !== 1 ? "s" : ""}`);
    if (dialogueDiff > 0) parts.push(`added ${dialogueDiff} dialogue${dialogueDiff !== 1 ? "s" : ""}`);
    else if (dialogueDiff < 0) parts.push(`removed ${Math.abs(dialogueDiff)} dialogue${Math.abs(dialogueDiff) !== 1 ? "s" : ""}`);
    if (wordDiff !== 0 && parts.length < 2) {
      const sign = wordDiff > 0 ? "+" : "";
      parts.push(`${sign}${wordDiff.toLocaleString()} words`);
    }
    if (parts.length === 0) {
      return `${stats.scenes} scene${stats.scenes !== 1 ? "s" : ""}, ${stats.dialogues} dialogue${stats.dialogues !== 1 ? "s" : ""}`;
    }
    // Capitalize first part
    if (parts.length > 0) {
      parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return parts.join(", ");
  }

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

  // Loading skeleton — timeline layout
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-11 w-40 rounded-lg" />
        </div>
        {/* Branch tabs skeleton */}
        <div className="flex gap-1">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        {/* Timeline skeleton */}
        <div className="relative pl-8">
          <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-muted" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="relative flex items-start gap-4 pb-8">
              <Skeleton className="absolute left-[-21px] top-1 h-3 w-3 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header — Save Version is now the dominant primary action */}
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
            className="font-semibold px-5 shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
              <path d="M2 2h9l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
              <path d="M5 2v4h5V2" /><rect x="4" y="10" width="8" height="4" rx="0.5" />
            </svg>
            Save Version
          </Button>
        </div>
      </div>

      {/* Branch filter — tab-style toggle */}
      {branches.length > 0 && (
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" role="tablist" aria-label="Filter by branch">
          {branchTabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={selectedBranch === tab.value}
              onClick={() => setSelectedBranch(tab.value)}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all duration-300
                ${selectedBranch === tab.value
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_oklch(0.715_0.165_195/0.2)]"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Version Timeline */}
      {versions.length === 0 ? (
        /* Empty state — timeline illustration */
        <div className="flex flex-col items-center justify-center py-20">
          {/* Timeline illustration: vertical line with empty dots */}
          <div className="relative w-8 mb-6" style={{ height: 120 }}>
            <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-muted-foreground/20 shadow-[0_0_4px_oklch(0.585_0.233_264/0.1)]" />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-muted-foreground/25 bg-background"
                style={{ top: i * 36, boxShadow: i === 0 ? '0 0 8px oklch(0.585 0.233 264 / 0.15)' : undefined }}
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
            className="font-semibold px-5 shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300"
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
            className="absolute left-[11px] top-1.5 w-[2px] bg-border shadow-[0_0_6px_oklch(0.585_0.233_264/0.15)]"
            style={{ bottom: versions.length > 1 ? 24 : 0, height: versions.length === 1 ? 0 : undefined }}
          />

          {versions.map((v, i) => {
            const diffSummary = buildDiffSummary(v, i);
            const branchLabel = getBranchLabel(v.branchId);
            const isLatest = i === 0;

            return (
              <div key={v.id} data-version-card className="relative pb-8 last:pb-0 group">
                {/* Timeline dot */}
                <div
                  className={`
                    absolute left-[-21px] top-1.5 w-3 h-3 rounded-full border-2 z-10 transition-all duration-300
                    ${isLatest
                      ? "border-primary bg-primary shadow-[0_0_10px_oklch(0.585_0.233_264/0.4)]"
                      : "border-border bg-background group-hover:border-primary/50 group-hover:shadow-[0_0_6px_oklch(0.585_0.233_264/0.15)]"
                    }
                  `}
                />

                {/* Entry content */}
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    {/* Version name row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold leading-tight">
                        v{v.versionNumber}
                        {v.label && <span className="text-foreground"> &mdash; {v.label}</span>}
                      </span>
                      {isLatest && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20 shadow-[0_0_8px_oklch(0.585_0.233_264/0.2)]">
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

                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                      {timeAgo(v.createdAt)}
                    </p>

                    {/* Diff summary */}
                    {diffSummary && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">
                        {diffSummary}
                      </p>
                    )}

                    {/* Trigger detail */}
                    {v.triggerDetail && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5 truncate leading-tight">
                        {v.triggerDetail}
                      </p>
                    )}
                  </div>

                  {/* Quick actions — visible on hover or always on mobile */}
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

                    {/* Export / Diff */}
                    {versions.length > 1 && i < versions.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={diffLoading}
                        onClick={() => handleDiff(versions[i + 1].id, v.id)}
                      >
                        {diffLoading && diffFrom === versions[i + 1]?.id && diffTo === v.id ? "..." : "Diff"}
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
          <Card className="backdrop-blur-sm bg-card/80 border-border/40 shadow-[0_0_15px_oklch(0.585_0.233_264/0.06)]">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-4">{diffResult.summary.description}</p>

              {/* Modified dialogues */}
              {diffResult.dialogues.modified.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-semibold">Modified Dialogues</h3>
                  {diffResult.dialogues.modified.map((d, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider">{d.character}</span>
                        <Badge variant="outline" className="text-[10px]">Scene {d.sceneNumber}</Badge>
                      </div>
                      <div className="font-mono text-sm space-y-0.5">
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
                <div className="space-y-2 mb-6">
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
                <div className="space-y-2 mb-6">
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
                <div className="space-y-3 mb-6">
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
                <div className="space-y-2">
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
          <div className="space-y-3 pt-2">
            {/* UX AUDIT FIX: added accessible label for input */}
            <Label htmlFor="version-label" className="sr-only">Version label</Label>
            <Input
              id="version-label"
              placeholder='Optional label (e.g. "Before AI rewrite")'
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
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
          <div className="space-y-3 pt-2">
            {/* UX AUDIT FIX: added accessible labels for inputs */}
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Branch name</Label>
              <Input
                id="branch-name"
                placeholder="Branch name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
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

      <ConfirmDialog
        open={revertTarget !== null}
        onOpenChange={(open) => { if (!open) setRevertTarget(null); }}
        title="Restore this version"
        description={`Restore the screenplay to version v${revertTarget?.versionNumber}? Current changes since this version will remain in version history.`}
        confirmLabel="Restore"
        variant="default"
        onConfirm={() => { if (revertTarget) return handleRevert(revertTarget.id); }}
      />
    </div>
  );
}
