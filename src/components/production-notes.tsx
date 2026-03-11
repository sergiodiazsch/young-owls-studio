"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface SceneNote {
  id: number;
  sceneId: number;
  projectId: number;
  content: string;
  category: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductionNotesProps {
  sceneId: number;
  projectId: string;
}

const CATEGORIES = ["blocking", "lighting", "sound", "vfx", "performance", "general"] as const;
const COLORS = ["red", "yellow", "green", "blue", "purple"] as const;

const COLOR_VALUES: Record<string, string> = {
  red: "oklch(0.55 0.2 25)",
  yellow: "oklch(0.75 0.15 85)",
  green: "oklch(0.55 0.18 145)",
  blue: "oklch(0.55 0.18 250)",
  purple: "oklch(0.55 0.18 300)",
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

export function ProductionNotes({ sceneId, projectId }: ProductionNotesProps) {
  const [notes, setNotes] = useState<SceneNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>("general");
  const [newColor, setNewColor] = useState<string>("yellow");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/scene-notes?sceneId=${sceneId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setNotes(data);
    } catch {
      toast.error("Failed to load production notes");
    } finally {
      setLoading(false);
    }
  }, [sceneId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleAdd() {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/scene-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          projectId: Number(projectId),
          content: newContent.trim(),
          category: newCategory,
          color: newColor,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      setNewContent("");
      setNewCategory("general");
      setNewColor("yellow");
      setShowAddForm(false);
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/scene-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, content: editContent.trim(), updatedAt: new Date().toISOString() } : n
        )
      );
      setEditingId(null);
      setEditContent("");
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this note?")) return;
    // Optimistic update
    const prev = notes;
    setNotes((n) => n.filter((note) => note.id !== id));
    try {
      const res = await fetch(`/api/scene-notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Note deleted");
    } catch {
      setNotes(prev);
      toast.error("Failed to delete note");
    }
  }

  function startEdit(note: SceneNote) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="h-20 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Production Notes</h3>
        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add Note
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder="Enter production note..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className="text-sm resize-none"
              autoFocus
            />

            {/* Category selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                      newCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Color selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Color</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${
                      newColor === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: COLOR_VALUES[c] }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleAdd} disabled={saving || !newContent.trim()} className="h-7 text-xs">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setShowAddForm(false);
                  setNewContent("");
                  setNewCategory("general");
                  setNewColor("yellow");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      {notes.length === 0 && !showAddForm ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M8 13h8M8 17h5" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No production notes yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add notes to track technical requirements.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Card key={note.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  {/* Color dot */}
                  <div className="pt-0.5 shrink-0">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLOR_VALUES[note.color] || COLOR_VALUES.yellow }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] capitalize h-5">
                        {note.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(note.createdAt)}</span>
                    </div>

                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => handleUpdate(note.id)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] px-2"
                            onClick={() => {
                              setEditingId(null);
                              setEditContent("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  {editingId !== note.id && (
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        onClick={() => startEdit(note)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Edit note"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete note"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
