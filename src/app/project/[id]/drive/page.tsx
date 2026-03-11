"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { gsap } from "@/lib/gsap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { uploadToStorage, getMediaType } from "@/lib/supabase";
import {
  fetchFolders,
  fetchAllFolders,
  fetchItems,
  createFolder,
  updateFolder,
  deleteFolder,
  createItem,
  updateItem,
  deleteItemWithStorage,
  getFolderBreadcrumbs,
  fetchFolderItemCounts,
  type LibraryItem,
  type LibraryFolder,
  type LibraryItemType,
} from "@/lib/library";

/* ── Folder icon set ── */

const FOLDER_ICON_KEYS = [
  "folder", "star", "film", "music", "image", "palette", "camera",
  "doc", "mic", "video", "heart", "eye", "tag", "book", "globe",
  "layers", "archive", "play", "code", "zap",
] as const;

function FolderIcon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    folder: <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />,
    camera: <><rect x="2" y="4" width="12" height="10" rx="1.5" /><circle cx="8" cy="9" r="2.5" /><path d="M5 4V3h6v1" /></>,
    film: <><rect x="2" y="1" width="12" height="14" rx="1.5" /><path d="M2 4h12M2 12h12M5 1v3M5 12v3M11 1v3M11 12v3" /></>,
    music: <><path d="M6 14V5l8-2v9" /><circle cx="4" cy="14" r="2" /><circle cx="12" cy="12" r="2" /></>,
    image: <><rect x="1" y="1" width="14" height="14" rx="2" /><circle cx="5" cy="5" r="1.5" /><path d="M1 11l4-4 3 3 2-2 5 5" /></>,
    star: <path d="M8 1l2.24 4.55 5.01.73-3.63 3.54.86 5L8 12.27 3.52 14.82l.86-5L.75 6.28l5.01-.73z" />,
    doc: <><path d="M10 2H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L10 2z" /><path d="M10 2v3h3" /></>,
    mic: <><path d="M8 1v6M5 4a3 3 0 006 0M4 8a4 4 0 008 0" /><path d="M8 11v4M6 15h4" /></>,
    palette: <><circle cx="8" cy="8" r="7" /><circle cx="5" cy="6" r="1" /><circle cx="8" cy="4.5" r="1" /><circle cx="11" cy="6" r="1" /><circle cx="5" cy="10.5" r="1.5" /></>,
    video: <><rect x="1" y="3" width="10" height="10" rx="1" /><path d="M11 6l4-2v8l-4-2" /></>,
    heart: <path d="M8 14s-5.5-3.5-5.5-7A3 3 0 018 4.5 3 3 0 0113.5 7C13.5 10.5 8 14 8 14z" />,
    eye: <><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2.5" /></>,
    tag: <><path d="M1 9V2a1 1 0 011-1h7l6 6-7 7-6-6z" /><circle cx="5" cy="5" r="1" /></>,
    book: <><path d="M2 2h5a3 3 0 013 3v10a2 2 0 00-2-2H2V2zM14 2H9a3 3 0 00-3 3v10a2 2 0 012-2h6V2z" /></>,
    globe: <><circle cx="8" cy="8" r="7" /><path d="M1 8h14M8 1a11 11 0 014 7 11 11 0 01-4 7 11 11 0 01-4-7 11 11 0 014-7z" /></>,
    layers: <><path d="M8 1L1 5l7 4 7-4-7-4z" /><path d="M1 8l7 4 7-4" /><path d="M1 11l7 4 7-4" /></>,
    archive: <><rect x="1" y="1" width="14" height="4" rx="1" /><path d="M2 5v9a1 1 0 001 1h10a1 1 0 001-1V5M6 9h4" /></>,
    play: <path d="M4 2l10 6-10 6V2z" />,
    code: <path d="M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12" />,
    zap: <path d="M9 1L3 9h5l-1 6 6-8H8l1-6z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className={`shrink-0 ${className}`}>
      {icons[name] || icons.folder}
    </svg>
  );
}

/* ── Flag colors ── */

const FLAG_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Red", value: "#EF4444" },
  { name: "Pink", value: "#EC4899" },
];

/* ── Tag colors ── */

