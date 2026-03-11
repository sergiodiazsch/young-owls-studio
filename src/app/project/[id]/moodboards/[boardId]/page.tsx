"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Moodboard, MoodboardItem, DriveFile } from "@/lib/types";

interface BoardWithItems extends Moodboard {
  items: MoodboardItem[];
}

interface AISuggestions {
  analysis: string;
  suggestions: string[];
  colorPalette: string[];
  missingElements: string[];
}

export default function MoodboardBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const { id: projectId, boardId } = params as {
    id: string;
    boardId: string;
  };

  const [board, setBoard] = useState<BoardWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Add item dialogs
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [newTextContent, setNewTextContent] = useState("");
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [newColorValue, setNewColorValue] = useState("#6366f1");
  const [newColorName, setNewColorName] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(
    new Set()
  );
  const [loadingFiles, setLoadingFiles] = useState(false);

  // AI suggestions
  const [suggestions, setSuggestions] = useState<AISuggestions | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestContext, setSuggestContext] = useState("");

  function fetchBoard(signal?: AbortSignal) {
    fetch(`/api/moodboards/${boardId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((data: BoardWithItems) => {
        setBoard(data);
        setTitleValue(data.title);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load moodboard");
        setLoading(false);
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchBoard(controller.signal);
    return () => controller.abort();
  }, [boardId]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  async function saveTitle() {
    if (!titleValue.trim() || titleValue === board?.title) {
      setTitleValue(board?.title ?? "");
      setEditingTitle(false);
      return;
    }
    await fetch(`/api/moodboards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleValue.trim() }),
    });
    setEditingTitle(false);
    fetchBoard();
  }

  async function setLayout(layout: string) {
    await fetch(`/api/moodboards/${boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout }),
    });
    fetchBoard();
  }

  async function addTextItem() {
    if (!newTextContent.trim()) return;
    await fetch(`/api/moodboards/${boardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        textContent: newTextContent.trim(),
      }),
    });
    setTextDialogOpen(false);
    setNewTextContent("");
    toast.success("Text note added");
    fetchBoard();
  }

  async function addColorItem() {
    await fetch(`/api/moodboards/${boardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "color",
        colorValue: newColorValue,
        colorName: newColorName.trim() || undefined,
      }),
    });
    setColorDialogOpen(false);
    setNewColorName("");
    toast.success("Color swatch added");
    fetchBoard();
  }

  async function deleteItem(itemId: number) {
    await fetch(`/api/moodboards/items/${itemId}`, { method: "DELETE" });
    toast.success("Item removed");
    fetchBoard();
  }

  async function updateItemCaption(itemId: number, caption: string) {
    await fetch(`/api/moodboards/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption }),
    });
    fetchBoard();
  }

  async function updateTextItem(itemId: number, textContent: string) {
    await fetch(`/api/moodboards/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ textContent }),
    });
    fetchBoard();
  }

  // Import from Drive
  async function openImportDialog() {
    setImportDialogOpen(true);
    setLoadingFiles(true);
    setSelectedFileIds(new Set());
    try {
      const res = await fetch(
        `/api/drive/browse?projectId=${projectId}`
      );
      const data = await res.json();
      setDriveFiles(
        (data.files || []).filter((f: DriveFile) => f.fileType === "image")
      );
    } catch {
      toast.error("Failed to load drive files");
    } finally {
      setLoadingFiles(false);
    }
  }

  function toggleFileSelection(fileId: number) {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }

  async function handleImport() {
    if (selectedFileIds.size === 0) return;
    try {
      await fetch(`/api/moodboards/${boardId}/import-from-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedFileIds) }),
      });
      toast.success(`Imported ${selectedFileIds.size} image(s)`);
      setImportDialogOpen(false);
      setSelectedFileIds(new Set());
      fetchBoard();
    } catch {
      toast.error("Import failed");
    }
  }

  // AI Suggestions
  async function handleSuggest() {
    setSuggestLoading(true);
    setSuggestions(null);
    try {
      const res = await fetch(`/api/moodboards/${boardId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: suggestContext || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Suggestion failed");
      }
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI suggestion failed"
      );
    } finally {
      setSuggestLoading(false);
    }
  }

  async function addSuggestedColor(hex: string) {
    await fetch(`/api/moodboards/${boardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "color",
        colorValue: hex,
        colorName: hex,
      }),
    });
    toast.success("Color added to board");
    fetchBoard();
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96 mb-6" />
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton
              key={i}
              className="break-inside-avoid rounded-lg"
              style={{ height: 120 + Math.random() * 100 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Moodboard not found
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="flex-1">
          <button
            onClick={() => router.push(`/project/${projectId}/moodboards`)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 flex items-center gap-1"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 2L4 8l6 6" />
            </svg>
            All Boards
          </button>

          {editingTitle ? (
            <Input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleValue(board.title);
                  setEditingTitle(false);
                }
              }}
              className="text-xl font-bold h-auto py-1 px-2 -ml-2"
            />
          ) : (
            <h1
              className="text-xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Click to edit title"
            >
              {board.title}
            </h1>
          )}

          {board.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {board.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-[10px]">
              {board.items.length} item
              {board.items.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {board.layout}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout toggle */}
          <div className="flex items-center gap-0.5 bg-muted/60 backdrop-blur-sm border border-border/30 rounded-lg p-0.5">
            {(["masonry", "grid", "freeform"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  board.layout === l
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l === "masonry"
                  ? "Masonry"
                  : l === "grid"
                    ? "Grid"
                    : "Free"}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
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
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openImportDialog}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mr-2"
                >
                  <rect x="1" y="1" width="14" height="14" rx="2" />
                  <circle cx="5" cy="5" r="1.5" />
                  <path d="M1 11l4-4 3 3 2-2 5 5" />
                </svg>
                Image from Drive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTextDialogOpen(true)}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mr-2"
                >
                  <path d="M3 3h10M3 7h6M3 11h8" />
                </svg>
                Text Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorDialogOpen(true)}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mr-2"
                >
                  <circle cx="8" cy="8" r="6" />
                  <circle cx="6" cy="6" r="1" />
                  <circle cx="10" cy="6" r="1" />
                  <circle cx="8" cy="10" r="1" />
                </svg>
                Color Swatch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={suggestLoading}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mr-1.5"
            >
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
              <circle cx="8" cy="8" r="3" />
            </svg>
            {suggestLoading ? "Analyzing..." : "Suggest"}
          </Button>
        </div>
      </div>

      {/* Board Content */}
      {board.items.length === 0 ? (
        <Card className="border-dashed border-2 border-border/40 backdrop-blur-sm bg-card/80">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-4 shadow-[0_0_25px_oklch(0.585_0.233_264/0.15)]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-muted-foreground"
              >
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-1">Board is empty</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Add images from your Asset Drive, text notes, or color swatches to
              build your visual reference
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openImportDialog}>
                Import from Drive
              </Button>
              <Button
                variant="outline"
                onClick={() => setTextDialogOpen(true)}
              >
                Add Text
              </Button>
              <Button
                variant="outline"
                onClick={() => setColorDialogOpen(true)}
              >
                Add Color
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Masonry Layout */}
          {board.layout === "masonry" && (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
              {board.items.map((item) => (
                <div key={item.id} className="break-inside-avoid">
                  <MoodboardItemCard
                    item={item}
                    onDelete={() => deleteItem(item.id)}
                    onUpdateCaption={(caption) =>
                      updateItemCaption(item.id, caption)
                    }
                    onUpdateText={(text) =>
                      updateTextItem(item.id, text)
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* Grid Layout */}
          {board.layout === "grid" && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {board.items.map((item) => (
                <MoodboardItemCard
                  key={item.id}
                  item={item}
                  onDelete={() => deleteItem(item.id)}
                  onUpdateCaption={(caption) =>
                    updateItemCaption(item.id, caption)
                  }
                  onUpdateText={(text) =>
                    updateTextItem(item.id, text)
                  }
                  gridMode
                />
              ))}
            </div>
          )}

          {/* Freeform Layout (horizontal scroll) */}
          {board.layout === "freeform" && (
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
              {board.items.map((item) => (
                <div key={item.id} className="flex-none w-72 snap-start">
                  <MoodboardItemCard
                    item={item}
                    onDelete={() => deleteItem(item.id)}
                    onUpdateCaption={(caption) =>
                      updateItemCaption(item.id, caption)
                    }
                    onUpdateText={(text) =>
                      updateTextItem(item.id, text)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* AI Suggestions Section */}
      {(suggestions || suggestLoading) && (
        <>
          <Separator className="my-8" />
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
                <circle cx="8" cy="8" r="3" />
              </svg>
              AI Suggestions
            </h2>

            {suggestLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-10 w-1/2" />
              </div>
            ) : suggestions ? (
              <div className="space-y-6">
                {/* Analysis */}
                <Card className="border-border/40 backdrop-blur-sm bg-card/80">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-1">Board Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      {suggestions.analysis}
                    </p>
                  </CardContent>
                </Card>

                {/* Suggested Prompts */}
                {suggestions.suggestions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Suggested Image Prompts
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {suggestions.suggestions.map((prompt, i) => (
                        <Card key={i} className="border-border/40 backdrop-blur-sm bg-card/80 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.08)]">
                          <CardContent className="p-3">
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              {prompt}
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-7 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(prompt);
                                toast.success("Prompt copied to clipboard");
                              }}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="mr-1"
                              >
                                <rect x="5" y="5" width="9" height="9" rx="1" />
                                <path d="M5 11H3a1 1 0 01-1-1V3a1 1 0 011-1h7a1 1 0 011 1v2" />
                              </svg>
                              Copy Prompt
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Color Palette */}
                {suggestions.colorPalette.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Suggested Color Palette
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {suggestions.colorPalette.map((hex, i) => (
                        <button
                          key={i}
                          onClick={() => addSuggestedColor(hex)}
                          className="group flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted/60 transition-all duration-300 hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.1)]"
                          title={`Add ${hex} to board`}
                        >
                          <div
                            className="w-10 h-10 rounded-lg border shadow-sm group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {hex}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Elements */}
                {suggestions.missingElements.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Missing Elements
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {suggestions.missingElements.map((el, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {el}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Context input for re-suggestion */}
            <div className="flex gap-2">
              <Input
                placeholder="Add context for better suggestions (e.g. 'film noir thriller set in 1940s')"
                value={suggestContext}
                onChange={(e) => setSuggestContext(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSuggest()}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleSuggest}
                disabled={suggestLoading}
              >
                {suggestLoading ? "..." : "Re-analyze"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Add Text Dialog */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Text Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              placeholder="Type your note, mood description, reference keywords..."
              value={newTextContent}
              onChange={(e) => setNewTextContent(e.target.value)}
              rows={4}
              autoFocus
            />
            <Button
              onClick={addTextItem}
              disabled={!newTextContent.trim()}
              className="w-full"
            >
              Add Note
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Color Dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Color Swatch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-lg border shadow-sm shrink-0"
                style={{ backgroundColor: newColorValue }}
              />
              <div className="flex-1 space-y-2">
                {/* UX AUDIT FIX: replaced raw <label> with <Label htmlFor> for accessibility */}
                <Label htmlFor="moodboard-color">Color</Label>
                <div className="flex gap-2">
                  <input
                    id="moodboard-color"
                    type="color"
                    value={newColorValue}
                    onChange={(e) => setNewColorValue(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={newColorValue}
                    onChange={(e) => setNewColorValue(e.target.value)}
                    placeholder="#6366f1"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="moodboard-color-name">
                Name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="moodboard-color-name"
                placeholder="e.g. Midnight Blue, Warm Amber"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
              />
            </div>
            {/* Preset palette */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Quick presets
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  "#ef4444",
                  "#f97316",
                  "#eab308",
                  "#22c55e",
                  "#06b6d4",
                  "#3b82f6",
                  "#6366f1",
                  "#8b5cf6",
                  "#ec4899",
                  "#f43f5e",
                  "#1a1a1a",
                  "#6b7280",
                  "#d1d5db",
                  "#fafafa",
                  "#451a03",
                  "#1e3a5f",
                ].map((hex) => (
                  <button
                    key={hex}
                    onClick={() => setNewColorValue(hex)}
                    className={`w-7 h-7 rounded-md border transition-all hover:scale-110 ${
                      newColorValue === hex
                        ? "ring-2 ring-primary ring-offset-2"
                        : ""
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={addColorItem} className="w-full">
              Add Color
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import from Drive Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import from Asset Drive</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Select images to add to your moodboard
          </p>

          {loadingFiles ? (
            <div className="grid grid-cols-3 gap-2 pt-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No images found in your Asset Drive.
              <br />
              Upload images first, then import them here.
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pt-2">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {driveFiles.map((file) => {
                  const selected = selectedFileIds.has(file.id);
                  return (
                    <button
                      key={file.id}
                      onClick={() => toggleFileSelection(file.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/20"
                      }`}
                    >
                      <Image
                        src={`/api/drive/files/${file.id}`}
                        alt={file.filename}
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                      {selected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M3 8l4 4 6-8" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">
                        {file.filename}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-xs text-muted-foreground">
              {selectedFileIds.size} selected
            </span>
            <Button
              onClick={handleImport}
              disabled={selectedFileIds.size === 0}
            >
              Import {selectedFileIds.size > 0 ? `(${selectedFileIds.size})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Individual Moodboard Item Card ──

function MoodboardItemCard({
  item,
  onDelete,
  onUpdateCaption,
  onUpdateText,
  gridMode,
}: {
  item: MoodboardItem;
  onDelete: () => void;
  onUpdateCaption: (caption: string) => void;
  onUpdateText: (text: string) => void;
  gridMode?: boolean;
}) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionValue, setCaptionValue] = useState(item.caption ?? "");
  const [editingText, setEditingText] = useState(false);
  const [textValue, setTextValue] = useState(item.textContent ?? "");

  if (item.type === "image") {
    const imgSrc = item.fileId
      ? `/api/drive/files/${item.fileId}`
      : item.storagePath
        ? `/api/drive/files/${item.fileId}`
        : null;

    return (
      <Card className="group overflow-hidden border-border/40 backdrop-blur-sm bg-card/80 transition-all duration-300 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-0.5">
        <div className={`relative bg-muted/30 ${gridMode ? "aspect-square" : ""}`}>
          {imgSrc ? (
            gridMode ? (
              <Image
                src={imgSrc}
                alt={item.caption || "Moodboard image"}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element -- masonry/freeform layout needs natural aspect ratio */
              <img
                src={imgSrc}
                alt={item.caption || "Moodboard image"}
                className="w-full"
                loading="lazy"
              />
            )
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-muted-foreground text-xs">
              No image
            </div>
          )}
          {/* Delete overlay */}
          <button
            onClick={onDelete}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600/80 transition-all"
            title="Remove"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        {/* Caption area */}
        <CardContent className="p-2">
          {editingCaption ? (
            <Input
              value={captionValue}
              onChange={(e) => setCaptionValue(e.target.value)}
              onBlur={() => {
                onUpdateCaption(captionValue);
                setEditingCaption(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdateCaption(captionValue);
                  setEditingCaption(false);
                }
                if (e.key === "Escape") {
                  setCaptionValue(item.caption ?? "");
                  setEditingCaption(false);
                }
              }}
              className="h-7 text-xs"
              autoFocus
            />
          ) : (
            <p
              className="text-[10px] text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setEditingCaption(true)}
              title="Click to edit caption"
            >
              {item.caption || "Add caption..."}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (item.type === "text") {
    return (
      <Card className="group border-border/40 backdrop-blur-sm bg-card/80 transition-all duration-300 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-0.5">
        <CardContent className="p-3 relative">
          <button
            onClick={onDelete}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Remove"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
          <div className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="shrink-0 mt-0.5 text-muted-foreground"
            >
              <path d="M3 3h10M3 7h6M3 11h8" />
            </svg>
            {editingText ? (
              <Textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onBlur={() => {
                  onUpdateText(textValue);
                  setEditingText(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setTextValue(item.textContent ?? "");
                    setEditingText(false);
                  }
                }}
                className="text-xs min-h-[60px] flex-1"
                autoFocus
              />
            ) : (
              <p
                className="text-xs text-foreground flex-1 whitespace-pre-wrap cursor-pointer hover:text-primary transition-colors"
                onClick={() => setEditingText(true)}
                title="Click to edit"
              >
                {item.textContent || "Empty note"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (item.type === "color") {
    return (
      <Card className="group border-border/40 backdrop-blur-sm bg-card/80 transition-all duration-300 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-0.5 overflow-hidden">
        <div
          className="h-20 relative"
          style={{ backgroundColor: item.colorValue || "#888" }}
        >
          <button
            onClick={onDelete}
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600/80 transition-all"
            title="Remove"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <CardContent className="p-2">
          <p className="text-xs font-medium truncate">
            {item.colorName || "Unnamed"}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            {item.colorValue}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Fallback for unknown item type
  return (
    <Card>
      <CardContent className="p-3 text-xs text-muted-foreground">
        Unknown item type: {item.type}
      </CardContent>
    </Card>
  );
}
