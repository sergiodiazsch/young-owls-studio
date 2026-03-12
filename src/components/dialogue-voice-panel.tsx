"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { Dialogue, VoiceGeneration } from "@/lib/types";

// ── ElevenLabs v3 Audio Tags ──

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
const DEFAULT_PADDING_START = 0.75;
const DEFAULT_PADDING_END = 1;
const COLLAPSED_GEN_LIMIT = 3;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface DialogueVoicePanelProps {
  dialogue: Dialogue;
  projectId: string;
  sceneId: string;
  voiceId?: string | null;
  generations: VoiceGeneration[];
  onRefresh: () => void;
  sceneContext?: string;
}

export function DialogueVoicePanel({
  dialogue,
  projectId,
  sceneId,
  voiceId,
  generations,
  onRefresh,
  sceneContext,
}: DialogueVoicePanelProps) {
  const [text, setText] = useState(dialogue.line);
  const [generating, setGenerating] = useState(false);
  const [paddingStart, setPaddingStart] = useState(DEFAULT_PADDING_START);
  const [paddingEnd, setPaddingEnd] = useState(DEFAULT_PADDING_END);
  const [padding, setPadding] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [suggestedReasoning, setSuggestedReasoning] = useState("");
  const [showAllGens, setShowAllGens] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTextModified = text !== dialogue.line;

  const dialogueGens = generations
    .filter((g) => g.dialogueId === dialogue.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const selectedGen = dialogueGens.find((g) => g.selected);
  const latestGenId = dialogueGens.length > 0 ? dialogueGens[0].id : null;
  const visibleGens = showAllGens ? dialogueGens : dialogueGens.slice(0, COLLAPSED_GEN_LIMIT);
  const hiddenCount = dialogueGens.length - COLLAPSED_GEN_LIMIT;

  // Load existing padding values when selected generation changes
  useEffect(() => {
    if (selectedGen) {
      setPaddingStart(selectedGen.paddingStart ?? DEFAULT_PADDING_START);
      setPaddingEnd(selectedGen.paddingEnd ?? DEFAULT_PADDING_END);
    }
  }, [selectedGen?.id, selectedGen?.paddingStart, selectedGen?.paddingEnd]);

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
    const needSpaceBefore = before.length > 0 && !/[\s\n]$/.test(before);
    const needSpaceAfter = after.length > 0 && !/^[\s\n]/.test(after);
    const insertion = (needSpaceBefore ? " " : "") + tag + (needSpaceAfter ? " " : "");
    const newText = before + insertion + after;
    setText(newText);

    requestAnimationFrame(() => {
      const newPos = start + insertion.length;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  async function handleSuggestTags() {
    setSuggestingTags(true);
    setSuggestedReasoning("");
    try {
      const res = await fetch("/api/voices/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogueLine: dialogue.line,
          character: dialogue.character,
          parenthetical: dialogue.parenthetical || undefined,
          sceneContext: sceneContext || undefined,
        }),
      });
      const data = await res.json();
      if (data.taggedText && data.taggedText !== dialogue.line) {
        setText(data.taggedText);
        setSuggestedReasoning(data.reasoning || "");
      } else if (data.tags?.length > 0) {
        const tagStr = data.tags.map((t: string) => `[${t}]`).join(" ");
        setText(tagStr + " " + dialogue.line);
        setSuggestedReasoning(data.reasoning || "");
      } else {
        toast("No tags suggested for this line");
      }
    } catch {
      toast.error("Failed to suggest tags");
    }
    setSuggestingTags(false);
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
      onRefresh();
    } catch {
      toast.error("Failed to select voice option");
    }
  }

  async function handlePad(genId: number) {
    if (paddingStart === 0 && paddingEnd === 0 && !selectedGen?.paddedStoragePath) {
      toast("No padding to apply");
      return;
    }
    setPadding(true);
    try {
      const res = await fetch(`/api/voices/generate/${genId}/pad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paddingStart, paddingEnd }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Padding failed");
      toast.success("Padding applied");
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Padding failed");
    }
    setPadding(false);
  }

  const quickTags = [
    { label: "Whispers", tag: "[whispers]" },
    { label: "Laughs", tag: "[laughs]" },
    { label: "Sighs", tag: "[sighs]" },
    { label: "Pause", tag: "[pause]" },
    { label: "Gasps", tag: "[gasps]" },
    { label: "Excited", tag: "[excited]" },
    { label: "Angry", tag: "[angry]" },
    { label: "Sad", tag: "[sad]" },
  ];

  // Check if current padding matches saved values
  const paddingChanged = selectedGen
    ? paddingStart !== (selectedGen.paddingStart ?? DEFAULT_PADDING_START) ||
      paddingEnd !== (selectedGen.paddingEnd ?? DEFAULT_PADDING_END)
    : false;

  return (
    <Card className="border-l-2 border-l-primary/30">
      <CardContent className="p-3 space-y-2.5">
        {/* Header: character + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] font-semibold">{dialogue.character}</Badge>
          {dialogue.parenthetical && (
            <span className="text-[9px] text-muted-foreground italic">({dialogue.parenthetical})</span>
          )}
          {selectedGen?.paddedStoragePath && (
            <Badge variant="outline" className="text-[10px] text-primary/70 border-primary/20">
              Padded {selectedGen.paddingStart}s / {selectedGen.paddingEnd}s
            </Badge>
          )}
          {dialogueGens.length > 0 && (
            <span className="text-[9px] text-muted-foreground ml-auto">
              {dialogueGens.length} take{dialogueGens.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Editable text with reset */}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="text-xs min-h-[40px] font-mono pr-8"
            rows={2}
            aria-label={`Dialogue text for ${dialogue.character}`}
          />
          {isTextModified && (
            <button
              onClick={() => { setText(dialogue.line); setSuggestedReasoning(""); }}
              className="absolute top-1.5 right-1.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Reset to original line"
              aria-label="Reset text to original dialogue"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2v5h5" /><path d="M2 7a6 6 0 1011-3" />
              </svg>
            </button>
          )}
        </div>

        {/* AI reasoning feedback */}
        {suggestedReasoning && (
          <p className="text-[9px] text-primary/70 italic px-1 leading-relaxed">{suggestedReasoning}</p>
        )}

        {/* Tags row: AI button prominent, quick tags compact */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={handleSuggestTags}
            disabled={suggestingTags}
            className="text-[10px] px-2.5 py-1 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors font-medium text-primary disabled:opacity-50 flex items-center gap-1.5"
            title="AI analyzes the dialogue context and suggests voice tags"
            aria-label="Suggest voice tags with AI"
          >
            {suggestingTags ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
                </svg>
                AI Tags
              </>
            )}
          </button>

          <span className="w-px h-4 bg-border mx-0.5" aria-hidden="true" />

          {quickTags.map((t) => (
            <button
              key={t.tag}
              onClick={() => insertTag(t.tag)}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 hover:bg-accent hover:border-border transition-colors"
              title={`Insert ${t.tag} at cursor`}
              aria-label={`Insert ${t.label} tag`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => setShowAllTags(!showAllTags)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 hover:bg-accent transition-colors font-medium text-primary"
            aria-expanded={showAllTags}
            aria-label={showAllTags ? "Collapse tag palette" : "Show all tags"}
          >
            {showAllTags ? "Less" : "More..."}
          </button>
        </div>

        {/* Full tag palette */}
        {showAllTags && (
          <div className="space-y-2 p-2.5 rounded-lg border bg-muted/20" role="group" aria-label="Voice tag palette">
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
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 hover:bg-accent hover:border-border transition-colors"
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

        {/* Generate button or no-voice prompt */}
        {voiceId ? (
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full gap-1.5"
            aria-label={generating ? "Generating voice..." : "Generate voice for this dialogue"}
          >
            {generating ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 1v6M5 4a3 3 0 006 0M4 8a4 4 0 008 0" /><path d="M8 11v4M6 15h4" />
                </svg>
                Generate Voice
              </>
            )}
          </Button>
        ) : (
          <div className="text-center py-2 space-y-1.5 rounded-lg border border-dashed border-border/60 bg-muted/10">
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

        {/* Generated voices list */}
        {dialogueGens.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
              <span>Takes ({dialogueGens.length})</span>
              {selectedGen && (
                <span className="font-normal">
                  Playing: {selectedGen.paddedStoragePath ? "padded" : "original"}
                </span>
              )}
            </p>

            {visibleGens.map((gen) => {
              const isLatest = gen.id === latestGenId;
              return (
                <div
                  key={gen.id}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    gen.selected
                      ? "bg-primary/8 ring-1 ring-primary/20"
                      : isLatest
                      ? "bg-muted/60 ring-1 ring-border/40"
                      : "bg-muted/30 hover:bg-muted/50"
                  }`}
                  role="listitem"
                >
                  {/* Audio player */}
                  <audio
                    controls
                    src={gen.paddedStoragePath ? `/api/storage/${gen.paddedStoragePath}` : `/api/voices/generate/${gen.id}`}
                    className="h-8 flex-1 min-w-0"
                    preload="none"
                    aria-label={`Voice take ${gen.optionIndex + 1}${gen.selected ? " (selected)" : ""}`}
                  />

                  {/* Meta info column */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[52px]">
                    <div className="flex items-center gap-1">
                      {isLatest && !gen.selected && (
                        <span className="text-[8px] font-medium text-primary uppercase tracking-wide">New</span>
                      )}
                      <span className="text-[9px] text-muted-foreground font-mono">
                        #{gen.optionIndex + 1}
                      </span>
                    </div>
                    <span className="text-[8px] text-muted-foreground/60">
                      {timeAgo(gen.createdAt)}
                    </span>
                  </div>

                  {/* Select button */}
                  <Button
                    size="sm"
                    variant={gen.selected ? "default" : "ghost"}
                    className={`text-[10px] h-7 px-2 shrink-0 ${gen.selected ? "" : "hover:bg-muted"}`}
                    onClick={() => handleSelect(gen.id)}
                    aria-pressed={gen.selected}
                    aria-label={gen.selected ? "Currently selected" : `Select take ${gen.optionIndex + 1}`}
                  >
                    {gen.selected ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8l3.5 3.5L13 5" />
                      </svg>
                    ) : "Use"}
                  </Button>
                </div>
              );
            })}

            {/* Show more / less toggle */}
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllGens(!showAllGens)}
                className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-muted/40 transition-colors"
                aria-expanded={showAllGens}
              >
                {showAllGens ? "Show less" : `Show ${hiddenCount} older take${hiddenCount !== 1 ? "s" : ""}...`}
              </button>
            )}

            {/* Padding controls */}
            {selectedGen && (
              <div className="space-y-2 p-2.5 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-muted-foreground">Padding (silence)</p>
                  {paddingChanged && (
                    <span className="text-[8px] text-primary font-medium">unsaved</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor={`pad-start-${dialogue.id}`} className="text-muted-foreground text-[10px] w-8 shrink-0">Start</label>
                  <select
                    id={`pad-start-${dialogue.id}`}
                    value={paddingStart}
                    onChange={(e) => setPaddingStart(Number(e.target.value))}
                    className="text-xs border border-border rounded-md px-1.5 py-1 bg-background flex-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    aria-label="Padding start duration"
                  >
                    {PADDING_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}s</option>
                    ))}
                  </select>
                  <label htmlFor={`pad-end-${dialogue.id}`} className="text-muted-foreground text-[10px] w-6 shrink-0">End</label>
                  <select
                    id={`pad-end-${dialogue.id}`}
                    value={paddingEnd}
                    onChange={(e) => setPaddingEnd(Number(e.target.value))}
                    className="text-xs border border-border rounded-md px-1.5 py-1 bg-background flex-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    aria-label="Padding end duration"
                  >
                    {PADDING_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}s</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant={paddingChanged ? "default" : "outline"}
                    className="text-[10px] h-7 px-2.5 shrink-0"
                    onClick={() => handlePad(selectedGen.id)}
                    disabled={padding}
                    aria-label="Apply padding"
                  >
                    {padding ? (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                      </svg>
                    ) : "Apply"}
                  </Button>
                </div>
                <p className="text-[8px] text-muted-foreground">Default: 0.75s start / 1s end</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
