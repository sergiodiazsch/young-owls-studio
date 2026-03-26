"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SnippetPicker } from "@/components/snippet-picker";
import { toast } from "sonner";
import type { SceneModificationOption, ParsedElement } from "@/lib/types";

/* ── Quick presets ── */
const PRESETS = [
  { label: "More tense", prompt: "Make this scene more tense and suspenseful — add dramatic pauses, sharper dialogue, and raise the emotional stakes" },
  { label: "Shorten dialogue", prompt: "Shorten all dialogue lines — make every line punchy, remove filler words, keep only what advances the story" },
  { label: "Add humor", prompt: "Add moments of humor and levity — physical comedy, witty lines, or comedic timing while preserving the scene's purpose" },
  { label: "Adapt for kids", prompt: "Adapt for a children's audience (ages 2-8) — simplify dialogue, make emotions explicit, add energy and fun, shorter sentences" },
  { label: "Dramatic pauses", prompt: "Add dramatic pauses, meaningful silences, and slower pacing at key emotional moments" },
  { label: "More action", prompt: "Add more physical action and movement — characters should be doing things, not just talking" },
  { label: "Simplify", prompt: "Simplify the scene — fewer lines, clearer motivation, more direct conflict" },
];

interface SceneModifyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneId: string;
  projectId: string;
  /** Original elements from the scene for diff display */
  originalElements: Array<{ _kind: "dialogue" | "direction"; character?: string; parenthetical?: string; line?: string; type?: string; content?: string; sortOrder: number }>;
  onApplied: () => void;
}

