"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { Dialogue, VoiceGeneration } from "@/lib/types";

// ── ElevenLabs v3 Audio Tags ──
// Tags can be placed ANYWHERE in text. Organized by category.

interface TagCategory {
  label: string;
  tags: Array<{ label: string; tag: string }>;
}

const V3_TAG_CATEGORIES: TagCategory[] = [
  {
    label: "Emotions",
    tags: [
      { label: "Happy", tag: "[happy]" },
      { label: "Sad", tag: "[sad]" },
      { label: "Angry", tag: "[angry]" },
      { label: "Excited", tag: "[excited]" },
      { label: "Curious", tag: "[curious]" },
      { label: "Surprised", tag: "[surprised]" },
      { label: "Annoyed", tag: "[annoyed]" },
      { label: "Appalled", tag: "[appalled]" },
      { label: "Thoughtful", tag: "[thoughtful]" },
      { label: "Sympathetic", tag: "[sympathetic]" },
      { label: "Reassuring", tag: "[reassuring]" },
      { label: "Warmly", tag: "[warmly]" },
      { label: "Sheepishly", tag: "[sheepishly]" },
    ],
  },
  {
    label: "Delivery",
    tags: [
      { label: "Whispers", tag: "[whispers]" },
      { label: "Shouting", tag: "[shouting]" },
      { label: "Sarcastic", tag: "[sarcastic]" },
      { label: "Dramatically", tag: "[dramatically]" },
      { label: "Mischievously", tag: "[mischievously]" },
      { label: "Professional", tag: "[professional]" },
      { label: "Questioning", tag: "[questioning]" },
      { label: "Muttering", tag: "[muttering]" },
      { label: "Impressively", tag: "[impressively]" },
    ],
  },
  {
    label: "Sounds",
    tags: [
      { label: "Laughs", tag: "[laughs]" },
      { label: "Chuckles", tag: "[chuckles]" },
      { label: "Sighs", tag: "[sighs]" },
      { label: "Gasps", tag: "[gasps]" },
      { label: "Cries", tag: "[crying]" },
      { label: "Snorts", tag: "[snorts]" },
      { label: "Clears throat", tag: "[clears throat]" },
      { label: "Exhales", tag: "[exhales]" },
      { label: "Inhales", tag: "[inhales deeply]" },
      { label: "Swallows", tag: "[swallows]" },
      { label: "Stifling laugh", tag: "[stifling laughter]" },
    ],
  },
  {
    label: "Pace",
    tags: [
      { label: "Pause", tag: "[pause]" },
      { label: "Short pause", tag: "[short pause]" },
      { label: "Long pause", tag: "[long pause]" },
      { label: "Slowly", tag: "[slowly]" },
      { label: "Quickly", tag: "[quickly]" },
    ],
  },
  {
    label: "Effects",
    tags: [
      { label: "Sings", tag: "[sings]" },
      { label: "Gunshot", tag: "[gunshot]" },
      { label: "Explosion", tag: "[explosion]" },
      { label: "Applause", tag: "[applause]" },
      { label: "Clapping", tag: "[clapping]" },
    ],
  },
  {
    label: "Accents",
    tags: [
      { label: "French", tag: "[French accent]" },
      { label: "British", tag: "[British accent]" },
      { label: "Southern US", tag: "[Southern accent]" },
      { label: "Italian", tag: "[Italian accent]" },
      { label: "Pirate", tag: "[pirate voice]" },
    ],
  },
  {
    label: "Genre",
    tags: [
      { label: "Film Noir", tag: "[classic film noir]" },
      { label: "Fantasy", tag: "[fantasy narrator]" },
      { label: "Sci-Fi AI", tag: "[sci-fi AI voice]" },
    ],
  },
];

const PADDING_OPTIONS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

interface DialogueVoicePanelProps {
  dialogue: Dialogue;
  projectId: string;
  sceneId: string;
  voiceId?: string | null;
  generations: VoiceGeneration[];
  onRefresh: () => void;
}

