"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Spinner ── */
export function Spinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClass = size === "sm" ? "loader-spin-sm" : size === "lg" ? "loader-spin-lg" : "";
  return <div className={cn("loader-spin", sizeClass, className)} />;
}

/* ── Dot Pulse ── */
export function DotPulse({ className }: { className?: string }) {
  return (
    <span className={cn("loader-dots", className)}>
      <span /><span /><span />
    </span>
  );
}

/* ── Bar Progress ── */
export function BarProgress({ className }: { className?: string }) {
  return <div className={cn("loader-bar", className)} />;
}

/* ── Page Loader ── */
export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="page-loader">
      <Spinner size="lg" />
      {message && <p>{message}</p>}
    </div>
  );
}

/* ── Card Skeleton — mimics a project card ── */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 card-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-card rounded-lg border dark:border-white/[0.06] overflow-hidden shadow-theme card-padded"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="h-1.5 bg-muted w-full" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-[1px] w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Detail Skeleton — for detail pages ── */
export function DetailSkeleton() {
  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-lg border p-4 space-y-2 shadow-theme">
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-5 space-y-3 shadow-theme">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="bg-card rounded-lg border p-5 space-y-3 shadow-theme">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}