const TAG_COLORS: Record<string, string> = {
  red: "bg-red-500/15 text-red-400 border-red-500/20",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  green: "bg-green-500/15 text-green-400 border-green-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  pink: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  gray: "bg-white/10 text-white/60 border-white/10",
};

function tagColor(tag: string): string {
  const hash = [...tag].reduce((h, c) => h + c.charCodeAt(0), 0);
  const keys = Object.keys(TAG_COLORS);
  return TAG_COLORS[keys[hash % keys.length]];
}

/* ── File type icons for previews ── */

function FileTypeIcon({ type, className = "" }: { type: string; className?: string }) {
  switch (type) {
    case "audio":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
      );
    case "video":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
          <rect x="2" y="4" width="15" height="16" rx="2" /><path d="M17 9l5-3v12l-5-3" />
        </svg>
      );
    case "document":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" />
        </svg>
      );
    case "prompt":
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      );
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
        </svg>
      );
  }
}

/* ── Filter tabs config ── */

type FilterType = "all" | LibraryItemType;

const FILTER_TABS: { label: string; value: FilterType; icon: React.ReactNode }[] = [
  {
    label: "All",
    value: "all",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    label: "Images",
    value: "image",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1" y="1" width="14" height="14" rx="2" /><circle cx="5" cy="5" r="1.5" /><path d="M1 11l4-4 3 3 2-2 5 5" />
      </svg>
    ),
  },
  {
    label: "Video",
    value: "video",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1" y="3" width="10" height="10" rx="1" /><path d="M11 6l4-2v8l-4-2" />
      </svg>
    ),
  },
  {
    label: "Audio",
    value: "audio",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M6 14V5l8-2v9" /><circle cx="4" cy="14" r="2" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    label: "Documents",
    value: "document",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M10 2H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L10 2z" /><path d="M10 2v3h3" />
      </svg>
    ),
  },
];

/* ══════════════════════════════════════════════════
   Drive Page
   ══════════════════════════════════════════════════ */

