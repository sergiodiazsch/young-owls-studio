"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { ImageGeneration, ImageGenerationParams } from "@/lib/types";

const MAX_CONCURRENT = 4;

interface EnqueueOptions {
  prompt: string;
  model?: string;
  params?: ImageGenerationParams;
  count?: number;
  seed?: number;
  /** For camera-angles / stable-zero123: preset angles to generate */
  cameraPresets?: Array<{ label: string; azimuth: number; elevation: number; distance: number }>;
  /** Source image storage path for camera angle engines */
  sourceImagePath?: string;
}

export function useImageGenerationQueue(projectId: string) {
  const [generations, setGenerations] = useState<ImageGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const activeCount = useRef(0);
  const queue = useRef<Array<{ tempId: string; prompt: string; model: string; params: ImageGenerationParams; batchId?: string; batchLabel?: string }>>([]);

  // ── Load existing generations from DB on mount ──
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/generate/image/generations?projectId=${projectId}&limit=200`);
      if (!res.ok) return;
      const data: ImageGeneration[] = await res.json();

      // Mark stale "generating" rows as failed (interrupted by refresh)
      const stale = data.filter((g) => g.status === "generating");
      for (const g of stale) {
        await fetch(`/api/generate/image/generations/${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed", error: "Interrupted by page reload" }),
        }).catch(() => {});
      }

      setGenerations(data.map((g) =>
        g.status === "generating" ? { ...g, status: "failed" as const, error: "Interrupted by page reload" } : g
      ));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Process queue ──
  const processQueue = useCallback(() => {
    while (activeCount.current < MAX_CONCURRENT && queue.current.length > 0) {
      const item = queue.current.shift()!;
      activeCount.current++;

      fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          prompt: item.prompt,
          model: item.model,
          params: item.params,
        }),
      })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok || data.status === "failed") {
            // Update the placeholder with the real DB row (failed)
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === -Number(item.tempId.split("-").pop())
                  ? { ...data, batchId: item.batchId, batchLabel: item.batchLabel }
                  : g
              )
            );
            toast.error(data.error || "Generation failed");
          } else {
            // Replace optimistic entry with real DB row
            setGenerations((prev) =>
              prev.map((g) =>
                g.id === -Number(item.tempId.split("-").pop())
                  ? { ...data, batchId: item.batchId, batchLabel: item.batchLabel }
                  : g
              )
            );
            toast.success(item.batchLabel ? `${item.batchLabel} generated` : "Image generated", {
              action: {
                label: "Save to Drive",
                onClick: () => {
                  fetch("/api/generate/image/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ generationId: data.id }),
                  })
                    .then((r) => {
                      if (!r.ok) throw new Error("Save failed");
                      return r.json();
                    })
                    .then((result) => {
                      setGenerations((prev) =>
                        prev.map((g) => (g.id === data.id ? { ...g, driveFileId: result.driveFileId ?? result.id } : g))
                      );
                      toast.success("Saved to Drive");
                    })
                    .catch(() => toast.error("Failed to save to Drive"));
                },
              },
            });

            // Fire auto-tagging in background (non-blocking)
            if (data.id && data.status === "completed") {
              fetch("/api/generate/image/auto-tag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generationId: data.id }),
              })
                .then((r) => r.json())
                .then((tagData) => {
                  if (tagData.tags) {
                    setGenerations((prev) =>
                      prev.map((g) => g.id === data.id ? { ...g, tags: tagData.tags } : g)
                    );
                  }
                })
                .catch(() => {}); // Tagging failure is non-critical
            }
          }
        })
        .catch((err) => {
          const message = err.message || "Generation failed";
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === -Number(item.tempId.split("-").pop())
                ? { ...g, status: "failed" as const, error: message }
                : g
            )
          );
          toast.error(message);
        })
        .finally(() => {
          activeCount.current--;
          processQueue();

          // When all work is done, trigger consistency check in background
          if (activeCount.current === 0 && queue.current.length === 0) {
            fetch("/api/consistency-check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: Number(projectId) }),
            }).catch(() => {}); // Non-blocking
          }
        });
    }
  }, [projectId]);

  // ── Enqueue new generations ──
  const enqueue = useCallback(
    (options: EnqueueOptions) => {
      const model = options.model || "nano-banana-pro";
      const baseParams = {
        ...options.params,
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
      };

      // Camera angles / stable-zero123: batch of presets (1 call per angle)
      if ((model === "camera-angles" || model === "stable-zero123") && options.cameraPresets) {
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const optimistic: ImageGeneration[] = [];

        for (let i = 0; i < options.cameraPresets.length; i++) {
          const preset = options.cameraPresets[i];
          const fakeId = -(Date.now() + i); // negative ID = optimistic

          const itemParams: ImageGenerationParams = {
            ...baseParams,
            azimuth: preset.azimuth,
            elevation: preset.elevation,
            distance: preset.distance,
            ...(options.sourceImagePath ? { sourceImagePath: options.sourceImagePath } : {}),
          };

          optimistic.push({
            id: fakeId,
            projectId: Number(projectId),
            prompt: options.prompt,
            model,
            status: "queued",
            storagePath: null,
            mimeType: "image/png",
            fileSize: 0,
            seed: null,
            error: null,
            params: JSON.stringify(itemParams),
            isFavorite: false,
            driveFileId: null,
            batchId,
            batchLabel: preset.label,
            tags: null,
            cost: null,
            createdAt: new Date().toISOString(),
          });

          queue.current.push({
            tempId: `temp-${fakeId}`,
            prompt: options.prompt,
            model,
            params: itemParams,
            batchId,
            batchLabel: preset.label,
          });
        }

        setGenerations((prev) => [...optimistic, ...prev]);
        processQueue();
        return;
      }

      // Era3D: single API call → 6 canonical views
      if (model === "era3d" && options.sourceImagePath) {
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const viewLabels = ["Front", "Right", "Back", "Left", "Front-Right", "Back-Left"];
        const optimistic: ImageGeneration[] = [];

        // Era3D returns 6 images in one call, but we make 1 API call
        // and rely on the API to handle the multi-image response
        const fakeId = -(Date.now());
        const itemParams: ImageGenerationParams = {
          ...baseParams,
          sourceImagePath: options.sourceImagePath,
        };

        // Create 6 optimistic rows
        for (let i = 0; i < viewLabels.length; i++) {
          optimistic.push({
            id: -(Date.now() + i),
            projectId: Number(projectId),
            prompt: options.prompt,
            model,
            status: "queued",
            storagePath: null,
            mimeType: "image/png",
            fileSize: 0,
            seed: null,
            error: null,
            params: JSON.stringify(itemParams),
            isFavorite: false,
            driveFileId: null,
            batchId,
            batchLabel: viewLabels[i],
            tags: null,
            cost: null,
            createdAt: new Date().toISOString(),
          });
        }

        // Only 1 queue item — the API call handles all 6
        queue.current.push({
          tempId: `temp-${fakeId}`,
          prompt: options.prompt,
          model,
          params: itemParams,
          batchId,
          batchLabel: "Era3D Multi-View",
        });

        setGenerations((prev) => [...optimistic, ...prev]);
        processQueue();
        return;
      }

      // Standard: generate `count` images
      const count = options.count || 1;
      const optimistic: ImageGeneration[] = [];

      for (let i = 0; i < count; i++) {
        const fakeId = -(Date.now() + i);

        optimistic.push({
          id: fakeId,
          projectId: Number(projectId),
          prompt: options.prompt,
          model,
          status: "queued",
          storagePath: null,
          mimeType: "image/png",
          fileSize: 0,
          seed: null,
          error: null,
          params: JSON.stringify(baseParams),
          isFavorite: false,
          driveFileId: null,
          batchId: null,
          batchLabel: null,
          tags: null,
          cost: null,
          createdAt: new Date().toISOString(),
        });

        queue.current.push({
          tempId: `temp-${fakeId}`,
          prompt: options.prompt,
          model,
          params: baseParams,
        });
      }

      setGenerations((prev) => [...optimistic, ...prev]);
      processQueue();
    },
    [projectId, processQueue]
  );

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

    await fetch(`/api/generate/image/generations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: newVal }),
    }).catch(() => {
      // Revert on failure
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, isFavorite: !newVal } : g))
      );
    });
  }, []);

  // ── Delete generation ──
  const deleteGeneration = useCallback(async (id: number) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id));

    await fetch(`/api/generate/image/generations/${id}`, {
      method: "DELETE",
    }).catch(() => {
      toast.error("Failed to delete");
      refresh();
    });
  }, [refresh]);

  // ── Promote to drive ──
  const promoteToDrive = useCallback(async (id: number, folderId?: number, sceneId?: number) => {
    try {
      const res = await fetch("/api/generate/image/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: id, folderId, sceneId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save to drive");
      }
      const result = await res.json();

      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, driveFileId: result.driveFileId ?? result.id } : g))
      );

      toast.success("Saved to Drive");
      return result;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      return null;
    }
  }, []);

  // ── Clear completed/failed ──
  const clearCompleted = useCallback(() => {
    let toRemove: typeof generations = [];
    setGenerations((prev) => {
      toRemove = prev.filter((g) => g.status === "completed" || g.status === "failed");
      return prev.filter((g) => g.status !== "completed" && g.status !== "failed");
    });

    // Delete from DB in background
    for (const g of toRemove) {
      if (g.id > 0) {
        fetch(`/api/generate/image/generations/${g.id}`, { method: "DELETE" }).catch(() => {});
      }
    }
  }, []);

  return {
    generations,
    loading,
    enqueue,
    toggleFavorite,
    deleteGeneration,
    promoteToDrive,
    clearCompleted,
    refresh,
  };
}
