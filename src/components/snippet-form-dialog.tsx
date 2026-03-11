"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { PromptSnippet } from "@/lib/types";

interface SnippetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippet?: PromptSnippet | null;
  projectId: string;
  onSaved: () => void;
}

export function SnippetFormDialog({ open, onOpenChange, snippet, projectId, onSaved }: SnippetFormDialogProps) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const isEdit = !!snippet;

  useEffect(() => {
    if (snippet) {
      setName(snippet.name);
      setContent(snippet.content);
      setShortcut(snippet.shortcut || "");
      setTagsInput(snippet.tags ? snippet.tags.join(", ") : "");
    } else {
      setName("");
      setContent("");
      setShortcut("");
      setTagsInput("");
    }
  }, [snippet, open]);

  function parseTags(input: string): string[] {
    return input
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  async function handleSave() {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);

    const tags = parseTags(tagsInput);

    try {
      const url = isEdit ? `/api/snippets/${snippet!.id}` : "/api/snippets";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? {} : { projectId: Number(projectId) }),
          name,
          content,
          shortcut: shortcut || null,
          tags: tags.length > 0 ? tags : null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Failed to save snippet");
    } finally {
      setSaving(false);
    }
  }

  const previewTags = parseTags(tagsInput);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Snippet" : "New Snippet"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="snippet-name">Name</Label>
            <Input id="snippet-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Film Noir Style" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snippet-shortcut">Shortcut (optional)</Label>
            <Input id="snippet-shortcut" value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="e.g. noir" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="snippet-tags">Tags (comma-separated)</Label>
            <Input
              id="snippet-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. lighting, mood, style"
            />
            {previewTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {previewTags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="snippet-content">Content</Label>
            <Textarea id="snippet-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="The prompt text to insert..." rows={4} />
          </div>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()} className="w-full">
            {saving ? "Saving..." : isEdit ? "Update Snippet" : "Create Snippet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
