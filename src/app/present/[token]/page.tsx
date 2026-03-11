"use client";

import { useEffect, useState, useCallback, use } from "react";

interface LinkedFile {
  id: number;
  sceneId: number;
  fileId: number;
  reviewStatus: string;
  file: {
    id: number;
    filename: string;
    fileType: string;
    mimeType: string;
    storagePath: string;
  };
}

interface PresentationScene {
  id: number;
  sceneNumber: string;
  heading: string;
  synopsis: string | null;
  headingType: string | null;
  timeOfDay: string | null;
  dialogues?: { id: number; character: string; text: string }[];
  directions?: { id: number; text: string }[];
  linkedFiles: LinkedFile[];
}

interface PresentationData {
  projectTitle: string;
  projectSubtitle: string | null;
  scenes: PresentationScene[];
}

export default function PublicPresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/presentations/${token}`);
        if (res.status === 404) {
          setError("Presentation not found. The link may be invalid.");
          return;
        }
        if (res.status === 410) {
          setError("This presentation link has expired.");
          return;
        }
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        setData(json);
      } catch {
        setError("Failed to load presentation.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const goNext = useCallback(() => {
    if (data) setCurrentScene((prev) => Math.min(prev + 1, data.scenes.length - 1));
  }, [data]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-[oklch(0.10_0.01_280)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2 text-foreground">{error}</h1>
          <p className="text-sm text-muted-foreground">
            Please check the link and try again, or contact the person who shared it.
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.scenes.length === 0) {
    return (
      <div className="min-h-screen bg-[oklch(0.10_0.01_280)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2 text-foreground">No scenes available</h1>
          <p className="text-sm text-muted-foreground">This project has no scenes to present.</p>
        </div>
      </div>
    );
  }

  const scene = data.scenes[currentScene];
  const primaryImage = scene.linkedFiles.find(
    (f) => f.file.mimeType?.startsWith("image/")
  );
  const audioFile = scene.linkedFiles.find(
    (f) => f.file.mimeType?.startsWith("audio/")
  );

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.01_280)] text-foreground relative">
      {/* Navigation arrows */}
      {currentScene > 0 && (
        <button
          onClick={goPrev}
          className="fixed left-0 top-0 bottom-0 w-16 z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-black/40 to-transparent"
          aria-label="Previous scene"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {currentScene < data.scenes.length - 1 && (
        <button
          onClick={goNext}
          className="fixed right-0 top-0 bottom-0 w-16 z-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-gradient-to-l from-black/40 to-transparent"
          aria-label="Next scene"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Scene counter */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-full px-4 py-1.5 text-xs font-mono text-muted-foreground">
          {currentScene + 1} / {data.scenes.length}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        {/* Project title (on first scene) */}
        {currentScene === 0 && (
          <div className="text-center mb-16">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{data.projectTitle}</h1>
            {data.projectSubtitle && (
              <p className="text-lg text-muted-foreground">{data.projectSubtitle}</p>
            )}
          </div>
        )}

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
                src={`/api/storage/${primaryImage.file.storagePath}`}
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
                  src={`/api/storage/${audioFile.file.storagePath}`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Scene dot navigation */}
        <div className="flex items-center justify-center gap-1.5 mt-8">
          {data.scenes.map((_, i) => (
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

      {/* Watermark */}
      <div className="fixed bottom-4 right-4 text-muted-foreground/20 text-sm font-mono select-none pointer-events-none z-50">
        Young Owls - Internal Preview
      </div>
    </div>
  );
}
