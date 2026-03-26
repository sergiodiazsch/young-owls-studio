"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { gsap } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { FilmSlate } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { useWalkthrough } from "@/hooks/use-walkthrough";


const Walkthrough = dynamic(
  () => import("@/components/onboarding/walkthrough").then((m) => ({ default: m.Walkthrough })),
  { ssr: false }
);
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useWorkspaceCover } from "@/hooks/use-workspace-cover";
import { Checkbox } from "@/components/ui/checkbox";
import type { Project } from "@/lib/types";

interface SharedAsset {
  id: number;
  assetType: string;
  name: string;
  description: string | null;
  thumbnailPath: string | null;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [uploadingCover, setUploadingCover] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharedAssets, setSharedAssets] = useState<SharedAsset[]>([]);
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());
  const [libraryOpen, setLibraryOpen] = useState(false);
  const wt = useWalkthrough();
  const { cover, hasCover, update: updateCover, clear: clearCover } = useWorkspaceCover();
  const gridRef = useRef<HTMLDivElement>(null);

  // GSAP stagger on project cards
  useEffect(() => {
    if (!gridRef.current || loading || projects.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-project-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 18, scale: 0.97, stagger: 0.07, duration: 0.5, ease: "power3.out", clearProps: "all" });
  }, [loading, projects.length]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => { setProjects(data); setLoading(false); })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        toast.error(err?.message || "Failed to load projects");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    setSelectedImports(new Set());
    setLibraryOpen(false);
    fetch("/api/shared-assets")
      .then(r => r.json())
      .then(setSharedAssets)
      .catch(() => setSharedAssets([]));
  }, [dialogOpen]);

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), subtitle: newSubtitle.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }
      const project = await res.json();
      if (!project?.id) throw new Error("Invalid project response");

      // Import selected shared assets into the new project
      if (selectedImports.size > 0) {
        await Promise.all(
          Array.from(selectedImports).map(sharedAssetId =>
            fetch("/api/shared-assets/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sharedAssetId, targetProjectId: project.id }),
            }).catch(() => {})
          )
        );
      }

      setDialogOpen(false);
      setNewTitle("");
      setNewSubtitle("");
      router.push(`/project/${project.id}/upload`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
    }
  }

  const handleCoverUpload = useCallback(async (projectId: number, file: File) => {
    setUploadingCover(projectId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/cover`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { coverImage } = await res.json();
      setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, coverImage } : p));
      toast.success("Cover updated");
    } catch {
      toast.error("Failed to upload cover");
    } finally {
      setUploadingCover(null);
    }
  }, []);

  function openEditDialog(project: Project) {
    setEditTarget(project);
    setEditTitle(project.title);
    setEditSubtitle(project.subtitle || "");
  }

  async function handleEdit() {
    if (!editTarget || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          subtitle: editSubtitle.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update project");
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === editTarget.id
            ? { ...p, title: updated.title, subtitle: updated.subtitle }
            : p
        )
      );
      setEditTarget(null);
      toast.success("Project updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* ── Header ── */}
      <header className="relative overflow-hidden border-b border-border/50" style={{ boxShadow: "0 1px 30px var(--glow-primary)" }}>
        {/* Cover image */}
        {hasCover && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${cover.imageUrl})` }}
            />
            {cover.overlayEnabled && (
              <div
                className="absolute inset-0"
                style={{ backgroundColor: cover.overlayColor, opacity: cover.overlayOpacity }}
              />
            )}
          </>
        )}
        {/* Subtle ambient glow (only when no cover) */}
        {!hasCover && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-40%] left-[10%] w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[120px]" />
            <div className="absolute bottom-[-30%] right-[15%] w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-[100px]" />
            <div className="absolute top-[20%] right-[30%] w-[300px] h-[300px] rounded-full bg-accent/[0.03] blur-[80px]" />
          </div>
        )}

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-8 sm:pt-14 sm:pb-12">
          <div className="flex items-start justify-between mb-8 stagger-header">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shadow-md film-glow" style={{ boxShadow: "0 0 20px var(--glow-primary)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-foreground">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" />
                </svg>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight" style={hasCover ? { color: cover.textColor } : { textShadow: "0 0 30px var(--glow-primary)" }}>Young Owls Studio</span>
                <p
                  className={hasCover ? "text-[10px] font-mono tracking-widest" : "text-[10px] text-muted-foreground font-mono tracking-widest"}
                  style={hasCover ? { color: cover.textColor, opacity: 0.6 } : undefined}
                >DARK CINEMA PREMIUM</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Cover settings popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" title="Cover image" aria-label="Cover image" className={hasCover ? "text-white/80 hover:text-white hover:bg-white/10" : ""}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="20" height="20" rx="3" />
                      <circle cx="8" cy="8" r="2" />
                      <path d="M2 16l5-5 4 4 3-3 8 8" />
                    </svg>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 space-y-4" align="end">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cover Image</Label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Image URL</Label>
                    <Input
                      value={cover.imageUrl}
                      onChange={(e) => updateCover({ imageUrl: e.target.value })}
                      placeholder="https://images.unsplash.com/..."
                      className="text-xs h-8"
                    />
                  </div>
                  {hasCover && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Overlay</Label>
                        <Switch
                          checked={cover.overlayEnabled}
                          onCheckedChange={(v) => updateCover({ overlayEnabled: v })}
                        />
                      </div>
                      {cover.overlayEnabled && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Overlay Color</Label>
                              <input
                                type="color"
                                value={cover.overlayColor}
                                onChange={(e) => updateCover({ overlayColor: e.target.value })}
                                className="w-7 h-7 rounded border border-border cursor-pointer"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Opacity</Label>
                              <span className="text-xs text-muted-foreground font-mono">{Math.round(cover.overlayOpacity * 100)}%</span>
                            </div>
                            <Slider
                              value={[cover.overlayOpacity]}
                              onValueChange={([v]) => updateCover({ overlayOpacity: v })}
                              min={0}
                              max={1}
                              step={0.05}
                              className="w-full"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Text Color</Label>
                          <input
                            type="color"
                            value={cover.textColor}
                            onChange={(e) => updateCover({ textColor: e.target.value })}
                            className="w-7 h-7 rounded border border-border cursor-pointer"
                          />
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={clearCover}>
                        Remove Cover
                      </Button>
                    </>
                  )}
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} title="Settings" aria-label="Settings" data-tour="settings" className={hasCover ? "text-white/80 hover:text-white hover:bg-white/10" : ""}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="max-w-xl">
            <h1
              className={hasCover ? "text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1] mb-3" : "text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1] mb-3 text-gradient-hero"}
              style={hasCover ? { color: cover.textColor } : undefined}
            >
              Workspace
            </h1>
            <p
              className={hasCover ? "text-sm leading-relaxed mb-6 max-w-md" : "text-sm text-muted-foreground/80 leading-relaxed mb-6 max-w-md"}
              style={hasCover ? { color: cover.textColor, opacity: 0.7 } : undefined}
            >
              Your production suite. Select a project or create a new one to begin.
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" data-tour="new-project" className="h-11 px-6 text-sm font-semibold gap-2 glow-md hover:shadow-md transition-shadow duration-300">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" placeholder="e.g. Tax Free Episode 1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtitle">Subtitle (optional)</Label>
                    <Input id="subtitle" placeholder="e.g. Pilot Episode" value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} />
                  </div>

                  {/* Import from Library */}
                  {sharedAssets.length > 0 && (
                    <div className="rounded-lg border border-border/40 overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 transition-colors"
                        onClick={() => setLibraryOpen(v => !v)}
                      >
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                          <span className="text-xs font-medium text-muted-foreground">Import from Library</span>
                          {selectedImports.size > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">{selectedImports.size}</span>
                          )}
                        </div>
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-muted-foreground transition-transform duration-200 ${libraryOpen ? "rotate-180" : ""}`}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                      {libraryOpen && (
                        <div className="border-t border-border/30 p-3 space-y-2 max-h-48 overflow-y-auto">
                          {sharedAssets.map(asset => (
                            <label key={asset.id} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/30 cursor-pointer transition-colors">
                              <Checkbox
                                checked={selectedImports.has(asset.id)}
                                onCheckedChange={(checked: boolean | "indeterminate") => {
                                  setSelectedImports(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(asset.id); else next.delete(asset.id);
                                    return next;
                                  });
                                }}
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                {asset.thumbnailPath ? (
                                  <img src={`/api/storage/${asset.thumbnailPath}`} alt="" className="w-7 h-7 rounded object-cover bg-muted" />
                                ) : (
                                  <div className="w-7 h-7 rounded bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                    {asset.assetType === "character" ? "C" : asset.assetType === "location" ? "L" : "P"}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">{asset.name}</p>
                                  <p className="text-[10px] text-muted-foreground capitalize">{asset.assetType}</p>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="w-full h-12 text-base font-semibold hover:shadow-md transition-shadow duration-300">
                    {creating ? (
                      <span className="flex items-center gap-2">
                        <span className="loader-spin loader-spin-sm border-primary-foreground/30 border-t-primary-foreground" />
                        Creating...
                      </span>
                    ) : (
                      "Create & Upload Screenplay"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* ── Project Grid ── */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/40 backdrop-blur-sm bg-card/60 p-5 space-y-3">
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2 pt-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-2 border-border/40 empty-state-decoration backdrop-blur-sm bg-card/60">
            <CardContent className="flex flex-col items-center justify-center py-24 relative z-10">
              <div
                className="w-24 h-24 rounded-2xl bg-primary/10 bg-primary/5 glow-md flex items-center justify-center mb-6 animate-float"
                style={{ boxShadow: "0 0 30px var(--glow-primary)" }}
              >
                <FilmSlate size={40} weight="duotone" className="text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2 tracking-tight">Your stage is set</h2>
              <p className="text-sm text-muted-foreground/70 mb-8 text-center max-w-sm leading-relaxed">
                Create your first project to start building your screenplay production.
              </p>
              <Button
                size="lg"
                onClick={() => setDialogOpen(true)}
                className="cta-glow h-12 px-8 text-base font-semibold hover:shadow-md transition-shadow duration-300"
                style={{ boxShadow: "0 0 15px var(--glow-primary)" }}
              >
                Create First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest font-mono">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-list stagger-grid card-grid" data-tour="project-list">
              {projects.map((p) => {
                const scenes = p.sceneCount || 0;
                const characters = p.characterCount || 0;
                const media = p.mediaCount || 0;
                const hasContent = scenes > 0;
                const progress = hasContent ? Math.min(100, Math.round((media / Math.max(1, scenes)) * 100)) : 0;

                return (
                  <div key={p.id} data-project-card className="relative group">
                    <Link href={`/project/${p.id}`} className="block" prefetch={true}>
                      <Card className="cursor-pointer backdrop-blur-sm bg-card/80 border-border/40 hover:border-primary/30 transition-all duration-300 overflow-hidden hover:shadow-md hover:-translate-y-0.5">
                        {/* Cover image or accent bar */}
                        {p.coverImage ? (
                          <div className="relative h-32 overflow-hidden bg-muted/20">
                            <img
                              src={`/api/projects/${p.id}/cover`}
                              alt=""
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                          </div>
                        ) : (
                          <div className="relative h-20 overflow-hidden bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent">
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04]">
                              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5">
                                <rect x="2" y="2" width="20" height="20" rx="3" /><path d="M7 2v20M17 2v20M2 7h20M2 17h20" />
                              </svg>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/40 to-transparent" />
                          </div>
                        )}
                        <CardContent className="p-5">
                          {/* Title + subtitle */}
                          <div className="mb-4">
                            <h3 className="text-base font-bold truncate tracking-tight group-hover:text-primary transition-colors">{p.title}</h3>
                            {p.subtitle && <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{p.subtitle}</p>}
                          </div>

                          {/* Stats grid */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center rounded-lg bg-muted/30 border border-border/20 py-2.5 px-1">
                              <p className="text-lg font-bold tabular-nums">{scenes}</p>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">Scenes</p>
                            </div>
                            <div className="text-center rounded-lg bg-muted/30 border border-border/20 py-2.5 px-1">
                              <p className="text-lg font-bold tabular-nums">{characters}</p>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">Characters</p>
                            </div>
                            <div className="text-center rounded-lg bg-muted/30 border border-border/20 py-2.5 px-1">
                              <p className="text-lg font-bold tabular-nums">{media}</p>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">Files</p>
                            </div>
                          </div>

                          {/* Progress bar */}
                          {hasContent && (
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-muted-foreground">Production progress</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/60 transition-all duration-700"
                                  style={{ width: `${progress}%`, boxShadow: "0 0 8px var(--glow-primary)" }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Date */}
                          <p className="text-[10px] text-muted-foreground/60 font-mono">
                            {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>

                    {/* Cover upload button — OUTSIDE the Link */}
                    <label
                      className="absolute top-2 left-2 text-foreground hover:text-foreground transition-all p-1.5 rounded-md bg-background/70 backdrop-blur-sm hover:bg-background/90 opacity-0 group-hover:opacity-100 focus-within:opacity-100 z-10 cursor-pointer"
                      title="Set cover image"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {uploadingCover === p.id ? (
                        <span className="loader-spin loader-spin-sm border-muted-foreground/30 border-t-muted-foreground block w-[14px] h-[14px]" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="2" y="2" width="20" height="20" rx="3" />
                          <circle cx="8" cy="8" r="2" />
                          <path d="M2 16l5-5 4 4 3-3 8 8" />
                        </svg>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCoverUpload(p.id, file);
                          e.target.value = "";
                        }}
                      />
                    </label>

                    {/* Edit button — OUTSIDE the Link to prevent navigation */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditDialog(p); }}
                      className={`absolute ${p.coverImage ? "top-2" : "top-[5.5rem]"} right-10 text-foreground hover:text-primary transition-all p-1.5 rounded-md bg-background/70 backdrop-blur-sm hover:bg-background/90 opacity-0 group-hover:opacity-100 focus:opacity-100 z-10`}
                      aria-label={`Edit project ${p.title}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                      </svg>
                    </button>

                    {/* Delete button — OUTSIDE the Link to prevent navigation */}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(p.id); }}
                      className={`absolute ${p.coverImage ? "top-2" : "top-[5.5rem]"} right-2 text-foreground hover:text-destructive transition-all p-1.5 rounded-md bg-background/70 backdrop-blur-sm hover:bg-background/90 opacity-0 group-hover:opacity-100 focus:opacity-100 z-10`}
                      aria-label={`Delete project ${p.title}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Edit Project Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                placeholder="Project title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-subtitle">Subtitle / Description</Label>
              <Textarea
                id="edit-subtitle"
                placeholder="e.g. Pilot Episode"
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
            <Button
              onClick={handleEdit}
              disabled={saving || !editTitle.trim()}
              className="w-full h-12 text-base font-semibold hover:shadow-md transition-shadow duration-300"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="loader-spin loader-spin-sm border-primary-foreground/30 border-t-primary-foreground" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete project"
        description="This will permanently delete this project and all its data (scenes, characters, files). This action cannot be undone."
        confirmLabel="Delete Project"
        onConfirm={() => { if (deleteTarget !== null) return handleDelete(deleteTarget); }}
      />

      <Walkthrough
        isActive={wt.isActive}
        step={wt.step}
        currentStep={wt.currentStep}
        totalSteps={wt.totalSteps}
        onNext={wt.next}
        onPrev={wt.prev}
        onSkip={wt.skip}
      />
    </div>
  );
}