export default function DrivePage() {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [allFoldersList, setAllFoldersList] = useState<LibraryFolder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderIcon, setNewFolderIcon] = useState("folder");
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ type: "item" | "folder"; id: number | string; name: string } | null>(null);
  const [moveDestination, setMoveDestination] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "item" | "folder"; id: number | string; storagePath?: string } | null>(null);

  // Sheet preview
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Rename state
  const [renameTarget, setRenameTarget] = useState<{ type: "folder" | "item"; id: string | number; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");

  // Icon picker for existing folders
  const [iconPickerTarget, setIconPickerTarget] = useState<string | null>(null);

  const driveGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!driveGridRef.current || loading || (items.length === 0 && folders.length === 0)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = driveGridRef.current.querySelectorAll("[data-drive-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, items.length, folders.length]);

  const loadDrive = useCallback(
    async (folderId: string | null = currentFolder, searchTerm?: string) => {
      try {
        const [foldersData, itemsData, allF] = await Promise.all([
          searchTerm ? Promise.resolve([]) : fetchFolders(folderId),
          fetchItems(folderId, searchTerm),
          fetchAllFolders(),
        ]);
        setFolders(foldersData);
        setItems(itemsData);
        setAllFoldersList(allF);
        setBreadcrumbs(getFolderBreadcrumbs(folderId, allF));

        // Fetch item counts for visible folders
        if (foldersData.length > 0) {
          fetchFolderItemCounts(foldersData.map((f) => f.id))
            .then(setFolderCounts)
            .catch(() => {});
        } else {
          setFolderCounts({});
        }
      } catch {
        toast.error("Failed to load library");
      } finally {
        setLoading(false);
      }
    },
    [currentFolder],
  );

  useEffect(() => {
    loadDrive(null);
  }, []);

  /* ── Filtered items ── */
  const filteredItems = useMemo(() => {
    if (filterType === "all") return items;
    return items.filter((item) => item.type === filterType);
  }, [items, filterType]);

  /* ── Filter counts ── */
  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = { all: items.length, image: 0, video: 0, audio: 0, document: 0, prompt: 0 };
    for (const item of items) {
      if (item.type in counts) counts[item.type as FilterType]++;
    }
    return counts;
  }, [items]);

  function navigateToFolder(folderId: string | null) {
    setCurrentFolder(folderId);
    setSearch("");
    setFilterType("all");
    setLoading(true);
    loadDrive(folderId);
  }

  function handleSearch() {
    if (search.trim()) {
      setLoading(true);
      loadDrive(null, search.trim());
    } else {
      setLoading(true);
      loadDrive(currentFolder);
    }
  }

  async function handleUpload(fileList: FileList) {
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(fileList)) {
      try {
        const result = await uploadToStorage(file);
        if (!result) {
          toast.error(`${file.name}: type not allowed or too large`);
          continue;
        }
        const type = getMediaType(file.type);
        await createItem({
          name: file.name,
          folderId: currentFolder,
          status: "approved",
          imgUrl: result.publicUrl,
          storagePath: result.storagePath,
          tags: [],
          linkedIds: [],
          type,
          meta: {},
        });
        successCount++;
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    if (successCount > 0) toast.success(`Uploaded ${successCount} file${successCount > 1 ? "s" : ""}`);
    loadDrive();
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), currentFolder, newFolderIcon);
      setNewFolderOpen(false);
      setNewFolderName("");
      setNewFolderIcon("folder");
      toast.success("Folder created");
      loadDrive();
    } catch {
      toast.error("Failed to create folder");
    }
  }

  async function handleDeleteItem(id: number, storagePath?: string) {
    setItems((prev) => prev.filter((f) => f.id !== id));
    // Close preview if this item is being viewed
    if (previewItem?.id === id) {
      setPreviewOpen(false);
      setPreviewItem(null);
    }
    try {
      await deleteItemWithStorage(id, storagePath);
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete");
      loadDrive();
    }
  }

  async function handleDeleteFolder(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    try {
      await deleteFolder(id);
      toast.success("Folder deleted");
    } catch {
      toast.error("Failed to delete folder");
      loadDrive();
    }
  }

  async function handleMove() {
    if (!moveTarget) return;
    setMoveDialogOpen(false);
    try {
      if (moveTarget.type === "item") {
        setItems((prev) => prev.filter((f) => f.id !== moveTarget.id));
        await updateItem(moveTarget.id as number, { folderId: moveDestination });
      } else {
        setFolders((prev) => prev.filter((f) => f.id !== moveTarget.id));
        await updateFolder(moveTarget.id as string, { parentId: moveDestination });
      }
      toast.success("Moved successfully");
      setMoveTarget(null);
    } catch {
      toast.error("Failed to move");
      loadDrive();
    }
  }

  async function openMoveDialog(type: "item" | "folder", id: number | string, name: string) {
    setMoveTarget({ type, id, name });
    const allF = await fetchAllFolders();
    setAllFoldersList(allF);
    setMoveDestination(null);
    setMoveDialogOpen(true);
  }

  async function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    try {
      if (renameTarget.type === "folder") {
        await updateFolder(renameTarget.id as string, { name: renameName.trim() });
      } else {
        await updateItem(renameTarget.id as number, { name: renameName.trim() });
      }
      toast.success("Renamed");
      setRenameTarget(null);
      loadDrive();
    } catch {
      toast.error("Failed to rename");
    }
  }

  async function handleSetFlag(type: "folder" | "item", id: string | number, flag: string | undefined) {
    try {
      if (type === "folder") {
        await updateFolder(id as string, { flag: flag || undefined });
        setFolders((prev) => prev.map((f) => f.id === id ? { ...f, flag } : f));
      } else {
        await updateItem(id as number, { flag });
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, flag } : i));
      }
    } catch {
      toast.error("Failed to update flag");
    }
  }

  async function handleSetFolderIcon(folderId: string, icon: string) {
    try {
      await updateFolder(folderId, { icon });
      setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, icon } : f));
      setIconPickerTarget(null);
    } catch {
      toast.error("Failed to update icon");
    }
  }

  async function handleRemoveTag(itemId: number, tag: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const newTags = item.tags.filter((t) => t !== tag);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, tags: newTags } : i)));
    try {
      await updateItem(itemId, { tags: newTags });
    } catch {
      loadDrive();
    }
  }

  function openPreview(item: LibraryItem) {
    setPreviewItem(item);
    setPreviewOpen(true);
  }

  /* ── Loading skeleton ── */

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
        <Skeleton className="h-10 w-full max-w-2xl mb-4 rounded-xl" />
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-2 mb-6">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-3 w-20 mb-4" />
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const isEmpty = folders.length === 0 && items.length === 0;

  return (
    <div ref={driveGridRef} className="p-4 md:p-8 max-w-[1400px] mx-auto">

      {/* ── Search bar + view toggle ── */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <label htmlFor="library-search" className="sr-only">Search files, folders, tags...</label>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true">
            <circle cx="7" cy="7" r="5" /><path d="M12 12l3 3" />
          </svg>
          <Input
            id="library-search"
            placeholder="Search files, folders, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 h-11 rounded-xl bg-muted/40 dark:bg-white/[0.04] border-muted-foreground/10 text-sm focus:shadow-[0_0_10px_oklch(0.585_0.233_264/0.1)] transition-shadow duration-300"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); loadDrive(currentFolder); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </button>
          )}
        </div>
        <div className="flex rounded-xl border border-muted-foreground/10 overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors ${
              viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
            Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors ${
              viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            List
          </button>
        </div>
      </div>

      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1 text-sm mb-4 bg-muted/30 dark:bg-white/[0.02] rounded-lg px-3 py-2 border border-border/40 backdrop-blur-sm">
        <button
          onClick={() => navigateToFolder(null)}
          className={`flex items-center gap-1.5 transition-colors rounded-md px-2 py-1 ${
            breadcrumbs.length === 0
              ? "text-foreground font-semibold bg-foreground/[0.06]"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
          </svg>
          Library
        </button>
        {breadcrumbs.map((bc, i) => (
          <span key={bc.id} className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/30">
              <path d="M6 3l5 5-5 5" />
            </svg>
            <button
              onClick={() => navigateToFolder(bc.id)}
              className={`transition-colors rounded-md px-2 py-1 ${
                i === breadcrumbs.length - 1
                  ? "text-foreground font-semibold bg-foreground/[0.06]"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
              }`}
            >
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      {/* ── Filter tabs ── */}
      {items.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filterType === tab.value
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/50 dark:bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.icon}
              {tab.label}
              {filterCounts[tab.value] > 0 && (
                <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                  filterType === tab.value
                    ? "bg-background/20 text-background"
                    : "bg-foreground/[0.06] text-muted-foreground"
                }`}>
                  {filterCounts[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-2 mb-6">
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-lg h-9 px-4 gap-1.5 shadow-[0_0_10px_oklch(0.585_0.233_264/0.15)] hover:shadow-[0_0_20px_oklch(0.585_0.233_264/0.25)] transition-shadow duration-300">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          {uploading ? "Uploading..." : "Add File"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(true)} className="rounded-lg h-9 px-4 gap-1.5 hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.1)] transition-shadow duration-300">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
          </svg>
          New Folder
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleUpload(e.target.files); }}
        />
      </div>

      {/* ── FOLDERS ── */}
      {folders.length > 0 && (
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 mb-3">
            Folders
          </p>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            {folders.map((folder) => (
              <div
                key={folder.id}
                data-drive-card
                className="group relative backdrop-blur-sm bg-card/80 border border-border/40 rounded-xl hover:border-border hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                onClick={() => navigateToFolder(folder.id)}
              >
                {/* Flag dot */}
                {folder.flag && (
                  <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: folder.flag }} />
                  </div>
                )}

                {/* Three-dot menu */}
                <div role="group" className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => { setRenameTarget({ type: "folder", id: folder.id, name: folder.name }); setRenameName(folder.name); }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><path d="M8 14h6M2 14l1.5-4.5L11 2l3 3-7.5 7.5L2 14z" /></svg>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIconPickerTarget(folder.id)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="mr-2"><circle cx="8" cy="8" r="7" /><circle cx="5" cy="6" r="1" /><circle cx="8" cy="4.5" r="1" /><circle cx="11" cy="6" r="1" /></svg>
                        Change Icon
                      </DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><circle cx="8" cy="8" r="6" /></svg>
                          Set Flag
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {FLAG_COLORS.map((fc) => (
                            <DropdownMenuItem key={fc.value} onClick={() => handleSetFlag("folder", folder.id, fc.value)}>
                              <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: fc.value }} />
                              {fc.name}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleSetFlag("folder", folder.id, undefined)}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                            Remove Flag
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem onClick={() => openMoveDialog("folder", folder.id, folder.name)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><path d="M4 8h8M12 8l-3-3M12 8l-3 3" /></svg>
                        Move
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget({ type: "folder", id: folder.id })}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Folder card body */}
                <div className="flex flex-col items-center pt-7 pb-4 px-3">
                  <div className="w-10 h-10 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-2">
                    <FolderIcon name={folder.icon || "folder"} size={32} />
                  </div>
                  <p className="text-[13px] font-medium text-center leading-tight line-clamp-2">{folder.name}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {folderCounts[folder.id] ?? 0} items
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FILES ── */}
      {filteredItems.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50 mb-3">
            Files{filterType !== "all" ? ` — ${FILTER_TABS.find((t) => t.value === filterType)?.label}` : ""}
          </p>
          {viewMode === "grid" ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  data-drive-card
                  className={`group relative backdrop-blur-sm bg-card/80 border rounded-lg overflow-hidden hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer ${
                    previewItem?.id === item.id && previewOpen
                      ? "border-primary ring-1 ring-primary/30 shadow-[0_0_15px_oklch(0.585_0.233_264/0.15)]"
                      : "border-border/40 hover:border-border"
                  }`}
                  onClick={() => openPreview(item)}
                >
                  {/* Thumbnail area */}
                  <div className={`relative overflow-hidden bg-muted/50 ${
                    item.type === "image" ? "aspect-square" : item.type === "video" ? "aspect-video" : "aspect-[4/3]"
                  }`}>
                    {item.type === "image" ? (
                      <Image
                        src={item.imgUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        unoptimized
                      />
                    ) : item.type === "video" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted">
                        <div className="w-14 h-14 rounded-2xl bg-foreground/5 dark:bg-white/10 flex items-center justify-center shadow-[0_0_12px_oklch(0.585_0.233_264/0.1)]">
                          <FileTypeIcon type="video" className="text-muted-foreground" />
                        </div>
                      </div>
                    ) : item.type === "audio" ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted">
                        <div className="w-14 h-14 rounded-2xl bg-foreground/5 dark:bg-white/10 flex items-center justify-center shadow-[0_0_12px_oklch(0.715_0.165_195/0.1)]">
                          <FileTypeIcon type="audio" className="text-muted-foreground" />
                        </div>
                      </div>
                    ) : item.type === "document" ? (
                      <div className="w-full h-full relative bg-gradient-to-br from-muted/80 to-muted overflow-hidden">
                        {item.imgUrl && (item.name.toLowerCase().endsWith(".pdf") || item.imgUrl.toLowerCase().includes(".pdf")) ? (
                          <>
                            <iframe
                              src={`${item.imgUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              className="absolute inset-0 w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
                              title={item.name}
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-transparent" />
                          </>
                        ) : item.imgUrl && /\.(jpe?g|png|gif|webp|svg)$/i.test(item.imgUrl) ? (
                          <Image
                            src={item.imgUrl}
                            alt={item.name}
                            fill
                            className="object-cover opacity-90"
                            sizes="(max-width: 640px) 50vw, 20vw"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-14 h-14 rounded-2xl bg-foreground/5 dark:bg-white/10 flex items-center justify-center">
                              <FileTypeIcon type="document" className="text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/80 to-muted">
                        <div className="w-14 h-14 rounded-2xl bg-foreground/5 dark:bg-white/10 flex items-center justify-center">
                          <FileTypeIcon type={item.type} className="text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Status badge */}
                    {item.status && item.status !== "approved" && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-[10px] bg-background/80 backdrop-blur-sm border-none capitalize">
                          {item.status}
                        </Badge>
                      </div>
                    )}

                    {/* Flag dot */}
                    {item.flag && (
                      <div className="absolute top-2 left-2">
                        <div className="w-2.5 h-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: item.flag }} />
                      </div>
                    )}

                    {/* Hover actions */}
                    <div role="group" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-7 h-7 rounded-md bg-foreground/50 backdrop-blur-sm text-background flex items-center justify-center hover:bg-foreground/70 transition-colors">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" />
                            </svg>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => { setRenameTarget({ type: "item", id: item.id, name: item.name }); setRenameName(item.name); }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><path d="M8 14h6M2 14l1.5-4.5L11 2l3 3-7.5 7.5L2 14z" /></svg>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><circle cx="8" cy="8" r="6" /></svg>
                              Set Flag
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {FLAG_COLORS.map((fc) => (
                                <DropdownMenuItem key={fc.value} onClick={() => handleSetFlag("item", item.id, fc.value)}>
                                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: fc.value }} />
                                  {fc.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSetFlag("item", item.id, undefined)}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                                Remove Flag
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem onClick={() => openMoveDialog("item", item.id, item.name)}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2"><path d="M4 8h8M12 8l-3-3M12 8l-3 3" /></svg>
                            Move
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget({ type: "item", id: item.id, storagePath: item.storagePath })}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* File info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate leading-tight" title={item.name}>{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 capitalize font-medium">
                        {item.type}
                      </Badge>
                      {item.meta?.duration && (
                        <span className="text-[10px] text-muted-foreground">{item.meta.duration}</span>
                      )}
                    </div>
                    {item.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {item.tags.slice(0, 2).map((tag) => (
                          <button
                            key={tag}
                            onClick={(e) => { e.stopPropagation(); handleRemoveTag(item.id, tag); }}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${tagColor(tag)}`}
                            title="Click to remove tag"
                          >
                            {tag}
                          </button>
                        ))}
                        {item.tags.length > 2 && (
                          <span className="text-[9px] text-muted-foreground/60 self-center">+{item.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── List view ── */
            <div className="space-y-1">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  data-drive-card
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                    previewItem?.id === item.id && previewOpen
                      ? "bg-primary/[0.06] border border-primary/20 shadow-[0_0_10px_oklch(0.585_0.233_264/0.08)]"
                      : "hover:bg-primary/5 border border-transparent"
                  }`}
                  onClick={() => openPreview(item)}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {item.type === "image" ? (
                      <Image src={item.imgUrl} alt={item.name} width={40} height={40} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <FileTypeIcon type={item.type} className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 capitalize font-medium">
                        {item.type}
                      </Badge>
                      {item.meta?.duration && (
                        <span className="text-[10px] text-muted-foreground">{item.meta.duration}</span>
                      )}
                    </div>
                  </div>
                  {item.flag && (
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.flag }} />
                  )}
                  {item.tags.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {item.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${tagColor(tag)}`}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div role="group" className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openMoveDialog("item", item.id, item.name)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      title="Move"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 8h8M12 8l-3-3M12 8l-3 3" /></svg>
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "item", id: item.id, storagePath: item.storagePath })}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : isEmpty ? (
        /* ── Empty state ── */
        <div className="border-2 border-dashed border-border/50 rounded-2xl backdrop-blur-sm bg-card/40">
          <div className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M12 11v4M10 13h4" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-1">
              {currentFolder !== null ? "This folder is empty" : "Your production asset library"}
            </h2>
            <p className="relative text-sm text-muted-foreground mb-6 text-center max-w-md">
              {currentFolder !== null
                ? "Upload files or create folders to organize your assets"
                : "Generated images, videos, audio, and documents are saved here. Upload files or create folders to organize your production assets."
              }
            </p>
            <div className="relative flex gap-2">
              <Button variant="outline" onClick={() => setNewFolderOpen(true)} className="rounded-lg">New Folder</Button>
              <Button onClick={() => fileInputRef.current?.click()} className="rounded-lg shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-shadow duration-300">Add File</Button>
            </div>
          </div>
        </div>
      ) : items.length > 0 && filteredItems.length === 0 ? (
        /* ── No results for filter ── */
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <FileTypeIcon type={filterType === "all" ? "document" : filterType} className="text-muted-foreground/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            No {FILTER_TABS.find((t) => t.value === filterType)?.label?.toLowerCase()} found
          </p>
          <p className="text-xs text-muted-foreground/60">
            Try uploading or selecting a different filter
          </p>
        </div>
      ) : null}

      {/* ══ DIALOGS ══ */}

      {/* New Folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Choose a name and icon for your folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                placeholder="e.g. Reference Images"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex gap-1.5 flex-wrap">
                {FOLDER_ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => setNewFolderIcon(key)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                      newFolderIcon === key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                    title={key}
                    aria-label={`${key} icon`}
                    aria-pressed={newFolderIcon === key}
                  >
                    <FolderIcon name={key} size={16} />
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="w-full">
              Create Folder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>Enter a new name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
              <Button onClick={handleRename} disabled={!renameName.trim()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Icon Picker Dialog */}
      <Dialog open={iconPickerTarget !== null} onOpenChange={(open) => { if (!open) setIconPickerTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Icon</DialogTitle>
            <DialogDescription>Select an icon for this folder.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 flex-wrap pt-2">
            {FOLDER_ICON_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => iconPickerTarget && handleSetFolderIcon(iconPickerTarget, key)}
                className="w-11 h-11 rounded-lg bg-muted text-muted-foreground hover:bg-accent hover:text-foreground flex items-center justify-center transition-all"
                title={key}
              >
                <FolderIcon name={key} size={20} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move &ldquo;{moveTarget?.name}&rdquo;</DialogTitle>
            <DialogDescription>Select a destination folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 pt-2 max-h-[300px] overflow-y-auto">
            <button
              onClick={() => setMoveDestination(null)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                moveDestination === null ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
              </svg>
              Root
            </button>
            {allFoldersList
              .filter((f) => moveTarget?.type !== "folder" || f.id !== moveTarget.id)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() => setMoveDestination(f.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                    moveDestination === f.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <FolderIcon name={f.icon || "folder"} size={14} />
                  {f.name}
                </button>
              ))}
          </div>
          <div className="border-t pt-3 mt-2">
            <Button onClick={handleMove} className="w-full">Move Here</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Right-panel preview Sheet ── */}
      <PreviewSheet
        item={previewItem}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewItem(null);
        }}
        onDeleted={() => {
          setPreviewOpen(false);
          setPreviewItem(null);
          loadDrive();
        }}
        onRenamed={() => { loadDrive(); }}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget?.type === "folder" ? "Delete folder" : "Delete file"}
        description={deleteTarget?.type === "folder"
          ? "This folder and all its contents will be permanently deleted."
          : "This file will be permanently deleted. This action cannot be undone."
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "folder") {
            return handleDeleteFolder(deleteTarget.id as string);
          }
          return handleDeleteItem(deleteTarget.id as number, deleteTarget.storagePath);
        }}
      />
    </div>
  );
}

