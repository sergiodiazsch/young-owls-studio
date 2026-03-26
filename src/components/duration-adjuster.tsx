"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";

interface SceneOption {
  id: string;
  label: string;
  action: "remove" | "merge" | "split" | "add";
  description: string;
  impactMinutes: number;
  affectedScenes: number[];
  riskLevel: "low" | "medium" | "high";
  preservesKeyMoments?: boolean;
}

interface DialogueChange {
  type: string;
  character?: string;
  originalLine?: string;
  suggestedLine?: string;
  description: string;
}

interface DialogueOption {
  id: string;
  label: string;
  description: string;
  impactMinutes: number;
  strategy: string;
  details?: Array<{
    sceneNumber: number;
    changes: DialogueChange[];
  }>;
}

interface AdjustmentResult {
  currentDurationMinutes: number;
  targetDurationMinutes: number;
  sceneOptions: SceneOption[];
  dialogueOptions: DialogueOption[];
  recommendation: string;
}

const RISK_COLORS = {
  low: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
};

const ACTION_LABELS = {
  remove: "Remove",
  merge: "Merge",
  split: "Split",
  add: "Add",
};

export function DurationAdjuster({
  projectId,
  currentDurationMinutes,
  onApplied,
}: {
  projectId: string;
  currentDurationMinutes: number;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Default to 1 minute less than current (or 7 if no data) so the button isn't disabled
  const [target, setTarget] = useState(
    currentDurationMinutes > 1 ? Math.round(currentDurationMinutes) - 1 : 7
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdjustmentResult | null>(null);
  const [selectedScene, setSelectedScene] = useState<Set<string>>(new Set());
  const [selectedDialogue, setSelectedDialogue] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [expandedDialogue, setExpandedDialogue] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setSelectedScene(new Set());
    setSelectedDialogue(new Set());
    try {
      const res = await fetch("/api/screenplay/adjust-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetDurationMinutes: target }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Analysis failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }, [projectId, target]);

  const toggleSceneOption = (id: string) => {
    setSelectedScene((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDialogueOption = (id: string) => {
    setSelectedDialogue((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalImpact = (() => {
    if (!result) return 0;
    let impact = 0;
    for (const opt of result.sceneOptions) {
      if (selectedScene.has(opt.id)) impact += opt.impactMinutes;
    }
    for (const opt of result.dialogueOptions) {
      if (selectedDialogue.has(opt.id)) impact += opt.impactMinutes;
    }
    return impact;
  })();

  const projectedDuration = currentDurationMinutes + totalImpact;

  const handleApply = useCallback(async () => {
    if (selectedScene.size === 0 && selectedDialogue.size === 0) {
      toast.error("Select at least one option to apply");
      return;
    }
    setApplying(true);
    try {
      // First save a version
      const versionRes = await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          label: `Before duration adjustment (${Math.round(currentDurationMinutes)}min → ${target}min)`,
          triggerType: "manual_save",
          triggerDetail: "Auto-saved before duration adjustment",
        }),
      });
      if (!versionRes.ok) throw new Error("Failed to save version");

      toast.success("Version saved. Duration adjustment options noted — apply changes manually in the scene editor for full control.");
      onApplied?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }, [projectId, currentDurationMinutes, target, selectedScene, selectedDialogue, onApplied]);

  const diff = target - Math.round(currentDurationMinutes);
  const diffLabel = diff > 0 ? `+${diff} min` : `${diff} min`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Adjust Duration
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">Duration Adjuster</SheetTitle>
          <p className="text-sm text-muted-foreground">
            AI-powered screenplay length adjustment
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Current vs Target */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-muted/30 border-border/40">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current</p>
                <p className="text-2xl font-bold mt-0.5">{Math.round(currentDurationMinutes)}</p>
                <p className="text-[10px] text-muted-foreground">minutes</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Target</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value) || 1)}
                    className="w-16 h-9 text-center text-xl font-bold border-none bg-transparent p-0"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">minutes</p>
              </CardContent>
            </Card>
          </div>

          {diff !== 0 && (
            <div className="text-center">
              <Badge variant="outline" className={diff < 0 ? "text-red-500 border-red-500/20" : "text-green-500 border-green-500/20"}>
                {diff < 0 ? "Shorten" : "Lengthen"} by {Math.abs(diff)} min ({diffLabel})
              </Badge>
            </div>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={loading || target <= 0}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Analyzing screenplay...
              </span>
            ) : (
              `Analyze & Suggest (${diff < 0 ? "shorten" : "lengthen"})`
            )}
          </Button>

          {/* Results */}
          {result && (
            <div className="space-y-5">
              {/* AI Recommendation */}
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary mt-0.5 shrink-0">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-primary">AI Recommendation</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{result.recommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scene-Level Options */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Scene-Level Options
                </Label>
                <p className="text-[10px] text-muted-foreground mb-2">Select which scenes to modify</p>
                <div className="space-y-2">
                  {result.sceneOptions.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => toggleSceneOption(opt.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-all duration-200 ${
                        selectedScene.has(opt.id)
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/40 hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {ACTION_LABELS[opt.action]}
                          </Badge>
                          <span className="text-sm font-medium">{opt.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] px-1.5 py-0 border ${RISK_COLORS[opt.riskLevel]}`}>
                            {opt.riskLevel} risk
                          </Badge>
                          <span className={`text-xs font-mono font-bold ${opt.impactMinutes < 0 ? "text-red-500" : "text-green-500"}`}>
                            {opt.impactMinutes > 0 ? "+" : ""}{opt.impactMinutes.toFixed(1)}m
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
                      <div className="flex gap-1 mt-1.5">
                        {opt.affectedScenes.map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Sc. {s}
                          </span>
                        ))}
                        {opt.preservesKeyMoments && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600">
                            preserves key moments
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dialogue-Level Options */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dialogue-Level Options
                </Label>
                <p className="text-[10px] text-muted-foreground mb-2">Adjust dialogue across scenes</p>
                <div className="space-y-2">
                  {result.dialogueOptions.map((opt) => (
                    <div key={opt.id}>
                      <button
                        onClick={() => toggleDialogueOption(opt.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-all duration-200 ${
                          selectedDialogue.has(opt.id)
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/40 hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{opt.label}</span>
                          <span className={`text-xs font-mono font-bold ${opt.impactMinutes < 0 ? "text-red-500" : "text-green-500"}`}>
                            {opt.impactMinutes > 0 ? "+" : ""}{opt.impactMinutes.toFixed(1)}m
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
                      </button>
                      {selectedDialogue.has(opt.id) && opt.details && opt.details.length > 0 && (
                        <button
                          onClick={() => setExpandedDialogue(expandedDialogue === opt.id ? null : opt.id)}
                          className="w-full text-left mt-1 px-3 py-1.5 text-[10px] text-primary hover:underline"
                        >
                          {expandedDialogue === opt.id ? "Hide details" : `Show ${opt.details.length} scene changes`}
                        </button>
                      )}
                      {expandedDialogue === opt.id && opt.details && (
                        <div className="ml-3 mt-1 space-y-2 border-l-2 border-primary/20 pl-3">
                          {opt.details.map((d) => (
                            <div key={d.sceneNumber} className="text-xs">
                              <p className="font-medium text-muted-foreground mb-1">Scene {d.sceneNumber}</p>
                              {d.changes.map((c, ci) => (
                                <div key={ci} className="mb-1.5 rounded bg-muted/30 p-2">
                                  <p className="text-muted-foreground">{c.description}</p>
                                  {c.originalLine && (
                                    <p className="mt-1 line-through text-red-400/70 text-[11px]">
                                      {c.character && <span className="font-semibold">{c.character}: </span>}
                                      {c.originalLine}
                                    </p>
                                  )}
                                  {c.suggestedLine && (
                                    <p className="text-green-400/70 text-[11px]">
                                      {c.character && <span className="font-semibold">{c.character}: </span>}
                                      {c.suggestedLine}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary & Apply */}
              {(selectedScene.size > 0 || selectedDialogue.size > 0) && (
                <Card className="border-border/40 bg-card/80">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Projected duration</span>
                      <span className="text-lg font-bold">
                        {projectedDuration.toFixed(1)} min
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          Math.abs(projectedDuration - target) < 0.5
                            ? "bg-green-500"
                            : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, (projectedDuration / Math.max(currentDurationMinutes, target)) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{selectedScene.size + selectedDialogue.size} options selected</span>
                      <span className={`font-mono ${totalImpact < 0 ? "text-red-500" : "text-green-500"}`}>
                        {totalImpact > 0 ? "+" : ""}{totalImpact.toFixed(1)} min impact
                      </span>
                    </div>
                    <Button
                      onClick={handleApply}
                      disabled={applying}
                      className="w-full"
                    >
                      {applying ? "Saving version..." : "Save Version & Review Changes"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      A version will be saved before any changes. You can always revert from Versions.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ══════════════════════════════════════════════════════════════
   Scene-level Duration Adjuster
   ══════════════════════════════════════════════════════════════ */

interface SceneAdjustOption {
  id: string;
  label: string;
  strategy: string;
  description: string;
  impactSeconds: number;
  riskLevel: "low" | "medium" | "high";
  changes?: Array<{
    type: string;
    character?: string;
    originalLine?: string;
    suggestedLine?: string;
    description: string;
  }>;
}

interface SceneAdjustResult {
  currentDurationSeconds: number;
  targetDurationSeconds: number;
  options: SceneAdjustOption[];
  recommendation: string;
}

export function SceneDurationAdjuster({
  projectId,
  sceneId,
  sceneNumber,
  estimatedDurationSeconds,
  onApplied,
}: {
  projectId: string;
  sceneId: number;
  sceneNumber: number;
  estimatedDurationSeconds: number;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetSec, setTargetSec] = useState(
    estimatedDurationSeconds > 10 ? Math.round(estimatedDurationSeconds * 0.7) : 30
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SceneAdjustResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedOpt, setExpandedOpt] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const handleAnalyze = useCallback(async (sec?: number) => {
    const t = sec ?? targetSec;
    setTargetSec(t);
    setLoading(true);
    setResult(null);
    setSelected(new Set());
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout
      const res = await fetch("/api/screenplay/adjust-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, sceneId, targetDurationSeconds: t }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 504 || res.status === 502) {
          throw new Error("The server timed out — try again, it sometimes needs a second attempt");
        }
        throw new Error(data.error || "Analysis failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Request timed out — try again");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to analyze scene");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, sceneId, targetSec]);

  const toggleOption = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalImpact = (() => {
    if (!result) return 0;
    let impact = 0;
    for (const opt of result.options) {
      if (selected.has(opt.id)) impact += opt.impactSeconds;
    }
    return impact;
  })();

  const projectedSec = estimatedDurationSeconds + totalImpact;
  const estSec = Math.round(estimatedDurationSeconds);

  const handleApply = useCallback(async () => {
    if (!result || selected.size === 0) return;
    setApplying(true);
    try {
      // 1. Save version backup
      await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          label: `Before scene ${sceneNumber} duration adjustment`,
          triggerDetail: `Auto-saved before adjusting scene ${sceneNumber} from ${estSec}s to ${targetSec}s`,
        }),
      });

      // 2. Build a modification prompt from selected options
      const selectedOpts = result.options.filter((o) => selected.has(o.id));
      const modPrompt = `Adjust this scene's duration from ~${estSec} seconds to ~${targetSec} seconds by applying these specific changes:\n\n${selectedOpts.map((o, i) => {
        let detail = `${i + 1}. ${o.label}: ${o.description}`;
        if (o.changes && o.changes.length > 0) {
          for (const c of o.changes) {
            if (c.originalLine && c.suggestedLine) {
              detail += `\n   - Change "${c.originalLine}" to "${c.suggestedLine}"`;
            } else {
              detail += `\n   - ${c.description}`;
            }
          }
        }
        return detail;
      }).join("\n\n")}\n\nApply ALL of these changes. Keep the scene's core purpose intact.`;

      // 3. Use scene modify API to rewrite the scene
      const modRes = await fetch(`/api/scenes/${sceneId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: modPrompt }),
      });
      const modData = await modRes.json();
      if (modData.error) throw new Error(modData.error);

      // Pick the moderate option (index 1) or first available
      const option = modData.options?.[1] || modData.options?.[0];
      if (!option) throw new Error("No modification generated");

      // 4. Apply the modification
      const applyRes = await fetch(`/api/scenes/${sceneId}/apply-modification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements: option.elements, synopsis: option.synopsis }),
      });
      if (!applyRes.ok) throw new Error("Failed to apply changes");

      // 5. Regenerate breakdown for this scene
      await fetch("/api/breakdowns/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, projectId: Number(projectId) }),
      }).catch(() => { /* best effort — breakdown regen is async */ });

      toast.success("Scene updated and breakdown regenerating");
      setResult(null);
      setSelected(new Set());
      setOpen(false);
      onApplied?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  }, [projectId, sceneId, sceneNumber, estSec, targetSec, result, selected, onApplied]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground hover:text-foreground">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Adjust
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="p-6 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-base">Scene {sceneNumber} — {estSec}s</SheetTitle>
          </SheetHeader>

          {/* Step 1: Pick a target — one click to analyze */}
          <p className="text-xs text-muted-foreground mt-3 mb-2">How long should this scene be?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: `${Math.round(estSec * 0.5)}s`, sub: "Half", value: Math.round(estSec * 0.5) },
              { label: `${Math.round(estSec * 0.7)}s`, sub: "Shorter", value: Math.round(estSec * 0.7) },
              { label: "30s", sub: "30 sec", value: 30 },
              { label: "60s", sub: "1 min", value: 60 },
              { label: "90s", sub: "1.5 min", value: 90 },
              { label: `${Math.round(estSec * 1.5)}s`, sub: "Longer", value: Math.round(estSec * 1.5) },
            ].map((qt) => (
              <button
                key={qt.sub}
                onClick={() => handleAnalyze(qt.value)}
                disabled={loading}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-border p-2.5 text-center transition-all hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-bold text-foreground">{qt.label}</span>
                <span className="text-[10px] text-muted-foreground">{qt.sub}</span>
              </button>
            ))}
          </div>

          {/* Custom target */}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Custom:</span>
            <Input
              type="number"
              min={5}
              max={600}
              value={targetSec}
              onChange={(e) => setTargetSec(Number(e.target.value) || 5)}
              className="w-20 h-7 text-xs text-center"
            />
            <span className="text-xs text-muted-foreground">sec</span>
            <Button onClick={() => handleAnalyze()} disabled={loading || targetSec <= 0} size="sm" className="h-7 text-xs ml-auto">
              {loading ? "Analyzing..." : "Go"}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing scene...</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="p-6 space-y-4">
            {/* Recommendation */}
            <div className="bg-primary/5 rounded-lg border border-primary/20 p-3">
              <p className="text-xs font-semibold text-primary mb-1">AI Recommendation</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{result.recommendation}</p>
            </div>

            {/* Options — select which to apply */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Select changes to apply:</p>
              <div className="space-y-2">
                {result.options.map((opt) => {
                  const isSelected = selected.has(opt.id);
                  return (
                    <div key={opt.id}>
                      <button
                        onClick={() => toggleOption(opt.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-all duration-200 ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {/* Checkbox indicator */}
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="3">
                                <path d="M3 8l3 3 7-7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs font-medium flex-1">{opt.label}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 border ${RISK_COLORS[opt.riskLevel]}`}>
                            {opt.riskLevel}
                          </Badge>
                          <span className={`text-xs font-mono font-bold ${opt.impactSeconds < 0 ? "text-red-500" : "text-green-500"}`}>
                            {opt.impactSeconds > 0 ? "+" : ""}{opt.impactSeconds}s
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed ml-6">{opt.description}</p>
                      </button>
                      {/* Details */}
                      {isSelected && opt.changes && opt.changes.length > 0 && (
                        <>
                          <button
                            onClick={() => setExpandedOpt(expandedOpt === opt.id ? null : opt.id)}
                            className="w-full text-left mt-1 px-3 py-1 text-[10px] text-primary hover:underline"
                          >
                            {expandedOpt === opt.id ? "Hide details" : `Show ${opt.changes.length} line changes`}
                          </button>
                          {expandedOpt === opt.id && (
                            <div className="ml-6 mt-1 space-y-1.5 border-l-2 border-primary/20 pl-3">
                              {opt.changes.map((c, ci) => (
                                <div key={ci} className="rounded bg-muted/30 p-2 text-[11px]">
                                  <p className="text-muted-foreground">{c.description}</p>
                                  {c.originalLine && (
                                    <p className="mt-1 line-through text-red-400/70">
                                      {c.character && <span className="font-semibold">{c.character}: </span>}
                                      {c.originalLine}
                                    </p>
                                  )}
                                  {c.suggestedLine && (
                                    <p className="text-green-400/70">
                                      {c.character && <span className="font-semibold">{c.character}: </span>}
                                      {c.suggestedLine}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Apply bar — always visible when options selected */}
            {selected.size > 0 && (
              <div className="sticky bottom-0 bg-card border-t border-border -mx-6 px-6 py-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{selected.size} selected</span>
                  <span className="font-mono font-bold">
                    {estSec}s <span className="text-muted-foreground mx-1">&rarr;</span> {Math.round(projectedSec)}s
                    <span className={`ml-1.5 ${totalImpact < 0 ? "text-red-500" : "text-green-500"}`}>
                      ({totalImpact > 0 ? "+" : ""}{totalImpact}s)
                    </span>
                  </span>
                </div>
                <Button onClick={handleApply} disabled={applying} className="w-full">
                  {applying ? "Saving..." : "Save version & apply to scene"}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Saves a backup, then open the scene to edit with these suggestions
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="p-12 text-center">
            <p className="text-xs text-muted-foreground">Pick a target duration above to get AI suggestions</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
