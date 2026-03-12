"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import dynamic from "next/dynamic";

const SceneModifyDialog = dynamic(
  () => import("@/components/scene-modify-dialog").then((m) => ({ default: m.SceneModifyDialog })),
  { ssr: false }
);
const DialogueVoicePanel = dynamic(
  () => import("@/components/dialogue-voice-panel").then((m) => ({ default: m.DialogueVoicePanel })),
  { ssr: false }
);
const ProductionNotes = dynamic(
  () => import("@/components/production-notes").then((m) => ({ default: m.ProductionNotes })),
  { ssr: false }
);
import { toast } from "sonner";
import type { Scene, Dialogue, Direction, DriveFile, VoiceGeneration, Character, Location } from "@/lib/types";

interface LinkedFile extends DriveFile {
  linkId: number;
}

interface FullScene extends Scene {
  dialogues: Dialogue[];
  directions: Direction[];
  linkedFiles: LinkedFile[];
}

export default function SceneDetailPage() {
  const params = useParams();
  const { id: projectId, sceneId } = params as { id: string; sceneId: string };
  const [scene, setScene] = useState<FullScene | null>(null);
  const [loading, setLoading] = useState(true);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [voiceGenerations, setVoiceGenerations] = useState<VoiceGeneration[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showVoices, setShowVoices] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lightboxFile, setLightboxFile] = useState<LinkedFile | null>(null);

  // Link file dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [linkTab, setLinkTab] = useState<"drive" | "upload">("drive");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");

  function fetchScene(signal?: AbortSignal) {
    fetch(`/api/scenes/${sceneId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((data) => { setScene(data); setLoading(false); })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load scene");
        setLoading(false);
      });
  }

  function fetchVoiceGenerations(signal?: AbortSignal) {
    fetch(`/api/voices/generations?sceneId=${sceneId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then(setVoiceGenerations)
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load voice generations");
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    // Parallel fetch: all four requests are independent
    Promise.all([
      fetch(`/api/scenes/${sceneId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/voices/generations?sceneId=${sceneId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/characters?projectId=${projectId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/locations?projectId=${projectId}`, { signal: controller.signal }).then((r) => r.json()).catch(() => []),
    ])
      .then(([sceneData, voiceData, charData, locData]) => {
        setScene(sceneData);
        setVoiceGenerations(voiceData);
        setCharacters(charData);
        setLocations(locData);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load scene data");
        setLoading(false);
      });
    return () => controller.abort();
  }, [sceneId, projectId]);

  async function handleUnlinkFile(linkId: number) {
    // Optimistic update: remove file from local state immediately
    setScene((prev) =>
      prev ? { ...prev, linkedFiles: prev.linkedFiles.filter((f) => f.linkId !== linkId) } : prev
    );
    try {
      await fetch("/api/drive/scene-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      });
      toast.success("File unlinked");
    } catch {
      toast.error("Failed to unlink file");
      fetchScene(); // Revert on failure by refetching
    }
  }

  async function openLinkDialog() {
    const res = await fetch(`/api/drive/files?projectId=${projectId}`);
    const data = await res.json();
    setDriveFiles(data);
    setLinkDialogOpen(true);
  }

  async function handleLinkFile(fileId: number) {
    await fetch("/api/drive/scene-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneId: Number(sceneId), fileId }),
    });
    toast.success("File linked");
    setLinkDialogOpen(false);
    fetchScene();
  }

  async function handleUploadAndLink(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const uploadRes = await fetch("/api/drive/files/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const driveFile = await uploadRes.json();

      await fetch("/api/drive/scene-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: Number(sceneId), fileId: driveFile.id }),
      });

      toast.success("File uploaded & linked");
      setLinkDialogOpen(false);
      fetchScene();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Scene not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Merge dialogue + directions into ordered elements
  const elements = [
    ...scene.dialogues.map((d) => ({ ...d, _kind: "dialogue" as const })),
    ...scene.directions.map((d) => ({ ...d, _kind: "direction" as const })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  // Map character name → voiceId
  const charVoiceMap: Record<string, string | null> = {};
  for (const c of characters) {
    charVoiceMap[c.name.toUpperCase()] = c.voiceId;
  }

  // Find matching location for this scene
  const matchedLocation = scene.location
    ? locations.find((l) => l.name.toLowerCase() === scene.location!.toLowerCase())
    : null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              {scene.sceneNumber}
            </span>
            <h1 className="text-xl font-bold tracking-tight">{scene.heading}</h1>
          </div>
          <div className="flex gap-2 flex-wrap ml-12">
            {scene.headingType && (
              <Badge variant="outline" className="text-xs">{scene.headingType}</Badge>
            )}
            {scene.location && (
              matchedLocation ? (
                <Link href={`/project/${projectId}/locations/${matchedLocation.id}`}>
                  <Badge variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-secondary/80 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8z" /><circle cx="8" cy="6" r="1.5" />
                    </svg>
                    {scene.location}
                    <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5 opacity-60">
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </Badge>
                </Link>
              ) : (
                <Badge variant="secondary" className="text-xs gap-1">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8z" /><circle cx="8" cy="6" r="1.5" />
                  </svg>
                  {scene.location}
                </Badge>
              )
            )}
            {scene.timeOfDay && (
              <Badge variant="secondary" className="text-xs gap-1">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
                </svg>
                {scene.timeOfDay}
              </Badge>
            )}
          </div>
          <EditableSynopsis
            value={scene.synopsis || ""}
            onSave={async (val) => {
              await fetch(`/api/scenes/${sceneId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ synopsis: val }),
              });
              setScene((prev) => prev ? { ...prev, synopsis: val } : prev);
              toast.success("Synopsis updated");
            }}
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setModifyOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3" /><circle cx="8" cy="8" r="3" />
            </svg>
            Modify with AI
          </Button>
          <Button variant={showVoices ? "default" : "outline"} size="sm" onClick={() => setShowVoices(!showVoices)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
              <path d="M8 1v6M5 4a3 3 0 006 0M4 8a4 4 0 008 0" /><path d="M8 11v4M6 15h4" />
            </svg>
            Voices
          </Button>
          <a href={`/api/download/scene/${sceneId}`}>
            <Button variant="outline" size="sm">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                <path d="M8 2v8M8 10L5 7M8 10L11 7" />
                <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
              </svg>
              Export
            </Button>
          </a>
        </div>
      </div>

      {/* Responsive layout */}
      <div className="md:hidden">
        <Tabs defaultValue="script">
          <TabsList className="w-full">
            <TabsTrigger value="script" className="flex-1">Script</TabsTrigger>
            <TabsTrigger value="files" className="flex-1">Files ({scene.linkedFiles?.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="script" className="mt-4">
            <ScriptView elements={elements} />
            {showVoices && (
              <VoiceSection
                dialogues={scene.dialogues}
                projectId={projectId}
                sceneId={sceneId}
                charVoiceMap={charVoiceMap}
                generations={voiceGenerations}
                onRefresh={fetchVoiceGenerations}
                sceneHeading={scene.heading}
              />
            )}
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <SceneFiles
              linkedFiles={scene.linkedFiles || []}
              onUnlink={handleUnlinkFile}
              onLinkFile={openLinkDialog}
              onThumbnailClick={setLightboxFile}
              projectId={projectId}
              sceneId={sceneId}
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden md:grid md:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          <ScriptView elements={elements} />
          {showVoices && (
            <VoiceSection
              dialogues={scene.dialogues}
              projectId={projectId}
              sceneId={sceneId}
              charVoiceMap={charVoiceMap}
              generations={voiceGenerations}
              onRefresh={fetchVoiceGenerations}
              sceneHeading={scene.heading}
            />
          )}
        </div>
        <SceneFiles
          linkedFiles={scene.linkedFiles || []}
          onUnlink={handleUnlinkFile}
          onLinkFile={openLinkDialog}
          onThumbnailClick={setLightboxFile}
          projectId={projectId}
          sceneId={sceneId}
        />
      </div>

      {/* Modify Dialog */}
      <SceneModifyDialog
        open={modifyOpen}
        onOpenChange={setModifyOpen}
        sceneId={sceneId}
        projectId={projectId}
        onApplied={fetchScene}
      />

      {/* Link File Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) { setLinkTab("drive"); setDriveSearch(""); setDragOver(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Asset to Scene</DialogTitle></DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 p-0.5 bg-muted/60 rounded-lg mb-2" role="tablist" aria-label="File source">
            <button
              role="tab"
              aria-selected={linkTab === "drive"}
              onClick={() => setLinkTab("drive")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                linkTab === "drive" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
                </svg>
                From Drive
              </span>
            </button>
            <button
              role="tab"
              aria-selected={linkTab === "upload"}
              onClick={() => setLinkTab("upload")}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                linkTab === "upload" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 16V4M12 4L8 8M12 4L16 8" />
                  <path d="M2 17v3a2 2 0 002 2h16a2 2 0 002-2v-3" />
                </svg>
                Upload File
              </span>
            </button>
          </div>

          {/* Drive tab */}
          {linkTab === "drive" && (() => {
            const linkedIds = new Set(scene?.linkedFiles?.map((f) => f.id) || []);
            const filtered = driveFiles.filter((f) =>
              !driveSearch || f.filename.toLowerCase().includes(driveSearch.toLowerCase())
            );
            return (
              <div className="space-y-2">
                {driveFiles.length > 5 && (
                  <div className="relative">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search files..."
                      value={driveSearch}
                      onChange={(e) => setDriveSearch(e.target.value)}
                      className="w-full text-sm pl-8 pr-3 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                )}
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">{driveSearch ? "No matching files" : "No files in drive yet"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {driveSearch ? "Try a different search term" : "Upload files in the Asset Drive first, or use the Upload tab"}
                      </p>
                    </div>
                  ) : filtered.map((f) => {
                    const alreadyLinked = linkedIds.has(f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => !alreadyLinked && handleLinkFile(f.id)}
                        disabled={alreadyLinked}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-3 ${
                          alreadyLinked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-accent"
                        }`}
                      >
                        {f.fileType === "image" ? (
                          <Image src={`/api/drive/files/${f.id}`} alt="" width={40} height={40} className="rounded-md object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                            {f.fileType === "audio" ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                            ) : f.fileType === "video" ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M10 8l6 4-6 4V8z" /></svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm truncate block">{f.filename}</span>
                          <span className="text-[10px] text-muted-foreground">{f.fileType}</span>
                        </div>
                        {alreadyLinked && (
                          <Badge variant="outline" className="text-[9px] shrink-0">Linked</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Upload tab */}
          {linkTab === "upload" && (
            <div className="py-2">
              <label
                htmlFor="scene-file-upload"
                className={`flex flex-col items-center justify-center gap-3 py-10 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  uploading
                    ? "border-primary/40 bg-primary/5"
                    : dragOver
                      ? "border-primary bg-primary/10 scale-[1.01] shadow-lg shadow-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-accent/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleUploadAndLink(file);
                }}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                    </svg>
                    <p className="text-sm text-muted-foreground">Uploading & linking...</p>
                  </>
                ) : dragOver ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                        <path d="M12 16V4M12 4L8 8M12 4L16 8" />
                        <path d="M2 17v3a2 2 0 002 2h16a2 2 0 002-2v-3" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-primary">Release to upload</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                        <path d="M12 16V4M12 4L8 8M12 4L16 8" />
                        <path d="M2 17v3a2 2 0 002 2h16a2 2 0 002-2v-3" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Images, audio, video, or documents (max 100MB)</p>
                    </div>
                  </>
                )}
                <input
                  id="scene-file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadAndLink(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Lightbox Dialog */}
      <Dialog open={!!lightboxFile} onOpenChange={() => setLightboxFile(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxFile && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- lightbox with max-height constraint */}
              <img
                src={`/api/drive/files/${lightboxFile.id}`}
                alt={lightboxFile.filename}
                className="w-full rounded-lg object-contain max-h-[75vh]"
                loading="lazy"
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{lightboxFile.filename}</p>
                  {lightboxFile.generationPrompt && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{lightboxFile.generationPrompt}</p>
                  )}
                </div>
                <a
                  href={`/api/drive/files/${lightboxFile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 ml-3"
                >
                  <Button variant="outline" size="sm">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                      <path d="M12 9v4a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4" />
                      <path d="M9 2h5v5M5 11L14 2" />
                    </svg>
                    Open
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Production Notes */}
      <Separator className="mt-8 mb-6" />
      <ProductionNotes sceneId={Number(sceneId)} projectId={projectId} />
    </div>
  );
}

function ScriptView({ elements }: {
  elements: ({ _kind: "dialogue" } & Dialogue | { _kind: "direction" } & Direction)[];
}) {
  return (
    <Card className="dark:bg-card/80 dark:border-white/[0.06] bg-[#fefefe] dark:bg-[#1a1a1e]">
      <CardContent className="py-8 px-6 sm:px-12 md:px-16 font-mono text-[13px] leading-relaxed space-y-4">
        {elements.map((el, i) => {
          if (el._kind === "dialogue") {
            const d = el as Dialogue;
            return (
              <div key={`d-${i}`} className="my-4">
                <p className="font-bold text-xs tracking-[0.2em] text-center uppercase ml-[15%] mr-[15%]">
                  {d.character}
                </p>
                {d.parenthetical && (
                  <p className="text-xs text-muted-foreground text-center italic ml-[20%] mr-[20%]">
                    ({d.parenthetical})
                  </p>
                )}
                <p className="text-center ml-[10%] mr-[10%] mt-0.5">
                  {d.line}
                </p>
              </div>
            );
          } else {
            const d = el as Direction;
            if (d.type === "transition") {
              return (
                <p key={`r-${i}`} className="text-right text-xs uppercase tracking-[0.15em] text-muted-foreground my-4">
                  {d.content}
                </p>
              );
            }
            if (d.type === "broll" || d.type === "music" || d.type === "note") {
              return (
                <div key={`r-${i}`} className="my-3 pl-3 border-l-2 border-primary/20">
                  <span className="text-[10px] uppercase tracking-widest text-primary/60 font-semibold">{d.type}</span>
                  <p className="text-muted-foreground text-xs mt-0.5">{d.content}</p>
                </div>
              );
            }
            return (
              <p key={`r-${i}`} className="text-foreground/80 my-3">
                {d.content}
              </p>
            );
          }
        })}
        {elements.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No script elements in this scene</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SceneFiles({ linkedFiles, onUnlink, onLinkFile, onThumbnailClick, projectId, sceneId }: {
  linkedFiles: LinkedFile[];
  onUnlink: (linkId: number) => void;
  onLinkFile: () => void;
  onThumbnailClick: (file: LinkedFile) => void;
  projectId?: string;
  sceneId?: string;
}) {
  const imageFiles = linkedFiles.filter((f) => f.fileType === "image");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Linked Files</h3>
        <div className="flex items-center gap-1.5">
          {projectId && sceneId && imageFiles.length > 0 && (
            <a href={`/project/${projectId}/scenes/${sceneId}/mood-board`}>
              <Button variant="outline" size="sm">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-1.5">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="4" rx="1" />
                  <rect x="1" y="9" width="6" height="4" rx="1" />
                  <rect x="9" y="7" width="6" height="8" rx="1" />
                </svg>
                Mood Board
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={onLinkFile}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Link File
          </Button>
        </div>
      </div>

      {linkedFiles.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <circle cx="8" cy="8" r="2" />
                <path d="M2 16l5-5 4 4 3-3 8 8" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No files linked to this scene</p>
            <p className="text-xs text-muted-foreground mt-1">Link assets from Drive or upload a new file</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Image thumbnails grid */}
          {imageFiles.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Images ({imageFiles.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {imageFiles.map((f) => (
                  <div key={f.id} className="group relative rounded-lg overflow-hidden border bg-muted">
                    <button
                      onClick={() => onThumbnailClick(f)}
                      className="w-full text-left"
                      title={f.generationPrompt || f.filename}
                    >
                      <div className="relative w-full aspect-square">
                        <Image
                          src={`/api/drive/files/${f.id}`}
                          alt={f.generationPrompt || f.filename}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, 200px"
                        />
                      </div>
                      {/* Alt text overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate">{f.generationPrompt || f.filename}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => onUnlink(f.linkId)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive/80"
                      aria-label={`Unlink ${f.filename}`}
                      title="Unlink file"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-image files */}
          {linkedFiles.filter((f) => f.fileType !== "image").length > 0 && (
            <div>
              {imageFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mb-1.5">Other Files</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {linkedFiles.filter((f) => f.fileType !== "image").map((f) => (
                  <div key={f.id} className="group relative rounded-lg overflow-hidden border bg-muted">
                    {f.fileType === "audio" ? (
                      <div className="w-full aspect-square flex flex-col items-center justify-center p-3 gap-2 bg-gradient-to-b from-muted to-muted/50">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate max-w-full">{f.filename}</p>
                        <audio controls src={`/api/drive/files/${f.id}`} className="w-full h-8" preload="none" />
                      </div>
                    ) : (
                      <div className="w-full aspect-video">
                        <video controls src={`/api/drive/files/${f.id}`} className="w-full h-full object-cover" preload="none" />
                      </div>
                    )}
                    <button
                      onClick={() => onUnlink(f.linkId)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-md bg-black/60 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive/80"
                      aria-label={`Unlink ${f.filename}`}
                      title="Unlink file"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VoiceSection({ dialogues, projectId, sceneId, charVoiceMap, generations, onRefresh, sceneHeading }: {
  dialogues: Dialogue[];
  projectId: string;
  sceneId: string;
  charVoiceMap: Record<string, string | null>;
  generations: VoiceGeneration[];
  onRefresh: () => void;
  sceneHeading?: string;
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<Map<number, { text: string; voiceId: string }>>(new Map());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Build scene context string for AI tag suggestions
  const sceneContext = [
    sceneHeading,
    ...dialogues.slice(0, 5).map((d) => `${d.character}: "${d.line}"`),
  ].filter(Boolean).join("\n");

  // Initialize bulk items from dialogues that have voices assigned
  function initBulkItems() {
    const items = new Map<number, { text: string; voiceId: string }>();
    for (const d of dialogues) {
      const voice = charVoiceMap[d.character.toUpperCase()];
      if (voice) {
        items.set(d.id, { text: d.line, voiceId: voice });
      }
    }
    setBulkItems(items);
    setBulkMode(true);
  }

  function removeBulkItem(dialogueId: number) {
    setBulkItems((prev) => {
      const next = new Map(prev);
      next.delete(dialogueId);
      return next;
    });
  }

  function updateBulkText(dialogueId: number, text: string) {
    setBulkItems((prev) => {
      const next = new Map(prev);
      const existing = next.get(dialogueId);
      if (existing) {
        next.set(dialogueId, { ...existing, text });
      }
      return next;
    });
  }

  async function handleBulkGenerate() {
    if (bulkItems.size === 0) {
      toast.error("No items to generate");
      return;
    }
    setBulkGenerating(true);
    const total = bulkItems.size;
    setBulkProgress({ done: 0, total });
    try {
      const items = Array.from(bulkItems.entries()).map(([dialogueId, item]) => ({
        dialogueId,
        voiceId: item.voiceId,
        text: item.text,
      }));

      const res = await fetch("/api/voices/generate-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          sceneId: Number(sceneId),
          items,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bulk generation failed");

      setBulkProgress({ done: data.successCount + data.errorCount, total });
      toast.success(`Generated ${data.successCount} voice${data.successCount !== 1 ? "s" : ""}${data.errorCount > 0 ? ` (${data.errorCount} failed)` : ""}`);
      setBulkMode(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bulk generation failed");
    }
    setBulkGenerating(false);
    setBulkProgress(null);
  }

  // Count dialogues that can be bulk-generated
  const eligibleForBulk = dialogues.filter((d) => charVoiceMap[d.character.toUpperCase()]).length;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
              <path d="M8 1v6M5 4a3 3 0 006 0M4 8a4 4 0 008 0" /><path d="M8 11v4M6 15h4" />
            </svg>
            <h3 className="font-semibold text-sm">Voice Generation</h3>
          </div>
          {eligibleForBulk > 0 && !bulkMode && (
            <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={initBulkItems}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h12M2 12h8" />
              </svg>
              Generate All ({eligibleForBulk})
            </Button>
          )}
        </div>
        <Separator />

        {/* Bulk mode: review & edit before generating */}
        {bulkMode && (
          <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">Bulk Voice Generation</p>
                <p className="text-[10px] text-muted-foreground">{bulkItems.size} dialogue{bulkItems.size !== 1 ? "s" : ""} queued</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={() => setBulkMode(false)}>
                Cancel
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Array.from(bulkItems.entries()).map(([dialogueId, item]) => {
                const dialogue = dialogues.find((d) => d.id === dialogueId);
                if (!dialogue) return null;
                return (
                  <div key={dialogueId} className="flex items-start gap-2 p-2 rounded-md bg-background border">
                    <div className="flex-1 min-w-0">
                      <Badge variant="secondary" className="text-[9px] mb-1">{dialogue.character}</Badge>
                      <textarea
                        value={item.text}
                        onChange={(e) => updateBulkText(dialogueId, e.target.value)}
                        className="w-full text-[11px] font-mono bg-muted/50 border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 p-1.5 min-h-[32px] mt-1"
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={() => removeBulkItem(dialogueId)}
                      className="shrink-0 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label={`Remove ${dialogue.character} from bulk generation`}
                      title="Remove from queue"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {bulkItems.size === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">All items removed. Cancel or add back.</p>
            )}

            <div className="space-y-2">
              {bulkGenerating && bulkProgress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Generating voices...</span>
                    <span>{bulkProgress.done}/{bulkProgress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(5, (bulkProgress.done / bulkProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={handleBulkGenerate}
                disabled={bulkGenerating || bulkItems.size === 0}
              >
                {bulkGenerating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8" className="opacity-75" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  `Generate ${bulkItems.size} Voice${bulkItems.size !== 1 ? "s" : ""}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Individual dialogue panels */}
        {dialogues.map((d) => (
          <DialogueVoicePanel
            key={d.id}
            dialogue={d}
            projectId={projectId}
            sceneId={sceneId}
            voiceId={charVoiceMap[d.character.toUpperCase()]}
            generations={generations}
            onRefresh={onRefresh}
            sceneContext={sceneContext}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function EditableSynopsis({ value, onSave }: { value: string; onSave: (val: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (editing) {
    return (
      <div className="mt-2 space-y-2 ml-12">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="text-sm min-h-[50px]" autoFocus />
        <div className="flex gap-2">
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => { onSave(text); setEditing(false); }}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setText(value); setEditing(false); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <p
      className="text-sm text-muted-foreground mt-2 ml-12 cursor-pointer hover:text-foreground transition-colors rounded-md px-2 py-1 -mx-2 hover:bg-accent/50"
      onClick={() => setEditing(true)}
      title="Click to edit synopsis"
    >
      {value || "Click to add synopsis..."}
    </p>
  );
}