/* ── Right-panel preview Sheet ── */

function PreviewSheet({
  item,
  open,
  onOpenChange,
  onDeleted,
  onRenamed,
}: {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  onRenamed?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset rename state when item changes
  useEffect(() => {
    setRenaming(false);
    setNewName("");
  }, [item?.id]);

  if (!item) return null;

  async function handleRename() {
    if (!newName.trim() || !item) return;
    try {
      await updateItem(item.id, { name: newName.trim() });
      toast.success("Renamed");
      setRenaming(false);
      onRenamed?.();
    } catch {
      toast.error("Failed to rename");
    }
  }

  async function handleDelete() {
    if (!item) return;
    try {
      await deleteItemWithStorage(item.id, item.storagePath);
      toast.success("Deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch {
      toast.error("Failed to delete");
    }
  }

  function handleDownload() {
    if (!item) return;
    const a = document.createElement("a");
    a.href = item.imgUrl;
    a.download = item.name;
    a.target = "_blank";
    a.click();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="text-base truncate pr-6">{item.name}</SheetTitle>
            <SheetDescription className="sr-only">File preview and details</SheetDescription>
          </SheetHeader>

          {/* Preview area */}
          <div className="px-5 pt-3">
            <div className="rounded-lg overflow-hidden bg-muted/50 dark:bg-white/[0.03] border border-border/40 shadow-[inset_0_0_20px_oklch(0.585_0.233_264/0.03)]">
              {item.type === "image" ? (
                <div className="relative aspect-square">
                  <Image
                    src={item.imgUrl}
                    alt={item.name}
                    fill
                    className="object-contain"
                    sizes="400px"
                    unoptimized
                  />
                </div>
              ) : item.type === "video" ? (
                <div className="aspect-video">
                  <video
                    src={item.meta?.videoUrl || item.imgUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : item.type === "audio" ? (
                <div className="p-6 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-foreground/5 dark:bg-white/10 flex items-center justify-center">
                    <FileTypeIcon type="audio" className="text-muted-foreground w-8 h-8" />
                  </div>
                  <audio controls src={item.imgUrl} className="w-full" />
                </div>
              ) : item.type === "prompt" ? (
                <div className="p-5 max-h-[300px] overflow-auto">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{item.meta?.prompt || item.name}</p>
                </div>
              ) : item.type === "document" ? (
                <div className="relative aspect-[4/3]">
                  {item.imgUrl && (item.name.toLowerCase().endsWith(".pdf") || item.imgUrl.toLowerCase().includes(".pdf")) ? (
                    <iframe
                      src={`${item.imgUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                      className="absolute inset-0 w-full h-full border-0"
                      title={item.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileTypeIcon type="document" className="text-muted-foreground w-12 h-12" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <FileTypeIcon type={item.type} className="mx-auto text-muted-foreground mb-3 w-12 h-12" />
                  <p className="text-sm text-muted-foreground">{String(item.type).toUpperCase()}</p>
                </div>
              )}
            </div>
          </div>

          {/* File details */}
          <div className="px-5 pt-4 pb-2 space-y-3">
            <div className="space-y-2.5">
              {/* Name (editable) */}
              {renaming ? (
                <div className="flex gap-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    autoFocus
                    className="flex-1 h-8 text-sm"
                  />
                  <Button size="sm" className="h-8 px-3" onClick={handleRename}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setRenaming(false)}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <p className="text-sm font-medium break-all leading-snug flex-1">{item.name}</p>
                  <button
                    onClick={() => { setNewName(item.name); setRenaming(true); }}
                    className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14h6M2 14l1.5-4.5L11 2l3 3-7.5 7.5L2 14z" /></svg>
                  </button>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize flex items-center gap-1.5">
                  <FileTypeIcon type={item.type} className="w-3.5 h-3.5 text-muted-foreground/60" />
                  {item.type}
                </span>

                {item.status && (
                  <>
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">{item.status}</span>
                  </>
                )}

                {item.meta?.tool && (
                  <>
                    <span className="text-muted-foreground">Generated by</span>
                    <span>{item.meta.tool}</span>
                  </>
                )}

                {item.meta?.duration && (
                  <>
                    <span className="text-muted-foreground">Duration</span>
                    <span>{item.meta.duration}</span>
                  </>
                )}
              </div>

              {/* Prompt (if available) */}
              {item.meta?.prompt && (
                <div className="pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Prompt</p>
                  <div className="rounded-md bg-muted/50 dark:bg-white/[0.03] border border-border/40 p-2.5 shadow-[inset_0_0_10px_oklch(0.585_0.233_264/0.02)]">
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{item.meta.prompt}</p>
                  </div>
                </div>
              )}

              {/* Notes */}
              {item.meta?.notes && (
                <div className="pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-xs text-muted-foreground/80 italic">{item.meta.notes}</p>
                </div>
              )}

              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Tags</p>
                  <div className="flex gap-1 flex-wrap">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className={`text-[10px] ${tagColor(tag)}`}>{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Flag */}
              {item.flag && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Flag</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.flag }} />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pt-2 pb-5 flex flex-col gap-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5 hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.1)] transition-shadow duration-300" onClick={handleDownload}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" /><path d="M8 2v8M5 7l3 3 3-3" />
                </svg>
                Download
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-9 gap-1.5 px-4"
                onClick={() => setConfirmDelete(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
                Delete
              </Button>
            </div>
            {item.meta?.tool && (
              <Button size="sm" variant="outline" className="w-full h-9 gap-1.5 text-xs">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 1L3 9h5l-1 6 6-8H8l1-6z" />
                </svg>
                Open in Generator
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete file"
        description="This file will be permanently deleted."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </>
  );
}
