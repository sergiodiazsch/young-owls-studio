"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SnippetPicker } from "@/components/snippet-picker";
import { toast } from "sonner";
import type { SceneModificationOption, ParsedElement } from "@/lib/types";

interface SceneModifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sceneId: string;
  projectId: string;
  onApplied: () => void;
}

export function SceneModifyDialog({ open, onOpenChange, sceneId, projectId, onApplied }: SceneModifyDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<SceneModificationOption[]>([]);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setOptions([]);

    try {
      const res = await fetch(`/api/scenes/${sceneId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOptions(data.options);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate modifications");
    }
    setGenerating(false);
  }

  async function handleApply(option: SceneModificationOption) {
    setApplying(true);
    try {
      await fetch(`/api/scenes/${sceneId}/apply-modification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements: option.elements, synopsis: option.synopsis }),
      });
      toast.success("Scene updated");
      onOpenChange(false);
      onApplied();
    } catch {
      toast.error("Failed to apply modification");
    }
    setApplying(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modify Scene with AI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Modification prompt</span>
              <SnippetPicker
                projectId={projectId}
                onInsert={(text) => setPrompt((prev) => prev + text)}
              />
            </div>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Make this scene more tense and add dramatic pauses..."
              rows={3}
            />
            <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
              {generating ? "Generating..." : "Generate 3 Options"}
            </Button>
          </div>

          {options.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              {options.map((opt, i) => (
                <Card key={i} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{opt.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">{opt.synopsis}</p>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
                      {opt.elements.map((el, j) => (
                        <ElementPreview key={j} element={el} />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => handleApply(opt)}
                      disabled={applying}
                    >
                      Use This
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {options.length > 0 && (
            <Button variant="outline" onClick={handleGenerate} disabled={generating}>
              Regenerate
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ElementPreview({ element }: { element: ParsedElement }) {
  if (element.type === "dialogue") {
    return (
      <div>
        <p className="font-bold text-[10px] tracking-wider">{element.character}</p>
        {element.parenthetical && <p className="italic text-muted-foreground text-[10px]">{element.parenthetical}</p>}
        <p>{element.line}</p>
      </div>
    );
  }
  return (
    <div>
      {element.type !== "action" && (
        <Badge variant="outline" className="text-[8px] mb-0.5">{element.type.toUpperCase()}</Badge>
      )}
      <p className={element.type === "action" ? "text-muted-foreground" : ""}>{element.content}</p>
    </div>
  );
}
