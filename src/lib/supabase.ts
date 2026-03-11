"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: true, persistSession: true },
    db: { schema: "public" },
  });
  return _client;
}

/* ── camelCase <-> snake_case field mappers ── */

const SNAKE_MAP: Record<string, string> = {
  imgUrl: "img_url",
  storagePath: "storage_path",
  parentId: "parent_id",
  folderId: "folder_id",
  linkedIds: "linked_ids",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const CAMEL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SNAKE_MAP).map(([k, v]) => [v, k]),
);

export function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) o[SNAKE_MAP[k] || k] = v;
  return o;
}

export function toCamel<T = Record<string, unknown>>(
  obj: Record<string, unknown>,
): T {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj as T;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) o[CAMEL_MAP[k] || k] = v;
  return o as T;
}

export function toCamelRows<T = Record<string, unknown>>(
  rows: Record<string, unknown>[],
): T[] {
  return (rows || []).map((r) => toCamel<T>(r));
}

/* ── Storage upload ── */

const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "image/bmp", "image/tiff",
  "video/mp4", "video/quicktime", "video/webm", "video/x-msvideo",
  "audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/flac", "audio/aac",
  "application/pdf", "text/plain", "text/csv",
  "application/json", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

export async function uploadToStorage(
  file: File,
): Promise<{ publicUrl: string; storagePath: string } | null> {
  const sb = getSupabase();
  if (file.type && !ALLOWED_UPLOAD_TYPES.has(file.type)) {
    console.warn("uploadToStorage: blocked file type:", file.type);
    return null;
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    console.warn("uploadToStorage: file too large:", file.size);
    return null;
  }
  const ext = (file.name?.split(".").pop() || "bin")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10) || "bin";
  const path =
    Date.now() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const { error } = await sb.storage
    .from("assets")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const {
    data: { publicUrl },
  } = sb.storage.from("assets").getPublicUrl(path);
  return { publicUrl, storagePath: path };
}

export function getMediaType(
  mimeType: string,
): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}
