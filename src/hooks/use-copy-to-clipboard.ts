"use client";

import { useState, useCallback, useRef } from "react";

/**
 * A hook that wraps `navigator.clipboard.writeText` with copied state tracking.
 *
 * The `navigator.clipboard.writeText` pattern is repeated across:
 *   - src/app/project/[id]/snippets/page.tsx (copy snippet content)
 *   - src/app/project/[id]/moodboards/[boardId]/page.tsx (copy prompt)
 *   - src/components/image-gen-results-grid.tsx (copy seed, 2 locations)
 *   - src/components/drive-file-viewer.tsx (copy seed)
 *
 * @example
 *   const { copy, copied } = useCopyToClipboard();
 *   <button onClick={() => copy("text")}>
 *     {copied ? "Copied!" : "Copy"}
 *   </button>
 */
export function useCopyToClipboard(resetDelay: number = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), resetDelay);

        return true;
      } catch {
        setCopied(false);
        return false;
      }
    },
    [resetDelay]
  );

  return { copy, copied };
}