export function SceneModifyPanel({ open, onOpenChange, sceneId, projectId, originalElements, onApplied }: SceneModifyPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<SceneModificationOption | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showDiff, setShowDiff] = useState(true);

  /* Format original elements into readable lines */
  const originalLines = useMemo(() => {
    return originalElements.map((el) => {
      if (el._kind === "dialogue") {
        const parts: string[] = [];
        if (el.character) parts.push(el.character);
        if (el.parenthetical) parts.push(el.parenthetical);
        if (el.line) parts.push(el.line);
        return { text: parts.join("\n"), kind: "dialogue" as const, character: el.character };
      }
      return { text: `[${(el.type || "action").toUpperCase()}] ${el.content || ""}`, kind: "direction" as const };
    });
  }, [originalElements]);

  async function handleGenerate(customPrompt?: string) {
    const p = customPrompt || prompt;
    if (!p.trim()) return;
    setPrompt(p);
    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch(`/api/scenes/${sceneId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      // Take the moderate option (index 1) or the first available
      const chosen = data.options?.[1] || data.options?.[0];
      if (!chosen) throw new Error("No modifications generated");
      setResult(chosen);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate modification");
    }
    setGenerating(false);
  }

  async function handleApply() {
    if (!result) return;
    setApplying(true);
    try {
      // Auto-save version before applying
      await fetch("/api/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          label: `Before AI modification`,
          triggerDetail: `Auto-saved before: "${prompt.slice(0, 60)}${prompt.length > 60 ? "..." : ""}"`,
        }),
      });

      await fetch(`/api/scenes/${sceneId}/apply-modification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements: result.elements, synopsis: result.synopsis }),
      });
      toast.success("Scene updated — version saved");
      setResult(null);
      setPrompt("");
      onOpenChange(false);
      onApplied();
    } catch {
      toast.error("Failed to apply modification");
    }
    setApplying(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0">
        <div className="p-6 pb-4 border-b border-border">
          <SheetHeader>
            <SheetTitle className="text-base">Modify with AI</SheetTitle>
          </SheetHeader>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleGenerate(preset.prompt)}
                disabled={generating}
                className="px-2.5 py-1 rounded-full border border-border bg-muted/50 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom prompt */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Or describe what you want</span>
              <SnippetPicker
                projectId={projectId}
                onInsert={(text) => setPrompt((prev) => prev + text)}
              />
            </div>
            <div className="flex gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. The character should be more hesitant, add a long pause before the revelation..."
                rows={2}
                className="text-sm resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
              <Button
                onClick={() => handleGenerate()}
                disabled={generating || !prompt.trim()}
                className="shrink-0 self-end"
                size="sm"
              >
                {generating ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Generating
                  </span>
                ) : "Generate"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Cmd+Enter to generate</p>
          </div>
        </div>

        {/* Generating state */}
        {generating && (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Rewriting your scene...</p>
            <p className="text-[10px] text-muted-foreground">This takes 10-20 seconds</p>
          </div>
        )}

        {/* Result */}
        {result && !generating && (
          <div className="p-6 space-y-4">
            {/* Synopsis */}
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">What changed</p>
              <p className="text-sm text-foreground">{result.synopsis}</p>
            </div>

            {/* View toggle */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1 p-0.5 bg-muted/60 rounded-lg">
                <button
                  onClick={() => setShowDiff(true)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${showDiff ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Before / After
                </button>
                <button
                  onClick={() => setShowDiff(false)}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${!showDiff ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  New version only
                </button>
              </div>
              <Badge variant="outline" className="text-[10px]">{result.label}</Badge>
            </div>

            {/* Diff view */}
            {showDiff ? (
              <div className="grid grid-cols-2 gap-3">
                {/* Original */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Original</p>
                  <div className="rounded-lg border border-border bg-card p-3 space-y-2 max-h-[50vh] overflow-y-auto">
                    {originalLines.map((line, i) => (
                      <div key={i} className={`text-xs leading-relaxed ${line.kind === "dialogue" ? "" : "text-muted-foreground italic"}`}>
                        {line.kind === "dialogue" && line.character && (
                          <p className="font-bold text-[10px] tracking-wider text-primary/70 mb-0.5">{line.character}</p>
                        )}
                        <p className="whitespace-pre-wrap">{line.kind === "dialogue" ? line.text.split("\n").slice(line.character ? 1 : 0).join("\n") : line.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modified */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-primary uppercase tracking-wider mb-2">Modified</p>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 max-h-[50vh] overflow-y-auto">
                    {result.elements.map((el, i) => (
                      <ModifiedElement key={i} element={el} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* New version only */
              <div className="rounded-lg border border-border bg-card p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
                {result.elements.map((el, i) => (
                  <ModifiedElement key={i} element={el} />
                ))}
              </div>
            )}

            {/* Action buttons */}
            <Separator />
            <div className="flex items-center gap-2">
              <Button onClick={handleApply} disabled={applying} className="flex-1">
                {applying ? "Applying..." : "Apply changes"}
              </Button>
              <Button variant="outline" onClick={() => handleGenerate()} disabled={generating} className="shrink-0">
                Try another
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setResult(null); }}
                className="shrink-0 text-muted-foreground"
              >
                Discard
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">A version snapshot is saved automatically before applying</p>
          </div>
        )}

        {/* Empty state */}
        {!result && !generating && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Pick a preset or describe how you want to modify the scene</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── Element renderer for modified content ── */
function ModifiedElement({ element }: { element: ParsedElement }) {
  if (element.type === "dialogue") {
    return (
      <div className="text-xs leading-relaxed">
        <p className="font-bold text-[10px] tracking-wider text-primary/70 mb-0.5">{element.character}</p>
        {element.parenthetical && <p className="italic text-muted-foreground text-[10px]">{element.parenthetical}</p>}
        <p>{element.line}</p>
      </div>
    );
  }
  return (
    <div className="text-xs leading-relaxed">
      {element.type !== "action" && (
        <Badge variant="outline" className="text-[8px] mb-0.5 mr-1">{element.type.toUpperCase()}</Badge>
      )}
      <p className={element.type === "action" ? "text-muted-foreground italic" : ""}>{element.content}</p>
    </div>
  );
}
