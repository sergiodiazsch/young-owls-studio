"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Scene, DriveFile } from "@/lib/types";

interface LinkedFile extends DriveFile {
  linkId: number;
}

interface FullScene extends Scene {
  linkedFiles: LinkedFile[];
}

export default function MoodBoardPage() {
  const params = useParams();
  const router = useRouter();
  const { id: projectId, sceneId } = params as { id: string; sceneId: string };
  const [scene, setScene] = useState<FullScene | null>(null);
  const [loading, setLoading] = useState(true);

  // Preview
  const [previewFile, setPreviewFile] = useState<LinkedFile | null>(null);
  const [zoom, setZoom] = useState(1);

  // Layout mode
  const [layout, setLayout] = useState<"masonry" | "grid" | "strip">("masonry");

  useEffect(() => {
    fetch(`/api/scenes/${sceneId}`)
      .then((r) => r.json())
      .then((data: FullScene) => {
        setScene(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sceneId]);

  const imageFiles = scene?.linkedFiles.filter((f) => f.fileType === "image") || [];

  function fileUrl(file: DriveFile) {
    return `/api/drive/files/${file.id}`;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-video bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="p-6 text-center text-muted-foreground">Scene not found</div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push(`/project/${projectId}/scenes/${sceneId}`)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 2L4 8l6 6" />
            </svg>
            Back to Scene
          </button>
          <h1 className="text-xl font-bold tracking-tight">
            Mood Board — Sc. {scene.sceneNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{scene.heading}</p>
          {scene.synopsis && (
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">{scene.synopsis}</p>
          )}
        </div>

        {/* Layout toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(["masonry", "grid", "strip"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layout === l ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "masonry" ? "Masonry" : l === "grid" ? "Grid" : "Strip"}
            </button>
          ))}
        </div>
      </div>

      {/* Image count */}
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="secondary" className="text-xs">
          {imageFiles.length} image{imageFiles.length !== 1 ? "s" : ""}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => router.push(`/project/${projectId}/generate`)}
        >
          Generate More
        </Button>
      </div>

      {imageFiles.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-16 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <circle cx="8" cy="8" r="2" />
              <path d="M2 16l5-5 4 4 3-3 8 8" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground mb-2">No images linked to this scene yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Generate images and save them to Drive with this scene linked,
            or link existing Drive files from the scene detail page.
          </p>
          <Button variant="outline" onClick={() => router.push(`/project/${projectId}/generate`)}>
            Go to Image Generation
          </Button>
        </div>
      ) : (
        <>
          {/* Masonry Layout */}
          {layout === "masonry" && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {imageFiles.map((file) => (
                <MoodBoardCard
                  key={file.id}
                  file={file}
                  fileUrl={fileUrl(file)}
                  onClick={() => { setPreviewFile(file); setZoom(1); }}
                />
              ))}
            </div>
          )}

          {/* Grid Layout */}
          {layout === "grid" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {imageFiles.map((file) => (
                <div key={file.id} className="aspect-square">
                  <MoodBoardCard
                    file={file}
                    fileUrl={fileUrl(file)}
                    onClick={() => { setPreviewFile(file); setZoom(1); }}
                    aspectSquare
                  />
                </div>
              ))}
            </div>
          )}

          {/* Strip Layout */}
          {layout === "strip" && (
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
              {imageFiles.map((file) => (
                <div key={file.id} className="flex-none w-72 snap-start">
                  <MoodBoardCard
                    file={file}
                    fileUrl={fileUrl(file)}
                    onClick={() => { setPreviewFile(file); setZoom(1); }}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Preview Dialog with Zoom */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm">{previewFile?.filename}</DialogTitle>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>-</Button>
                <button onClick={() => setZoom(1)} className="text-xs text-muted-foreground min-w-[3rem] text-center hover:text-foreground">
                  {Math.round(zoom * 100)}%
                </button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setZoom((z) => Math.min(5, z + 0.25))}>+</Button>
              </div>
            </div>
          </DialogHeader>
          {previewFile && (
            <div className="flex-1 min-h-0 flex flex-col gap-4">
              <div
                className="flex-1 min-h-0 overflow-hidden rounded-lg bg-muted/30 border"
                onWheel={(e) => {
                  e.preventDefault();
                  setZoom((z) => Math.min(5, Math.max(0.5, z - e.deltaY * 0.002)));
                }}
              >
                <div className="w-full h-full flex items-center justify-center" style={{ minHeight: 300 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- zoom transform requires raw img */}
                  <img
                    src={fileUrl(previewFile)}
                    alt={previewFile.filename}
                    className="max-w-full max-h-full rounded-lg select-none"
                    draggable={false}
                    style={{
                      transform: `scale(${zoom})`,
                      transition: "transform 0.15s ease-out",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1 text-xs shrink-0">
                {previewFile.generationPrompt && (
                  <p className="text-muted-foreground">{previewFile.generationPrompt}</p>
                )}
                {previewFile.caption && (
                  <p><span className="font-medium">Caption:</span> {previewFile.caption}</p>
                )}
                <p className="text-muted-foreground">
                  {previewFile.generatedBy ? `Generated by ${previewFile.generatedBy}` : "Uploaded"} — {new Date(previewFile.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                <a href={fileUrl(previewFile)} download={previewFile.filename}>
                  <Button size="sm" variant="outline">Download</Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Individual mood board image card ──

function MoodBoardCard({
  file,
  fileUrl,
  onClick,
  aspectSquare,
}: {
  file: DriveFile;
  fileUrl: string;
  onClick: () => void;
  aspectSquare?: boolean;
}) {
  return (
    <div
      className="group relative rounded-lg overflow-hidden border bg-muted cursor-pointer break-inside-avoid hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {aspectSquare ? (
        <Image
          src={fileUrl}
          alt={file.filename}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- masonry layout needs natural aspect ratio */
        <img
          src={fileUrl}
          alt={file.filename}
          className="w-full"
          loading="lazy"
        />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          {file.generationPrompt && (
            <p className="text-white text-[10px] line-clamp-2 mb-1">{file.generationPrompt}</p>
          )}
          <div className="flex items-center gap-2">
            {file.generatedBy && (
              <Badge variant="secondary" className="text-[9px] bg-white/20 text-white border-0">
                {file.generatedBy}
              </Badge>
            )}
            {file.caption && (
              <span className="text-white/80 text-[9px] truncate">{file.caption}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
