"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { gsap } from "@/lib/gsap";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Media, Scene } from "@/lib/types";

type UploadStep = "idle" | "uploading" | "uploaded" | "parsing" | "done" | "error";

interface BreakdownProgress {
  step: "locations" | "characters" | "breakdowns" | "prompts" | "complete";
  detail?: string;
}

const BREAKDOWN_LABELS: Record<BreakdownProgress["step"], string> = {
  locations: "Extracting locations...",
  characters: "Linking characters...",
  breakdowns: "Generating scene breakdowns...",
  prompts: "Creating image prompts...",
  complete: "Breakdown complete!",
};

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [step, setStep] = useState<UploadStep>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState("");
  const [parseResult, setParseResult] = useState<{ title: string; sceneCount: number; characterCount: number } | null>(null);
  const [error, setError] = useState("");
  const [mediaFiles, setMediaFiles] = useState<Media[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [reParsing, setReParsing] = useState(false);
  const [showReParseConfirm, setShowReParseConfirm] = useState(false);
  const [breakdownProgress, setBreakdownProgress] = useState<BreakdownProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // GSAP pulse animation on idle drop zone
  useEffect(() => {
    if (step !== "idle" || !dropZoneRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(
      dropZoneRef.current,
      { opacity: 0.85 },
      { opacity: 1, duration: 2, ease: "sine.inOut", repeat: -1, yoyo: true }
    );
    return () => { tween.kill(); };
  }, [step]);

  // Load existing media and scenes
  useEffect(() => {
    fetch(`/api/scenes?projectId=${projectId}`).then(r => r.json()).then(setScenes).catch(() => {});
    fetch(`/api/media?projectId=${projectId}`).then(r => r.json()).then(setMediaFiles).catch(() => {});
  }, [projectId]);

  const runAutoBreakdown = useCallback(async () => {
    try {
      setBreakdownProgress({ step: "locations" });
      const locRes = await fetch("/api/locations/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      if (locRes.ok) {
        const locs = await locRes.json();
        setBreakdownProgress({ step: "locations", detail: `${Array.isArray(locs) ? locs.length : 0} locations found` });
      }

      setBreakdownProgress({ step: "characters", detail: "Characters linked from parse" });

      setBreakdownProgress({ step: "breakdowns" });
      const bdRes = await fetch("/api/breakdowns/generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      if (bdRes.ok) {
        const bdData = await bdRes.json();
        setBreakdownProgress({ step: "breakdowns", detail: `${bdData.completed}/${bdData.total} scenes processed` });
      }

      setBreakdownProgress({ step: "prompts" });
      const conceptRes = await fetch("/api/scenes/auto-generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      if (conceptRes.ok) {
        const conceptData = await conceptRes.json();
        setBreakdownProgress({ step: "prompts", detail: `${conceptData.queued} prompts queued` });
      }

      setBreakdownProgress({ step: "complete" });
      toast.success("Full breakdown complete! Redirecting...");
      setTimeout(() => router.push(`/project/${projectId}/breakdowns`), 1500);
    } catch {
      toast.error("Auto-breakdown encountered an error. You can still trigger it manually.");
      setBreakdownProgress(null);
    }
  }, [projectId, router]);

  // UX AUDIT FIX: added file size validation (50MB limit) and double-submit prevention
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleScreenplayFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".docx")) {
      setError("Only .docx files are supported");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 50 MB.");
      return;
    }
    if (step === "uploading" || step === "parsing") return;
    setStep("uploading");
    setFilename(file.name);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/screenplay/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");
      const { projectId: pid } = uploadData;

      setStep("parsing");
      const parseRes = await fetch("/api/screenplay/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: pid || projectId }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || "Parse failed");

      const result = parseData;
      setParseResult(result);
      setStep("done");
      toast.success(`Parsed ${result.sceneCount} scenes and ${result.characterCount} characters`);
      fetch(`/api/scenes?projectId=${projectId}`).then(r => r.json()).then(setScenes).catch(() => {});

      // Auto-trigger full breakdown
      runAutoBreakdown();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      setStep("error");
      toast.error(message);
    }
  }, [projectId, step, runAutoBreakdown]);

  const handleReParse = async () => {
    setReParsing(true);
    try {
      const parseRes = await fetch("/api/screenplay/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!parseRes.ok) throw new Error((await parseRes.json()).error || "Parse failed");
      const result = await parseRes.json();
      toast.success(`Re-parsed: ${result.sceneCount} scenes, ${result.characterCount} characters`);
      fetch(`/api/scenes?projectId=${projectId}`).then(r => r.json()).then(setScenes).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-parse failed");
    }
    setReParsing(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleScreenplayFile(file);
  }, [handleScreenplayFile]);

  const handleMediaUpload = async (files: FileList) => {
    setMediaUploading(true);
    const uploaded: Media[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: formData });
        if (res.ok) uploaded.push(await res.json());
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setMediaFiles((prev) => [...prev, ...uploaded]);
    setMediaUploading(false);
    if (uploaded.length > 0) toast.success(`Uploaded ${uploaded.length} file${uploaded.length > 1 ? "s" : ""}`);
  };

  const handleAssignScene = async (mediaId: number, sceneId: number | null) => {
    await fetch(`/api/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId }),
    });
    setMediaFiles((prev) => prev.map((m) => m.id === mediaId ? { ...m, sceneId } : m));
    toast.success(sceneId ? "Assigned to scene" : "Unassigned from scene");
  };

  const handleDeleteMedia = async (mediaId: number) => {
    await fetch(`/api/media/${mediaId}`, { method: "DELETE" });
    setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
    toast.success("Media deleted");
  };

  const handleReplace = () => {
    setStep("idle");
    setFilename("");
    setParseResult(null);
    setError("");
    // Slight delay so UI re-renders the drop zone before opening file picker
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const stepProgress = step === "idle" ? 0 : step === "uploading" ? 33 : step === "parsing" ? 66 : step === "done" ? 100 : 0;

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto space-y-10">
      {/* Page header */}
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Upload Screenplay</h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Import your screenplay to extract scenes, characters, and locations
        </p>
      </div>

      {/* ── Hero: Screenplay Upload Zone ── */}
      {step === "idle" || step === "error" ? (
        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          aria-label="Upload screenplay file. Drop a .docx file here or click to browse."
          className={`relative rounded-2xl border-2 border-dashed p-12 md:p-16 text-center transition-all duration-300 cursor-pointer backdrop-blur-sm ${
            dragOver
              ? "border-primary bg-primary/5 shadow-[0_0_30px_var(--glow-primary)] scale-[1.01]"
              : "border-primary/30 hover:border-primary/50 hover:bg-muted/30 hover:shadow-md"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
        >
          {/* Screenplay icon */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-muted-foreground/60 mb-4 drop-shadow-[0_0_8px_var(--glow-primary)]"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
            <path d="M10 9H8" />
          </svg>
          <p className="text-base font-semibold">Drop your screenplay here</p>
          <p className="text-sm text-muted-foreground mt-1.5">
            Supports .docx files
          </p>
          <Button variant="outline" size="sm" className="mt-5 pointer-events-none">
            Browse files
          </Button>
          {error && (
            <p className="text-sm text-destructive mt-4 font-medium">{error}</p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleScreenplayFile(file); }}
          />
        </div>
      ) : (
        /* ── Loaded file: compact confirmation card ── */
        <Card className="border-green-200 dark:border-green-900/50 shadow-sm backdrop-blur-sm">
          <CardContent className="p-6 space-y-5">
            {/* File info row */}
            <div className="flex items-center gap-4">
              {/* Green checkmark or spinner */}
              {step === "done" ? (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shadow-sm">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center shadow-[0_0_12px_var(--glow-primary)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary animate-pulse">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step === "uploading" && "Extracting text..."}
                  {step === "parsing" && "AI is parsing screenplay structure..."}
                  {step === "done" && parseResult && `${parseResult.sceneCount} scenes, ${parseResult.characterCount} characters`}
                  {step === "done" && !parseResult && "Parsing complete"}
                </p>
              </div>

              {step === "done" && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 flex-shrink-0">
                  Ready
                </Badge>
              )}
            </div>

            {/* Progress bar (visible during upload/parse) */}
            {(step === "uploading" || step === "parsing") && (
              <Progress value={stepProgress} className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-primary/70 [&>div]:shadow-[0_0_8px_var(--glow-primary)]" />
            )}

            {/* Parse result stats */}
            {parseResult && step === "done" && (
              <div className="flex gap-3">
                <div className="text-center flex-1 rounded-lg bg-muted/60 backdrop-blur-sm border border-border/40 p-3">
                  <p className="text-2xl font-bold text-primary drop-shadow-[0_0_6px_var(--glow-primary)]">{parseResult.sceneCount}</p>
                  <p className="text-xs text-muted-foreground">Scenes</p>
                </div>
                <div className="text-center flex-1 rounded-lg bg-muted/60 backdrop-blur-sm border border-border/40 p-3">
                  <p className="text-2xl font-bold text-primary drop-shadow-[0_0_6px_var(--glow-primary)]">{parseResult.characterCount}</p>
                  <p className="text-xs text-muted-foreground">Characters</p>
                </div>
              </div>
            )}

            {/* Auto-breakdown progress */}
            {breakdownProgress && breakdownProgress.step !== "complete" && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary animate-spin">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  <span className="text-sm font-medium">Auto-Breakdown</span>
                </div>
                <div className="space-y-1.5">
                  {(["locations", "characters", "breakdowns", "prompts"] as const).map((s) => {
                    const isActive = breakdownProgress.step === s;
                    const isDone = ["locations", "characters", "breakdowns", "prompts"].indexOf(s) < ["locations", "characters", "breakdowns", "prompts"].indexOf(breakdownProgress.step);
                    return (
                      <div key={s} className={`flex items-center gap-2 text-xs transition-colors ${isActive ? "text-primary font-medium" : isDone ? "text-muted-foreground" : "text-muted-foreground"}`}>
                        {isDone ? (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                          </svg>
                        ) : isActive ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-current" />
                        )}
                        <span>{BREAKDOWN_LABELS[s]}</span>
                        {isActive && breakdownProgress.detail && (
                          <span className="text-muted-foreground ml-1">({breakdownProgress.detail})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {breakdownProgress?.step === "complete" && (
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                  <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                </svg>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">Breakdown complete — redirecting to review...</span>
              </div>
            )}

            {/* Actions row */}
            {step === "done" && (
              <div className="flex items-center gap-3 pt-1">
                <Button className="flex-1" onClick={() => router.push(`/project/${projectId}/breakdowns`)}>
                  {breakdownProgress?.step === "complete" ? "View Breakdowns" : "View Scenes"}
                </Button>

                <div className="flex items-center gap-2">
                  {/* Re-parse button with tooltip */}
                  {scenes.length > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowReParseConfirm(true)}
                            disabled={reParsing}
                          >
                            {reParsing ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 11-6.219-8.56" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                              </svg>
                            )}
                            <span className="ml-1.5">Re-parse</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Re-analyze the screenplay to update characters, scenes, and locations
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Upload new link */}
                  <button
                    onClick={handleReplace}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors whitespace-nowrap"
                  >
                    Upload new
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleScreenplayFile(file); }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Secondary: Reference Assets (optional) ── */}
      <Card className="backdrop-blur-sm bg-card/80 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reference Assets <span className="text-muted-foreground font-normal text-sm">(optional)</span></CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Upload mood boards, reference images, or production documents
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* UX AUDIT FIX: disable media drop zone during upload to prevent double-submit, added keyboard accessibility */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload reference assets. Click to browse for images, audio, or video."
            aria-disabled={mediaUploading}
            className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
              mediaUploading ? "opacity-50 cursor-not-allowed" : "border-muted-foreground/20 hover:border-muted-foreground/40 cursor-pointer"
            }`}
            onClick={() => { if (!mediaUploading) mediaInputRef.current?.click(); }}
            onKeyDown={(e) => { if (!mediaUploading && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); mediaInputRef.current?.click(); } }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted-foreground mb-1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p className="text-sm text-muted-foreground">{mediaUploading ? "Uploading..." : "Click to upload images, audio, or video"}</p>
            <input ref={mediaInputRef} type="file" multiple accept="image/*,audio/*,video/*" className="hidden"
              onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleMediaUpload(e.target.files); }}
            />
          </div>

          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              {mediaFiles.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                  {m.mediaType === "image" ? (
                    <Image src={`/api/media/${m.id}`} alt={m.filename} width={40} height={40} className="rounded object-cover" />
                  ) : m.mediaType === "audio" ? (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.filename}</p>
                    <p className="text-xs text-muted-foreground">{(m.fileSize / 1024).toFixed(0)} KB</p>
                  </div>
                  {/* Scene assignment dropdown */}
                  {/* UX AUDIT FIX: added aria-label for scene assignment select */}
                  <select
                    value={m.sceneId ?? ""}
                    onChange={(e) => handleAssignScene(m.id, e.target.value ? Number(e.target.value) : null)}
                    className="text-xs border rounded px-2 py-1 bg-background max-w-[120px]"
                    aria-label={`Assign scene for ${m.filename}`}
                  >
                    <option value="">No scene</option>
                    {scenes.map((s) => (
                      <option key={s.id} value={s.id}>Sc. {s.sceneNumber}: {s.location || s.heading}</option>
                    ))}
                  </select>
                  {/* UX AUDIT FIX: added aria-label for icon-only delete button */}
                  <button
                    onClick={() => handleDeleteMedia(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label={`Delete ${m.filename}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showReParseConfirm}
        onOpenChange={setShowReParseConfirm}
        title="Re-parse screenplay"
        description="This will re-extract all scenes and characters from the uploaded screenplay. Existing scene data and character assignments may be overwritten."
        confirmLabel="Re-parse"
        variant="default"
        onConfirm={handleReParse}
      />
    </div>
  );
}
