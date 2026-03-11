"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { Scene, Project } from "@/lib/types";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { gsap } from "@/lib/gsap";

/* ── Phosphor icons (deep imports) ── */
import { FilmSlate } from "@phosphor-icons/react/dist/csr/FilmSlate";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { ChatText } from "@phosphor-icons/react/dist/csr/ChatText";
import { FileText } from "@phosphor-icons/react/dist/csr/FileText";
import { Image as ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { VideoCamera } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { Microphone } from "@phosphor-icons/react/dist/csr/Microphone";
import { Brain } from "@phosphor-icons/react/dist/csr/Brain";
import { Scissors } from "@phosphor-icons/react/dist/csr/Scissors";
import { Waveform } from "@phosphor-icons/react/dist/csr/Waveform";
import { Camera } from "@phosphor-icons/react/dist/csr/Camera";
import { PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { ListBullets } from "@phosphor-icons/react/dist/csr/ListBullets";
import { Export } from "@phosphor-icons/react/dist/csr/Export";
import { Slideshow } from "@phosphor-icons/react/dist/csr/Slideshow";
import { Upload } from "@phosphor-icons/react/dist/csr/Upload";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { Folder } from "@phosphor-icons/react/dist/csr/Folder";
import { Sun } from "@phosphor-icons/react/dist/csr/Sun";
import { Moon } from "@phosphor-icons/react/dist/csr/Moon";
import { TrendUp } from "@phosphor-icons/react/dist/csr/TrendUp";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";

/* ── Dynamic recharts imports ── */
const DynamicBarChart = dynamic(() => import("recharts").then(m => m.BarChart), { ssr: false });
const DynamicBar = dynamic(() => import("recharts").then(m => m.Bar), { ssr: false });
const DynamicXAxis = dynamic(() => import("recharts").then(m => m.XAxis), { ssr: false });
const DynamicYAxis = dynamic(() => import("recharts").then(m => m.YAxis), { ssr: false });
const DynamicTooltip = dynamic(() => import("recharts").then(m => m.Tooltip), { ssr: false });
const DynamicResponsiveContainer = dynamic(() => import("recharts").then(m => m.ResponsiveContainer), { ssr: false });

interface ProjectStats {
  scenes: { total: number; intCount: number; extCount: number; intExtCount: number; dayCount: number; nightCount: number };
  characters: number;
  dialogues: number;
  directions: { total: number; actions: number; transitions: number; brolls: number; music: number; notes: number };
  wordCount: number;
  estimatedPages: number;
  imageGenerations: { total: number; completed: number; favorites: number; totalCost: number };
  videoGenerations: { total: number; completed: number; favorites: number; totalCost: number };
  voiceGenerations: number;
  voiceCost: number;
  driveFiles: { total: number; images: number; audio: number; video: number; documents: number; totalSize: number };
  breakdowns: { total: number; completed: number };
  versions: number;
  analyses: number;
  polishJobs: number;
  moodboards: number;
  locations: number;
  topCharacters: Array<{ name: string; dialogueCount: number; hasVoice: number }>;
  totalAiCost: number;
  quickActions: {
    charactersWithoutVoice: number;
    charactersWithoutDescription: number;
    scenesWithoutBreakdowns: number;
    scenesWithoutFiles: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ── Stat card with GSAP count-up ── */
function StatNumber({ value, label, icon, accentColor }: { value: number; label: string; icon: React.ReactNode; accentColor: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!ref.current || hasAnimated.current || value === 0) return;
    if (prefersReducedMotion()) return;
    hasAnimated.current = true;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: value,
      duration: 1.2,
      ease: "power2.out",
      snap: { val: 1 },
      onUpdate: () => { if (ref.current) ref.current.textContent = String(Math.round(obj.val)); },
    });
  }, [value]);

  return (
    <div className="relative group/stat flex items-center gap-4 min-w-0 rounded-xl p-4 backdrop-blur-sm bg-card/90 border border-border/50 hover:border-border transition-all duration-300" style={{ boxShadow: `0 0 0 0 ${accentColor}`, ["--stat-accent" as string]: accentColor }}>
      <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 relative z-[1] transition-colors duration-300" style={{ backgroundColor: `color-mix(in oklch, ${accentColor} 18%, transparent)`, color: accentColor }}>
        {icon}
      </div>
      <div className="min-w-0 relative z-[1]">
        <p className="text-3xl font-bold tracking-tight leading-none text-foreground tabular-nums">
          <span ref={ref}>{value}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}

/* ── Production pipeline step ── */
function PipelineStep({ label, done, href, stepNumber, isLast, isCurrent }: { label: string; done: boolean; href: string; stepNumber: number; isLast?: boolean; isCurrent?: boolean }) {
  return (
    <div className="flex items-center flex-1 min-w-0" data-pipeline-step>
      <Link href={href} className="flex flex-col items-center gap-2 flex-1 min-w-0 group py-2">
        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
          done
            ? "bg-primary text-primary-foreground shadow-[0_0_14px_oklch(0.585_0.233_264/0.4)]"
            : isCurrent
              ? "border-2 border-primary text-primary bg-primary/15 shadow-[0_0_16px_oklch(0.585_0.233_264/0.25)]"
              : "border border-border text-muted-foreground bg-muted/40 group-hover:border-primary/40 group-hover:text-foreground"
        }`}>
          {done ? <Check size={16} weight="bold" /> : <span>{stepNumber}</span>}
        </div>
        <span className={`text-[11px] font-semibold text-center leading-tight transition-colors ${
          done ? "text-foreground" : isCurrent ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}>{label}</span>
      </Link>
      {!isLast && (
        <div className={`w-full h-0.5 flex-1 mx-1 rounded-full transition-colors duration-500 ${done ? "bg-primary/50" : "bg-border"}`} />
      )}
    </div>
  );
}

