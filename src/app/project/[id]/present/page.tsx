"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SceneFileLink {
  linkId: number;
  fileId: number;
  filename: string;
  fileType: string;
  mimeType: string;
  storagePath: string;
  reviewStatus: string;
}

interface PresentScene {
  id: number;
  sceneNumber: string;
  heading: string;
  synopsis: string | null;
  headingType: string | null;
  timeOfDay: string | null;
  dialogues?: { id: number; character: string; text: string }[];
  directions?: { id: number; text: string }[];
  files: SceneFileLink[];
}

export default function InternalPresentationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [scenes, setScenes] = useState<PresentScene[]>([]);
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentScene, setCurrentScene] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [creatingShare, setCreatingShare] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [scenesRes, reviewRes, projRes] = await Promise.all([
          fetch(`/api/scenes?projectId=${projectId}&include=dialogues,directions`),
          fetch(`/api/scenes/review?projectId=${projectId}`),
          fetch(`/api/projects/${projectId}`),
        ]);

        const scenesData = await scenesRes.json();
        const reviewData = await reviewRes.json();
        const projData = await projRes.json();

        setProjectTitle(projData.title || "Untitled Project");

        // Build file map from review data
        const fileMap = new Map<number, SceneFileLink[]>();
        if (Array.isArray(reviewData)) {
          for (const r of reviewData) {
            if (r.files && r.files.length > 0) {
              fileMap.set(r.id, r.files);
            }
          }
        }

        const combined: PresentScene[] = (Array.isArray(scenesData) ? scenesData : [])
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
          .map((s: any) => ({
            ...s,
            files: fileMap.get(s.id) || [],
          }));

        setScenes(combined);
      } catch {
        toast.error("Failed to load presentation data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const goNext = useCallback(() => {
    setCurrentScene((prev) => Math.min(prev + 1, scenes.length - 1));
  }, [scenes.length]);

  const goPrev = useCallback(() => {
    setCurrentScene((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev]);

  const createShareLink = useCallback(async () => {
    setCreatingShare(true);
    try {
      const res = await fetch("/api/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      const url = `${window.location.origin}/present/${data.token}`;
      setShareLink(url);
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setCreatingShare(false);
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[oklch(0.10_0.01_280)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-mono">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="min-h-screen bg-[oklch(0.10_0.01_280)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2 text-foreground">No scenes available</h1>
          <p className="text-sm text-muted-foreground mb-4">Upload and parse a screenplay first.</p>
          <a href={`/project/${projectId}`}>
            <Button variant="outline" size="sm">Back to Overview</Button>
          </a>
        </div>
      </div>
    );
  }

  const scene = scenes[currentScene];
  const approvedFiles = scene.files.filter((f) => f.reviewStatus === "approved");
  const primaryImage = approvedFiles.find((f) => f.mimeType?.startsWith("image/")) || scene.files.find((f) => f.mimeType?.startsWith("image/"));
  const audioFile = approvedFiles.find((f) => f.mimeType?.startsWith("audio/")) || scene.files.find((f) => f.mimeType?.startsWith("audio/"));

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.01_280)] text-foreground relative">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/20">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold truncate">{projectTitle}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setShowShareDialog(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
              </svg>
              Share
            </Button>
            <a href={`/project/${projectId}`}>
              <Button variant="ghost" size="sm" className="text-xs gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Close
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Share dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border/30 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Share Presentation</h2>
              <button
                onClick={() => setShowShareDialog(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create a public link to share this presentation. Only approved files will be visible to viewers.
            </p>
            {shareLink ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    className="flex-1 bg-muted/30 border border-border/30 rounded-lg px-3 py-2 text-sm font-mono text-foreground"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    setShareLink(null);
                  }}
                >
                  Create another link
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={createShareLink}
                disabled={creatingShare}
              >
                {creatingShare ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  "Generate Share Link"
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Navigation arrows */}
      {currentScene > 0 && (
        <button
          onClick={goPrev}
          className="fixed left-0 top-14 bottom-0 w-16 z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-black/40 to-transparent"
          aria-label="Previous scene"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {currentScene < scenes.length - 1 && (
        <button
          onClick={goNext}
          className="fixed right-0 top-14 bottom-0 w-16 z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-l from-black/40 to-transparent"
          aria-label="Next scene"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Scene counter */}
      <div className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-20">
        <div className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-full px-4 py-1.5 text-xs font-mono text-muted-foreground">
          {currentScene + 1} / {scenes.length}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        {/* Scene card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/30 rounded-xl overflow-hidden">
          {/* Scene header */}
          <div className="p-6 border-b border-border/20">
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold text-primary font-mono">
                {scene.sceneNumber}
              </span>
              <div>
                <h2 className="text-xl font-semibold">{scene.heading}</h2>
                {(scene.headingType || scene.timeOfDay) && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[scene.headingType, scene.timeOfDay].filter(Boolean).join(" — ")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Primary image */}
          {primaryImage && (
            <div className="relative">
              <img
                src={`/api/storage/${primaryImage.storagePath}`}
                alt={`Scene ${scene.sceneNumber}`}
                className="w-full max-h-[60vh] object-contain bg-black/40"
              />
            </div>
          )}

          {/* Scene content */}
          <div className="p-6 space-y-6">
            {/* Synopsis / description */}
            {scene.synopsis && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Synopsis</p>
                <p className="text-base leading-relaxed text-foreground/90">{scene.synopsis}</p>
              </div>
            )}

            {/* Directions */}
            {scene.directions && scene.directions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Action</p>
                <div className="space-y-2">
                  {scene.directions.map((d) => (
                    <p key={d.id} className="text-sm leading-relaxed text-foreground/80 italic">
                      {d.text}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Dialogues */}
            {scene.dialogues && scene.dialogues.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Dialogue</p>
                <div className="space-y-3">
                  {scene.dialogues.map((d) => (
                    <div key={d.id} className="pl-4 border-l-2 border-primary/30">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-0.5">
                        {d.character}
                      </p>
                      <p className="text-base leading-relaxed text-foreground/90">{d.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio player */}
            {audioFile && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Audio</p>
                <audio
                  controls
                  className="w-full h-10 rounded-lg"
                  src={`/api/storage/${audioFile.storagePath}`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Scene dot navigation */}
        <div className="flex items-center justify-center gap-1.5 mt-8">
          {scenes.map((_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentScene
                  ? "bg-primary w-6"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              onClick={() => setCurrentScene(i)}
              aria-label={`Go to scene ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
