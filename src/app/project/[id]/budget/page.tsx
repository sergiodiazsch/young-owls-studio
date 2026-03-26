"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { gsap } from "@/lib/gsap";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import {
  IMAGE_PRICING,
  VIDEO_PRICING,
  VOICE_PRICING,
  LIPSYNC_PRICING,
  AUDIO_PRICING,
  UPSCALE_PRICING,
  BUDGET_PROFILES,
  type BudgetTier,
  type ProjectCostEstimate,
  type SceneCostBreakdown,
  type CategoryModelOverrides,
  type ModelCategory,
  type PriceRange,
} from "@/lib/ai-pricing";

// ── Helpers ──

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtShort(amount: number): string {
  if (amount >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return fmt(amount);
}

function fmtRange(range: PriceRange): string {
  return `${fmtShort(range.low)} \u2013 ${fmtShort(range.high)}`;
}

function tierColor(tier: BudgetTier | string): string {
  switch (tier) {
    case "economy":
    case "budget": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "standard":
    case "mid": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "premium": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function tierDot(tier: BudgetTier): string {
  switch (tier) {
    case "economy": return "bg-emerald-500";
    case "standard": return "bg-blue-500";
    case "premium": return "bg-amber-500";
  }
}

function tierLabel(tier: BudgetTier | string): string {
  switch (tier) {
    case "economy":
    case "budget": return "Draft Cut";
    case "standard":
    case "mid": return "Director's Cut";
    case "premium": return "Festival Print";
    default: return tier;
  }
}

const COST_CATEGORIES = [
  { key: "images" as const, label: "Image Generation", color: "bg-violet-500", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { key: "video" as const, label: "Video Generation", color: "bg-blue-500", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { key: "voice" as const, label: "Voice / TTS", color: "bg-rose-500", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  { key: "lipsync" as const, label: "Lip Sync", color: "bg-orange-500", icon: "M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "audio" as const, label: "Audio / SFX", color: "bg-emerald-500", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { key: "analysis" as const, label: "AI Analysis", color: "bg-slate-500", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
];

/** Category key to ModelCategory mapping for overrides */
const CATEGORY_MODEL_MAP: Record<string, { category: ModelCategory; models: Array<{ id: string; name: string; tier: string }> }> = {
  images: { category: "image", models: IMAGE_PRICING },
  video: { category: "video", models: VIDEO_PRICING },
  voice: { category: "voice", models: VOICE_PRICING },
  lipsync: { category: "lipsync", models: LIPSYNC_PRICING },
  audio: { category: "audio", models: AUDIO_PRICING },
};

/** Get the profile's default model id for a category */
function profileModelForCategory(profile: typeof BUDGET_PROFILES[number], category: ModelCategory): string {
  switch (category) {
    case "image": return profile.imageModel;
    case "video": return profile.videoModel;
    case "voice": return profile.voiceModel;
    case "lipsync": return profile.lipsyncModel;
    case "audio": return profile.audioModel;
  }
}

// ── Component ──

export default function BudgetPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [estimate, setEstimate] = useState<ProjectCostEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasBreakdowns, setHasBreakdowns] = useState<boolean | null>(null);

  // Controls
  const [tier, setTier] = useState<BudgetTier>("standard");
  const [retryMultiplier, setRetryMultiplier] = useState(1.8);
  const [includeUpscale, setIncludeUpscale] = useState(false);
  const [expandedScene, setExpandedScene] = useState<number | null>(null);

  // Per-category model overrides
  const [modelOverrides, setModelOverrides] = useState<CategoryModelOverrides>({});
  const [showModelCustomizer, setShowModelCustomizer] = useState(false);

  // Refs for GSAP animations
  const resultsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // GSAP stagger animation for results cards
  useEffect(() => {
    if (!resultsRef.current || !estimate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = resultsRef.current.querySelectorAll("[data-budget-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.06, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [estimate]);

  // GSAP stagger animation for quality profile cards
  useEffect(() => {
    if (!profileRef.current || !hasBreakdowns) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = profileRef.current.querySelectorAll("[data-profile-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.06, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [hasBreakdowns]);

  // Check for breakdowns on mount
  useEffect(() => {
    fetch(`/api/breakdowns/summary?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => setHasBreakdowns(data.completedBreakdowns > 0))
      .catch(() => setHasBreakdowns(false));
  }, [projectId]);

  // Reset overrides when profile changes
  const handleTierChange = useCallback((newTier: BudgetTier) => {
    setTier(newTier);
    setModelOverrides({});
    // Update retry multiplier to match profile default
    const profile = BUDGET_PROFILES.find((p) => p.tier === newTier);
    if (profile) setRetryMultiplier(profile.retryMultiplier);
  }, []);

  const handleModelOverride = useCallback((category: ModelCategory, modelId: string) => {
    setModelOverrides((prev) => {
      // If user selects the profile default, remove the override
      const profile = BUDGET_PROFILES.find((p) => p.tier === tier);
      if (profile && profileModelForCategory(profile, category) === modelId) {
        const next = { ...prev };
        delete next[category];
        return next;
      }
      return { ...prev, [category]: modelId };
    });
  }, [tier]);

  const calculate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/budget/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          tier,
          retryMultiplier,
          includeUpscale,
          modelOverrides: Object.keys(modelOverrides).length > 0 ? modelOverrides : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to calculate");
      }

      const data: ProjectCostEstimate = await res.json();
      setEstimate(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Calculation failed");
    } finally {
      setLoading(false);
    }
  }, [projectId, tier, retryMultiplier, includeUpscale, modelOverrides]);

  // Recalculate when controls change (if we already have an estimate)
  useEffect(() => {
    if (estimate) {
      calculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, retryMultiplier, includeUpscale, modelOverrides]);

  const currentProfile = BUDGET_PROFILES.find((p) => p.tier === tier) || BUDGET_PROFILES[1];
  const hasOverrides = Object.keys(modelOverrides).length > 0;

  // ── Loading state ──
  if (hasBreakdowns === null) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight">
            Production Budget
          </h1>
          <p className="text-muted-foreground mt-1 text-[15px]">
            Estimate real costs for your AI-generated production based on scene breakdowns.
          </p>
        </div>
      </div>

      {/* No breakdowns */}
      {!hasBreakdowns && (
        <Card className="border-dashed border-2 backdrop-blur-sm bg-card/80 border-border/40">
          <CardContent className="relative flex flex-col items-center justify-center py-16 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
            <div className="relative w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="relative text-lg font-semibold mb-1">Generate breakdowns first</h2>
            <p className="relative text-sm text-muted-foreground text-center max-w-sm">
              The budget calculator needs scene breakdown data (images, shots, dialogue, audio)
              to compute accurate cost estimates.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      {hasBreakdowns && (
        <div className="flex flex-col gap-6">
          {/* Budget Profile Selector */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/40">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold uppercase tracking-wide border-l-2 border-primary/50 pl-2">Quick Start Profile</h3>
                {hasOverrides && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    Customized
                  </Badge>
                )}
              </div>
              <div ref={profileRef} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {BUDGET_PROFILES.map((profile) => (
                  <button
                    key={profile.tier}
                    data-profile-card
                    onClick={() => handleTierChange(profile.tier)}
                    className={`relative rounded-lg border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${
                      tier === profile.tier
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_15px_var(--glow-primary)]"
                        : "border-border/40 hover:border-muted-foreground/30 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full ${tierDot(profile.tier)}`} />
                      <span className="font-medium text-[15px]">{profile.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{profile.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Per-Category Model Customizer */}
          <Card className="backdrop-blur-sm bg-card/80 border-border/40">
            <CardContent className="p-5">
              <button
                onClick={() => setShowModelCustomizer(!showModelCustomizer)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} weight="bold" className="text-primary" />
                  <h3 className="text-[14px] font-semibold uppercase tracking-wide">Customize Models per Category</h3>
                </div>
                <div className="flex items-center gap-2">
                  {hasOverrides && (
                    <span className="text-[11px] text-primary font-medium">
                      {Object.keys(modelOverrides).length} override{Object.keys(modelOverrides).length !== 1 ? "s" : ""}
                    </span>
                  )}
                  <CaretDown
                    size={14}
                    weight="bold"
                    className={`text-muted-foreground transition-transform duration-200 ${showModelCustomizer ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {showModelCustomizer && (
                <div className="mt-4 flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Mix and match models across categories. The profile above sets defaults; override any below.
                  </p>

                  {Object.entries(CATEGORY_MODEL_MAP).map(([costKey, { category, models }]) => {
                    const catMeta = COST_CATEGORIES.find((c) => c.key === costKey);
                    const currentModelId = modelOverrides[category] ?? profileModelForCategory(currentProfile, category);
                    const isOverridden = category in modelOverrides;

                    return (
                      <div key={category} className="rounded-lg border border-border/40 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          {catMeta && <div className={`w-2 h-2 rounded-full ${catMeta.color}`} />}
                          <span className="text-[13px] font-medium">{catMeta?.label ?? category}</span>
                          {isOverridden && (
                            <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20 ml-auto">
                              custom
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => handleModelOverride(category, model.id)}
                              className={`text-xs px-2.5 py-1.5 rounded-md border transition-all duration-200 ${
                                currentModelId === model.id
                                  ? "border-primary bg-primary/10 text-primary shadow-[0_0_8px_var(--glow-primary)]"
                                  : "border-border/40 text-muted-foreground hover:border-muted-foreground/40 hover:bg-primary/5"
                              }`}
                            >
                              <span className="font-medium">{model.name}</span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] ml-1.5 ${tierColor(model.tier)}`}
                              >
                                {model.tier}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {hasOverrides && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModelOverrides({})}
                      className="text-xs text-muted-foreground self-end"
                    >
                      Reset to profile defaults
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retry Multiplier + Upscale Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-semibold uppercase tracking-wide border-l-2 border-primary/50 pl-2">Generation Reliability</h3>
                  <span className="text-[12px] font-mono text-muted-foreground">{retryMultiplier.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[retryMultiplier]}
                  onValueChange={([v]) => setRetryMultiplier(v)}
                  min={1.0}
                  max={4.0}
                  step={0.1}
                  className="mb-2"
                />
                <div className="flex justify-between text-[12px] text-muted-foreground">
                  <span>Optimistic</span>
                  <span>Realistic</span>
                  <span>Safe</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {retryMultiplier <= 1.5
                    ? "Optimistic: assumes most generations will be usable on the first try."
                    : retryMultiplier <= 2.5
                      ? "Realistic: accounts for occasional re-generations to get the right result."
                      : "Safe: builds in extra budget for more attempts, reducing the risk of going over estimate."}
                </p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[14px] font-semibold uppercase tracking-wide border-l-2 border-primary/50 pl-2">Video Upscale</h3>
                  <Switch checked={includeUpscale} onCheckedChange={setIncludeUpscale} />
                </div>
                <p className="text-[15px] text-muted-foreground mb-1">
                  Enhance your final video to 4K resolution for a sharper, cinema-quality look.
                </p>
                <p className="text-[12px] text-muted-foreground mb-3">
                  Uses Topaz Video AI for per-second 4K upscaling of every video clip.
                </p>
                {estimate && includeUpscale && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="font-mono">
                      {Math.round(estimate.counts.totalVideoSeconds / 60)} min
                    </Badge>
                    <span className="text-muted-foreground">
                      = {fmtRange(estimate.totalRanges.upscale)} upscale cost
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Calculate CTA */}
          <Button
            onClick={calculate}
            disabled={loading || !hasBreakdowns}
            size="lg"
            className="w-full text-base font-semibold py-6 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-shadow duration-300"
          >
            {loading ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mr-2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Calculating...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mr-2">
                  <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {estimate ? "Recalculate Budget" : "Calculate Budget"}
              </>
            )}
          </Button>

          {/* Loading skeleton */}
          {loading && !estimate && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-36" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
              </div>
            </div>
          )}

          {/* Results */}
          {estimate && (
            <div ref={resultsRef} className="flex flex-col gap-6">
              {/* Grand Total Card */}
              <Card data-budget-card className="backdrop-blur-sm bg-card/80 border-border/40 overflow-hidden shadow-[0_0_20px_var(--glow-primary)]">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-accent/[0.02] pointer-events-none" />
                <CardContent className="p-6 relative">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                        Estimated Total Cost
                      </p>
                      <p className="text-4xl font-bold tracking-tight text-primary">
                        {fmtRange(estimate.totalRanges.grandTotal)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Midpoint: {fmtShort(estimate.totals.grandTotal)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span>{estimate.counts.totalScenes} scenes</span>
                        <span>{estimate.counts.totalImages} images</span>
                        <span>{estimate.counts.totalShots} video clips</span>
                        <span>{estimate.counts.totalDialogueLines} voice lines</span>
                        <span>{Math.round(estimate.counts.totalVideoSeconds / 60)} min total</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <div className="text-[12px] text-muted-foreground">
                        Base cost: {fmt(estimate.totals.subtotal - estimate.totals.retryBuffer)}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        Reliability buffer: +{fmt(estimate.totals.retryBuffer)}
                      </div>
                      {includeUpscale && (
                        <div className="text-[12px] text-muted-foreground">
                          4K upscale: +{fmtRange(estimate.totalRanges.upscale)}
                        </div>
                      )}
                      {hasOverrides && (
                        <Badge variant="outline" className="text-[10px] mt-1 bg-primary/10 text-primary border-primary/20">
                          Custom model mix
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="breakdown" className="flex flex-col gap-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="breakdown">Cost Breakdown</TabsTrigger>
                  <TabsTrigger value="scenes">Per Scene</TabsTrigger>
                  <TabsTrigger value="tools">Tool Guide</TabsTrigger>
                </TabsList>

                {/* ── Tab: Cost Breakdown ── */}
                <TabsContent value="breakdown" className="flex flex-col gap-4">
                  {/* Category cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {COST_CATEGORIES.map((cat) => {
                      const amount = estimate.totals[cat.key];
                      const range = estimate.totalRanges[cat.key as keyof typeof estimate.totalRanges] as PriceRange | undefined;
                      const pct = estimate.totals.grandTotal > 0 ? (amount / estimate.totals.grandTotal) * 100 : 0;
                      return (
                        <Card key={cat.key} data-budget-card className="backdrop-blur-sm bg-card/80 border-border/40 hover:bg-primary/5 transition-colors duration-200">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                              <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                            </div>
                            {range ? (
                              <p className="text-[15px] font-bold tracking-tight">{fmtRange(range)}</p>
                            ) : (
                              <p className="text-lg font-bold tracking-tight">{fmt(amount)}</p>
                            )}
                            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${cat.color}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{Math.round(pct)}% of total</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Distribution bar */}
                  <Card data-budget-card className="backdrop-blur-sm bg-card/80 border-border/40">
                    <CardContent className="p-5">
                      <h3 className="text-[14px] font-semibold uppercase tracking-wide mb-3 border-l-2 border-primary/50 pl-2">Cost Distribution</h3>
                      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                        {COST_CATEGORIES.map((cat) => {
                          const amount = estimate.totals[cat.key];
                          const pct = estimate.totals.grandTotal > 0 ? (amount / estimate.totals.grandTotal) * 100 : 0;
                          if (pct < 0.5) return null;
                          return (
                            <div
                              key={cat.key}
                              className={`${cat.color} transition-all`}
                              style={{ width: `${pct}%` }}
                              title={`${cat.label}: ${fmt(amount)} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                        {includeUpscale && estimate.totals.upscale > 0 && (
                          <div
                            className="bg-cyan-500 transition-all"
                            style={{ width: `${(estimate.totals.upscale / estimate.totals.grandTotal) * 100}%` }}
                            title={`Upscale: ${fmt(estimate.totals.upscale)}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                        {COST_CATEGORIES.map((cat) => (
                          <div key={cat.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className={`w-2 h-2 rounded-sm ${cat.color}`} />
                            {cat.label}
                          </div>
                        ))}
                        {includeUpscale && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-2 h-2 rounded-sm bg-cyan-500" />
                            Upscale
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary stats */}
                  <Card data-budget-card className="backdrop-blur-sm bg-card/80 border-border/40">
                    <CardContent className="p-5">
                      <h3 className="text-[14px] font-semibold uppercase tracking-wide mb-3 border-l-2 border-primary/50 pl-2">Production Stats</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        {[
                          { label: "Total Images", value: estimate.counts.totalImages },
                          { label: "Video Clips", value: estimate.counts.totalShots },
                          { label: "Voice Lines", value: estimate.counts.totalDialogueLines },
                          { label: "Audio Effects", value: estimate.counts.totalAudioElements },
                        ].map((stat) => (
                          <div key={stat.label}>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-4" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-lg font-bold">{Math.round(estimate.counts.totalVideoSeconds / 60)} min</p>
                          <p className="text-xs text-muted-foreground">Total Duration</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">
                            {estimate.counts.totalVideoSeconds > 0
                              ? fmtRange({
                                  low: estimate.totalRanges.grandTotal.low / (estimate.counts.totalVideoSeconds / 60),
                                  high: estimate.totalRanges.grandTotal.high / (estimate.counts.totalVideoSeconds / 60),
                                })
                              : "$0"}
                          </p>
                          <p className="text-xs text-muted-foreground">Cost per Minute</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold">
                            {fmtRange({
                              low: estimate.totalRanges.grandTotal.low / estimate.counts.totalScenes,
                              high: estimate.totalRanges.grandTotal.high / estimate.counts.totalScenes,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">Avg Cost per Scene</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Tab: Per Scene ── */}
                <TabsContent value="scenes" className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground mb-3">
                    Click a scene to expand cost details. Most expensive scenes are candidates for optimization.
                  </div>
                  {estimate.scenes
                    .sort((a, b) => b.totalWithRetries - a.totalWithRetries)
                    .map((scene) => (
                      <SceneRow
                        key={scene.sceneId}
                        scene={scene}
                        maxCost={estimate.scenes[0]?.totalWithRetries || 1}
                        expanded={expandedScene === scene.sceneId}
                        onToggle={() => setExpandedScene(expandedScene === scene.sceneId ? null : scene.sceneId)}
                      />
                    ))}
                </TabsContent>

                {/* ── Tab: Tool Guide ── */}
                <TabsContent value="tools" className="flex flex-col gap-4">
                  <ToolSection
                    title="Image Generation"
                    subtitle="AI models for generating stills from text prompts"
                    items={IMAGE_PRICING.map((m) => ({
                      name: m.name,
                      cost: fmt(m.costPerImage) + " / image",
                      range: `${fmt(m.priceRange.low)} \u2013 ${fmt(m.priceRange.high)}`,
                      tier: m.tier,
                      bestFor: m.bestFor,
                      active: m.id === estimate.profile.imageModel,
                    }))}
                  />
                  <ToolSection
                    title="Video Generation (Image-to-Video)"
                    subtitle="Animate images into video clips"
                    items={VIDEO_PRICING.map((m) => ({
                      name: m.name,
                      cost: fmt(m.costPerSecond) + "/s",
                      range: `${fmt(m.priceRange.low)} \u2013 ${fmt(m.priceRange.high)}/s`,
                      tier: m.tier,
                      bestFor: m.bestFor,
                      active: m.id === estimate.profile.videoModel,
                    }))}
                  />
                  <ToolSection
                    title="Voice / TTS"
                    subtitle="Generate dialogue audio from text"
                    items={VOICE_PRICING.map((m) => ({
                      name: m.name,
                      cost: fmt(m.costPer1kChars) + " / 1k chars",
                      range: `${fmt(m.priceRange.low)} \u2013 ${fmt(m.priceRange.high)} / 1k chars`,
                      tier: m.tier,
                      bestFor: m.bestFor,
                      active: m.id === estimate.profile.voiceModel,
                    }))}
                  />
                  <ToolSection
                    title="Lip Sync"
                    subtitle="Sync character mouth to dialogue audio"
                    items={LIPSYNC_PRICING.map((m) => ({
                      name: m.name,
                      cost: fmt(m.costPerRun) + " / run",
                      range: `${fmt(m.priceRange.low)} \u2013 ${fmt(m.priceRange.high)} / run`,
                      tier: m.tier,
                      bestFor: m.bestFor,
                      active: m.id === estimate.profile.lipsyncModel,
                    }))}
                  />
                  <ToolSection
                    title="Audio / SFX"
                    subtitle="Sound effects, ambience, and foley"
                    items={AUDIO_PRICING.map((m) => ({
                      name: m.name,
                      cost: fmt(m.costPerGeneration) + " / gen",
                      range: `${fmt(m.priceRange.low)} \u2013 ${fmt(m.priceRange.high)} / gen`,
                      tier: m.tier,
                      bestFor: m.bestFor,
                      active: m.id === estimate.profile.audioModel,
                    }))}
                  />
                  <ToolSection
                    title="Video Upscaling"
                    subtitle="Topaz Video AI for 4K upscaling"
                    items={UPSCALE_PRICING.map((m) => ({
                      name: m.name,
                      cost: fmt(m.costPerSecond) + "/s",
                      range: `${fmt(m.priceRange.low)} \u2013 ${fmt(m.priceRange.high)}/s`,
                      tier: m.tier,
                      bestFor: [],
                      active: includeUpscale,
                    }))}
                  />
                </TabsContent>
              </Tabs>

              {/* Disclaimer */}
              <div className="rounded-lg border border-dashed border-muted-foreground/20 px-4 py-3 backdrop-blur-sm bg-card/40">
                <div className="flex items-start gap-2">
                  <Info size={14} weight="bold" className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-muted-foreground">
                    Estimates based on current API pricing. Actual costs may vary based on retries, complexity, and model availability.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Scene Row Component ──

function SceneRow({
  scene,
  maxCost,
  expanded,
  onToggle,
}: {
  scene: SceneCostBreakdown;
  maxCost: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const barWidth = maxCost > 0 ? (scene.totalWithRetries / maxCost) * 100 : 0;

  return (
    <Card className="backdrop-blur-sm bg-card/80 border-border/40 overflow-hidden hover:bg-primary/5 transition-colors duration-200">
      <button onClick={onToggle} className="w-full text-left">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold">
              {scene.sceneNumber}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{scene.heading}</p>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span>{scene.imageCount} img</span>
                <span>{scene.shotCount} shots</span>
                <span>{scene.dialogueLineCount} lines</span>
                <span>{scene.audioElementCount} sfx</span>
                <span>{Math.round(scene.estimatedDurationSeconds)}s</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold">{fmtRange(scene.totalRange)}</p>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`flex-shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
          </div>
        </CardContent>
      </button>
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COST_CATEGORIES.map((cat) => {
              const range = scene.costRanges[cat.key as keyof typeof scene.costRanges] as PriceRange | undefined;
              return (
                <div key={cat.key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cat.color}`} />
                  <span className="text-xs text-muted-foreground">{cat.label}</span>
                  <span className="text-xs font-mono font-medium ml-auto">
                    {range ? fmtRange(range) : fmt(scene.costs[cat.key])}
                  </span>
                </div>
              );
            })}
          </div>
          {scene.needsLipsync && (
            <p className="text-[10px] text-muted-foreground mt-2">
              * Lip sync estimated for ~70% of dialogue lines (character-on-screen shots)
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Tool Section Component ──

function ToolSection({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{
    name: string;
    cost: string;
    range: string;
    tier: string;
    bestFor: string[];
    active: boolean;
  }>;
}) {
  return (
    <Card data-budget-card className="backdrop-blur-sm bg-card/80 border-border/40">
      <CardContent className="p-5">
        <h3 className="text-[14px] font-semibold uppercase tracking-wide border-l-2 border-primary/50 pl-2">{title}</h3>
        <p className="text-[12px] text-muted-foreground mb-3 pl-2">{subtitle}</p>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.name}
              className={`flex items-start gap-3 rounded-md p-2.5 transition-colors duration-200 ${
                item.active ? "bg-primary/5 ring-1 ring-primary/20 shadow-[0_0_10px_var(--glow-primary)]" : "hover:bg-primary/5"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${tierColor(item.tier as BudgetTier)}`}
                  >
                    {tierLabel(item.tier as BudgetTier)}
                  </Badge>
                  {item.active && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                      selected
                    </Badge>
                  )}
                </div>
                {item.bestFor.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Best for: {item.bestFor.join(", ")}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-xs font-mono font-medium text-muted-foreground whitespace-nowrap">
                  {item.cost}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                  {item.range}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
