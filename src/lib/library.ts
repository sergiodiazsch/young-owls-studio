"use client";

import { getSupabase, toSnake, toCamel, toCamelRows } from "@/lib/supabase";

/* ── Types (match Young Owls Hub schema) ── */

export type LibraryItemType = "image" | "prompt" | "video" | "audio" | "document";

export interface LibraryItemMeta {
  role?: string;
  traits?: string[];
  notes?: string;
  prompt?: string;
  videoUrl?: string;
  duration?: string;
  tool?: string;
}

export interface LibraryItem {
  id: number;
  name: string;
  folderId: string | null;
  status: string;
  imgUrl: string;
  storagePath?: string;
  tags: string[];
  linkedIds: number[];
  type: LibraryItemType;
  meta: LibraryItemMeta;
  flag?: string;
}

export interface LibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  icon?: string;
  flag?: string;
}

/* ── CRUD: Folders ── */

export async function fetchFolders(parentId: string | null = null): Promise<LibraryFolder[]> {
  const sb = getSupabase();
  let q = sb.from("library_folders").select("*");
  if (parentId === null) {
    q = q.is("parent_id", null);
  } else {
    q = q.eq("parent_id", parentId);
  }
  q = q.order("name");
  const { data, error } = await q;
  if (error) throw error;
  return toCamelRows<LibraryFolder>(data || []);
}

export async function fetchAllFolders(): Promise<LibraryFolder[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("library_folders")
    .select("*")
    .order("name");
  if (error) throw error;
  return toCamelRows<LibraryFolder>(data || []);
}

export async function createFolder(
  name: string,
  parentId: string | null,
  icon: string = "folder",
): Promise<LibraryFolder> {
  const sb = getSupabase();
  const id = "f-" + Date.now();
  const row = toSnake({ id, name, parentId, icon });
  const { data, error } = await sb
    .from("library_folders")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return toCamel<LibraryFolder>(data);
}

export async function updateFolder(
  id: string,
  updates: Partial<Pick<LibraryFolder, "name" | "parentId" | "icon" | "flag">>,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("library_folders")
    .update(toSnake(updates as Record<string, unknown>))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const sb = getSupabase();
  // Also delete items inside the folder
  await sb.from("library_items").delete().eq("folder_id", id);
  const { error } = await sb.from("library_folders").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchFolderItemCounts(
  folderIds: string[],
): Promise<Record<string, number>> {
  if (folderIds.length === 0) return {};
  const sb = getSupabase();
  const counts: Record<string, number> = {};
  for (const fid of folderIds) counts[fid] = 0;

  // Fetch items + child folders per folder in one go
  const { data: items } = await sb
    .from("library_items")
    .select("folder_id")
    .in("folder_id", folderIds);

  if (items) {
    for (const row of items) {
      const fid = (row as Record<string, unknown>).folder_id as string;
      if (fid) counts[fid] = (counts[fid] || 0) + 1;
    }
  }

  // Also count sub-folders
  const { data: subFolders } = await sb
    .from("library_folders")
    .select("parent_id")
    .in("parent_id", folderIds);

  if (subFolders) {
    for (const row of subFolders) {
      const pid = (row as Record<string, unknown>).parent_id as string;
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    }
  }

  return counts;
}

/* ── CRUD: Items ── */

export async function fetchItems(
  folderId: string | null = null,
  search?: string,
): Promise<LibraryItem[]> {
  const sb = getSupabase();
  let q = sb.from("library_items").select("*");

  if (search) {
    q = q.ilike("name", `%${search}%`);
  } else if (folderId === null) {
    q = q.is("folder_id", null);
  } else {
    q = q.eq("folder_id", folderId);
  }

  q = q.order("id", { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return toCamelRows<LibraryItem>(data || []);
}

export async function createItem(
  item: Omit<LibraryItem, "id">,
): Promise<LibraryItem> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("library_items")
    .insert(toSnake(item as unknown as Record<string, unknown>))
    .select()
    .single();
  if (error) throw error;
  return toCamel<LibraryItem>(data);
}

export async function updateItem(
  id: number,
  updates: Partial<LibraryItem>,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("library_items")
    .update(toSnake(updates as unknown as Record<string, unknown>))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("library_items").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteItemWithStorage(id: number, storagePath?: string): Promise<void> {
  const sb = getSupabase();
  if (storagePath) {
    await sb.storage.from("assets").remove([storagePath]);
  }
  const { error } = await sb.from("library_items").delete().eq("id", id);
  if (error) throw error;
}

/* ── Breadcrumbs ── */

export function getFolderBreadcrumbs(
  folderId: string | null,
  allFolders: LibraryFolder[],
): Array<{ id: string; name: string }> {
  if (!folderId) return [];
  const crumbs: Array<{ id: string; name: string }> = [];
  const visited = new Set<string>();
  let current = folderId;
  while (current) {
    if (visited.has(current)) break;
    visited.add(current);
    const folder = allFolders.find((f) => f.id === current);
    if (!folder) break;
    crumbs.unshift({ id: folder.id, name: folder.name });
    current = folder.parentId!;
  }
  return crumbs;
}
