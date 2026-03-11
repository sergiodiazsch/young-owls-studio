"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { VideoGeneration } from "@/lib/types";

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 120; // 10 minutes max

interface SubmitOptions {
  prompt: string;
  model: string;
  mode: "image-to-video" | "lipsync" | "avatar" | "upscale" | "fps-boost";
  params?: Record<string, unknown>;
  sourceImagePath?: string;
  sourceVideoPath?: string;
  sourceAudioPath?: string;
  // Lipsync TTS
  text?: string;
}

export function useVideoGenerationQueue(projectId: string) {
  const [generations, setGenerations] = useState<VideoGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef<Record<number, number>>({});

  // ── Load existing generations ──
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate/video/generations?projectId=${projectId}`);
      if (!res.ok) return;
      const data: VideoGeneration[] = await res.json();
      setGenerations(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Polling loop for pending jobs ──
  const pollPending = useCallback(async () => {
    // Read current state via ref-safe approach — extract pending items first
    let pending: VideoGeneration[] = [];
    setGenerations((prev) => {
      pending = prev.filter(
        (g) => g.status === "submitted" || g.status === "processing"
      );
      return prev; // no mutation
    });

    if (pending.length === 0) return;

    // Fire all polls outside of setState
    for (const gen of pending) {
      const attempts = pollCountRef.current[gen.id] || 0;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        fetch(`/api/generate/video/generations/${gen.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed", error: "Timed out after 10 minutes" }),
        }).catch(() => {});
        setGenerations((p) =>
          p.map((g) =>
            g.id === gen.id ? { ...g, status: "failed" as const, error: "Timed out" } : g
          )
        );
        delete pollCountRef.current[gen.id];
        continue;
      }

      pollCountRef.current[gen.id] = attempts + 1;

      fetch("/api/generate/video/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: gen.id }),
      })
        .then((r) => r.json())
        .then((data) => {
          setGenerations((p) =>
            p.map((g) => (g.id === gen.id ? { ...data, tags: data.tags || null } : g))
          );
          if (data.status === "completed") {
            delete pollCountRef.current[gen.id];
            toast.success("Video generated", {
              action: {
                label: "Save to Drive",
                onClick: () => {
                  fetch("/api/generate/video/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ generationId: data.id }),
                  })
                    .then((r) => {
                      if (!r.ok) throw new Error("Save failed");
                      return r.json();
                    })
                    .then((driveFile) => {
                      setGenerations((prev) =>
                        prev.map((g) => (g.id === data.id ? { ...g, driveFileId: driveFile.id } : g))
                      );
                      toast.success("Saved to Drive");
                    })
                    .catch(() => toast.error("Failed to save to Drive"));
                },
              },
            });
          } else if (data.status === "failed") {
            delete pollCountRef.current[gen.id];
            toast.error(data.error || "Video generation failed");
          }
        })
        .catch(() => {});
    }
  }, []);

  // Start/stop polling based on active jobs
  useEffect(() => {
    const hasPending = generations.some(
      (g) => g.status === "submitted" || g.status === "processing"
    );

    if (hasPending && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(pollPending, POLL_INTERVAL);
    } else if (!hasPending && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [generations, pollPending]);

  // ── Submit new generation ──
  const submit = useCallback(
    async (options: SubmitOptions) => {
      const endpoint =
        options.mode === "lipsync"
          ? "/api/generate/video/lipsync"
          : options.mode === "avatar"
            ? "/api/generate/video/avatar"
            : options.mode === "upscale" || options.mode === "fps-boost"
              ? "/api/generate/video/upscale"
              : "/api/generate/video";

      // Optimistic entry
      const fakeId = -(Date.now());
      const optimistic: VideoGeneration = {
        id: fakeId,
        projectId: Number(projectId),
        prompt: options.prompt,
        model: options.model,
        mode: options.mode,
        status: "submitted",
        falRequestId: null,
        storagePath: null,
        mimeType: "video/mp4",
        fileSize: 0,
        durationMs: null,
        seed: null,
        error: null,
        params: options.params ? JSON.stringify(options.params) : null,
        isFavorite: false,
        driveFileId: null,
        sourceImagePath: options.sourceImagePath || null,
        sourceVideoPath: options.sourceVideoPath || null,
        sourceAudioPath: options.sourceAudioPath || null,
        batchId: null,
        tags: null,
        cost: null,
        createdAt: new Date().toISOString(),
      };

      setGenerations((prev) => [optimistic, ...prev]);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: Number(projectId),
            prompt: options.prompt,
            model: options.model,
            mode: options.mode,
            params: options.params,
            sourceImagePath: options.sourceImagePath,
            sourceVideoPath: options.sourceVideoPath,
            sourceAudioPath: options.sourceAudioPath,
            text: options.text,
            // Upscale params passed at top level
            ...(options.mode === "upscale" || options.mode === "fps-boost"
              ? { scale: options.params?.scale, targetFps: options.params?.targetFps }
              : {}),
          }),
        });

        const data = await res.json();

        if (!res.ok || data.status === "failed") {
          setGenerations((prev) =>
            prev.map((g) => (g.id === fakeId ? { ...data, id: data.id || fakeId } : g))
          );
          toast.error(data.error || "Submission failed");
        } else {
          setGenerations((prev) =>
            prev.map((g) => (g.id === fakeId ? { ...data, tags: null } : g))
          );
          toast.success("Video submitted — processing...");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Submission failed";
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === fakeId
              ? { ...g, status: "failed" as const, error: message }
              : g
          )
        );
        toast.error(message);
      }
    },
    [projectId]
  );

  // ── Retry failed generation ──
  const retryGeneration = useCallback(async (id: number) => {
    // Reset local status to "processing" so polling resumes
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, status: "processing" as const, error: null } : g
      )
    );
    pollCountRef.current[id] = 0;

    // Reset DB status so the poll endpoint doesn't short-circuit
    await fetch(`/api/generate/video/generations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "processing", error: null }),
    }).catch(() => {});

    // Immediately trigger a poll — the backend will re-check fal.ai
    try {
      const res = await fetch("/api/generate/video/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: id }),
      });
      const data = await res.json();
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...data, tags: data.tags || null } : g))
      );
      if (data.status === "completed") {
        toast.success("Video recovered successfully");
      } else if (data.status === "failed") {
        toast.error(data.error || "Video generation failed");
      } else {
        toast.info("Retrying — video is still processing...");
      }
    } catch {
      toast.error("Failed to retry — check your connection");
    }
  }, []);

  // ── Toggle favorite ──
  const toggleFavorite = useCallback(async (id: number) => {
    let newVal = false;
    setGenerations((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          newVal = !g.isFavorite;
          return { ...g, isFavorite: newVal };
        }
        return g;
      })
    );
    await fetch(`/api/generate/video/generations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: newVal }),
    }).catch(() => {
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, isFavorite: !newVal } : g))
      );
    });
  }, []);

  // ── Delete generation ──
  const deleteGeneration = useCallback(async (id: number) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/generate/video/generations/${id}`, { method: "DELETE" }).catch(() => {
      toast.error("Failed to delete");
      refresh();
    });
  }, [refresh]);

  // ── Promote to drive ──
  const promoteToDrive = useCallback(async (id: number, folderId?: number, sceneId?: number) => {
    try {
      const res = await fetch("/api/generate/video/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: id, folderId, sceneId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save to drive");
      }
      const driveFile = await res.json();
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, driveFileId: driveFile.id } : g))
      );
      toast.success("Saved to Drive");
      return driveFile;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      return null;
    }
  }, []);

  return {
    generations,
    loading,
    submit,
    toggleFavorite,
    deleteGeneration,
    retryGeneration,
    promoteToDrive,
    refresh,
  };
}
