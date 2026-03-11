"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { gsap } from "@/lib/gsap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BREAKDOWN_CATEGORIES } from "@/lib/breakdown-categories";
import type { Scene, SceneBreakdown, BreakdownElement } from "@/lib/types";

interface BreakdownRow {
  scene: Scene;
  breakdown: (SceneBreakdown & { elements: BreakdownElement[] }) | null;
}

interface SummaryData {
  totalScenes: number;
  completedBreakdowns: number;
  totalPageCount: number;
  totalEstimatedShootHours: number;
  uniqueLocations: string[];
  castList: string[];
  elementsByCategory: Record<string, number>;
  dayNightSplit: { day: number; night: number };
}

export default function BreakdownsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSceneId, setExpandedSceneId] = useState<number | null>(null);
  const [generatingScenes, setGeneratingScenes] = useState<Set<number>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState(0);
  const [generateAllTotal, setGenerateAllTotal] = useState(0);
  const [generateAllCurrent, setGenerateAllCurrent] = useState(0);
  const [generateAllCurrentScene, setGenerateAllCurrentScene] = useState<string | null>(null);
  const [generateAllCompleted, setGenerateAllCompleted] = useState(0);
  const [generateAllFailed, setGenerateAllFailed] = useState(0);
  const [confirmGenerateAll, setConfirmGenerateAll] = useState(false);

  // Add element dialog
  const [addElementDialog, setAddElementDialog] = useState<{
    open: boolean;
    breakdownId: number;
    sceneId: number;
  } | null>(null);
  const [newElementCategory, setNewElementCategory] = useState("props");
  const [newElementName, setNewElementName] = useState("");
  const [newElementDescription, setNewElementDescription] = useState("");
  const [newElementQuantity, setNewElementQuantity] = useState("1");
  const [addingElement, setAddingElement] = useState(false);
  const [duplicatingScenes, setDuplicatingScenes] = useState<Set<number>>(new Set());
  const [breakdownTab, setBreakdownTab] = useState<"plan" | "visuals" | "voice" | "audio">("plan");
  const [expandedShots, setExpandedShots] = useState<Set<number>>(new Set());
  const [expandedImagePrompts, setExpandedImagePrompts] = useState<Set<string>>(new Set());
  const [showArtDirection, setShowArtDirection] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current || loading || rows.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-breakdown-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, rows.length]);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const cacheBust = `&_t=${Date.now()}`;
      const opts: RequestInit = { cache: "no-store" };
      if (signal) opts.signal = signal;

      const [rowsRes, summaryRes] = await Promise.all([
        fetch(`/api/breakdowns?projectId=${projectId}${cacheBust}`, opts),
        fetch(`/api/breakdowns/summary?projectId=${projectId}${cacheBust}`, opts),
      ]);

      if (!rowsRes.ok) {
        const errData = await rowsRes.json().catch(() => null);
        throw new Error(errData?.error || `Failed to fetch breakdowns: ${rowsRes.status}`);
      }

      const rowsData = await rowsRes.json();
      // Guard: ensure we got an array (API might return error object)
      if (!Array.isArray(rowsData)) {
        throw new Error(rowsData?.error || "Unexpected response format");
      }
      setRows(rowsData);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Failed to load breakdown data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  // Reset breakdown tab when a different scene is expanded
  useEffect(() => {
    setBreakdownTab("plan");
    setExpandedShots(new Set());
    setExpandedImagePrompts(new Set());
    setShowArtDirection(false);
  }, [expandedSceneId]);

  // Helper: read an SSE stream with a timeout. Returns { resultData, errorMsg }.
  async function readSSEStream(
    res: Response,
    timeoutMs = 150_000
  ): Promise<{
    resultData: { breakdown: SceneBreakdown & { elements: BreakdownElement[] }; elements: BreakdownElement[] } | null;
    errorMsg: string | null;
    streamFailed: boolean;
  }> {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let resultData: { breakdown: SceneBreakdown & { elements: BreakdownElement[] }; elements: BreakdownElement[] } | null = null;
    let errorMsg: string | null = null;
    let streamFailed = false;
    let receivedDone = false;

    const processChunk = (text: string) => {
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "done") {
          receivedDone = true;
        } else if (payload.startsWith("result:")) {
          try { resultData = JSON.parse(payload.slice(7)); } catch { /* ignore */ }
        } else if (payload.startsWith("error:")) {
          errorMsg = payload.slice(6);
        }
        // heartbeat, loading, analyzing, saving, token events keep connection alive
      }
    };

    if (reader) {
      let buffer = "";
      let lastActivity = Date.now();

      const checkTimeout = () => {
        if (Date.now() - lastActivity > timeoutMs) {
          reader.cancel();
          if (!errorMsg) errorMsg = "Generation timed out - no response from server";
        }
      };
      const intervalId = setInterval(checkTimeout, 5000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          for (const part of parts) {
            processChunk(part + "\n\n");
          }
        }
        if (buffer.trim()) {
          processChunk(buffer);
        }
      } catch (err) {
        // Stream was cut (e.g. Netlify function timeout) — fall back to polling
        if (!errorMsg && !resultData && !receivedDone) {
          streamFailed = true;
        }
        if (!errorMsg && !receivedDone) {
          errorMsg = err instanceof Error ? err.message : "Stream reading failed";
        }
      } finally {
        clearInterval(intervalId);
      }
    }

    // If stream ended cleanly but we got no result and no done event, treat as stream failure
    if (!resultData && !errorMsg && !receivedDone && !streamFailed) {
      streamFailed = true;
    }

    return { resultData, errorMsg, streamFailed };
  }

  // Polling fallback: checks if a breakdown completed server-side after SSE stream was cut
  async function pollForCompletion(
    sceneId: number,
    maxAttempts = 40,
    intervalMs = 5000
  ): Promise<BreakdownRow | null> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs));
      try {
        const res = await fetch(`/api/breakdowns?projectId=${projectId}&_t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        if (!Array.isArray(data)) continue;
        const row = data.find((r: BreakdownRow) => r.scene.id === sceneId);
        if (row?.breakdown?.status === "completed") return row;
        if (row?.breakdown?.status === "failed") return row;
      } catch { /* keep polling */ }
    }
    return null;
  }

  async function handleGenerate(sceneId: number) {
    setGeneratingScenes((prev) => new Set(prev).add(sceneId));

    // Optimistically set status
    setRows((prev) =>
      prev.map((r) =>
        r.scene.id === sceneId
          ? {
              ...r,
              breakdown: r.breakdown
                ? { ...r.breakdown, status: "generating" }
                : ({
                    id: -1,
                    sceneId,
                    projectId: Number(projectId),
                    status: "generating",
                    pageCount: null,
                    dayOrNight: null,
                    intOrExt: null,
                    estimatedShootHours: null,
                    notes: null,
                    createdAt: "",
                    updatedAt: "",
                    elements: [],
                  } as BreakdownRow["breakdown"]),
            }
          : r
      )
    );

    try {
      // Step 1: Submit — triggers background function and returns immediately
      const res = await fetch("/api/breakdowns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, projectId: Number(projectId) }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Generation failed: ${res.status}` }));
        throw new Error(err.error || `Generation failed: ${res.status}`);
      }

      // Step 2: Poll for completion (background function processes the Claude call)
      toast.info("Generating breakdown — this may take up to 60 seconds...");
      const polledRow = await pollForCompletion(sceneId);

      if (polledRow?.breakdown?.status === "failed") {
        throw new Error(polledRow.breakdown.notes || "Generation failed on server");
      } else if (!polledRow || polledRow.breakdown?.status !== "completed") {
        throw new Error("Generation did not complete in time — try again");
      }

      // Step 3: Reload all data from server
      await fetchData();

      // Auto-expand the scene and scroll into view
      setExpandedSceneId(sceneId);
      toast.success(`Breakdown complete`);

      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-breakdown-card][data-scene-id="${sceneId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      // Refresh summary
      const summaryRes = await fetch(`/api/breakdowns/summary?projectId=${projectId}&_t=${Date.now()}`, { cache: "no-store" });
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch (error) {
      const msg = error instanceof DOMException && error.name === "AbortError"
        ? "Generation timed out"
        : error instanceof Error ? error.message : "Generation failed";
      toast.error(msg);
      setRows((prev) =>
        prev.map((r) =>
          r.scene.id === sceneId && r.breakdown
            ? { ...r, breakdown: { ...r.breakdown, status: "failed" } }
            : r
        )
      );
    } finally {
      setGeneratingScenes((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }

  async function handleGenerateAll() {
    const pendingRows = rows.filter(
      (r) => !r.breakdown || r.breakdown.status !== "completed"
    );

    if (pendingRows.length === 0) {
      toast.info("All scenes already have completed breakdowns");
      return;
    }

    setGeneratingAll(true);
    setGenerateAllProgress(0);
    setGenerateAllTotal(pendingRows.length);
    setGenerateAllCurrent(0);
    setGenerateAllCurrentScene(null);
    setGenerateAllCompleted(0);
    setGenerateAllFailed(0);

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < pendingRows.length; i++) {
      const row = pendingRows[i];
      const sceneLabel = String(row.scene.sceneNumber || `#${row.scene.id}`);

      setGenerateAllCurrent(i + 1);
      setGenerateAllCurrentScene(sceneLabel);
      setGenerateAllProgress(Math.round((i / pendingRows.length) * 100));
      setGeneratingScenes((prev) => new Set(prev).add(row.scene.id));

      // Optimistically set status to generating
      setRows((prev) =>
        prev.map((r) =>
          r.scene.id === row.scene.id
            ? {
                ...r,
                breakdown: r.breakdown
                  ? { ...r.breakdown, status: "generating" }
                  : ({
                      id: -1,
                      sceneId: row.scene.id,
                      projectId: Number(projectId),
                      status: "generating",
                      pageCount: null,
                      dayOrNight: null,
                      intOrExt: null,
                      estimatedShootHours: null,
                      notes: null,
                      createdAt: "",
                      updatedAt: "",
                      elements: [],
                    } as BreakdownRow["breakdown"]),
              }
            : r
        )
      );

      try {
        const res = await fetch("/api/breakdowns/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sceneId: row.scene.id, projectId: Number(projectId) }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: `Generation failed: ${res.status}` }));
          throw new Error(errData.error || "Generation failed");
        }

        // Poll for completion — background function handles the Claude call
        const polledRow = await pollForCompletion(row.scene.id, 40, 5000);
        if (polledRow?.breakdown?.status === "failed") {
          throw new Error(polledRow.breakdown.notes || "Generation failed on server");
        } else if (!polledRow || polledRow.breakdown?.status !== "completed") {
          throw new Error("Generation did not complete in time");
        }

        await fetchData();
        completed++;
        setGenerateAllCompleted(completed);
      } catch {
        failed++;
        setGenerateAllFailed(failed);
        setRows((prev) =>
          prev.map((r) =>
            r.scene.id === row.scene.id && r.breakdown
              ? { ...r, breakdown: { ...r.breakdown, status: "failed" } }
              : r
          )
        );
      } finally {
        setGeneratingScenes((prev) => {
          const next = new Set(prev);
          next.delete(row.scene.id);
          return next;
        });
      }
    }

    setGenerateAllProgress(100);

    toast.success(`Breakdown complete: ${completed}/${pendingRows.length} scenes processed`);
    if (failed > 0) {
      toast.error(`${failed} scene(s) failed`);
    }

    // Refresh summary
    try {
      const summaryRes = await fetch(`/api/breakdowns/summary?projectId=${projectId}&_t=${Date.now()}`, { cache: "no-store" });
      setSummary(await summaryRes.json());
    } catch {
      // non-critical
    }

    setGeneratingAll(false);
    setGeneratingScenes(new Set());
  }

  async function handleRetryFailed() {
    // First, reset all failed/stuck breakdowns on the server
    try {
      const resetRes = await fetch("/api/breakdowns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId), action: "reset-failed" }),
      });
      if (!resetRes.ok) {
        toast.error("Failed to reset stuck breakdowns");
        return;
      }
      const { reset } = await resetRes.json();
      if (reset === 0) {
        toast.info("No failed or stuck breakdowns to retry");
        return;
      }
    } catch {
      toast.error("Failed to reset stuck breakdowns");
      return;
    }

    // Reload data to get fresh statuses, then use the fresh data to generate
    try {
      const [rowsRes, summaryRes] = await Promise.all([
        fetch(`/api/breakdowns?projectId=${projectId}&_t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/breakdowns/summary?projectId=${projectId}&_t=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (!rowsRes.ok) {
        throw new Error("Failed to fetch breakdowns after reset");
      }
      const freshRowsData = await rowsRes.json();
      if (!Array.isArray(freshRowsData)) {
        throw new Error("Unexpected response format");
      }
      const freshRows: BreakdownRow[] = freshRowsData;
      setRows(freshRows);
      if (summaryRes.ok) {
        const freshSummary = await summaryRes.json();
        setSummary(freshSummary);
      }

      // Use freshRows directly (not stale state) to find scenes that need generation
      const pendingRows = freshRows.filter(
        (r) => !r.breakdown || r.breakdown.status !== "completed"
      );

      if (pendingRows.length === 0) {
        toast.info("All scenes already have completed breakdowns");
        return;
      }

      // Trigger generation with fresh data
      setGeneratingAll(true);
      setGenerateAllProgress(0);
      setGenerateAllTotal(pendingRows.length);
      setGenerateAllCurrent(0);
      setGenerateAllCurrentScene(null);
      setGenerateAllCompleted(0);
      setGenerateAllFailed(0);

      let completed = 0;
      let failed = 0;

      for (let i = 0; i < pendingRows.length; i++) {
        const row = pendingRows[i];
        const sceneLabel = String(row.scene.sceneNumber || `#${row.scene.id}`);

        setGenerateAllCurrent(i + 1);
        setGenerateAllCurrentScene(sceneLabel);
        setGenerateAllProgress(Math.round((i / pendingRows.length) * 100));
        setGeneratingScenes((prev) => new Set(prev).add(row.scene.id));

        setRows((prev) =>
          prev.map((r) =>
            r.scene.id === row.scene.id
              ? {
                  ...r,
                  breakdown: r.breakdown
                    ? { ...r.breakdown, status: "generating" }
                    : ({
                        id: -1,
                        sceneId: row.scene.id,
                        projectId: Number(projectId),
                        status: "generating",
                        pageCount: null,
                        dayOrNight: null,
                        intOrExt: null,
                        estimatedShootHours: null,
                        notes: null,
                        createdAt: "",
                        updatedAt: "",
                        elements: [],
                      } as BreakdownRow["breakdown"]),
                }
              : r
          )
        );

        try {
          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 180_000);

          const res = await fetch("/api/breakdowns/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sceneId: row.scene.id, projectId: Number(projectId) }),
            signal: controller.signal,
          });

          clearTimeout(fetchTimeout);

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ error: `Generation failed: ${res.status}` }));
            throw new Error(errData.error || "Generation failed");
          }

          const { errorMsg, streamFailed } = await readSSEStream(res, 150_000);

          if (streamFailed) {
            const polledRow = await pollForCompletion(row.scene.id, 40, 5000);
            if (!polledRow || polledRow.breakdown?.status !== "completed") {
              throw new Error("Generation did not complete in time");
            }
          } else if (errorMsg) {
            throw new Error(errorMsg);
          }

          await fetchData();
          completed++;
          setGenerateAllCompleted(completed);
        } catch {
          failed++;
          setGenerateAllFailed(failed);
          setRows((prev) =>
            prev.map((r) =>
              r.scene.id === row.scene.id && r.breakdown
                ? { ...r, breakdown: { ...r.breakdown, status: "failed" } }
                : r
            )
          );
        } finally {
          setGeneratingScenes((prev) => {
            const next = new Set(prev);
            next.delete(row.scene.id);
            return next;
          });
        }
      }

      setGenerateAllProgress(100);
      toast.success(`Retry complete: ${completed}/${pendingRows.length} scenes processed`);
      if (failed > 0) {
        toast.error(`${failed} scene(s) failed`);
      }

      // Refresh summary
      try {
        const finalSummaryRes = await fetch(`/api/breakdowns/summary?projectId=${projectId}&_t=${Date.now()}`, { cache: "no-store" });
        setSummary(await finalSummaryRes.json());
      } catch {
        // non-critical
      }

      setGeneratingAll(false);
      setGeneratingScenes(new Set());
    } catch {
      toast.error("Failed to reload breakdown data");
    }
  }

  async function handleExportCSV() {
    try {
      const res = await fetch("/api/breakdowns/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId), format: "csv" }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `breakdown-project-${projectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Failed to export CSV");
    }
  }

  async function handleAddElement() {
    if (!addElementDialog || !newElementName.trim()) return;
    setAddingElement(true);

    try {
      const res = await fetch("/api/breakdowns/elements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          breakdownId: addElementDialog.breakdownId,
          category: newElementCategory,
          name: newElementName.trim(),
          description: newElementDescription.trim() || undefined,
          quantity: Number(newElementQuantity) || 1,
        }),
      });

      if (!res.ok) throw new Error("Failed to add element");
      const element = await res.json();

      // Update local state
      setRows((prev) =>
        prev.map((r) =>
          r.scene.id === addElementDialog.sceneId && r.breakdown
            ? {
                ...r,
                breakdown: {
                  ...r.breakdown,
                  elements: [...r.breakdown.elements, element],
                },
              }
            : r
        )
      );

      toast.success(`Added "${newElementName.trim()}"`);
      setAddElementDialog(null);
      setNewElementName("");
      setNewElementDescription("");
      setNewElementQuantity("1");
      setNewElementCategory("props");
    } catch {
      toast.error("Failed to add element");
    } finally {
      setAddingElement(false);
    }
  }

  async function handleDeleteElement(elementId: number, sceneId: number) {
    try {
      const res = await fetch(`/api/breakdowns/elements/${elementId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete element");

      setRows((prev) =>
        prev.map((r) =>
          r.scene.id === sceneId && r.breakdown
            ? {
                ...r,
                breakdown: {
                  ...r.breakdown,
                  elements: r.breakdown.elements.filter((e) => e.id !== elementId),
                },
              }
            : r
        )
      );

      toast.success("Element removed");
    } catch {
      toast.error("Failed to delete element");
    }
  }

  async function handleDuplicate(sceneId: number) {
    const row = rows.find((r) => r.scene.id === sceneId);
    if (!row?.breakdown || row.breakdown.status !== "completed") return;

    setDuplicatingScenes((prev) => new Set(prev).add(sceneId));

    try {
      const breakdown = row.breakdown;
      const elements = breakdown.elements;

      // Add each element as a custom copy
      const newElements: BreakdownElement[] = [];
      for (const el of elements) {
        const res = await fetch("/api/breakdowns/elements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            breakdownId: breakdown.id,
            category: el.category,
            name: `${el.name} (Copy)`,
            description: el.description || undefined,
            quantity: el.quantity || 1,
          }),
        });
        if (res.ok) {
          const newEl = await res.json();
          newElements.push(newEl);
        }
      }

      // Update local state with the new elements
      setRows((prev) =>
        prev.map((r) =>
          r.scene.id === sceneId && r.breakdown
            ? {
                ...r,
                breakdown: {
                  ...r.breakdown,
                  elements: [...r.breakdown.elements, ...newElements],
                },
              }
            : r
        )
      );

      toast.success("Breakdown duplicated");
    } catch {
      toast.error("Failed to duplicate breakdown");
    } finally {
      setDuplicatingScenes((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }

  function handleExportPrintable() {
    const completedRows = rows.filter((r) => r.breakdown?.status === "completed");
    if (completedRows.length === 0) {
      toast.error("No completed breakdowns to export");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow pop-ups to export");
      return;
    }

    const categoryLabel = (cat: string) => {
      const found = BREAKDOWN_CATEGORIES[cat];
      return found ? found.label : cat.replace(/_/g, " ");
    };

    const tableRows = completedRows.map((r) => {
      const bd = r.breakdown!;
      const elements = bd.elements || [];
      const grouped = elements.reduce<Record<string, string[]>>((acc, el) => {
        if (!acc[el.category]) acc[el.category] = [];
        acc[el.category].push(el.name + (el.quantity && el.quantity > 1 ? ` (x${el.quantity})` : ""));
        return acc;
      }, {});

      const elementsList = Object.entries(grouped)
        .map(([cat, names]) => `<strong>${categoryLabel(cat)}:</strong> ${names.join(", ")}`)
        .join("<br/>");

      return `
        <tr>
          <td>${r.scene.sceneNumber}</td>
          <td>${r.scene.heading || ""}</td>
          <td>${r.scene.location || ""}</td>
          <td>${bd.intOrExt || ""}</td>
          <td>${bd.dayOrNight || ""}</td>
          <td>${r.breakdown?.elements?.length ?? ""}</td>
          <td>${bd.estimatedShootHours ? Math.round(bd.estimatedShootHours * 60) + "s" : ""}</td>
          <td class="elements-cell">${elementsList}</td>
        </tr>
      `;
    }).join("");

    const summaryHtml = summary ? `
      <div class="summary-section">
        <h2>Summary</h2>
        <div class="summary-grid">
          <div><strong>Total Scenes:</strong> ${summary.totalScenes}</div>
          <div><strong>Breakdowns Complete:</strong> ${summary.completedBreakdowns}</div>
          <div><strong>Total AI Assets:</strong> ${Object.values(summary.elementsByCategory).reduce((a: number, b: number) => a + b, 0)}</div>
          <div><strong>Est. Duration:</strong> ${Math.round((summary.totalEstimatedShootHours || summary.totalPageCount) * 60)}s</div>
          <div><strong>Locations:</strong> ${summary.uniqueLocations.length}</div>
          <div><strong>Characters:</strong> ${summary.castList.length}</div>
        </div>
      </div>
    ` : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Production Breakdown Report</title>
        <style>
          @page { size: landscape; margin: 0.5in; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10pt;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 20px;
          }
          h1 { font-size: 18pt; margin-bottom: 4pt; }
          h2 { font-size: 14pt; margin-top: 16pt; margin-bottom: 8pt; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }
          .summary-section { margin-bottom: 24pt; }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            font-size: 10pt;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 4px 6px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f5f5f5;
            font-weight: bold;
            white-space: nowrap;
          }
          tr:nth-child(even) { background: #fafafa; }
          .elements-cell { font-size: 8pt; max-width: 400px; }
          .meta { font-size: 9pt; color: #666; margin-bottom: 12pt; }
          @media print {
            body { margin: 0; padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>Production Breakdown Report</h1>
        <div class="meta">Exported from Young Owls Studio</div>
        ${summaryHtml}
        <h2>Scene Breakdowns</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Scene Heading</th>
              <th>Location</th>
              <th>Int/Ext</th>
              <th>Time</th>
              <th>Assets</th>
              <th>Duration</th>
              <th>Elements</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
    toast.success("Export ready - use Print to save as PDF");
  }

  function getStatusBadge(status: string | undefined) {
    if (!status || status === "pending") {
      return (
        <Badge variant="outline" className="text-[10px] h-5">
          Pending
        </Badge>
      );
    }
    if (status === "generating") {
      return (
        <Badge className="text-[10px] h-5 bg-primary/15 text-primary border-primary/20">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="animate-spin mr-1"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Generating
        </Badge>
      );
    }
    if (status === "completed") {
      return (
        <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mr-1">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Complete
        </Badge>
      );
    }
    if (status === "failed") {
      return (
        <Badge variant="destructive" className="text-[10px] h-5">
          Failed
        </Badge>
      );
    }
    return null;
  }

  // Group elements by category for display
  function groupElementsByCategory(elements: BreakdownElement[]) {
    const groups: Record<string, BreakdownElement[]> = {};
    for (const el of elements) {
      if (!groups[el.category]) groups[el.category] = [];
      groups[el.category].push(el);
    }
    return groups;
  }

  // WOW AUDIT: enhanced loading skeleton to match breakdown layout with summary cards + stripboard rows
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <Skeleton className="h-3 w-full" />
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="px-4 py-3 border-b flex items-center gap-4">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight">
          Production Breakdown
        </h1>
        {/* WOW AUDIT: enhanced empty state with radial gradient background */}
        <Card className="border-dashed border-2 mt-6">
          <CardContent className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 dark:glow-md animate-float flex items-center justify-center mb-4">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground"
              >
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h6" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-1">No scenes to break down</h2>
            <p className="relative text-sm text-muted-foreground text-center max-w-sm">
              Upload and parse a screenplay first, then come back to generate
              production breakdowns.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            AI Video Breakdown
          </h1>
          <p className="text-muted-foreground mt-1">
            Shot planning, image generation list &amp; audio design per scene
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPrintable} disabled={!summary || summary.completedBreakdowns === 0} title="Export breakdown report as printable document">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mr-1.5"
            >
              <path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
              <path d="M10 1v4h4" />
              <path d="M6 9h4M6 12h4" />
            </svg>
            Export Report
          </Button>
          <Button variant="outline" onClick={handleExportCSV} disabled={!summary || summary.completedBreakdowns === 0} title="Download as spreadsheet compatible with Movie Magic, StudioBinder, etc.">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mr-1.5"
            >
              <path d="M8 2v8M8 10L5 7M8 10L11 7" />
              <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
            </svg>
            Export CSV
          </Button>
          {rows.some((r) => r.breakdown?.status === "failed") && (
            <Button
              variant="outline"
              onClick={handleRetryFailed}
              disabled={generatingAll}
              title="Reset all failed breakdowns and retry generation"
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mr-1.5"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
              Retry Failed ({rows.filter((r) => r.breakdown?.status === "failed").length})
            </Button>
          )}
          <Button onClick={() => setConfirmGenerateAll(true)} disabled={generatingAll} title="AI analyzes every scene and lists required production elements: cast, props, wardrobe, vehicles, effects." className="shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300">
            {generatingAll ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-spin mr-1.5"
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                {generateAllCurrent}/{generateAllTotal}
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mr-1.5"
                >
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
                  <circle cx="8" cy="8" r="3" />
                </svg>
                Generate All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Generate-all progress */}
      {generatingAll && (
        <Card className="mb-6 border-primary/20 bg-primary/[0.02] backdrop-blur-sm shadow-[0_0_15px_oklch(0.585_0.233_264/0.08)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                Generating breakdown {generateAllCurrent} of {generateAllTotal}...
              </p>
              <span className="text-xs font-mono text-muted-foreground">
                {generateAllProgress}%
              </span>
            </div>
            <Progress value={generateAllProgress} className="h-2 mb-2" />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {generateAllCurrentScene && (
                  <>
                    Currently processing: <span className="font-medium text-foreground">Scene {generateAllCurrentScene}</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {generateAllCompleted > 0 && (
                  <span className="text-primary">{generateAllCompleted} done</span>
                )}
                {generateAllFailed > 0 && (
                  <span className="text-destructive">{generateAllFailed} failed</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Scenes
              </p>
              <p className="text-2xl font-bold mt-1" style={{ textShadow: '0 0 20px oklch(0.585 0.233 264 / 0.25)' }}>
                {summary.completedBreakdowns}
                <span className="text-sm font-normal text-muted-foreground">
                  /{summary.totalScenes}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">breakdowns done</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                AI Assets
              </p>
              <p className="text-2xl font-bold mt-1" style={{ textShadow: '0 0 20px oklch(0.585 0.233 264 / 0.25)' }}>
                {Object.values(summary.elementsByCategory).reduce((a, b) => a + b, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">images, audio & video clips</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Est. Duration
              </p>
              <p className="text-2xl font-bold mt-1" style={{ textShadow: '0 0 20px oklch(0.585 0.233 264 / 0.25)' }}>
                {summary.totalEstimatedShootHours > 0
                  ? `${Math.round(summary.totalEstimatedShootHours * 60)}s`
                  : `${Math.round(summary.totalPageCount * 60)}s`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">estimated runtime</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Locations & Cast
              </p>
              <p className="text-2xl font-bold mt-1" style={{ textShadow: '0 0 20px oklch(0.585 0.233 264 / 0.25)' }}>
                {summary.uniqueLocations.length}
                <span className="text-sm font-normal text-muted-foreground mx-1">/</span>
                {summary.castList.length}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary.uniqueLocations.length} location{summary.uniqueLocations.length !== 1 ? "s" : ""}
                {" | "}
                {summary.castList.length} character{summary.castList.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stripboard Table */}
      <Card ref={gridRef} role="table" aria-label="Scene breakdown stripboard" className="backdrop-blur-sm bg-card/80 border-border/40">
        <CardContent className="p-0">
          {/* Table Header */}
          <div role="row" className="hidden md:grid grid-cols-[60px_1fr_80px_70px_80px_80px_70px_140px] gap-2 px-4 py-3 border-b bg-muted/30 backdrop-blur-sm text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div role="columnheader">Scene</div>
            <div role="columnheader">Location</div>
            <div role="columnheader">INT/EXT</div>
            <div role="columnheader">Time</div>
            <div role="columnheader">Assets</div>
            <div role="columnheader">Duration</div>
            <div role="columnheader">Status</div>
            <div role="columnheader" className="text-right">Action</div>
          </div>

          {/* Table Rows */}
          {/* PERF: Virtualization candidate — screenplays can have 100+ scenes with expandable
             breakdown details. Consider @tanstack/react-virtual for windowed table rows. */}
          {rows.map((row) => {
            const isExpanded = expandedSceneId === row.scene.id;
            const isGenerating = generatingScenes.has(row.scene.id);
            const breakdown = row.breakdown;
            const elements = breakdown?.elements || [];

            return (
              <div key={row.scene.id} data-breakdown-card data-scene-id={row.scene.id}>
                {/* Main row */}
                {/* Desktop row */}
                <div
                  className={`hidden md:grid grid-cols-[60px_1fr_80px_70px_80px_80px_70px_140px] gap-2 px-4 py-3 border-b items-center text-sm cursor-pointer hover:bg-muted/30 transition-colors ${
                    isExpanded ? "bg-muted/20" : ""
                  }`}
                  onClick={() =>
                    setExpandedSceneId(isExpanded ? null : row.scene.id)
                  }
                >
                  <div className="font-mono font-semibold text-xs">
                    {row.scene.sceneNumber}
                  </div>
                  <div className="truncate text-xs" title={row.scene.heading}>
                    {row.scene.location || row.scene.heading}
                  </div>
                  <div className="text-xs">
                    {breakdown?.intOrExt || row.scene.headingType || "-"}
                  </div>
                  <div className="text-xs">
                    {breakdown?.dayOrNight || row.scene.timeOfDay || "-"}
                  </div>
                  <div className="text-xs font-mono">
                    {breakdown ? (elements.length || "-") : "-"}
                  </div>
                  <div className="text-xs font-mono">
                    {breakdown?.estimatedShootHours != null
                      ? `${Math.round(breakdown.estimatedShootHours * 60)}s`
                      : breakdown?.pageCount != null
                      ? `${Math.round(breakdown.pageCount * 60)}s`
                      : "-"}
                  </div>
                  <div>{getStatusBadge(breakdown?.status)}</div>
                  <div role="group" className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {breakdown?.status === "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-1.5"
                        onClick={() => handleDuplicate(row.scene.id)}
                        disabled={duplicatingScenes.has(row.scene.id)}
                        title="Duplicate breakdown elements"
                        aria-label={`Duplicate breakdown for scene ${row.scene.sceneNumber}`}
                      >
                        {duplicatingScenes.has(row.scene.id) ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </Button>
                    )}
                    {breakdown?.status === "completed" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => handleGenerate(row.scene.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? "..." : "Redo"}
                      </Button>
                    ) : breakdown?.status === "failed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => handleGenerate(row.scene.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                        ) : (
                          "Retry"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3"
                        onClick={() => handleGenerate(row.scene.id)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className="animate-spin"
                          >
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                        ) : (
                          "Generate"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                {/* Mobile card row */}
                <div
                  className={`md:hidden flex items-center justify-between gap-3 px-4 py-3 border-b cursor-pointer hover:bg-muted/30 transition-colors ${
                    isExpanded ? "bg-muted/20" : ""
                  }`}
                  onClick={() =>
                    setExpandedSceneId(isExpanded ? null : row.scene.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-semibold text-xs">{row.scene.sceneNumber}</span>
                      {getStatusBadge(breakdown?.status)}
                    </div>
                    <p className="text-xs truncate text-muted-foreground">{row.scene.location || row.scene.heading}</p>
                  </div>
                  <div role="group" className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {breakdown?.status === "completed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-1.5"
                        onClick={() => handleDuplicate(row.scene.id)}
                        disabled={duplicatingScenes.has(row.scene.id)}
                        aria-label={`Duplicate breakdown for scene ${row.scene.sceneNumber}`}
                      >
                        {duplicatingScenes.has(row.scene.id) ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={breakdown?.status === "completed" ? "ghost" : breakdown?.status === "failed" ? "outline" : "default"}
                      className={`h-7 text-xs px-2 ${breakdown?.status === "failed" ? "border-destructive/30 text-destructive" : ""}`}
                      onClick={() => handleGenerate(row.scene.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? "..." : breakdown?.status === "completed" ? "Redo" : breakdown?.status === "failed" ? "Retry" : "Gen"}
                    </Button>
                  </div>
                </div>

                {/* Expanded detail view — AI Video Production Breakdown */}
                {isExpanded && breakdown?.status === "completed" && (() => {
                  // Parse the JSON result stored in notes
                  let aiBreakdown: {
                    metadata?: { totalImages?: number; totalVideoClips?: number; totalDialogueLines?: number; estimatedComplexity?: string; sceneMood?: string; artDirection?: string; estimatedDurationSeconds?: number };
                    shots?: Array<{ shotNumber: number; shotType: string; description: string; camera: string; durationSeconds: number; purpose: string; character?: string; dialogueLineIndex?: number; imageIds?: string[]; notes?: string }>;
                    images?: Array<{ imageId: string; imageType: string; subject: string; promptSuggestion: string; usedInShots?: number[]; notes?: string }>;
                    dialogueLines?: Array<{ index: number; character: string; line: string; emotion: string; parenthetical?: string }>;
                    audioDesign?: Array<{ audioType: string; description: string; timing?: string }>;
                  } | null = null;
                  try { if (breakdown.notes) aiBreakdown = JSON.parse(breakdown.notes); } catch { /* old format */ }

                  // If we have the new AI breakdown JSON, render the new tabbed layout
                  if (aiBreakdown?.shots) {
                    const imgCount = aiBreakdown.images?.length || 0;
                    const shotCount = aiBreakdown.shots?.length || 0;
                    const dlCount = aiBreakdown.dialogueLines?.length || 0;
                    const adCount = aiBreakdown.audioDesign?.length || 0;

                    const tabs = [
                      { key: "plan" as const, label: "Plan", count: shotCount },
                      { key: "visuals" as const, label: "Visuals", count: imgCount },
                      { key: "voice" as const, label: "Voice", count: dlCount },
                      { key: "audio" as const, label: "Audio", count: adCount },
                    ];

                    return (
                      <div className="px-4 py-4 border-b bg-muted/10 backdrop-blur-sm space-y-4">
                        {/* Summary bar */}
                        <div className="flex flex-wrap items-center gap-2">
                          {aiBreakdown.metadata?.estimatedDurationSeconds && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {Math.round(aiBreakdown.metadata.estimatedDurationSeconds)}s est.
                            </Badge>
                          )}
                          {aiBreakdown.metadata?.estimatedComplexity && (
                            <Badge variant="secondary" className="text-[10px] h-5 capitalize">
                              {aiBreakdown.metadata.estimatedComplexity}
                            </Badge>
                          )}
                          {aiBreakdown.metadata?.sceneMood && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {aiBreakdown.metadata.sceneMood}
                            </Badge>
                          )}
                          <div className="flex-1" />
                          <div className="flex items-center gap-1.5">
                            {[
                              { label: "Img", count: imgCount },
                              { label: "Shots", count: shotCount },
                              { label: "DL", count: dlCount },
                              { label: "SFX", count: adCount },
                            ].map((chip) => (
                              <span key={chip.label} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                <span className="font-semibold text-foreground">{chip.count}</span> {chip.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Art direction toggle */}
                        {(aiBreakdown.metadata?.sceneMood || aiBreakdown.metadata?.artDirection) && (
                          <div>
                            <button
                              onClick={() => setShowArtDirection(!showArtDirection)}
                              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                            >
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showArtDirection ? "rotate-90" : ""}`}>
                                <path d="M6 4l4 4-4 4" />
                              </svg>
                              Art Direction
                            </button>
                            {showArtDirection && (
                              <div className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm p-3 mt-1.5 space-y-1">
                                {aiBreakdown.metadata?.sceneMood && (
                                  <p className="text-xs"><span className="font-semibold">Mood:</span> <span className="text-muted-foreground">{aiBreakdown.metadata.sceneMood}</span></p>
                                )}
                                {aiBreakdown.metadata?.artDirection && (
                                  <p className="text-xs"><span className="font-semibold">Art Direction:</span> <span className="text-muted-foreground">{aiBreakdown.metadata.artDirection}</span></p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tab bar */}
                        <div className="flex gap-1 border-b">
                          {tabs.map((tab) => (
                            <button
                              key={tab.key}
                              onClick={() => setBreakdownTab(tab.key)}
                              className={`px-3 py-2 text-xs font-medium border-b-2 transition-all duration-300 ${
                                breakdownTab === tab.key
                                  ? "border-primary text-foreground"
                                  : "border-transparent text-muted-foreground hover:text-foreground"
                              }`}
                              style={breakdownTab === tab.key ? { textShadow: '0 0 10px oklch(0.585 0.233 264 / 0.3)' } : undefined}
                            >
                              {tab.label} <span className="text-muted-foreground/60 ml-1">{tab.count}</span>
                            </button>
                          ))}
                        </div>

                        {/* Tab: Plan (Shot Sequence) */}
                        {breakdownTab === "plan" && (
                          <div className="space-y-1.5">
                            {(!aiBreakdown.shots || aiBreakdown.shots.length === 0) ? (
                              <p className="text-xs text-muted-foreground py-4 text-center">No shots in this breakdown.</p>
                            ) : (
                              aiBreakdown.shots.map((shot) => {
                                const isShotExpanded = expandedShots.has(shot.shotNumber);
                                return (
                                  <div key={shot.shotNumber} className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm px-3 py-2 hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.06)] transition-all duration-300">
                                    <div
                                      className="flex items-center gap-3 cursor-pointer"
                                      onClick={() => {
                                        setExpandedShots((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(shot.shotNumber)) next.delete(shot.shotNumber);
                                          else next.add(shot.shotNumber);
                                          return next;
                                        });
                                      }}
                                    >
                                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-bold text-primary">{shot.shotNumber}</span>
                                      </div>
                                      <Badge variant="outline" className="text-[9px] h-4 capitalize">{shot.shotType.replace(/_/g, " ")}</Badge>
                                      <span className="text-[10px] text-muted-foreground">{shot.durationSeconds}s</span>
                                      <p className="text-xs truncate flex-1 min-w-0">{shot.description}</p>
                                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${isShotExpanded ? "rotate-90" : ""}`}>
                                        <path d="M6 4l4 4-4 4" />
                                      </svg>
                                    </div>
                                    {isShotExpanded && (
                                      <div className="mt-2 pl-9 space-y-0.5 text-[11px] text-muted-foreground">
                                        <p><span className="font-medium text-foreground">Camera:</span> {shot.camera}</p>
                                        <p><span className="font-medium text-foreground">Purpose:</span> {shot.purpose}</p>
                                        {shot.character && <p><span className="font-medium text-foreground">Character:</span> {shot.character}</p>}
                                        {shot.notes && <p className="italic">{shot.notes}</p>}
                                        {shot.imageIds && shot.imageIds.length > 0 && (
                                          <p><span className="font-medium text-foreground">Images:</span> {shot.imageIds.join(", ")}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {/* Tab: Visuals (Images to Generate) */}
                        {breakdownTab === "visuals" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(!aiBreakdown.images || aiBreakdown.images.length === 0) ? (
                              <p className="text-xs text-muted-foreground py-4 text-center col-span-full">No images in this breakdown.</p>
                            ) : (
                              aiBreakdown.images.map((img) => {
                                const catInfo = BREAKDOWN_CATEGORIES[img.imageType];
                                const isPromptExpanded = expandedImagePrompts.has(img.imageId);
                                return (
                                  <div key={img.imageId} className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm p-3 space-y-2 hover:-translate-y-0.5 hover:shadow-[0_0_12px_oklch(0.585_0.233_264/0.08)] transition-all duration-300">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: catInfo?.color || "#888" }} />
                                      <span className="text-xs font-semibold truncate">{img.subject}</span>
                                      <Badge variant="outline" className="text-[9px] h-4 capitalize ml-auto shrink-0">{img.imageType.replace(/_/g, " ")}</Badge>
                                    </div>
                                    {/* Collapsible prompt */}
                                    <button
                                      onClick={() => {
                                        setExpandedImagePrompts((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(img.imageId)) next.delete(img.imageId);
                                          else next.add(img.imageId);
                                          return next;
                                        });
                                      }}
                                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                    >
                                      <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isPromptExpanded ? "rotate-90" : ""}`}>
                                        <path d="M6 4l4 4-4 4" />
                                      </svg>
                                      {isPromptExpanded ? "Hide prompt" : "Show prompt"}
                                    </button>
                                    {isPromptExpanded && (
                                      <div className="rounded-md bg-muted/50 px-2.5 py-2 text-[11px] font-mono leading-relaxed text-muted-foreground">
                                        {img.promptSuggestion}
                                      </div>
                                    )}
                                    {img.usedInShots && img.usedInShots.length > 0 && (
                                      <p className="text-[10px] text-muted-foreground">Shots: {img.usedInShots.join(", ")}</p>
                                    )}
                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => {
                                          navigator.clipboard.writeText(img.promptSuggestion);
                                          toast.success("Prompt copied to clipboard");
                                        }}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                        Copy Prompt
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[10px] px-2"
                                        asChild
                                      >
                                        <Link href={`/project/${projectId}/generate?prompt=${encodeURIComponent(img.promptSuggestion)}`}>
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                          Open in Image Gen
                                        </Link>
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {/* Tab: Voice (Dialogue Lines) */}
                        {breakdownTab === "voice" && (
                          <div className="space-y-1.5">
                            {(!aiBreakdown.dialogueLines || aiBreakdown.dialogueLines.length === 0) ? (
                              <p className="text-xs text-muted-foreground py-4 text-center">No dialogue lines in this breakdown.</p>
                            ) : (
                              aiBreakdown.dialogueLines.map((dl) => (
                                <div key={dl.index} className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm px-3 py-2 flex items-start gap-3 hover:shadow-[0_0_8px_oklch(0.585_0.233_264/0.06)] transition-all duration-300">
                                  <div className="shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-primary">{dl.character}</span>
                                    <p className="text-[10px] text-muted-foreground">{dl.emotion}{dl.parenthetical ? ` (${dl.parenthetical})` : ""}</p>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs">&ldquo;{dl.line}&rdquo;</p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      title="Copy line"
                                      onClick={() => {
                                        navigator.clipboard.writeText(dl.line);
                                        toast.success("Line copied to clipboard");
                                      }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* Tab: Audio (Audio Design) */}
                        {breakdownTab === "audio" && (
                          <div className="space-y-1.5">
                            {(!aiBreakdown.audioDesign || aiBreakdown.audioDesign.length === 0) ? (
                              <p className="text-xs text-muted-foreground py-4 text-center">No audio design items in this breakdown.</p>
                            ) : (
                              aiBreakdown.audioDesign.map((ad, i) => (
                                <div key={i} className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm px-3 py-2 flex items-start gap-3 hover:shadow-[0_0_8px_oklch(0.715_0.165_195/0.06)] transition-all duration-300">
                                  <Badge variant="outline" className="text-[9px] h-4 capitalize shrink-0 mt-0.5">{ad.audioType}</Badge>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs">{ad.description}</p>
                                    {ad.timing && <p className="text-[10px] text-muted-foreground mt-0.5">{ad.timing}</p>}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      title="Copy description"
                                      onClick={() => {
                                        navigator.clipboard.writeText(ad.description);
                                        toast.success("Description copied to clipboard");
                                      }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      asChild
                                    >
                                      <Link href={`/project/${projectId}/audio-studio?type=${encodeURIComponent(ad.audioType)}`}>
                                        Generate
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Fallback: old-style element grid for legacy breakdowns
                  return (
                    <div className="px-4 py-4 border-b bg-muted/10 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">
                          Scene {row.scene.sceneNumber} — {row.scene.heading}
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setAddElementDialog({
                              open: true,
                              breakdownId: breakdown.id,
                              sceneId: row.scene.id,
                            })
                          }
                        >
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                            <path d="M8 3v10M3 8h10" />
                          </svg>
                          Add Element
                        </Button>
                      </div>
                      {elements.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          No elements found. Click &quot;Generate&quot; to create an AI video breakdown.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(groupElementsByCategory(elements)).map(
                            ([category, catElements]) => {
                              const catInfo = BREAKDOWN_CATEGORIES[category];
                              return (
                                <div key={category} className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm p-3 hover:-translate-y-0.5 hover:shadow-[0_0_12px_oklch(0.585_0.233_264/0.08)] transition-all duration-300" style={{ borderLeftWidth: 3, borderLeftColor: catInfo?.color || '#888' }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: catInfo?.color || "#888" }} />
                                    <span className="text-xs font-semibold">{catInfo?.label || category}</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{catElements.length}</Badge>
                                  </div>
                                  <Separator className="mb-2" />
                                  <div className="space-y-1.5">
                                    {catElements.map((el) => (
                                      <div key={el.id} className="flex items-start gap-2 group/el text-xs">
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium">{el.name}</span>
                                          {el.quantity > 1 && <span className="text-muted-foreground ml-1">x{el.quantity}</span>}
                                          {el.description && <p className="text-muted-foreground text-[11px] mt-0.5 line-clamp-2">{el.description}</p>}
                                        </div>
                                        <button
                                          onClick={() => handleDeleteElement(el.id, row.scene.id)}
                                          className="shrink-0 p-1.5 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover/el:opacity-100 transition-opacity"
                                          title="Remove element"
                                          aria-label={`Remove ${el.name}`}
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Expanded but no breakdown yet */}
                {isExpanded && (!breakdown || breakdown.status !== "completed") && (
                  <div className="px-4 py-8 border-b bg-muted/10 text-center">
                    {breakdown?.status === "generating" ? (
                      <>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="animate-spin mx-auto mb-3 text-primary"
                        >
                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                        <p className="text-sm text-muted-foreground mb-3">
                          Breakdown is being generated...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          This usually takes 30-60 seconds per scene.
                        </p>
                      </>
                    ) : breakdown?.status === "failed" ? (
                      <>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="mx-auto mb-3 text-destructive"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                        <p className="text-sm font-medium text-destructive mb-1">
                          Breakdown generation failed
                        </p>
                        {breakdown.notes && (
                          <p className="text-xs text-muted-foreground mb-3 max-w-md mx-auto">
                            {breakdown.notes}
                          </p>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleGenerate(row.scene.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? "Retrying..." : "Retry Generation"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">
                          No breakdown generated yet for this scene.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleGenerate(row.scene.id)}
                          disabled={isGenerating}
                        >
                          {isGenerating ? "Generating..." : "Generate Breakdown"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add Element Dialog */}
      <Dialog
        open={addElementDialog?.open ?? false}
        onOpenChange={(open) => {
          if (!open) setAddElementDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Production Element</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* UX AUDIT FIX: added htmlFor to Labels and id to inputs for accessibility */}
            <div className="space-y-2">
              <Label htmlFor="element-category">Category</Label>
              <Select value={newElementCategory} onValueChange={setNewElementCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BREAKDOWN_CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-name">Name</Label>
              <Input
                id="element-name"
                value={newElementName}
                onChange={(e) => setNewElementName(e.target.value)}
                placeholder="e.g. Revolver, Red Dress, Police Car"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddElement()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-description">Description (optional)</Label>
              <Input
                id="element-description"
                value={newElementDescription}
                onChange={(e) => setNewElementDescription(e.target.value)}
                placeholder="Additional details..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="element-quantity">Quantity</Label>
              <Input
                id="element-quantity"
                type="number"
                min="1"
                value={newElementQuantity}
                onChange={(e) => setNewElementQuantity(e.target.value)}
                className="w-24"
              />
            </div>

            <Button
              onClick={handleAddElement}
              disabled={addingElement || !newElementName.trim()}
              className="w-full"
            >
              {addingElement ? "Adding..." : "Add Element"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmGenerateAll}
        onOpenChange={setConfirmGenerateAll}
        title="Generate All Breakdowns?"
        description="This will generate breakdowns for all scenes without one. This may take a while for large scripts."
        confirmLabel="Generate All"
        variant="default"
        onConfirm={handleGenerateAll}
      />
    </div>
  );
}
