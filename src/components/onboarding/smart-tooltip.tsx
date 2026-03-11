"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SmartTooltipProps {
  id: string;
  label: string;
  hint?: string;
  maxHintShows?: number;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

const STORAGE_PREFIX = "smart-tooltip-views-";

function getViewCount(id: string): number {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + id);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

function incrementViewCount(id: string): number {
  const next = getViewCount(id) + 1;
  try {
    localStorage.setItem(STORAGE_PREFIX + id, String(next));
  } catch {
    // Storage full or unavailable
  }
  return next;
}

function dismissHint(id: string, max: number) {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, String(max));
  } catch {
    // Storage full or unavailable
  }
}

export function SmartTooltip({
  id,
  label,
  hint,
  maxHintShows = 3,
  side = "top",
  children,
}: SmartTooltipProps) {
  const [viewCount, setViewCount] = useState<number>(maxHintShows);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setViewCount(getViewCount(id));
  }, [id]);

  const showHint = hint && viewCount < maxHintShows;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && showHint) {
        const next = incrementViewCount(id);
        setViewCount(next);
      }
    },
    [id, showHint]
  );

  const handleDismiss = useCallback(() => {
    dismissHint(id, maxHintShows);
    setViewCount(maxHintShows);
    setOpen(false);
  }, [id, maxHintShows]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={6}
          className={
            showHint
              ? "max-w-xs border-indigo-500/20 bg-indigo-950/95 p-0 text-white shadow-xl backdrop-blur-xl"
              : undefined
          }
        >
          {showHint ? (
            <div className="p-3">
              {/* Header with icon */}
              <div className="mb-1.5 flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-indigo-300"
                >
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
                <span className="text-[12px] font-semibold text-indigo-200">
                  {label}
                </span>
              </div>

              {/* Hint text */}
              <p className="mb-2 text-[12px] leading-relaxed text-indigo-100/80">
                {hint}
              </p>

              {/* Dismiss button */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-indigo-300/40">
                  {maxHintShows - viewCount > 0
                    ? `Shown ${maxHintShows - viewCount} more time${maxHintShows - viewCount !== 1 ? "s" : ""}`
                    : "Last time showing"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss();
                  }}
                  className="rounded px-2 py-0.5 text-[11px] font-medium text-indigo-300 transition-colors hover:bg-indigo-400/10 hover:text-indigo-200"
                >
                  Got it
                </button>
              </div>
            </div>
          ) : (
            label
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
