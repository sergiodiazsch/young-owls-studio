"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShareAssetToggle } from "@/components/share-asset-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { gsap } from "@/lib/gsap";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Character } from "@/lib/types";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}

interface CharacterImage {
  linkId: number;
  isPrimary: boolean;
  file: {
    id: number;
    filename: string;
    storagePath: string;
    mimeType: string;
  };
}

interface CharacterDetails {
  sceneCount: number;
  excerpts: { line: string; parenthetical: string | null; sceneHeading: string }[];
}

// ── Avatar color from character name (deterministic hash, oklch palette) ──
function getCharacterColor(name: string): string {
  const colors = [
    "oklch(0.75 0.15 85)",    // warm gold
    "oklch(0.65 0.2 27)",     // coral
    "oklch(0.585 0.233 264)", // indigo (primary)
    "oklch(0.72 0.17 162)",   // teal
    "oklch(0.65 0.2 300)",    // purple
    "oklch(0.65 0.2 340)",    // rose
    "oklch(0.715 0.165 195)", // cyan (accent)
    "oklch(0.7 0.17 55)",     // orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ── Role classification by dialogue rank ──
function getRole(index: number, total: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (total <= 1) return { label: "Protagonist", variant: "default" };
  if (index <= 1) return { label: "Protagonist", variant: "default" };
  if (index <= 4) return { label: "Supporting", variant: "secondary" };
  return { label: "Minor", variant: "outline" };
}

export default function CharactersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<{ url: string; name: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // GSAP stagger animation on cards
  useEffect(() => {
    if (!gridRef.current || loading || characters.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-char-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, characters.length]);

  // Add character dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Character images state: { [characterId]: CharacterImage[] }
  const [charImages, setCharImages] = useState<Record<number, CharacterImage[]>>({});
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);

  // Voice dialog for dropdown-triggered assignment
  const [voiceDialogChar, setVoiceDialogChar] = useState<Character | null>(null);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<string>("all");
  const [voiceManualId, setVoiceManualId] = useState("");

  // Role editing
  const [roleEditingId, setRoleEditingId] = useState<number | null>(null);

  // Detail sheet state
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [selectedCharDetails, setSelectedCharDetails] = useState<CharacterDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Profile editing state
  const [profileTraits, setProfileTraits] = useState<string[]>([]);
  const [traitInput, setTraitInput] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  // Bible tab state
  const [bibleData, setBibleData] = useState<{
    dialogues: Array<{ id: number; line: string; parenthetical: string | null; sceneHeading: string; sceneNumber: number; projectTitle: string }>;
    generationHistory: Array<{ linkId: number; fileId: number; filename: string; mimeType: string; generatedBy: string | null; generationPrompt: string | null; seed: number | null; createdAt: string }>;
    seeds: Array<{ seed: number; prompt: string | null; fileId: number }>;
    topPrompts: Array<{ prompt: string; count: number }>;
  } | null>(null);
  const [bibleLoading, setBibleLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Sync profile traits when selected character changes
  useEffect(() => {
    if (selectedChar?.personalityTraits) {
      try { setProfileTraits(JSON.parse(selectedChar.personalityTraits)); } catch { setProfileTraits([]); }
    } else {
      setProfileTraits([]);
    }
    setTraitInput("");
    setProfileOpen(false);
    setActiveTab("profile");
    setBibleData(null);
  }, [selectedChar?.id]);

  const saveProfileField = useCallback(async (charId: number, field: string, value: string | null) => {
    try {
      await fetch(`/api/characters/${charId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, [field]: value } : c));
      if (selectedChar?.id === charId) {
        setSelectedChar((prev) => prev ? { ...prev, [field]: value } : prev);
      }
    } catch {
      toast.error("Failed to save");
    }
  }, [selectedChar?.id]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  function fetchCharacters(signal?: AbortSignal) {
    fetch(`/api/characters?projectId=${projectId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((data) => { setCharacters(data); setLoading(false); })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load characters");
        setLoading(false);
      });
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchCharacters(controller.signal);
    return () => controller.abort();
  }, [projectId]);

  // Load images for all characters once we have them (batched parallel)
  useEffect(() => {
    if (characters.length === 0) return;
    const controller = new AbortController();
    Promise.all(
      characters.map((char) =>
        fetch(`/api/characters/${char.id}/files`, { signal: controller.signal })
          .then((r) => r.json())
          .then((files: CharacterImage[]) => ({ charId: char.id, files }))
          .catch(() => ({ charId: char.id, files: [] as CharacterImage[] }))
      )
    ).then((results) => {
      const imageMap: Record<number, CharacterImage[]> = {};
      for (const { charId, files } of results) {
        imageMap[charId] = files;
      }
      setCharImages(imageMap);
    });
    return () => controller.abort();
  }, [characters]);

  // Fetch detail data when a character card is clicked
  const openDetailSheet = useCallback((char: Character) => {
    setSelectedChar(char);
    setSelectedCharDetails(null);
    setDetailsLoading(true);
    fetch(`/api/characters/${char.id}/details?name=${encodeURIComponent(char.name)}&projectId=${projectId}`)
      .then((r) => r.json())
      .then((data: CharacterDetails) => setSelectedCharDetails(data))
      .catch(() => setSelectedCharDetails({ sceneCount: 0, excerpts: [] }))
      .finally(() => setDetailsLoading(false));
  }, [projectId]);

  const fetchBibleData = useCallback(async (charId: number, charName: string) => {
    setBibleLoading(true);
    try {
      const res = await fetch(`/api/characters/${charId}/bible?name=${encodeURIComponent(charName)}`);
      const data = await res.json();
      setBibleData(data);
    } catch {
      setBibleData(null);
    } finally {
      setBibleLoading(false);
    }
  }, []);

  const uploadCharacterImage = useCallback(async (charId: number, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setUploadingFor(charId);

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        const uploadRes = await fetch("/api/drive/files/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const driveFile = await uploadRes.json();

        const linkRes = await fetch("/api/drive/character-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: charId, fileId: driveFile.id }),
        });
        if (!linkRes.ok) throw new Error("Link failed");
        const link = await linkRes.json();

        setCharImages((prev) => ({
          ...prev,
          [charId]: [...(prev[charId] || []), {
            linkId: link.id,
            isPrimary: link.isPrimary || false,
            file: { id: driveFile.id, filename: driveFile.filename, storagePath: driveFile.storagePath, mimeType: driveFile.mimeType },
          }],
        }));
        toast.success(`Added ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploadingFor(null);
  }, [projectId]);

  const removeCharacterImage = useCallback(async (charId: number, linkId: number) => {
    try {
      await fetch("/api/drive/character-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: linkId }),
      });
      setCharImages((prev) => ({
        ...prev,
        [charId]: (prev[charId] || []).filter((img) => img.linkId !== linkId),
      }));
    } catch {
      toast.error("Failed to remove image");
    }
  }, []);

  async function loadVoices() {
    if (voicesLoaded) return;
    try {
      const res = await fetch("/api/voices");
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setVoices(data);
      setVoicesLoaded(true);
    } catch {
      toast.error("Failed to load voices. Check your ElevenLabs API key in Settings.");
    }
  }

  async function saveDescription(id: number) {
    await fetch(`/api/characters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: editValue }),
    });
    setCharacters((prev) => prev.map((c) => c.id === id ? { ...c, description: editValue } : c));
    setEditingId(null);
    toast.success("Description updated");
  }

  async function saveName(id: number) {
    if (!editNameValue.trim()) return;
    await fetch(`/api/characters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editNameValue.trim() }),
    });
    setCharacters((prev) => prev.map((c) => c.id === id ? { ...c, name: editNameValue.trim() } : c));
    setEditingNameId(null);
    toast.success("Name updated");
  }

  async function handleVoiceChange(charId: number, voiceId: string) {
    const voice = voices.find((v) => v.voice_id === voiceId);
    await fetch(`/api/characters/${charId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, voiceName: voice?.name || null }),
    });
    setCharacters((prev) => prev.map((c) =>
      c.id === charId ? { ...c, voiceId, voiceName: voice?.name || null } : c
    ));
    toast.success(`Voice set to ${voice?.name}`);
  }

  async function handleRoleChange(charId: number, newRole: string) {
    await fetch(`/api/characters/${charId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, role: newRole } : c));
    setRoleEditingId(null);
    toast.success(`Role updated to ${newRole}`);
  }

  async function handleSetPrimaryImage(charId: number, linkId: number) {
    try {
      await fetch("/api/drive/character-links/primary", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: charId, linkId }),
      });
      setCharImages((prev) => ({
        ...prev,
        [charId]: (prev[charId] || []).map((img) => ({
          ...img,
          isPrimary: img.linkId === linkId,
        })),
      }));
      toast.success("Cover image updated");
    } catch {
      toast.error("Failed to set cover image");
    }
  }

  async function handleManualVoiceId(charId: number) {
    const id = voiceManualId.trim();
    if (!id) return;
    await fetch(`/api/characters/${charId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId: id, voiceName: `Custom (${id.slice(0, 8)}...)` }),
    });
    setCharacters((prev) => prev.map((c) =>
      c.id === charId ? { ...c, voiceId: id, voiceName: `Custom (${id.slice(0, 8)}...)` } : c
    ));
    setVoiceDialogChar(null);
    setVoiceManualId("");
    toast.success("Voice ID assigned");
  }

  async function handleAddCharacter() {
    if (!newName.trim()) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAddDialogOpen(false);
        setNewName("");
        setNewDescription("");
        toast.success("Character created");
        setCharacters((prev) => [...prev, { ...created, dialogueCount: created.dialogueCount ?? 0 }]);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create character");
      }
    } catch {
      toast.error("Failed to create character");
    }
    setAddSaving(false);
  }

  async function handleDeleteCharacter(id: number) {
    await fetch(`/api/characters/${id}`, { method: "DELETE" });
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    toast.success("Character deleted");
  }

  // Characters are already sorted by dialogueCount (desc) from the API.
  // Build a rank map based on the sorted order for role classification.
  const rankMap = useMemo(() => {
    const sorted = [...characters].sort((a, b) => b.dialogueCount - a.dialogueCount);
    const map = new Map<number, number>();
    sorted.forEach((c, i) => map.set(c.id, i));
    return map;
  }, [characters]);

  // Loading skeleton matching the new card design
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-48 mb-6" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="rounded-xl backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Skeleton className="w-20 h-20 rounded-full mb-4" />
                  <Skeleton className="h-5 w-28 mb-2" />
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Characters</h1>
          <Button onClick={() => setAddDialogOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add Character
          </Button>
        </div>
        <Card className="border-dashed border-2 border-primary/20 backdrop-blur-sm bg-card/80">
          <CardContent className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 shadow-[0_0_25px_oklch(0.585_0.233_264/0.15)] animate-float flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/60">
                <circle cx="9" cy="7" r="4" />
                <path d="M1 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
                <path d="M19 8v6M22 11h-6" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-1">The cast awaits</h2>
            <p className="relative text-sm text-muted-foreground text-center max-w-sm mb-6">
              Characters are automatically extracted when you parse a screenplay, or you can create them manually to begin casting your production.
            </p>
            <Button onClick={() => setAddDialogOpen(true)} className="relative shadow-[0_0_20px_oklch(0.585_0.233_264/0.2)]">Create Character</Button>
          </CardContent>
        </Card>
        <AddCharacterDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          name={newName}
          onNameChange={setNewName}
          description={newDescription}
          onDescriptionChange={setNewDescription}
          saving={addSaving}
          onSave={handleAddCharacter}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Characters</h1>
          <p className="text-muted-foreground mt-1">{characters.length} character{characters.length !== 1 ? "s" : ""} in this project</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add Character
        </Button>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search characters..."
          className="pl-9 focus:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-shadow duration-300 backdrop-blur-sm"
        />
      </div>

      {(() => {
        const filtered = characters.filter((c) =>
          c.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        );

        if (filtered.length === 0) {
          return (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No characters match your search.</p>
            </div>
          );
        }

        return (
          <div ref={gridRef} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((char) => {
              const images = charImages[char.id] || [];
              const primaryImage = images.find((img) => img.isPrimary) || images[0];
              const color = getCharacterColor(char.name);
              const rank = rankMap.get(char.id) ?? 999;
              const role = getRole(rank, characters.length);

              return (
                <Card
                  data-char-card
                  key={char.id}
                  className="group rounded-xl border border-border/40 cursor-pointer transition-all duration-300 backdrop-blur-sm bg-card/80 hover:shadow-[0_0_20px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-1"
                  onClick={() => openDetailSheet(char)}
                >
                  <CardContent className="p-6">
                    {/* Top row: avatar area + dropdown menu */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1" />
                      {/* Overflow menu — stop propagation so card click doesn't fire */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
                            aria-label={`Actions for ${char.name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => { setEditingNameId(char.id); setEditNameValue(char.name); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditingId(char.id); setEditValue(char.description || ""); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                            </svg>
                            Edit Description
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setVoiceDialogChar(char); loadVoices(); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                              <path d="M19 10v2a7 7 0 01-14 0v-2" />
                            </svg>
                            {char.voiceName ? "Change Voice" : "Assign Voice"}
                          </DropdownMenuItem>
                          {char.voiceId && (
                            <DropdownMenuItem onClick={() => {
                              const voice = voices.find((v) => v.voice_id === char.voiceId);
                              if (voice?.preview_url) setPreviewAudio({ url: voice.preview_url, name: voice.name });
                              else { loadVoices(); toast("Loading voices, try again..."); }
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="mr-2">
                                <path d="M5 3l14 9-14 9V3z" />
                              </svg>
                              Preview Voice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.multiple = true;
                            input.accept = "image/*";
                            input.onchange = () => {
                              if (input.files) uploadCharacterImage(char.id, input.files);
                            };
                            input.click();
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                            Add Images
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget({ id: char.id, name: char.name })}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            </svg>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Avatar area — centered */}
                    <div className="flex flex-col items-center text-center">
                      {primaryImage ? (
                        <div className="relative w-20 h-20 rounded-full overflow-hidden mb-4 ring-2 ring-primary/20 group-hover:ring-primary/40 group-hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.15)] transition-all duration-300">
                          <Image
                            src={`/api/drive/files/${primaryImage.file.id}`}
                            alt={char.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                        </div>
                      ) : (
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4 ring-2 ring-primary/20 group-hover:ring-primary/40 group-hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.15)] transition-all duration-300"
                          style={{ backgroundColor: color }}
                        >
                          {char.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Character name */}
                      {editingNameId === char.id ? (
                        <div role="group" className="flex gap-1 mb-2 w-full" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="h-7 text-sm font-semibold text-center"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveName(char.id);
                              if (e.key === "Escape") setEditingNameId(null);
                            }}
                          />
                          <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveName(char.id)}>OK</Button>
                        </div>
                      ) : (
                        <h3 className="font-semibold text-lg leading-tight mb-1 truncate max-w-full">{char.name}</h3>
                      )}

                      {/* Role badge — editable */}
                      {roleEditingId === char.id ? (
                        <div role="group" className="flex gap-1 mb-3" onClick={(e) => e.stopPropagation()}>
                          {["Protagonist", "Supporting", "Minor"].map((r) => (
                            <button
                              key={r}
                              onClick={() => handleRoleChange(char.id, r)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                (char.role || role.label) === r
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "hover:bg-accent border-border"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                          <button
                            onClick={() => setRoleEditingId(null)}
                            className="text-[10px] px-1 text-muted-foreground hover:text-foreground"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <Badge
                          variant={(char.role ? { Protagonist: "default" as const, Supporting: "secondary" as const, Minor: "outline" as const }[char.role] : role.variant) || role.variant}
                          className="text-[11px] uppercase tracking-wider font-medium mb-3 cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all"
                          onClick={(e) => { e.stopPropagation(); setRoleEditingId(char.id); }}
                          title="Click to change role"
                        >
                          {char.role || role.label}
                        </Badge>
                      )}

                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                          {char.dialogueCount} line{char.dialogueCount !== 1 ? "s" : ""}
                        </span>
                        {char.voiceName && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-4 px-1.5 gap-0.5 cursor-pointer hover:bg-accent"
                              onClick={(e) => { e.stopPropagation(); setVoiceDialogChar(char); loadVoices(); }}
                              title="Change voice"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                              </svg>
                              {char.voiceName}
                            </Badge>
                          </>
                        )}
                      </div>

                      {/* Description (inline editing or display) */}
                      {editingId === char.id ? (
                        <div role="group" className="space-y-2 mt-3 w-full text-left" onClick={(e) => e.stopPropagation()}>
                          <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="text-xs min-h-[60px]"
                            placeholder="Describe this character..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => saveDescription(char.id)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : char.description ? (
                        <p
                          className="text-xs text-muted-foreground mt-2 line-clamp-2 cursor-pointer hover:text-foreground transition-colors rounded p-1.5 hover:bg-accent/50 w-full text-left"
                          onClick={(e) => { e.stopPropagation(); setEditingId(char.id); setEditValue(char.description || ""); }}
                          title="Click to edit"
                        >
                          {char.description}
                        </p>
                      ) : null}

                      {/* Quick actions */}
                      <div role="group" className="flex items-center gap-2 mt-4 w-full" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/project/${projectId}/generate?character=${encodeURIComponent(char.name)}`}
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="w-full text-xs h-8">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                            Generate Reference
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => openDetailSheet(char)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Details
                        </Button>
                      </div>

                      {/* Compact image strip — click to set cover, hover to remove */}
                      {(images.length > 0 || uploadingFor === char.id) && (
                        <div role="group" className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 w-full justify-center" onClick={(e) => e.stopPropagation()}>
                          {images.map((img) => (
                            <div key={img.linkId} className="relative group/img w-10 h-10 rounded shrink-0 overflow-hidden bg-muted border">
                              <Image
                                src={`/api/drive/files/${img.file.id}`}
                                alt={img.file.filename}
                                fill
                                className="object-cover cursor-pointer"
                                sizes="40px"
                                onClick={() => handleSetPrimaryImage(char.id, img.linkId)}
                                title="Click to set as cover"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); removeCharacterImage(char.id, img.linkId); }}
                                className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity rounded-bl"
                                aria-label={`Remove image ${img.file.filename}`}
                              >
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                              </button>
                              {img.isPrimary && (
                                <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-white text-[7px] text-center leading-tight py-px">
                                  Cover
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            className="w-10 h-10 rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary shrink-0 flex items-center justify-center transition-colors"
                            title="Add image"
                            aria-label={`Add image to ${char.name}`}
                            onClick={() => {
                              const input = document.createElement("input");
                              input.type = "file";
                              input.multiple = true;
                              input.accept = "image/*";
                              input.onchange = () => {
                                if (input.files) uploadCharacterImage(char.id, input.files);
                              };
                              input.click();
                            }}
                          >
                            {uploadingFor === char.id ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                                <path d="M21 12a9 9 0 11-6.219-8.56" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* ── Character Detail Sheet ── */}
      <Sheet open={selectedChar !== null} onOpenChange={(open) => { if (!open) setSelectedChar(null); }}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto backdrop-blur-md bg-card/95 border-border/40">
          {selectedChar && (() => {
            const images = charImages[selectedChar.id] || [];
            const primaryImage = images.find((img) => img.isPrimary) || images[0];
            const color = getCharacterColor(selectedChar.name);
            const rank = rankMap.get(selectedChar.id) ?? 999;
            const role = getRole(rank, characters.length);

            return (
              <>
                <SheetHeader className="pb-2">
                  <SheetTitle className="text-xl">{selectedChar.name}</SheetTitle>
                  <SheetDescription>
                    <Badge
                      variant={(selectedChar.role ? { Protagonist: "default" as const, Supporting: "secondary" as const, Minor: "outline" as const }[selectedChar.role] : role.variant) || role.variant}
                      className="text-[11px] uppercase tracking-wider font-medium cursor-pointer hover:ring-1 hover:ring-primary/50"
                      onClick={() => setRoleEditingId(selectedChar.id)}
                    >
                      {selectedChar.role || role.label}
                    </Badge>
                  </SheetDescription>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={(v) => {
                  setActiveTab(v);
                  if (v === "bible" && !bibleData && selectedChar) {
                    fetchBibleData(selectedChar.id, selectedChar.name);
                  }
                }} className="flex-1">
                  <TabsList className="w-full mx-4 mb-2" style={{ width: 'calc(100% - 2rem)' }}>
                    <TabsTrigger value="profile" className="flex-1 text-xs">Profile</TabsTrigger>
                    <TabsTrigger value="bible" className="flex-1 text-xs">Bible</TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile">
                <div className="px-4 pb-6 space-y-6">
                  {/* Large reference image or avatar */}
                  <div className="flex justify-center">
                    {primaryImage ? (
                      <div className="relative w-40 h-40 rounded-xl overflow-hidden ring-2 ring-primary/30 shadow-[0_0_25px_oklch(0.585_0.233_264/0.15)]">
                        <Image
                          src={`/api/drive/files/${primaryImage.file.id}`}
                          alt={selectedChar.name}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-40 h-40 rounded-xl flex items-center justify-center text-5xl font-bold text-white ring-2 ring-primary/30 shadow-[0_0_25px_oklch(0.585_0.233_264/0.15)]"
                        style={{ backgroundColor: color }}
                      >
                        {selectedChar.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {selectedChar.description && (
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Description</h4>
                      <p className="text-sm leading-relaxed">{selectedChar.description}</p>
                    </div>
                  )}

                  {/* ── Character Profile Section ── */}
                  <div className="rounded-lg border border-border/40 backdrop-blur-sm bg-muted/10">
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/30 transition-colors rounded-lg"
                      onClick={() => setProfileOpen((v) => !v)}
                    >
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Character Profile</span>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-muted-foreground transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {profileOpen && (
                      <div className="px-3 pb-4 space-y-4">
                        {/* Personality Traits — tag input */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Personality Traits</Label>
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {profileTraits.map((trait) => (
                              <Badge key={trait} variant="secondary" className="text-xs gap-1 pr-1">
                                {trait}
                                <button
                                  className="ml-0.5 hover:text-destructive transition-colors"
                                  onClick={() => {
                                    const updated = profileTraits.filter((t) => t !== trait);
                                    setProfileTraits(updated);
                                    saveProfileField(selectedChar.id, "personalityTraits", updated.length > 0 ? JSON.stringify(updated) : null);
                                  }}
                                  aria-label={`Remove ${trait}`}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              </Badge>
                            ))}
                          </div>
                          <Input
                            value={traitInput}
                            onChange={(e) => setTraitInput(e.target.value)}
                            placeholder="Type a trait and press Enter..."
                            className="h-8 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const val = traitInput.trim().toLowerCase();
                                if (!val || profileTraits.includes(val)) return;
                                const updated = [...profileTraits, val];
                                setProfileTraits(updated);
                                setTraitInput("");
                                saveProfileField(selectedChar.id, "personalityTraits", JSON.stringify(updated));
                              }
                            }}
                          />
                        </div>

                        {/* Archetype */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Archetype</Label>
                          <Select
                            value={selectedChar.archetype || ""}
                            onValueChange={(v) => saveProfileField(selectedChar.id, "archetype", v || null)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select archetype..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hero">Hero</SelectItem>
                              <SelectItem value="mentor">Mentor</SelectItem>
                              <SelectItem value="sidekick">Sidekick</SelectItem>
                              <SelectItem value="antagonist">Antagonist</SelectItem>
                              <SelectItem value="comic-relief">Comic Relief</SelectItem>
                              <SelectItem value="background">Background</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Emotional Range */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Emotional Range</Label>
                          <Select
                            value={selectedChar.emotionalRange || ""}
                            onValueChange={(v) => saveProfileField(selectedChar.id, "emotionalRange", v || null)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select range..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="very-expressive">Very Expressive</SelectItem>
                              <SelectItem value="expressive">Expressive</SelectItem>
                              <SelectItem value="neutral">Neutral</SelectItem>
                              <SelectItem value="reserved">Reserved</SelectItem>
                              <SelectItem value="very-reserved">Very Reserved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Speaking Style */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Speaking Style</Label>
                          <Select
                            value={selectedChar.speakingStyle || ""}
                            onValueChange={(v) => saveProfileField(selectedChar.id, "speakingStyle", v || null)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select style..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="formal">Formal</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="childlike">Childlike</SelectItem>
                              <SelectItem value="dramatic">Dramatic</SelectItem>
                              <SelectItem value="sarcastic">Sarcastic</SelectItem>
                              <SelectItem value="poetic">Poetic</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Backstory */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Backstory</Label>
                          <Textarea
                            defaultValue={selectedChar.backstory || ""}
                            placeholder="Character backstory and history..."
                            className="text-xs min-h-[80px] resize-none"
                            maxLength={1000}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (selectedChar.backstory || "")) {
                                saveProfileField(selectedChar.id, "backstory", val || null);
                              }
                            }}
                          />
                          <p className="text-[10px] text-muted-foreground text-right">Max 1,000 characters</p>
                        </div>

                        {/* AI Generation Notes */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">AI Generation Notes</Label>
                          <p className="text-[10px] text-muted-foreground leading-snug">
                            This text is automatically added to image and video prompts for this character.
                          </p>
                          <Textarea
                            defaultValue={selectedChar.aiGenerationNotes || ""}
                            placeholder="e.g. Always wears a red leather jacket. Scar on left cheek. Mid-30s, athletic build."
                            className="text-xs min-h-[60px] resize-none"
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (selectedChar.aiGenerationNotes || "")) {
                                saveProfileField(selectedChar.id, "aiGenerationNotes", val || null);
                              }
                            }}
                          />
                        </div>

                        {/* AI Script Notes */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">AI Script Notes</Label>
                          <p className="text-[10px] text-muted-foreground leading-snug">
                            This text is used by the Script Doctor and Dialogue Polish when analyzing this character.
                          </p>
                          <Textarea
                            defaultValue={selectedChar.aiScriptNotes || ""}
                            placeholder="e.g. Speaks in short, clipped sentences. Never uses contractions. Has a dry wit."
                            className="text-xs min-h-[60px] resize-none"
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val !== (selectedChar.aiScriptNotes || "")) {
                                saveProfileField(selectedChar.id, "aiScriptNotes", val || null);
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/40 backdrop-blur-sm bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold text-primary drop-shadow-[0_0_6px_oklch(0.585_0.233_264/0.3)]">{selectedChar.dialogueCount}</p>
                      <p className="text-xs text-muted-foreground">Dialogue Lines</p>
                    </div>
                    <div className="rounded-lg border border-border/40 backdrop-blur-sm bg-muted/30 p-3 text-center">
                      {detailsLoading ? (
                        <Skeleton className="h-8 w-10 mx-auto mb-1" />
                      ) : (
                        <p className="text-2xl font-bold text-primary drop-shadow-[0_0_6px_oklch(0.585_0.233_264/0.3)]">{selectedCharDetails?.sceneCount ?? "--"}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Scene Appearances</p>
                    </div>
                  </div>

                  {/* Voice info */}
                  {selectedChar.voiceName && (
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Voice</h4>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                          <path d="M19 10v2a7 7 0 01-14 0v-2" />
                        </svg>
                        {selectedChar.voiceName}
                      </Badge>
                    </div>
                  )}

                  {/* Dialogue Excerpts */}
                  <div>
                    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Sample Dialogue</h4>
                    {detailsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-md" />
                        ))}
                      </div>
                    ) : selectedCharDetails?.excerpts && selectedCharDetails.excerpts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCharDetails.excerpts.map((excerpt, i) => (
                          <div key={i} className="rounded-md border border-border/40 backdrop-blur-sm bg-muted/20 p-2.5 text-sm">
                            {excerpt.parenthetical && (
                              <p className="text-xs text-muted-foreground italic mb-0.5">({excerpt.parenthetical})</p>
                            )}
                            <p className="leading-relaxed">{excerpt.line}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">{excerpt.sceneHeading}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No dialogue lines found.</p>
                    )}
                  </div>

                  {/* All reference images — click to set as cover */}
                  {images.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Reference Images <span className="normal-case font-normal">(click to set as cover)</span></h4>
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((img) => (
                          <div
                            key={img.linkId}
                            className={`relative aspect-square rounded-lg overflow-hidden bg-muted border cursor-pointer group/img transition-all duration-300 ${
                              img.isPrimary
                                ? "border-primary ring-2 ring-primary/30 shadow-[0_0_12px_oklch(0.585_0.233_264/0.15)]"
                                : "border-border/40 hover:border-primary/40 hover:shadow-[0_0_12px_oklch(0.585_0.233_264/0.1)]"
                            }`}
                            onClick={() => handleSetPrimaryImage(selectedChar.id, img.linkId)}
                            title={img.isPrimary ? "Current cover" : "Set as cover image"}
                          >
                            {img.isPrimary && (
                              <div className="absolute top-1 left-1 z-10 text-[8px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                                Cover
                              </div>
                            )}
                            <Image
                              src={`/api/drive/files/${img.file.id}`}
                              alt={img.file.filename}
                              fill
                              className="object-cover"
                              sizes="120px"
                            />
                            <button
                              onClick={() => removeCharacterImage(selectedChar.id, img.linkId)}
                              className="absolute inset-0 bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity"
                              aria-label={`Remove image ${img.file.filename}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="space-y-2 pt-2">
                    <Link href={`/project/${projectId}/generate?character=${encodeURIComponent(selectedChar.name)}`} className="block">
                      <Button variant="default" className="w-full shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-shadow duration-300">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        Generate Reference Image
                      </Button>
                    </Link>
                    <Link href={`/project/${projectId}/scenes`} className="block">
                      <Button variant="outline" className="w-full">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Open in Scenes
                      </Button>
                    </Link>
                    <ShareAssetToggle
                      assetType="character"
                      entityId={selectedChar.id}
                      projectId={Number(projectId)}
                      name={selectedChar.name}
                      description={selectedChar.description}
                    />
                  </div>
                </div>
                  </TabsContent>

                  <TabsContent value="bible">
                    <div className="px-4 pb-6 space-y-6">
                      {/* Character Name + Archetype */}
                      <div className="text-center">
                        <h2 className="text-2xl font-bold">{selectedChar.name}</h2>
                        {selectedChar.archetype && (
                          <Badge variant="secondary" className="mt-1 capitalize">{selectedChar.archetype}</Badge>
                        )}
                      </div>

                      {/* Profile Fields (read-only) */}
                      {(selectedChar.personalityTraits || selectedChar.emotionalRange || selectedChar.speakingStyle || selectedChar.backstory) && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Character Profile</h4>
                          {selectedChar.personalityTraits && (() => {
                            try {
                              const traits: string[] = JSON.parse(selectedChar.personalityTraits);
                              return traits.length > 0 ? (
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">Personality Traits</p>
                                  <div className="flex flex-wrap gap-1">{traits.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                                </div>
                              ) : null;
                            } catch { return null; }
                          })()}
                          {selectedChar.emotionalRange && <div><p className="text-[10px] text-muted-foreground mb-0.5">Emotional Range</p><p className="text-sm capitalize">{selectedChar.emotionalRange.replace(/-/g, " ")}</p></div>}
                          {selectedChar.speakingStyle && <div><p className="text-[10px] text-muted-foreground mb-0.5">Speaking Style</p><p className="text-sm capitalize">{selectedChar.speakingStyle}</p></div>}
                          {selectedChar.backstory && <div><p className="text-[10px] text-muted-foreground mb-0.5">Backstory</p><p className="text-sm leading-relaxed">{selectedChar.backstory}</p></div>}
                        </div>
                      )}

                      {/* AI Notes (read-only) */}
                      {(selectedChar.aiGenerationNotes || selectedChar.aiScriptNotes) && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">AI Notes</h4>
                          {selectedChar.aiGenerationNotes && <div className="rounded-md bg-muted/30 p-2.5"><p className="text-[10px] text-muted-foreground mb-0.5">Generation Notes</p><p className="text-xs">{selectedChar.aiGenerationNotes}</p></div>}
                          {selectedChar.aiScriptNotes && <div className="rounded-md bg-muted/30 p-2.5"><p className="text-[10px] text-muted-foreground mb-0.5">Script Notes</p><p className="text-xs">{selectedChar.aiScriptNotes}</p></div>}
                        </div>
                      )}

                      {/* Voice */}
                      {selectedChar.voiceName && (
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Voice</h4>
                          <Badge variant="secondary">{selectedChar.voiceName}</Badge>
                        </div>
                      )}

                      {/* Reference Images Gallery */}
                      {images.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Reference Images</h4>
                          <div className="grid grid-cols-3 gap-2">
                            {images.map((img) => (
                              <div key={img.linkId} className={`relative aspect-square rounded-lg overflow-hidden bg-muted border ${img.isPrimary ? "border-primary ring-1 ring-primary/30" : "border-border/40"}`}>
                                <Image src={`/api/drive/files/${img.file.id}`} alt={img.file.filename} fill className="object-cover" sizes="120px" />
                                {img.isPrimary && <div className="absolute top-1 left-1 text-[7px] px-1 py-0.5 rounded bg-primary text-primary-foreground font-medium">Cover</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bible data - loading/loaded */}
                      {bibleLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      ) : bibleData ? (
                        <>
                          {/* All Dialogue Lines */}
                          {bibleData.dialogues.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                                All Dialogue ({bibleData.dialogues.length} lines)
                              </h4>
                              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                                {bibleData.dialogues.map((d) => (
                                  <div key={d.id} className="rounded-md border border-border/40 bg-muted/20 p-2 text-sm">
                                    {d.parenthetical && <p className="text-[10px] text-muted-foreground italic">({d.parenthetical})</p>}
                                    <p className="text-xs leading-relaxed">{d.line}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Sc. {d.sceneNumber} - {d.projectTitle}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Generated Images */}
                          {bibleData.generationHistory.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                                Generated Images ({bibleData.generationHistory.filter(g => g.mimeType?.startsWith("image")).length})
                              </h4>
                              <div className="grid grid-cols-3 gap-2">
                                {bibleData.generationHistory.filter(g => g.mimeType?.startsWith("image")).map((g) => (
                                  <a key={g.linkId} href={`/api/drive/files/${g.fileId}`} target="_blank" rel="noopener noreferrer" className="relative aspect-square rounded-lg overflow-hidden bg-muted border border-border/40 hover:border-primary/40 transition-colors">
                                    <Image src={`/api/drive/files/${g.fileId}`} alt={g.filename} fill className="object-cover" sizes="120px" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Top Prompts */}
                          {bibleData.topPrompts.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Top Prompts</h4>
                              <div className="space-y-1.5">
                                {bibleData.topPrompts.map((p, i) => (
                                  <div key={i} className="rounded-md border border-border/40 bg-muted/20 p-2">
                                    <p className="text-xs leading-relaxed line-clamp-2">{p.prompt}</p>
                                    <p className="text-[9px] text-muted-foreground mt-0.5">Used {p.count} time{p.count !== 1 ? "s" : ""}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Saved Seeds */}
                          {bibleData.seeds.length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Saved Seeds</h4>
                              <div className="flex flex-wrap gap-1.5">
                                {bibleData.seeds.map((s, i) => (
                                  <Badge key={i} variant="outline" className="text-xs font-mono">{s.seed}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}

                      {/* Export PDF Button */}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const char = selectedChar;
                          const imgs = images;
                          const bible = bibleData;
                          const printWindow = window.open("", "_blank");
                          if (!printWindow) return;

                          const traitsHtml = (() => {
                            if (!char.personalityTraits) return "";
                            try {
                              const t: string[] = JSON.parse(char.personalityTraits);
                              return t.length ? `<p><strong>Personality:</strong> ${t.join(", ")}</p>` : "";
                            } catch { return ""; }
                          })();

                          printWindow.document.write(`<!DOCTYPE html><html><head><title>${char.name} - Character Bible</title>
                          <style>
                            @page { size: portrait; margin: 0.75in; }
                            body { font-family: system-ui, sans-serif; color: #1a1a2e; line-height: 1.6; max-width: 700px; margin: 0 auto; padding: 20px; }
                            h1 { font-size: 28px; margin-bottom: 4px; }
                            h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
                            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eee; font-size: 12px; margin: 2px; }
                            .dialogue { border-left: 3px solid #6366f1; padding: 4px 8px; margin: 4px 0; font-size: 13px; }
                            .meta { color: #999; font-size: 11px; }
                            img { max-width: 200px; border-radius: 8px; margin: 4px; }
                            .img-grid { display: flex; flex-wrap: wrap; gap: 8px; }
                          </style></head><body>
                            <h1>${char.name}</h1>
                            ${char.archetype ? `<span class="badge">${char.archetype}</span>` : ""}
                            ${char.role ? `<span class="badge">${char.role}</span>` : ""}
                            ${char.description ? `<p>${char.description}</p>` : ""}

                            <h2>Profile</h2>
                            ${traitsHtml}
                            ${char.emotionalRange ? `<p><strong>Emotional Range:</strong> ${char.emotionalRange.replace(/-/g, " ")}</p>` : ""}
                            ${char.speakingStyle ? `<p><strong>Speaking Style:</strong> ${char.speakingStyle}</p>` : ""}
                            ${char.backstory ? `<p><strong>Backstory:</strong> ${char.backstory}</p>` : ""}

                            ${char.voiceName ? `<h2>Voice</h2><p>${char.voiceName}</p>` : ""}

                            ${char.aiGenerationNotes ? `<h2>AI Generation Notes</h2><p>${char.aiGenerationNotes}</p>` : ""}

                            ${imgs.length > 0 ? `<h2>Reference Images</h2><div class="img-grid">${imgs.map(i => `<img src="/api/drive/files/${i.file.id}" />`).join("")}</div>` : ""}

                            ${bible?.dialogues?.length ? `<h2>Dialogue (${bible.dialogues.length} lines)</h2>${bible.dialogues.slice(0, 50).map(d => `<div class="dialogue">${d.parenthetical ? `<span class="meta">(${d.parenthetical})</span> ` : ""}${d.line}<br><span class="meta">Sc. ${d.sceneNumber} - ${d.projectTitle}</span></div>`).join("")}` : ""}

                            ${bible?.topPrompts?.length ? `<h2>Top Prompts</h2>${bible.topPrompts.map(p => `<div class="dialogue">${p.prompt}<br><span class="meta">Used ${p.count} time${p.count !== 1 ? "s" : ""}</span></div>`).join("")}` : ""}

                            ${bible?.seeds?.length ? `<h2>Saved Seeds</h2><p>${bible.seeds.map(s => `<span class="badge">${s.seed}</span>`).join(" ")}</p>` : ""}
                          </body></html>`);
                          printWindow.document.close();
                          setTimeout(() => printWindow.print(), 500);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                          <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Export as PDF
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Audio preview floating player */}
      {previewAudio && (
        <div className="fixed bottom-4 right-4 bg-card/95 backdrop-blur-md border border-border/40 rounded-xl shadow-[0_0_25px_oklch(0.585_0.233_264/0.15)] p-3 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4">
          <div className="flex-1">
            <p className="text-xs font-medium mb-1">{previewAudio.name}</p>
            <audio controls src={previewAudio.url} autoPlay className="h-8 w-48" />
          </div>
          <button
            onClick={() => setPreviewAudio(null)}
            className="w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-colors"
            aria-label="Close voice preview"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Voice Assignment Dialog — Full-featured with search, filters, preview, manual ID */}
      <Dialog open={voiceDialogChar !== null} onOpenChange={(open) => {
        if (!open) { setVoiceDialogChar(null); setVoiceSearch(""); setVoiceGenderFilter("all"); setVoiceManualId(""); }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col backdrop-blur-md bg-card/95 border-border/40">
          <DialogHeader>
            <DialogTitle>Assign Voice — {voiceDialogChar?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 flex-1 min-h-0 pt-1">
            {!voicesLoaded ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-9 w-full rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                </div>
              </div>
            ) : (
              <>
                {/* Search bar */}
                <div className="relative">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                  <Input
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    placeholder="Search voices by name, accent, language..."
                    className="pl-8 h-8 text-sm"
                    autoFocus
                  />
                </div>

                {/* Filter row */}
                <div className="flex gap-2 flex-wrap">
                  {["all", "male", "female"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setVoiceGenderFilter(g)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors capitalize ${
                        voiceGenderFilter === g
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent border-border text-muted-foreground"
                      }`}
                    >
                      {g === "all" ? "All" : g}
                    </button>
                  ))}
                  {voiceDialogChar?.voiceId && (
                    <button
                      onClick={() => {
                        const voice = voices.find((v) => v.voice_id === voiceDialogChar.voiceId);
                        if (voice?.preview_url) setPreviewAudio({ url: voice.preview_url, name: voice.name });
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors ml-auto flex items-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
                      Preview Current
                    </button>
                  )}
                </div>

                {/* Scrollable voice list */}
                <div className="flex-1 overflow-y-auto min-h-0 max-h-[40vh] space-y-1 pr-1">
                  {(() => {
                    const q = voiceSearch.toLowerCase();
                    const filtered = voices.filter((v) => {
                      // Gender filter
                      if (voiceGenderFilter !== "all") {
                        const gender = v.labels?.gender || "";
                        if (gender.toLowerCase() !== voiceGenderFilter) return false;
                      }
                      // Search filter — match name, category, or any label value
                      if (q) {
                        const searchable = [
                          v.name, v.category,
                          ...Object.values(v.labels || {}),
                        ].join(" ").toLowerCase();
                        return searchable.includes(q);
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return <p className="text-xs text-muted-foreground text-center py-6">No voices match your filters.</p>;
                    }

                    return filtered.map((v) => {
                      const isSelected = voiceDialogChar?.voiceId === v.voice_id;
                      const gender = v.labels?.gender;
                      const accent = v.labels?.accent;
                      const age = v.labels?.age;
                      const useCase = v.labels?.use_case;

                      return (
                        <div
                          key={v.voice_id}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-[0_0_8px_oklch(0.585_0.233_264/0.15)]"
                              : "border-transparent hover:bg-accent/50 hover:border-border"
                          }`}
                          onClick={() => {
                            if (voiceDialogChar) {
                              handleVoiceChange(voiceDialogChar.id, v.voice_id);
                              setVoiceDialogChar(null);
                              setVoiceSearch("");
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">{v.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">({v.category})</span>
                            </div>
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {gender && <span className="text-[9px] px-1.5 py-px rounded bg-muted text-muted-foreground capitalize">{gender}</span>}
                              {accent && <span className="text-[9px] px-1.5 py-px rounded bg-muted text-muted-foreground capitalize">{accent}</span>}
                              {age && <span className="text-[9px] px-1.5 py-px rounded bg-muted text-muted-foreground capitalize">{age}</span>}
                              {useCase && <span className="text-[9px] px-1.5 py-px rounded bg-muted text-muted-foreground capitalize">{useCase}</span>}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (v.preview_url) setPreviewAudio({ url: v.preview_url, name: v.name });
                            }}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                            title="Preview voice"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
                          </button>
                          {isSelected && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary shrink-0">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Manual Voice ID input */}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Or enter Voice ID directly</p>
                  <div className="flex gap-2">
                    <Input
                      value={voiceManualId}
                      onChange={(e) => setVoiceManualId(e.target.value)}
                      placeholder="Paste ElevenLabs voice ID..."
                      className="h-8 text-xs font-mono flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter" && voiceDialogChar) handleManualVoiceId(voiceDialogChar.id); }}
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs px-3"
                      disabled={!voiceManualId.trim()}
                      onClick={() => { if (voiceDialogChar) handleManualVoiceId(voiceDialogChar.id); }}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Character Dialog */}
      <AddCharacterDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        name={newName}
        onNameChange={setNewName}
        description={newDescription}
        onDescriptionChange={setNewDescription}
        saving={addSaving}
        onSave={handleAddCharacter}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete character"
        description={`Delete "${deleteTarget?.name}"? This will remove all linked data including images and voice assignments.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) return handleDeleteCharacter(deleteTarget.id); }}
      />
    </div>
  );
}

function AddCharacterDialog({ open, onOpenChange, name, onNameChange, description, onDescriptionChange, saving, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-md bg-card/95 border-border/40">
        <DialogHeader>
          <DialogTitle>Add Character</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="add-char-name">Name</Label>
            <Input
              id="add-char-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. DETECTIVE SMITH"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onSave()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-char-desc">Description (optional)</Label>
            <Textarea
              id="add-char-desc"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="A grizzled veteran detective with a troubled past..."
              rows={3}
            />
          </div>
          <Button onClick={onSave} disabled={saving || !name.trim()} className="w-full">
            {saving ? "Creating..." : "Create Character"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
