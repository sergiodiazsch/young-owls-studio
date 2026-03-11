"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ImageGeneration } from "@/lib/types";

interface Props {
  /** If provided, edit this existing generation */
  generation: ImageGeneration | null;
  /** If true, show the editor in standalone upload mode (no generation) */
  standalone?: boolean;
  projectId?: string;
  onClose: () => void;
  onComplete: () => void;
}

export function ImageGenInpaintEditor({ generation, standalone, projectId, onClose, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [prompt, setPrompt] = useState("");
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // For standalone mode: uploaded image file
  const [uploadedFile, setUploadedFile] = useState<{ storagePath: string; preview: string } | null>(null);

  const isOpen = !!generation || (standalone === true);

  // Determine the image source URL
  const imageUrl = generation && generation.id > 0 && generation.storagePath
    ? `/api/generate/image/generations/${generation.id}`
    : uploadedFile?.preview || null;

  // Load source image when generation changes or upload happens
  useEffect(() => {
    if (!imageUrl || !isOpen) return;

    // Wait a frame for the dialog to render and container to have dimensions
    const timeoutId = setTimeout(() => {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;

      setImageLoaded(false);
      setPrompt(generation?.prompt || "");

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imgRef.current = img;

        // Use container width or fallback to a reasonable default
        const maxW = containerRef.current?.clientWidth || 700;
        const maxH = containerRef.current?.clientHeight || 500;
        const scaleW = maxW / img.width;
        const scaleH = maxH / img.height;
        const scale = Math.min(1, scaleW, scaleH);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        maskCanvas.width = img.width; // Mask at full resolution
        maskCanvas.height = img.height;

        // Draw image on display canvas
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        // Clear mask canvas (black = keep)
        const maskCtx = maskCanvas.getContext("2d")!;
        maskCtx.fillStyle = "black";
        maskCtx.fillRect(0, 0, img.width, img.height);

        setImageLoaded(true);
      };
      img.onerror = () => {
        toast.error("Failed to load image");
      };
      img.src = imageUrl;
    }, 100); // Small delay so dialog DOM is rendered

    return () => clearTimeout(timeoutId);
  }, [imageUrl, isOpen, generation?.prompt]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setImageLoaded(false);
      setUploadedFile(null);
      setPrompt("");
      imgRef.current = null;
    }
  }, [isOpen]);

  // ── Upload handler for standalone mode ──
  const handleUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      // Create a local preview
      const preview = URL.createObjectURL(file);

      // Upload to storage for the API
      if (projectId) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("projectId", projectId);
          const res = await fetch("/api/generate/image/reference-upload", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          setUploadedFile({ storagePath: data.storagePath, preview });
        } catch {
          toast.error("Failed to upload image");
          URL.revokeObjectURL(preview);
        }
      } else {
        setUploadedFile({ storagePath: "", preview });
      }
    };
    input.click();
  }, [projectId]);

  // ── Drawing handlers ──
  const getCanvasCoords = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // Account for CSS scaling vs canvas resolution
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const drawBrush = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current!;
    const maskCanvas = maskCanvasRef.current!;
    const img = imgRef.current;
    if (!img) return;

    // Draw on display canvas (semi-transparent red overlay)
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255, 80, 80, 0.45)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw on mask canvas (white = area to regenerate) at full resolution
    const scaleX = img.width / canvas.width;
    const scaleY = img.height / canvas.height;
    const maskCtx = maskCanvas.getContext("2d")!;
    maskCtx.fillStyle = "white";
    maskCtx.beginPath();
    maskCtx.arc(x * scaleX, y * scaleY, (brushSize / 2) * scaleX, 0, Math.PI * 2);
    maskCtx.fill();
  }, [brushSize]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!imageLoaded) return;
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = getCanvasCoords(e);
    drawBrush(x, y);
  }, [getCanvasCoords, drawBrush, imageLoaded]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    drawBrush(x, y);
  }, [isDrawing, getCanvasCoords, drawBrush]);

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // ── Clear mask ──
  const clearMask = useCallback(() => {
    const canvas = canvasRef.current!;
    const maskCanvas = maskCanvasRef.current!;
    const img = imgRef.current;
    if (!img) return;

    // Redraw original image
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Reset mask
    const maskCtx = maskCanvas.getContext("2d")!;
    maskCtx.fillStyle = "black";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  }, []);

  // ── Generate inpainted image ──
  const handleInpaint = useCallback(async () => {
    if (!maskCanvasRef.current || !prompt.trim()) return;

    // Need either a generation ID or an uploaded file
    if (!generation && !uploadedFile?.storagePath) {
      toast.error("No image to inpaint");
      return;
    }

    const maskDataUrl = maskCanvasRef.current.toDataURL("image/png");

    setGenerating(true);
    try {
      if (generation) {
        // Inpaint an existing generation
        const res = await fetch("/api/generate/image/inpaint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationId: generation.id,
            prompt: prompt.trim(),
            maskDataUrl,
            model: generation.model,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.status === "failed") {
          throw new Error(data.error || "Inpainting failed");
        }
      } else if (uploadedFile?.storagePath && projectId) {
        // Inpaint a standalone uploaded image
        const res = await fetch("/api/generate/image/inpaint-standalone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: Number(projectId),
            storagePath: uploadedFile.storagePath,
            prompt: prompt.trim(),
            maskDataUrl,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.status === "failed") {
          throw new Error(data.error || "Inpainting failed");
        }
      }

      toast.success("Inpainting completed");
      onComplete();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Inpainting failed");
    }
    setGenerating(false);
  }, [generation, uploadedFile, projectId, prompt, onComplete, onClose]);

  const handleClose = useCallback(() => {
    if (uploadedFile?.preview) URL.revokeObjectURL(uploadedFile.preview);
    onClose();
  }, [uploadedFile, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Inpaint / Edit Image</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Brush</Label>
              <input
                type="range"
                min={5}
                max={100}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24 h-1.5 accent-primary"
              />
              <span className="text-xs text-muted-foreground w-8">{brushSize}px</span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearMask} disabled={!imageLoaded}>
              Clear Mask
            </Button>
            {/* Standalone: upload button */}
            {standalone && !generation && (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleUpload}>
                {uploadedFile ? "Change Image" : "Upload Image"}
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground ml-auto">
              Paint over the area you want to regenerate
            </p>
          </div>

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="flex-1 min-h-0 flex items-center justify-center bg-muted/30 rounded-lg border overflow-hidden"
            style={{ minHeight: "300px" }}
          >
            {!imageUrl && standalone && (
              <button
                onClick={handleUpload}
                className="flex flex-col items-center gap-3 text-muted-foreground hover:text-foreground transition-colors p-8"
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span className="text-sm font-medium">Click to upload an image to edit</span>
                <span className="text-xs">Supports JPG, PNG, WebP</span>
              </button>
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="rounded-lg"
              style={{
                display: imageLoaded ? "block" : "none",
                cursor: imageLoaded
                  ? `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="${brushSize}" height="${brushSize}" viewBox="0 0 ${brushSize} ${brushSize}"><circle cx="${brushSize/2}" cy="${brushSize/2}" r="${brushSize/2 - 1}" fill="none" stroke="red" stroke-width="2"/></svg>') ${brushSize/2} ${brushSize/2}, crosshair`
                  : "default",
                touchAction: "none",
              }}
            />
            {/* Hidden mask canvas */}
            <canvas ref={maskCanvasRef} style={{ display: "none" }} />
            {/* Loading state */}
            {imageUrl && !imageLoaded && (
              <p className="text-xs text-muted-foreground">Loading image...</p>
            )}
          </div>

          {/* Prompt */}
          <div className="space-y-1.5 shrink-0">
            <Label className="text-xs">Describe what should replace the masked area</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A blue sky with clouds..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <Button
              onClick={handleInpaint}
              disabled={!prompt.trim() || generating || !imageLoaded}
              className="flex-1"
            >
              {generating ? "Generating..." : "Inpaint"}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
