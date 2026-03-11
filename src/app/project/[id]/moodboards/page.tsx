"use client";

import { useState, useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { timeAgo } from "@/lib/utils/format";
import type { Moodboard } from "@/lib/types";

interface MoodboardWithMeta extends Moodboard {
  itemCount: number;
  thumbnails: Array<{
    id: number;
    type: string;
    fileId: number | null;
    storagePath: string | null;
    colorValue: string | null;
  }>;
}

export default function MoodboardsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [boards, setBoards] = useState<MoodboardWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current || loading || boards.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-moodboard-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, boards.length]);

  function fetchBoards() {
    fetch(`/api/moodboards?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        setBoards(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    fetchBoards();
  }, [projectId]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      const board = await res.json();
      toast.success("Moodboard created");
      setCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      router.push(`/project/${projectId}/moodboards/${board.id}`);
    } catch {
      toast.error("Failed to create moodboard");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(boardId: number) {
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    try {
      const res = await fetch(`/api/moodboards/${boardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Moodboard deleted");
    } catch {
      toast.error("Failed to delete moodboard");
      fetchBoards();
    }
  }

  async function handleDuplicate(boardId: number) {
    setDuplicatingId(boardId);
    try {
      const detailRes = await fetch(`/api/moodboards/${boardId}`);
      if (!detailRes.ok) throw new Error("Failed to fetch moodboard");
      const detail = await detailRes.json();

      const createRes = await fetch("/api/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          title: `${detail.title} (Copy)`,
          description: detail.description || undefined,
          layout: detail.layout || undefined,
        }),
      });
      if (!createRes.ok) throw new Error("Failed to create moodboard copy");

      toast.success("Moodboard duplicated");
      fetchBoards();
    } catch {
      toast.error("Failed to duplicate moodboard");
    } finally {
      setDuplicatingId(null);
    }
  }

  // Loading skeleton matching the redesigned card layout
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <Skeleton className="h-8 w-52 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reference Boards
          </h1>
          <p className="text-muted-foreground mt-1">
            Collect images, colors, and notes into visual moodboards
          </p>
        </div>
        <Button size="lg" onClick={() => setCreateOpen(true)} className="shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mr-1.5"
          >
            <path d="M8 2v12M2 8h12" />
          </svg>
          New Board
        </Button>
      </div>

      {/* Board Grid */}
      {boards.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed border-2 border-border/40 rounded-xl backdrop-blur-sm bg-card/80">
          <CardContent className="relative flex flex-col items-center justify-center py-24 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
            {/* Placeholder mosaic icon */}
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-5 shadow-[0_0_30px_oklch(0.585_0.233_264/0.15)]">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground"
              >
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <rect x="5" y="5" width="5" height="7" rx="1" />
                <rect x="14" y="5" width="5" height="4" rx="1" />
                <rect x="14" y="13" width="5" height="6" rx="1" />
                <rect x="5" y="16" width="5" height="3" rx="1" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-2">No moodboards yet</h2>
            <p className="relative text-sm text-muted-foreground mb-8 text-center max-w-md leading-relaxed">
              Create mood boards to define the visual style of your production.
              Collect reference images, color palettes, and style inspirations.
            </p>
            <Button size="lg" onClick={() => setCreateOpen(true)} className="relative shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)]">
              Create First Board
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div ref={gridRef} className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Card
              key={board.id}
              data-moodboard-card
              className="group cursor-pointer rounded-xl border border-border/40 backdrop-blur-sm bg-card/80 transition-all duration-300 hover:shadow-[0_0_20px_oklch(0.585_0.233_264/0.12)] hover:-translate-y-1 overflow-hidden"
              onClick={() =>
                router.push(`/project/${projectId}/moodboards/${board.id}`)
              }
            >
              <CardContent className="p-4">
                {/* 4-image mosaic preview or placeholder pattern - aspect-video */}
                <div className="aspect-video rounded-lg overflow-hidden bg-muted/30 relative mb-3 ring-1 ring-border/20">
                  {board.thumbnails.length > 0 ? (
                    <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-0.5">
                      {board.thumbnails.slice(0, 4).map((thumb) => (
                        <div key={thumb.id} className="relative overflow-hidden bg-muted/30">
                          {thumb.fileId ? (
                            <Image
                              src={`/api/drive/files/${thumb.fileId}`}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 15vw"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                        </div>
                      ))}
                      {/* Fill empty slots for 2x2 grid */}
                      {Array.from({
                        length: Math.max(0, 4 - board.thumbnails.length),
                      }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-muted/20" />
                      ))}
                    </div>
                  ) : (
                    /* Placeholder pattern when no images */
                    <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-1 p-3">
                      <div className="rounded bg-muted-foreground/[0.06] col-span-2 row-span-2" />
                      <div className="rounded bg-muted-foreground/[0.06]" />
                      <div className="rounded bg-muted-foreground/[0.06]" />
                    </div>
                  )}

                  {/* Action buttons overlay */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(board.id); }}
                      className="w-9 h-9 rounded-md bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-primary/80 transition-all disabled:opacity-50"
                      title="Duplicate board"
                      aria-label={`Duplicate moodboard ${board.title}`}
                      disabled={duplicatingId === board.id}
                    >
                      {duplicatingId === board.id ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(board.id); }}
                      className="w-9 h-9 rounded-md bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-destructive/80 transition-all"
                      title="Delete board"
                      aria-label={`Delete moodboard ${board.title}`}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Board name */}
                <h3 className="text-base font-semibold truncate">{board.title}</h3>

                {/* Item count + last edited */}
                <p className="text-xs text-muted-foreground mt-1">
                  {board.itemCount} item{board.itemCount !== 1 ? "s" : ""}
                  {" \u00B7 "}
                  Last edited {timeAgo(board.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete moodboard"
        description="This moodboard and all its items will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Board"
        onConfirm={() => { if (deleteTarget !== null) return handleDelete(deleteTarget); }}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Moodboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="moodboard-title">Title</Label>
              <Input
                id="moodboard-title"
                placeholder="e.g. Act 1 Visual Tone"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moodboard-desc">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="moodboard-desc"
                placeholder="Describe the mood, tone, or purpose of this board..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={!newTitle.trim() || creating}
              className="w-full"
            >
              {creating ? "Creating..." : "Create Board"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
