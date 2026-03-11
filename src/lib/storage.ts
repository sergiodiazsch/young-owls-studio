import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { getStore } from "@netlify/blobs";

// Detect serverless: NETLIFY is set by Netlify platform, /var/task is the Lambda cwd
const IS_SERVERLESS = !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME || process.cwd().startsWith("/var/task");
const STORAGE_ROOT = path.join(process.cwd(), "storage");
const BLOB_STORE_NAME = "file-storage";

// ── Local filesystem helpers (dev only) ──

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function validateStoragePath(storagePath: string): string {
  const resolved = path.resolve(STORAGE_ROOT, storagePath);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new Error("Invalid storage path: path traversal detected");
  }
  return resolved;
}

// ── Shared validation ──

const MAX_STORAGE_FILE_SIZE = 200 * 1024 * 1024; // 200MB hard limit

const ALLOWED_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  '.mp4', '.webm', '.mov', '.avi', '.mkv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.tiff',
  '.pdf', '.docx', '.txt', '.json',
]);

function validateInput(projectId: number, filename: string, buffer: Buffer) {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new Error("Invalid projectId");
  }
  if (buffer.length > MAX_STORAGE_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes exceeds ${MAX_STORAGE_FILE_SIZE} byte limit`);
  }
  const ext = path.extname(filename).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type not allowed: ${ext}`);
  }
}

function validatePathSegment(storagePath: string) {
  if (!storagePath || storagePath.includes("..")) {
    throw new Error("Invalid storage path: path traversal detected");
  }
}

// ── Public API (delegates to Netlify Blobs or local FS) ──

export async function saveFile(
  projectId: number,
  filename: string,
  buffer: Buffer
): Promise<{ storagePath: string; fileSize: number }> {
  validateInput(projectId, filename, buffer);
  const ext = path.extname(filename).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;
  const storagePath = `${projectId}/${uniqueName}`;

  if (IS_SERVERLESS) {
    const store = getStore(BLOB_STORE_NAME);
    await store.set(storagePath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  } else {
    const filePath = validateStoragePath(storagePath);
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, buffer);
  }

  return { storagePath, fileSize: buffer.length };
}

export async function readFile(storagePath: string): Promise<Buffer> {
  validatePathSegment(storagePath);

  if (IS_SERVERLESS) {
    const store = getStore(BLOB_STORE_NAME);
    const data = await store.get(storagePath, { type: "arrayBuffer" });
    if (!data) throw new Error("File not found in blob store");
    return Buffer.from(data);
  } else {
    const filePath = validateStoragePath(storagePath);
    return fs.readFileSync(filePath);
  }
}

export async function deleteFile(storagePath: string): Promise<void> {
  validatePathSegment(storagePath);

  if (IS_SERVERLESS) {
    const store = getStore(BLOB_STORE_NAME);
    await store.delete(storagePath);
  } else {
    const filePath = validateStoragePath(storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export function getAbsolutePath(storagePath: string): string {
  return validateStoragePath(storagePath);
}

export function getMediaType(mimeType: string): "image" | "audio" | "video" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}
