// ── Shared formatting utilities ──
// Extracted from duplicated implementations across the codebase.

/**
 * Returns a human-readable relative time string (e.g. "5m ago", "2h ago", "3d ago").
 *
 * Duplicated in:
 *   - src/components/production-notes.tsx (timeAgo)
 *   - src/app/project/[id]/versions/page.tsx (timeAgo)
 *   - src/components/image-gen-prompt-history.tsx (timeAgo)
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Truncates a string to `maxLength` characters, appending "..." if truncated.
 *
 * Many components use inline `.slice(0, N)` + "..." or CSS `truncate` class.
 * This provides a consistent JS-level truncation utility.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

/**
 * Formats a byte count into a human-readable file size string.
 *
 * Duplicated in:
 *   - src/app/project/[id]/page.tsx (formatBytes)
 *   - src/app/project/[id]/drive/page.tsx (formatFileSize)
 *   - src/components/drive-file-viewer.tsx (formatSize)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Returns the correct singular or plural form of a word based on count.
 *
 * Common pattern found across the codebase where `count !== 1 ? "s" : ""` is used inline.
 *
 * @example
 *   pluralize(1, "scene")    // "scene"
 *   pluralize(5, "scene")    // "scenes"
 *   pluralize(2, "analysis", "analyses") // "analyses"
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? singular + "s");
}

/**
 * Formats a duration in milliseconds to a "MM:SS" or "H:MM:SS" string.
 *
 * Duplicated in:
 *   - src/app/project/[id]/video-editor/page.tsx (formatTime)
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