export default function ProjectOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [filterType, setFilterType] = useState<string>(searchParams.get("filter") || "all");
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const productionRef = useRef<HTMLDivElement>(null);
  const sceneListRef = useRef<HTMLDivElement>(null);

  /* ── Debounce search ── */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Sync URL ── */
  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (filterType && filterType !== "all") p.set("filter", filterType);
    const qs = p.toString();
    router.replace(`/project/${projectId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [debouncedSearch, filterType, router, projectId]);

  /* ── Fetch project data ── */
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/projects/${projectId}`, { signal: controller.signal }).then(r => r.json()),
      fetch(`/api/scenes?projectId=${projectId}`, { signal: controller.signal }).then(r => r.json()),
      fetch(`/api/projects/${projectId}/stats`, { signal: controller.signal }).then(r => r.json()),
    ])
      .then(([proj, scns, st]) => { setProject(proj); setScenes(scns); setStats(st); setLoading(false); })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load project data");
        setLoading(false);
      });
    return () => controller.abort();
  }, [projectId]);

  /* ── Fetch hero images ── */
  useEffect(() => {
    fetch(`/api/generate/image/generations?projectId=${projectId}&limit=6`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const urls = data
            .filter((g: { storagePath?: string; status?: string }) => g.storagePath && g.status === "completed")
            .slice(0, 6)
            .map((g: { id: number }) => `/api/generate/image/generations/${g.id}`);
          setHeroImages(urls);
        }
      })
      .catch(() => {});
  }, [projectId]);

  /* ── Charts ready ── */
  useEffect(() => {
    const timer = setTimeout(() => setChartsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  /* ── Cover upload ── */
  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/cover`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const { coverImage } = await res.json();
      setProject(prev => prev ? { ...prev, coverImage } : prev);
      toast.success("Cover image updated");
    } catch {
      toast.error("Failed to upload cover");
    } finally {
      setUploadingCover(false);
    }
  }

  /* ── GSAP hero mosaic stagger ── */
  useEffect(() => {
    if (heroImages.length === 0 || !heroRef.current) return;
    if (prefersReducedMotion()) return;
    const images = heroRef.current.querySelectorAll("[data-hero-img]");
    if (images.length === 0) return;
    gsap.from(images, { opacity: 0, scale: 0.97, stagger: 0.08, duration: 0.5 });
  }, [heroImages]);

  /* ── GSAP entrance animations ── */
  const animateSections = useCallback(() => {
    if (prefersReducedMotion()) return;

    if (statsRef.current) {
      gsap.from(statsRef.current.children, {
        opacity: 0, y: 16, stagger: 0.05, duration: 0.45, ease: "power3.out",
      });
    }
    if (pipelineRef.current) {
      gsap.from(pipelineRef.current.querySelectorAll("[data-pipeline-step]"), {
        opacity: 0, y: 10, stagger: 0.07, duration: 0.4, delay: 0.15,
      });
    }
    if (productionRef.current) {
      gsap.from(productionRef.current.children, {
        opacity: 0, y: 12, stagger: 0.06, duration: 0.4, delay: 0.25,
      });
    }
    if (sceneListRef.current) {
      gsap.from(sceneListRef.current.children, {
        opacity: 0, y: 5, stagger: 0.012, duration: 0.2, delay: 0.35,
      });
    }
  }, []);

  useEffect(() => {
    if (loading || scenes.length === 0) return;
    const timer = setTimeout(animateSections, 60);
    return () => clearTimeout(timer);
  }, [loading, scenes.length, animateSections]);

  /* ── Derived data ── */
  const headingTypes = useMemo(() => {
    const types = new Set(scenes.map(s => s.headingType).filter(Boolean));
    return Array.from(types) as string[];
  }, [scenes]);

  const filtered = useMemo(() => {
    let result = scenes;
    if (filterType !== "all") result = result.filter(s => s.headingType === filterType);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(s =>
        s.heading.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q) ||
        s.synopsis?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [scenes, debouncedSearch, filterType]);

  const completionSteps = stats ? [
    { label: "Script", done: (stats.scenes.total || 0) > 0 },
    { label: "Characters", done: (stats.characters || 0) > 0 },
    { label: "Visuals", done: (stats.imageGenerations.completed || 0) > 0 },
    { label: "Breakdowns", done: (stats.breakdowns.completed || 0) > 0 },
    { label: "Locations", done: (stats.moodboards || 0) > 0 },
  ] : [];
  const completionDone = completionSteps.filter(s => s.done).length;
  const completionTotal = completionSteps.length;
  const completionPct = completionTotal > 0 ? Math.round((completionDone / completionTotal) * 100) : 0;

  const topCharsChartData = useMemo(() => {
    if (!stats?.topCharacters) return [];
    return stats.topCharacters.slice(0, 8).map(c => ({
      name: c.name.length > 12 ? c.name.slice(0, 12) + "..." : c.name,
      lines: c.dialogueCount,
    }));
  }, [stats]);

  /* ── Attention items ── */
  const attentionItems: Array<{ label: string; href: string; count?: number }> = [];
  if (stats?.quickActions) {
    const qa = stats.quickActions;
    if (qa.scenesWithoutBreakdowns > 0) attentionItems.push({ label: "Scenes need breakdowns", href: `/project/${projectId}/breakdowns`, count: qa.scenesWithoutBreakdowns });
    if (qa.charactersWithoutVoice > 0) attentionItems.push({ label: "Characters need voices", href: `/project/${projectId}/characters`, count: qa.charactersWithoutVoice });
    if ((stats.locations || 0) === 0 && (stats.scenes.total || 0) > 0) attentionItems.push({ label: "Extract locations", href: `/project/${projectId}/locations` });
    if (qa.scenesWithoutFiles > 0) attentionItems.push({ label: "Scenes need images", href: `/project/${projectId}/generate`, count: qa.scenesWithoutFiles });
  }

  /* ── Production progress items ── */
  const productionItems = stats ? [
    {
      label: "Images",
      icon: <ImageIcon size={15} weight="duotone" />,
      completed: stats.imageGenerations.completed || 0,
      total: stats.imageGenerations.total || 0,
      href: `/project/${projectId}/generate`,
    },
    {
      label: "Videos",
      icon: <VideoCamera size={15} weight="duotone" />,
      completed: stats.videoGenerations.completed || 0,
      total: stats.videoGenerations.total || 0,
      href: `/project/${projectId}/generate-video`,
    },
    {
      label: "Voices",
      icon: <Microphone size={15} weight="duotone" />,
      completed: stats.voiceGenerations || 0,
      total: stats.voiceGenerations || 0,
      href: `/project/${projectId}/audio-studio`,
    },
    {
      label: "Breakdowns",
      icon: <ListBullets size={15} weight="duotone" />,
      completed: stats.breakdowns.completed || 0,
      total: stats.scenes.total || 0,
      href: `/project/${projectId}/breakdowns`,
    },
  ] : [];

  /* ── Quick tools ── */
  const quickTools = [
    { label: "Generate Images", href: `/project/${projectId}/generate`, icon: <ImageIcon size={16} weight="duotone" /> },
    { label: "Generate Video", href: `/project/${projectId}/generate-video`, icon: <VideoCamera size={16} weight="duotone" /> },
    { label: "Audio Studio", href: `/project/${projectId}/audio-studio`, icon: <Waveform size={16} weight="duotone" /> },
    { label: "Script Doctor", href: `/project/${projectId}/script-doctor`, icon: <Brain size={16} weight="duotone" /> },
    { label: "Camera Angles", href: `/project/${projectId}/camera-angles`, icon: <Camera size={16} weight="duotone" /> },
    { label: "Dialogue Polish", href: `/project/${projectId}/dialogue-polish`, icon: <PencilSimple size={16} weight="duotone" /> },
    { label: "Breakdowns", href: `/project/${projectId}/breakdowns`, icon: <Scissors size={16} weight="duotone" /> },
    { label: "Upscale", href: `/project/${projectId}/upscale`, icon: <TrendUp size={16} weight="duotone" /> },
  ];

  /* ═══════════════════════════════════════════════════════════════
     LOADING SKELETON
     ═══════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="space-y-10 page-transition">
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-16 rounded-xl" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[200px] rounded-xl" />
            <Skeleton className="h-[200px] rounded-xl" />
          </div>
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     EMPTY STATE
     ═══════════════════════════════════════════════════════════════ */
  if (scenes.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 page-transition">
        <div className="border border-dashed border-border/40 rounded-xl">
          <div className="flex flex-col items-center justify-center py-24 md:py-32 empty-state-decoration">
            <div className="w-16 h-16 rounded-2xl border border-border/40 flex items-center justify-center mb-8 relative z-10">
              <FilmSlate size={28} weight="duotone" className="text-muted-foreground/40" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight mb-2 relative z-10">No scenes yet</h2>
            <p className="text-sm text-muted-foreground mb-10 text-center max-w-sm relative z-10">
              Upload and parse a screenplay to get started with your production dashboard.
            </p>
            <Button onClick={() => router.push(`/project/${projectId}/upload`)} size="lg" className="shadow-md relative z-10">
              <Upload size={16} className="mr-2" />
              Upload Screenplay
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN DASHBOARD
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 space-y-0 page-transition">

      {/* ──────────────────────────────────────────────────────────
          HERO SECTION
          ────────────────────────────────────────────────────────── */}
      <div className="relative rounded-xl overflow-hidden group/hero -mx-4 md:-mx-8 lg:mx-0" ref={heroRef}>
        {project?.coverImage ? (
          <div className="relative h-[240px] md:h-[280px]">
            <Image
              src={`/api/projects/${projectId}/cover`}
              alt=""
              fill
              className="object-cover"
              loading="lazy"
              unoptimized
            />
          </div>
        ) : heroImages.length >= 5 ? (
          <div className="grid grid-cols-4 grid-rows-2 gap-px h-[240px] md:h-[280px] bg-border/10">
            <div className="col-span-2 row-span-2 relative" data-hero-img>
              <Image src={heroImages[0]} alt="" fill className="object-cover" loading="lazy" unoptimized />
            </div>
            {heroImages.slice(1, 5).map((url, i) => (
              <div key={i} className="relative" data-hero-img>
                <Image src={url} alt="" fill className="object-cover" loading="lazy" unoptimized />
              </div>
            ))}
          </div>
        ) : heroImages.length > 0 ? (
          <div className={`grid gap-px h-[240px] bg-border/10 ${heroImages.length === 1 ? "grid-cols-1" : heroImages.length === 2 ? "grid-cols-2" : heroImages.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
            {heroImages.map((url, i) => (
              <div key={i} className="relative" data-hero-img>
                <Image src={url} alt="" fill className="object-cover" loading="lazy" unoptimized />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[140px] bg-gradient-to-b from-muted/20 to-transparent" />
        )}

        {/* Cover upload button */}
        <label className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/30 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover/hero:opacity-100 cursor-pointer">
          {uploadingCover ? (
            <span className="loader-spin loader-spin-sm border-muted-foreground/30 border-t-muted-foreground block w-3 h-3" />
          ) : (
            <Camera size={12} />
          )}
          Cover
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCoverUpload(file);
              e.target.value = "";
            }}
          />
        </label>

        {/* Gradient overlay + title */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[oklch(0.585_0.233_264/0.04)] to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight text-foreground">
                {project?.title || "Dashboard"}
              </h1>
              {stats && (
                <p className="text-muted-foreground text-xs mt-1.5 font-mono tabular-nums tracking-wide">
                  {stats.estimatedPages} pg &middot; {stats.wordCount.toLocaleString()} words &middot; {stats.scenes.total} scenes
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/project/${projectId}/present`}>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 bg-background/60 backdrop-blur-sm border-border/30">
                  <Slideshow size={13} />
                  Present
                </Button>
              </Link>
              <a href={`/api/download/project/${projectId}`}>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 bg-background/60 backdrop-blur-sm border-border/30">
                  <Export size={13} />
                  Export
                </Button>
              </a>
              <a href={`/api/projects/${projectId}/report`}>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 bg-background/60 backdrop-blur-sm border-border/30">
                  <FileText size={13} />
                  Report PDF
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onboarding Checklist ── */}
      {stats && (
        <div className="pt-8 [&>div]:backdrop-blur-sm [&>div]:bg-card/60 [&>div]:border-border/30 [&>div]:shadow-[0_0_20px_oklch(0.585_0.233_264/0.04)]">
          <OnboardingChecklist
            hasScenes={(stats.scenes.total || 0) > 0}
            charactersComplete={(stats.characters || 0) > 0 && (stats.quickActions?.charactersWithoutDescription || 0) === 0}
            hasImages={(stats.imageGenerations.completed || 0) > 0}
            hasBreakdowns={(stats.breakdowns.completed || 0) > 0}
            hasLocations={(stats.locations || 0) > 0}
            projectId={projectId}
          />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          KEY METRICS
          ────────────────────────────────────────────────────────── */}
      <div className="pt-10 pb-10">
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatNumber value={stats?.scenes.total || scenes.length} label="Scenes" icon={<FilmSlate size={20} weight="duotone" />} accentColor="oklch(0.585 0.233 264)" />
          <StatNumber value={stats?.characters || 0} label="Characters" icon={<Users size={20} weight="duotone" />} accentColor="oklch(0.715 0.165 195)" />
          <StatNumber value={stats?.dialogues || 0} label="Dialogues" icon={<ChatText size={20} weight="duotone" />} accentColor="oklch(0.80 0.14 85)" />
          <StatNumber value={stats?.estimatedPages || 0} label="Pages" icon={<FileText size={20} weight="duotone" />} accentColor="oklch(0.70 0.17 155)" />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border/25 to-transparent" />

      {/* ──────────────────────────────────────────────────────────
          PRODUCTION PIPELINE
          ────────────────────────────────────────────────────────── */}
      {completionSteps.length > 0 && (
        <div className="py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-0.5 h-3.5 rounded-full bg-primary" />
              <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground">Production Pipeline</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 rounded-full bg-border/30 overflow-hidden">
                <div className="h-full rounded-full bg-primary/60 transition-all duration-700 shadow-[0_0_6px_oklch(0.585_0.233_264/0.3)]" style={{ width: `${completionPct}%` }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums font-semibold">{completionPct}%</span>
            </div>
          </div>

          <div ref={pipelineRef} className="flex items-start">
            {(() => {
              const steps = [
                { label: "Upload Script", done: completionSteps[0]?.done, href: `/project/${projectId}/upload` },
                { label: "Review Cast", done: completionSteps[1]?.done, href: `/project/${projectId}/characters` },
                { label: "Generate Visuals", done: completionSteps[2]?.done, href: `/project/${projectId}/generate` },
                { label: "Breakdowns", done: completionSteps[3]?.done, href: `/project/${projectId}/breakdowns` },
                { label: "Organize", done: completionSteps[4]?.done, href: `/project/${projectId}/drive` },
              ];
              const firstPendingIdx = steps.findIndex(s => !s.done);
              return steps.map((step, i) => (
                <PipelineStep
                  key={step.label}
                  label={step.label}
                  done={step.done}
                  href={step.href}
                  stepNumber={i + 1}
                  isLast={i === steps.length - 1}
                  isCurrent={i === firstPendingIdx}
                />
              ));
            })()}
          </div>
        </div>
      )}

      <div className="h-px bg-gradient-to-r from-transparent via-border/25 to-transparent" />

      {/* ──────────────────────────────────────────────────────────
          PRODUCTION STATUS + SCRIPT BREAKDOWN (Two column)
          ────────────────────────────────────────────────────────── */}
      <div className="py-10">
        <div ref={productionRef} className="grid gap-10 lg:grid-cols-2 lg:gap-12">

          {/* LEFT: Production Status + Needs Attention */}
          <div className="space-y-10">
            {/* Generation Progress */}
            <div>
              <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground mb-5 flex items-center gap-2.5"><span className="w-0.5 h-3.5 rounded-full bg-primary" />Generation Status</h2>
              <div className="space-y-4">
                {productionItems.map(item => {
                  const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                  return (
                    <Link key={item.label} href={item.href} className="group block">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground group-hover:text-primary transition-colors">{item.icon}</span>
                          <span className="text-sm font-semibold text-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground tabular-nums font-semibold">
                          {item.completed}{item.total > 0 && item.total !== item.completed ? ` / ${item.total}` : ""}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full bg-primary group-hover:bg-primary transition-all duration-500"
                          style={{ width: `${Math.max(pct, item.completed > 0 ? 3 : 0)}%`, boxShadow: pct > 0 ? "0 0 8px oklch(0.585 0.233 264 / 0.3)" : "none" }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Cost summary */}
              {stats && stats.totalAiCost > 0 && (
                <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/10">
                  <div className="flex items-center gap-2">
                    <Lightning size={13} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">AI Spend</span>
                  </div>
                  <span className="text-sm font-mono text-foreground tabular-nums font-semibold">${stats.totalAiCost.toFixed(2)}</span>
                  {stats.driveFiles.total > 0 && (
                    <>
                      <Separator orientation="vertical" className="h-3 opacity-40" />
                      <Link href={`/project/${projectId}/drive`} className="flex items-center gap-1.5 group">
                        <Folder size={13} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors font-medium">
                          {stats.driveFiles.total} files ({formatBytes(stats.driveFiles.totalSize)})
                        </span>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Needs Attention */}
            {attentionItems.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground mb-4 flex items-center gap-2.5"><span className="w-0.5 h-3.5 rounded-full bg-primary" />Needs Attention</h2>
                <div className="space-y-1.5">
                  {attentionItems.map(item => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-3 -mx-3 rounded-lg hover:bg-destructive/10 transition-all duration-300 group border border-transparent hover:border-destructive/20"
                    >
                      <Warning size={15} weight="fill" className="text-destructive/70 shrink-0" />
                      <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors flex-1 font-medium">
                        {item.label}
                      </span>
                      {item.count !== undefined && (
                        <Badge variant="secondary" className="text-[11px] px-2 py-0.5 h-auto font-mono bg-destructive/15 text-destructive border-0 font-semibold">
                          {item.count}
                        </Badge>
                      )}
                      <CaretRight size={14} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Script Analysis */}
          <div className="space-y-10">
            {/* Scene type + time breakdown */}
            <div>
              <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground mb-5 flex items-center gap-2.5"><span className="w-0.5 h-3.5 rounded-full bg-primary" />Script Breakdown</h2>

              {/* INT / EXT split */}
              {stats && stats.scenes.total > 0 && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-semibold text-muted-foreground">Location Type</span>
                    </div>
                    <div className="flex gap-0.5 rounded-lg overflow-hidden h-3">
                      {stats.scenes.intCount > 0 && (
                        <div
                          className="transition-all duration-500 rounded-sm"
                          style={{ width: `${(stats.scenes.intCount / stats.scenes.total) * 100}%`, background: "oklch(0.585 0.233 264)" }}
                          title={`INT: ${stats.scenes.intCount}`}
                          role="meter"
                          aria-label={`Interior: ${stats.scenes.intCount} scenes`}
                          aria-valuenow={stats.scenes.intCount}
                        />
                      )}
                      {stats.scenes.extCount > 0 && (
                        <div
                          className="transition-all duration-500 rounded-sm"
                          style={{ width: `${(stats.scenes.extCount / stats.scenes.total) * 100}%`, background: "oklch(0.715 0.165 195)" }}
                          title={`EXT: ${stats.scenes.extCount}`}
                          role="meter"
                          aria-label={`Exterior: ${stats.scenes.extCount} scenes`}
                          aria-valuenow={stats.scenes.extCount}
                        />
                      )}
                      {stats.scenes.intExtCount > 0 && (
                        <div
                          className="transition-all duration-500 rounded-sm"
                          style={{ width: `${(stats.scenes.intExtCount / stats.scenes.total) * 100}%`, background: "oklch(0.80 0.14 85)" }}
                          title={`INT/EXT: ${stats.scenes.intExtCount}`}
                          role="meter"
                          aria-label={`Interior/Exterior: ${stats.scenes.intExtCount} scenes`}
                          aria-valuenow={stats.scenes.intExtCount}
                        />
                      )}
                    </div>
                    <div className="flex gap-5 mt-2.5">
                      {stats.scenes.intCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.585 0.233 264)" }} />
                          <span className="text-xs text-foreground/80 font-medium">INT <span className="font-mono tabular-nums font-semibold">{stats.scenes.intCount}</span></span>
                        </div>
                      )}
                      {stats.scenes.extCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.715 0.165 195)" }} />
                          <span className="text-xs text-foreground/80 font-medium">EXT <span className="font-mono tabular-nums font-semibold">{stats.scenes.extCount}</span></span>
                        </div>
                      )}
                      {stats.scenes.intExtCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "oklch(0.80 0.14 85)" }} />
                          <span className="text-xs text-foreground/80 font-medium">INT/EXT <span className="font-mono tabular-nums font-semibold">{stats.scenes.intExtCount}</span></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Day / Night split */}
                  {(stats.scenes.dayCount > 0 || stats.scenes.nightCount > 0) && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-semibold text-muted-foreground">Time of Day</span>
                      </div>
                      <div className="flex gap-0.5 rounded-lg overflow-hidden h-3">
                        {stats.scenes.dayCount > 0 && (
                          <div
                            className="transition-all duration-500 rounded-sm"
                            style={{ width: `${(stats.scenes.dayCount / stats.scenes.total) * 100}%`, background: "oklch(0.80 0.14 85)" }}
                            title={`Day: ${stats.scenes.dayCount}`}
                            role="meter"
                            aria-label={`Day scenes: ${stats.scenes.dayCount}`}
                          />
                        )}
                        {stats.scenes.nightCount > 0 && (
                          <div
                            className="transition-all duration-500 rounded-sm"
                            style={{ width: `${(stats.scenes.nightCount / stats.scenes.total) * 100}%`, background: "oklch(0.585 0.233 264)" }}
                            title={`Night: ${stats.scenes.nightCount}`}
                            role="meter"
                            aria-label={`Night scenes: ${stats.scenes.nightCount}`}
                          />
                        )}
                        {(() => {
                          const other = stats.scenes.total - stats.scenes.dayCount - stats.scenes.nightCount;
                          return other > 0 ? (
                            <div
                              className="transition-all duration-500 rounded-sm bg-muted"
                              style={{ width: `${(other / stats.scenes.total) * 100}%` }}
                              title={`Other: ${other}`}
                            />
                          ) : null;
                        })()}
                      </div>
                      <div className="flex gap-5 mt-2.5">
                        {stats.scenes.dayCount > 0 && (
                          <div className="flex items-center gap-2">
                            <Sun size={13} weight="fill" style={{ color: "oklch(0.80 0.14 85)" }} />
                            <span className="text-xs text-foreground/80 font-medium">Day <span className="font-mono tabular-nums font-semibold">{stats.scenes.dayCount}</span></span>
                          </div>
                        )}
                        {stats.scenes.nightCount > 0 && (
                          <div className="flex items-center gap-2">
                            <Moon size={13} weight="fill" className="text-primary" />
                            <span className="text-xs text-foreground/80 font-medium">Night <span className="font-mono tabular-nums font-semibold">{stats.scenes.nightCount}</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Directions breakdown */}
              {stats && stats.directions.total > 0 && (
                <div className="mt-5 pt-4 border-t border-border/10">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Actions", value: stats.directions.actions },
                      { label: "Transitions", value: stats.directions.transitions },
                      { label: "B-Roll", value: stats.directions.brolls },
                      { label: "Music", value: stats.directions.music },
                      { label: "Notes", value: stats.directions.notes },
                    ].filter(d => d.value > 0).map(d => (
                      <div key={d.label} className="py-2 px-3 rounded-lg bg-muted/40">
                        <span className="text-lg font-bold text-foreground tabular-nums">{d.value}</span>
                        <span className="text-[11px] text-muted-foreground ml-1.5 font-medium">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Characters — horizontal bar chart */}
            {chartsReady && topCharsChartData.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground flex items-center gap-2.5"><span className="w-0.5 h-3.5 rounded-full bg-primary" />Dialogue by Character</h2>
                  <Link href={`/project/${projectId}/characters`} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium">
                    View all <CaretRight size={11} />
                  </Link>
                </div>
                <div className="h-[220px]">
                  <DynamicResponsiveContainer width="100%" height="100%">
                    <DynamicBarChart data={topCharsChartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                      <DynamicXAxis type="number" hide />
                      <DynamicYAxis
                        dataKey="name"
                        type="category"
                        width={80}
                        tick={{ fontSize: 12, fill: "oklch(0.70 0 0)", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <DynamicTooltip
                        contentStyle={{
                          backgroundColor: "oklch(var(--card) / 0.85)",
                          backdropFilter: "blur(12px)",
                          WebkitBackdropFilter: "blur(12px)",
                          border: "1px solid oklch(var(--border) / 0.3)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 10px oklch(0.585 0.233 264 / 0.05)",
                        }}
                        cursor={{ fill: "oklch(0.585 0.233 264 / 5%)" }}
                      />
                      <DynamicBar
                        dataKey="lines"
                        fill="oklch(0.585 0.233 264 / 0.7)"
                        radius={[0, 4, 4, 0]}
                        barSize={14}
                      />
                    </DynamicBarChart>
                  </DynamicResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border/25 to-transparent" />

      {/* ──────────────────────────────────────────────────────────
          QUICK TOOLS — compact horizontal list
          ────────────────────────────────────────────────────────── */}
      <div className="py-10">
        <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground mb-5 flex items-center gap-2.5"><span className="w-0.5 h-3.5 rounded-full bg-primary" />Tools</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quickTools.map(tool => (
            <Link
              key={tool.label}
              href={tool.href}
              className="flex items-center gap-3 px-4 py-3.5 rounded-lg border border-border/50 bg-card/80 hover:border-primary/50 hover:bg-card hover:-translate-y-0.5 hover:shadow-[0_0_20px_oklch(0.585_0.233_264/0.15)] transition-all duration-300 group"
            >
              <span className="text-primary/70 group-hover:text-primary transition-colors">
                {tool.icon}
              </span>
              <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors truncate">
                {tool.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-border/25 to-transparent" />

      {/* ──────────────────────────────────────────────────────────
          SCENES LIST
          ────────────────────────────────────────────────────────── */}
      <div className="py-10 pb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs uppercase tracking-[0.14em] font-bold text-muted-foreground flex items-center gap-2.5"><span className="w-0.5 h-3.5 rounded-full bg-primary" />Scenes</h2>
          <span className="text-xs font-mono text-muted-foreground tabular-nums font-semibold">
            {filtered.length !== scenes.length ? `${filtered.length} of ` : ""}{scenes.length}
          </span>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 sm:max-w-xs">
            <label htmlFor="scene-search" className="sr-only">Search scenes</label>
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="scene-search"
              placeholder="Search scenes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-10 text-sm border-border/50 bg-card/50 placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="flex gap-1 flex-wrap" role="group" aria-label="Filter scenes">
            <button
              onClick={() => setFilterType("all")}
              aria-pressed={filterType === "all"}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                filterType === "all"
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_oklch(0.585_0.233_264/0.3)]"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All
            </button>
            {headingTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                aria-pressed={filterType === t}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  filterType === t
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_oklch(0.585_0.233_264/0.3)]"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No scenes match your filters</p>
            <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { setSearch(""); setFilterType("all"); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div ref={sceneListRef} className="divide-y divide-border/30">
            {filtered.map(scene => (
              <Link
                key={scene.id}
                href={`/project/${projectId}/scenes/${scene.id}`}
                className="flex items-center gap-4 py-3.5 px-3 -mx-3 rounded-lg hover:bg-card transition-all duration-200 group"
                prefetch={true}
              >
                {/* Scene number */}
                <span className="text-xs font-mono text-muted-foreground w-7 text-right shrink-0 tabular-nums font-semibold">
                  {scene.sceneNumber}
                </span>

                {/* Type badge */}
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-bold shrink-0 ${
                  scene.headingType === "INT" ? "bg-primary/15 text-primary" :
                  scene.headingType === "EXT" ? "bg-accent/15 text-accent" :
                  scene.headingType === "INT/EXT" ? "bg-[oklch(0.80_0.14_85)]/15 text-[oklch(0.80_0.14_85)]" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {scene.headingType || "--"}
                </span>

                {/* Heading + synopsis */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground group-hover:text-foreground transition-colors">
                    {scene.heading}
                  </p>
                  {scene.synopsis && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{scene.synopsis}</p>
                  )}
                </div>

                {/* Time of day */}
                {scene.timeOfDay && (
                  <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:block tabular-nums">
                    {scene.timeOfDay}
                  </span>
                )}

                {/* Arrow */}
                <CaretRight size={14} className="text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
