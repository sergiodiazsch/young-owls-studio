// DESIGN INTENT: Errors feel handled, not catastrophic — warm amber accent on the recovery action, cinematic dark composition, never a blank white screen

"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background page-transition">
      <div className="flex flex-col items-center text-center max-w-md px-6">
        {/* Warm error icon with subtle glow */}
        <div className="w-20 h-20 rounded-2xl bg-destructive/10 dark:bg-destructive/5 flex items-center justify-center mb-6 animate-scale-in">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          An unexpected error occurred while loading this page. Your work is safe — try again or head back to your projects.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.location.href = "/"}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 2L4 8l6 6" />
            </svg>
            Back to Projects
          </Button>
          <Button onClick={() => reset()}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