export function DialogueVoicePanel({
  dialogue,
  projectId,
  sceneId,
  voiceId,
  generations,
  onRefresh,
}: DialogueVoicePanelProps) {
  const [text, setText] = useState(dialogue.line);
  const [generating, setGenerating] = useState(false);
  const [paddingStart, setPaddingStart] = useState(0);
  const [paddingEnd, setPaddingEnd] = useState(0);
  const [padding, setPadding] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dialogueGens = generations.filter((g) => g.dialogueId === dialogue.id);
  const selectedGen = dialogueGens.find((g) => g.selected);

  // Load existing padding values when selected generation changes
  useEffect(() => {
    if (selectedGen) {
      setPaddingStart(selectedGen.paddingStart ?? 0);
      setPaddingEnd(selectedGen.paddingEnd ?? 0);
    }
  }, [selectedGen?.id, selectedGen?.paddingStart, selectedGen?.paddingEnd]);

  // Insert tag at cursor position in the textarea
  function insertTag(tag: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + " " + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);

    // Add space before tag if needed (not at start, not after space/newline)
    const needSpaceBefore = before.length > 0 && !/[\s\n]$/.test(before);
    // Add space after tag if needed (not at end, not before space/newline)
    const needSpaceAfter = after.length > 0 && !/^[\s\n]/.test(after);

    const insertion = (needSpaceBefore ? " " : "") + tag + (needSpaceAfter ? " " : "");
    const newText = before + insertion + after;
    setText(newText);

    // Restore cursor position after the inserted tag
    requestAnimationFrame(() => {
      const newPos = start + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  async function handleGenerate() {
    if (!voiceId) {
      toast.error("No voice assigned to this character. Go to Characters page first.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/voices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogueId: dialogue.id,
          projectId: Number(projectId),
          sceneId: Number(sceneId),
          voiceId,
          text,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Voice generated");
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
    setGenerating(false);
  }

  async function handleSelect(genId: number) {
    try {
      const res = await fetch("/api/voices/generate/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: genId, dialogueId: dialogue.id }),
      });
      if (!res.ok) throw new Error("Select failed");
      toast.success("Option selected");
      onRefresh();
    } catch {
      toast.error("Failed to select voice option");
    }
  }

  async function handlePad(genId: number) {
    if (paddingStart === 0 && paddingEnd === 0) {
      // If both are 0 and there's already a padded version, we're removing padding
      if (!selectedGen?.paddedStoragePath) {
        toast("No padding to apply");
        return;
      }
    }
    setPadding(true);
    try {
      const res = await fetch(`/api/voices/generate/${genId}/pad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paddingStart, paddingEnd }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Padding failed");
      }
      toast.success("Padding applied");
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Padding failed");
    }
    setPadding(false);
  }

  // Quick-access tags (always visible)
  const quickTags = [
    { label: "Whispers", tag: "[whispers]" },
    { label: "Laughs", tag: "[laughs]" },
    { label: "Sighs", tag: "[sighs]" },
    { label: "Pause", tag: "[pause]" },
    { label: "Gasps", tag: "[gasps]" },
    { label: "Cries", tag: "[crying]" },
    { label: "Excited", tag: "[excited]" },
    { label: "Angry", tag: "[angry]" },
  ];

  return (
    <Card className="border-l-2 border-l-primary/30">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{dialogue.character}</Badge>
          {selectedGen && <Badge variant="outline" className="text-[10px]">Has voice</Badge>}
          {selectedGen?.paddedStoragePath && (
            <Badge variant="outline" className="text-[10px] text-blue-500 border-blue-500/30">
              Padded {selectedGen.paddingStart}s / {selectedGen.paddingEnd}s
            </Badge>
          )}
        </div>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-xs min-h-[40px] font-mono"
          rows={2}
        />

        {/* Quick tags (always visible) */}
        <div className="flex flex-wrap gap-1">
          {quickTags.map((t) => (
            <button
              key={t.tag}
              onClick={() => insertTag(t.tag)}
              className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent transition-colors"
              title={`Insert ${t.tag} at cursor`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setShowAllTags(!showAllTags)}
            className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent transition-colors font-medium text-primary"
          >
            {showAllTags ? "Less" : "More..."}
          </button>
        </div>

        {/* Full tag palette (expandable) */}
        {showAllTags && (
          <div className="space-y-2 p-2 rounded-md border bg-muted/30">
            <p className="text-[9px] text-muted-foreground">
              Click any tag to insert it at your cursor position. Tags work anywhere in the text.
            </p>
            {V3_TAG_CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{cat.label}</p>
                <div className="flex flex-wrap gap-1">
                  {cat.tags.map((t) => (
                    <button
                      key={t.tag}
                      onClick={() => insertTag(t.tag)}
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent transition-colors"
                      title={t.tag}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground italic">
              You can also type custom tags directly, e.g. [nervous], [robot voice], [Spanish accent]
            </p>
          </div>
        )}

        {voiceId ? (
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="w-full">
            {generating ? "Generating..." : "Generate Voice"}
          </Button>
        ) : (
          <div className="text-center space-y-1.5">
            <p className="text-[10px] text-muted-foreground">No voice assigned to <span className="font-medium text-foreground">{dialogue.character}</span></p>
            <a
              href={`/project/${projectId}/characters`}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
              </svg>
              Assign voice in Characters
            </a>
          </div>
        )}

        {dialogueGens.length > 0 && (
          <div className="space-y-2">
            {dialogueGens.slice(0, 4).map((gen) => (
              <div key={gen.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/50">
                <audio
                  controls
                  src={`/api/voices/generate/${gen.id}`}
                  className="h-7 flex-1"
                  preload="none"
                />
                <span className="text-[10px] text-muted-foreground">#{gen.optionIndex + 1}</span>
                <Button
                  size="sm"
                  variant={gen.selected ? "default" : "outline"}
                  className="text-[10px] h-6 px-2"
                  onClick={() => handleSelect(gen.id)}
                >
                  {gen.selected ? "Selected" : "Select"}
                </Button>
              </div>
            ))}

            {selectedGen && (
              <div className="space-y-1.5 p-2 rounded-md border bg-muted/30">
                <p className="text-[10px] font-medium text-muted-foreground">Padding (silence before/after)</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground text-[10px] w-8">Start</span>
                  <select
                    value={paddingStart}
                    onChange={(e) => setPaddingStart(Number(e.target.value))}
                    className="text-xs border rounded px-1.5 py-1 bg-background flex-1"
                  >
                    {PADDING_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}s</option>
                    ))}
                  </select>
                  <span className="text-muted-foreground text-[10px] w-6">End</span>
                  <select
                    value={paddingEnd}
                    onChange={(e) => setPaddingEnd(Number(e.target.value))}
                    className="text-xs border rounded px-1.5 py-1 bg-background flex-1"
                  >
                    {PADDING_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}s</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[10px] h-7 px-2"
                    onClick={() => handlePad(selectedGen.id)}
                    disabled={padding}
                  >
                    {padding ? "..." : "Apply"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
