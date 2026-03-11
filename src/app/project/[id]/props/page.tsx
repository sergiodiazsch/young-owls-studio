"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { gsap } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Prop } from "@/lib/types";

interface PropFile {
  linkId: number;
  isPrimary: boolean;
  file: { id: number; filename: string; storagePath: string; mimeType: string; fileSize: number };
}

export default function PropsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Detail sheet
  const [selectedProp, setSelectedProp] = useState<Prop | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [propFiles, setPropFiles] = useState<PropFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Prop | null>(null);

  // Image data per prop (primary thumbnails)
  const [thumbs, setThumbs] = useState<Record<number, string>>({});

  const gridRef = useRef<HTMLDivElement>(null);

  // ── Load props ──
  const loadProps = useCallback(async () => {
    try {
      const res = await fetch(`/api/props?projectId=${projectId}`);
      if (!res.ok) throw new Error();
      const data: Prop[] = await res.json();
      setProps(data);

      // Load primary thumbnails in parallel
      const filePromises = data.map(async (p) => {
        try {
          const r = await fetch(`/api/props/${p.id}/files`);
          const files: PropFile[] = await r.json();
          const primary = files.find((f) => f.isPrimary) ?? files[0];
          if (primary) return { propId: p.id, path: `/api/storage/${primary.file.storagePath}` };
        } catch { /* ignore */ }
        return null;
      });
      const results = await Promise.all(filePromises);
      const newThumbs: Record<number, string> = {};
      for (const r of results) {
        if (r) newThumbs[r.propId] = r.path;
      }
      setThumbs(newThumbs);
    } catch {
      toast.error("Failed to load props");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadProps(); }, [loadProps]);

  // ── GSAP stagger animation ──
  useEffect(() => {
    if (loading || !gridRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const cards = gridRef.current.querySelectorAll("[data-prop-card]");
    if (cards.length === 0) return;
    gsap.fromTo(cards, { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: "power2.out" });
  }, [loading, props]);

  // ── Create prop ──
  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/props", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId), name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Prop created");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      loadProps();
    } catch {
      toast.error("Failed to create prop");
    } finally {
      setCreating(false);
    }
  }

  // ── Delete prop ──
  async function handleDelete(prop: Prop) {
    try {
      await fetch(`/api/props/${prop.id}`, { method: "DELETE" });
      toast.success(`Deleted "${prop.name}"`);
      if (selectedProp?.id === prop.id) setDetailOpen(false);
      loadProps();
    } catch {
      toast.error("Failed to delete");
    }
  }

  // ── Open detail sheet ──
  async function openDetail(prop: Prop) {
    setSelectedProp(prop);
    setEditName(prop.name);
    setEditDesc(prop.description || "");
    setEditNotes(prop.aiGenerationNotes || "");
    const parsed: string[] = prop.tags ? JSON.parse(prop.tags) : [];
    setEditTags(JSON.stringify(parsed));
    setTagInput("");
    setDetailOpen(true);

    // Load files
    try {
      const r = await fetch(`/api/props/${prop.id}/files`);
      setPropFiles(await r.json());
    } catch {
      setPropFiles([]);
    }
  }

  // ── Save detail ──
  async function handleSave() {
    if (!selectedProp) return;
    setSaving(true);
    try {
      let tags: string | null = editTags;
      try { JSON.parse(tags); } catch { tags = "[]"; }

      await fetch(`/api/props/${selectedProp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim() || selectedProp.name,
          description: editDesc.trim() || null,
          aiGenerationNotes: editNotes.trim() || null,
          tags,
        }),
      });
      toast.success("Saved");
      loadProps();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  // ── Tag helpers ──
  function currentTags(): string[] {
    try { return JSON.parse(editTags); } catch { return []; }
  }
  function addTag(tag: string) {
    const tags = currentTags();
    if (tag && !tags.includes(tag)) {
      setEditTags(JSON.stringify([...tags, tag]));
    }
    setTagInput("");
  }
  function removeTag(tag: string) {
    setEditTags(JSON.stringify(currentTags().filter((t) => t !== tag)));
  }

  // ── Image upload ──
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedProp || !e.target.files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("projectId", projectId);
        const uploadRes = await fetch("/api/drive/files/upload", { method: "POST", body: fd });
        if (!uploadRes.ok) throw new Error();
        const driveFile = await uploadRes.json();

        await fetch("/api/drive/prop-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propId: selectedProp.id, fileId: driveFile.id, isPrimary: propFiles.length === 0 }),
        });
      }
      // Refresh files
      const r = await fetch(`/api/props/${selectedProp.id}/files`);
      setPropFiles(await r.json());
      loadProps();
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // ── Set primary image ──
  async function setPrimary(linkId: number) {
    if (!selectedProp) return;
    await fetch("/api/drive/prop-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propId: selectedProp.id, linkId }),
    });
    const r = await fetch(`/api/props/${selectedProp.id}/files`);
    setPropFiles(await r.json());
    loadProps();
  }

  // ── Remove image ──
  async function removeImage(linkId: number) {
    await fetch("/api/drive/prop-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: linkId }),
    });
    setPropFiles((prev) => prev.filter((f) => f.linkId !== linkId));
    loadProps();
  }

  // ── Filter ──
  const filtered = props.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Props</h1>
          <p className="text-sm text-muted-foreground">
            {props.length} prop{props.length !== 1 ? "s" : ""} in project
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search props..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button onClick={() => setCreateOpen(true)}>New Prop</Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium mb-1">
            {props.length === 0 ? "No props yet" : "No matches"}
          </p>
          <p className="text-sm">
            {props.length === 0
              ? "Create props to track key objects, vehicles, weapons, and other items in your screenplay."
              : "Try adjusting your search."}
          </p>
          {props.length === 0 && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              Create First Prop
            </Button>
          )}
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((prop) => {
            const tags: string[] = prop.tags ? JSON.parse(prop.tags) : [];
            return (
              <Card
                key={prop.id}
                data-prop-card
                className="group cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => openDetail(prop)}
              >
                <CardContent className="p-0">
                  {/* Thumbnail */}
                  <div className="aspect-square relative bg-muted rounded-t-xl overflow-hidden">
                    {thumbs[prop.id] ? (
                      <Image
                        src={thumbs[prop.id]}
                        alt={prop.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-3xl font-bold text-muted-foreground/30">
                          {prop.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Dropdown */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="8" cy="3" r="1.5" />
                              <circle cx="8" cy="8" r="1.5" />
                              <circle cx="8" cy="13" r="1.5" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => openDetail(prop)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(prop)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{prop.name}</p>
                    {prop.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {prop.description}
                      </p>
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                        {tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Prop</DialogTitle>
            <DialogDescription>Add a prop to your project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Lightsaber, Treasure Map, Red Mustang"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief description of the prop..."
                rows={3}
              />
            </div>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create Prop"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedProp?.name || "Prop"}</SheetTitle>
            <SheetDescription>Edit prop details and reference images.</SheetDescription>
          </SheetHeader>
          {selectedProp && (
            <div className="flex flex-col gap-5 mt-4">
              <div>
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {currentTags().map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button
                        className="ml-1 text-muted-foreground hover:text-foreground"
                        onClick={() => removeTag(t)}
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                </div>
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Type tag and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      addTag(tagInput.trim());
                    }
                  }}
                />
              </div>
              <div>
                <Label>AI Generation Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe how this prop should look when generating images with @mention..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  These notes are appended to prompts when you @mention this prop.
                </p>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>

              {/* Reference Images */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Reference Images</Label>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    <Button variant="outline" size="sm" asChild disabled={uploading}>
                      <span>{uploading ? "Uploading..." : "Add Image"}</span>
                    </Button>
                  </label>
                </div>
                {propFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                    No reference images yet. Upload images to visually define this prop.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {propFiles.map((pf) => (
                      <div key={pf.linkId} className="relative group aspect-square rounded-lg overflow-hidden border">
                        <Image
                          src={`/api/storage/${pf.file.storagePath}`}
                          alt={pf.file.filename}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {pf.isPrimary && (
                          <Badge className="absolute top-1 left-1 text-[9px] px-1 py-0">Cover</Badge>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {!pf.isPrimary && (
                            <Button size="sm" variant="secondary" className="h-6 text-[10px]" onClick={() => setPrimary(pf.linkId)}>
                              Set Cover
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={() => removeImage(pf.linkId)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will permanently remove this prop and all its reference images."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
