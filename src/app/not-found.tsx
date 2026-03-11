// DESIGN INTENT: 404 is a moment of personality — warm, cinematic, not clinical. The amber glow invites users back rather than scolding them.

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center text-center max-w-md px-6">
        {/* Large cinematic 404 with amber accent */}
        <div className="relative mb-8">
          <span className="text-[120px] sm:text-[160px] font-extrabold leading-none tracking-tighter text-muted/30 dark:text-muted/10 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/5 dark:glow-md flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Scene not found
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          This page doesn&apos;t exist in the current cut. It may have been moved or removed during editing.
        </p>
        <Button asChild>
          <Link href="/">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 2L4 8l6 6" />
            </svg>
            Back to Projects
          </Link>
        </Button>
      </div>
    </div>
  );
}
