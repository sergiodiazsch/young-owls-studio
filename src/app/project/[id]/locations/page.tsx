"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { gsap } from "@/lib/gsap";
import { ConfirmDialog } from "@/components/confirm-dialog";
import Image from "next/image";
import type { Location } from "@/lib/types";

interface LocationWithCover extends Location {
  coverImage?: string | null;
}

/* ── Badge style helpers ─────────────────────────────────── */

function intExtBadge(intExt: string | null | undefined) {
  const val = (intExt || "").toUpperCase().replace(/\./g, "");
  if (val.includes("INT") && val.includes("EXT"))
    return { label: "INT/EXT", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-0" };
  if (val.includes("EXT"))
    return { label: "EXT", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-0" };
  if (val.includes("INT"))
    return { label: "INT", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0" };
  return null;
}

function timeOfDayBadge(tod: string) {
  const upper = tod.toUpperCase();
  if (upper.includes("NIGHT") || upper.includes("EVENING") || upper.includes("DUSK"))
    return { label: tod, className: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-0" };
  if (upper.includes("DAY") || upper.includes("MORNING") || upper.includes("DAWN"))
    return { label: tod, className: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-0" };
  return { label: tod, className: "bg-muted text-muted-foreground border-0" };
}

/* ── Location pin SVG icon ───────────────────────────────── */

function LocationPinIcon({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/* ── Spinner SVG ─────────────────────────────────────────── */

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`animate-spin ${className}`}
    >
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

/* ── Refresh icon SVG ────────────────────────────────────── */

function RefreshIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21.5 2v6h-6" />
      <path d="M2.5 22v-6h6" />
      <path d="M2.764 15.5A9 9 0 0020.485 8.5" />
      <path d="M21.236 8.5A9 9 0 003.515 15.5" />
    </svg>
  );
}

/* ── Main component ──────────────────────────────────────── */

export default function LocationsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [locations, setLocations] = useState<LocationWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const extractTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [generatingDesc, setGeneratingDesc] = useState<number | null>(null);
  const [confirmReExtract, setConfirmReExtract] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // GSAP stagger animation on location cards
  useEffect(() => {
    if (!gridRef.current || loading || locations.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-loc-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loading, locations.length]);

  const fetchLocations = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const res = await fetch(`/api/locations?projectId=${projectId}`, signal ? { signal } : undefined);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to load locations (${res.status})`);
      }
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
      setLoading(false);
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return false;
      console.error("[Locations] fetchLocations failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load locations");
      setLoading(false);
      return false;
    }
  }, [projectId]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLocations(controller.signal);
    return () => controller.abort();
  }, [fetchLocations]);

  async function handleExtract() {
    setExtracting(true);
    setExtractProgress(0);

    // Animate progress from 0 to ~85% while waiting for API
    let progress = 0;
    extractTimerRef.current = setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress > 85) progress = 85 + Math.random() * 2;
      if (progress > 92) { progress = 92; }
      setExtractProgress(Math.min(Math.round(progress), 92));
    }, 400);

    try {
      const res = await fetch("/api/locations/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });

      if (extractTimerRef.current) clearInterval(extractTimerRef.current);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[Locations] Extract API error:", err);
        toast.error(err.error || "Extraction failed");
        setExtracting(false);
        setExtractProgress(0);
        return;
      }

      setExtractProgress(95);
      const created = await res.json();
      const count = Array.isArray(created) ? created.length : 0;

      if (count > 0) {
        toast.success(`Extracted ${count} location${count !== 1 ? "s" : ""} from script`);
      } else {
        toast.warning("No locations found. Make sure your script has scene headings (INT./EXT.).");
      }

      // Fetch updated locations list — keep extracting state until fetch completes
      // so the UI shows the progress bar instead of flashing the empty state
      const fetchOk = await fetchLocations();
      if (!fetchOk && count > 0) {
        // Extraction succeeded but fetching the list failed — retry once
        console.warn("[Locations] First fetchLocations after extract failed, retrying...");
        await new Promise((r) => setTimeout(r, 500));
        await fetchLocations();
      }

      setExtractProgress(100);
    } catch (err) {
      if (extractTimerRef.current) clearInterval(extractTimerRef.current);
      console.error("[Locations] Extract failed:", err);
      toast.error("Failed to extract locations");
      setExtractProgress(0);
    }
    setExtracting(false);
  }

  async function handleGenerateDescription(locationId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setGeneratingDesc(locationId);
    try {
      const res = await fetch(`/api/locations/${locationId}/generate-prompt`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to generate description");
        return;
      }
      const data = await res.json();
      setLocations((prev) =>
        prev.map((loc) =>
          loc.id === locationId ? { ...loc, visualPrompt: data.visualPrompt } : loc
        )
      );
      toast.success("Visual description generated");
    } catch {
      toast.error("Failed to generate description");
    } finally {
      setGeneratingDesc(null);
    }
  }

  const hasLocations = locations.length > 0;

  /* ── Loading skeleton matching new card layout ──────────── */
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-4 w-56 mb-6" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="rounded-xl overflow-hidden">
              <CardContent className="p-5">
                <Skeleton className="w-full aspect-video rounded-lg mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <div className="flex gap-2 mb-2">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* ── Extract progress bar (shared) ─────────────────────── */
  const progressBar = extracting && (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-medium">Analyzing screenplay for locations...</p>
        <span className="text-xs font-mono text-muted-foreground">{extractProgress}%</span>
      </div>
      <Progress value={extractProgress} className="h-2" />
      <p className="text-xs text-muted-foreground mt-1">
        Scanning scene headings and extracting unique locations
      </p>
    </div>
  );

  /* ── Empty state ────────────────────────────────────────── */
  if (!hasLocations) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
        </div>

        {progressBar}

        <Card className="border-dashed border-2 rounded-xl backdrop-blur-sm bg-card/80 border-border/40">
          <CardContent className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

            {/* Location pin illustration */}
            <div className="relative w-20 h-20 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-5">
              <LocationPinIcon size={32} className="text-muted-foreground" />
            </div>

            <h2 className="relative text-lg font-semibold mb-2">
              Your script&apos;s locations live here
            </h2>
            <p className="relative text-sm text-muted-foreground text-center max-w-sm mb-6">
              Extract them from your screenplay to get started. Locations will be
              grouped by name with INT/EXT tags and time-of-day labels.
            </p>

            <Button
              onClick={handleExtract}
              disabled={extracting}
              className="relative shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-shadow duration-300"
            >
              {extracting ? (
                <>
                  <Spinner className="mr-1.5" />
                  Extracting...
                </>
              ) : (
                "Extract from Script"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Populated state ────────────────────────────────────── */
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground mt-1">
            {locations.length} location{locations.length !== 1 ? "s" : ""} in
            this project
          </p>
        </div>
        <Button
          onClick={() => setConfirmReExtract(true)}
          disabled={extracting}
          variant="outline"
        >
          {extracting ? (
            <Spinner className="mr-1.5" />
          ) : (
            <RefreshIcon className="mr-1.5" />
          )}
          {extracting ? "Extracting..." : "Refresh from Script"}
        </Button>
      </div>

      {progressBar}

      {/* Location cards grid */}
      <div ref={gridRef} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((loc) => {
          const badge = intExtBadge(loc.intExt);
          const todList = loc.timesOfDay || [];

          return (
            <Card
              data-loc-card
              key={loc.id}
              className="group rounded-xl border backdrop-blur-sm bg-card/80 border-border/40 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
              onClick={() =>
                router.push(`/project/${projectId}/locations/${loc.id}`)
              }
            >
              <CardContent className="p-5">
                {/* Cover image slot */}
                <div className="relative w-full aspect-video rounded-lg bg-muted/50 dark:bg-muted/30 flex items-center justify-center mb-3 overflow-hidden border border-border/20 group-hover:border-primary/20 group-hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.08)] transition-all duration-300">
                  {loc.coverImage ? (
                    <Image
                      src={`/api/storage/${loc.coverImage}`}
                      alt={loc.name}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : loc.referenceImages ? (
                    (() => {
                      let imgSrc = loc.referenceImages;
                      try {
                        const imgs: string[] = JSON.parse(loc.referenceImages);
                        if (imgs.length > 0) imgSrc = imgs[0];
                      } catch { /* single URL string */ }
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgSrc} alt={loc.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      );
                    })()
                  ) : (
                    <LocationPinIcon size={28} className="text-muted-foreground/40" />
                  )}
                </div>

                {/* Location name */}
                <p className="text-base font-semibold truncate mb-2">{loc.name}</p>

                {/* Badges row: INT/EXT + time-of-day tags */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {badge && (
                    <Badge variant="secondary" className={`text-[11px] font-medium h-5 px-2 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  )}
                  {todList.map((tod) => {
                    const todBadge = timeOfDayBadge(tod);
                    return (
                      <Badge
                        key={tod}
                        variant="secondary"
                        className={`text-[11px] font-medium h-5 px-2 ${todBadge.className}`}
                      >
                        {todBadge.label}
                      </Badge>
                    );
                  })}
                </div>

                {/* Scene count */}
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center bg-primary/10 text-primary text-[10px] font-semibold rounded-full px-1.5 py-0 min-w-[20px] shadow-[0_0_6px_oklch(0.585_0.233_264/0.1)]">{loc.sceneCount}</span>
                  scene{loc.sceneCount !== 1 ? "s" : ""}
                </p>

                {/* Description preview */}
                {loc.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {loc.description}
                  </p>
                )}
                {!loc.description && loc.visualPrompt && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">
                    {loc.visualPrompt}
                  </p>
                )}

                {/* Generate description action (subtle, at bottom) */}
                {!loc.visualPrompt && !loc.description && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs mt-2 -ml-2 text-muted-foreground hover:text-foreground"
                    disabled={generatingDesc === loc.id}
                    onClick={(e) => handleGenerateDescription(loc.id, e)}
                  >
                    {generatingDesc === loc.id ? (
                      <>
                        <Spinner className="mr-1" />
                        Generating...
                      </>
                    ) : (
                      "Generate Description"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmReExtract}
        onOpenChange={setConfirmReExtract}
        title="Refresh Locations from Script?"
        description="This will re-scan your screenplay and update locations. Existing locations and their data will be preserved."
        confirmLabel="Refresh from Script"
        variant="default"
        onConfirm={handleExtract}
      />
    </div>
  );
}
