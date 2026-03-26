"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Scene, Project } from "@/lib/types";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ConsistencyReport } from "@/components/consistency-report";
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
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { FilmScript } from "@phosphor-icons/react/dist/csr/FilmScript";

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

interface ActivityVersion {
  id: number;
  versionNumber: number;
  label: string;
  triggerType: string;
  createdAt: string;
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

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Focus ring classes shared across interactive elements ── */
const focusRingClasses = "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* ── SVG Progress Ring ── */
function ProgressRing({ percentage, size = 48, strokeWidth = 4 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
        style={{ filter: "drop-shadow(0 0 4px var(--glow-primary))" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[10px] font-bold font-mono rotate-90"
        style={{ transformOrigin: "center" }}
      >
        {percentage}%
      </text>
    </svg>
  );
}

/* ── Bento section header — sentence case, not all-caps ── */
function SectionDot({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <span className="w-1 h-3.5 rounded-full bg-primary" />
      {children}
    </h2>
  );
}

/* ── Metrics band cell with GSAP count-up ── */
function MetricCell({ value, label, href, icon }: { value: number; label: string; href: string; icon: React.ReactNode }) {
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
    <Link
      href={href}
      className={`group relative flex flex-col items-center justify-center py-6 px-4 transition-all duration-200 hover:bg-primary/10 ${focusRingClasses} rounded-lg`}
      aria-label={`${value} ${label}`}
    >
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 mb-2.5 text-primary">
        {icon}
      </span>
      <span className="text-3xl font-bold tabular-nums text-foreground group-hover:text-primary transition-colors duration-200">
        <span ref={ref}>{value}</span>
      </span>
      <span className="text-xs uppercase tracking-widest text-muted-foreground mt-2 font-bold">{label}</span>
    </Link>
  );
}

/* ── Tool descriptions for enhanced quick tools ── */
const toolDescriptions: Record<string, string> = {
  "Generate Images": "AI image generation",
  "Generate Video": "Scene-to-video clips",
  "Audio Studio": "Text-to-speech & SFX",
  "Script Doctor": "AI script analysis",
  "Camera Angles": "Shot planning & framing",
  "Dialogue Polish": "AI dialogue rewriting",
  "Breakdowns": "Scene element breakdowns",
  "Upscale": "Video quality enhancement",
};

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
  const [recentActivity, setRecentActivity] = useState<ActivityVersion[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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

  /* ── Fetch recent activity ── */
  useEffect(() => {
    fetch(`/api/versions?projectId=${projectId}&limit=5`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped: ActivityVersion[] = data.map((v: Record<string, unknown>) => ({
            id: v.id as number,
            versionNumber: (v.versionNumber ?? v.version_number ?? 0) as number,
            label: (v.label ?? "") as string,
            triggerType: (v.triggerType ?? v.trigger_type ?? "manual_save") as string,
            createdAt: (v.createdAt ?? v.created_at ?? "") as string,
          }));
          setRecentActivity(mapped);
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
      icon: <ImageIcon size={16} weight="duotone" />,
      completed: stats.imageGenerations.completed || 0,
      total: stats.imageGenerations.total || 0,
      href: `/project/${projectId}/generate`,
    },
    {
      label: "Videos",
      icon: <VideoCamera size={16} weight="duotone" />,
      completed: stats.videoGenerations.completed || 0,
      total: stats.videoGenerations.total || 0,
      href: `/project/${projectId}/generate-video`,
    },
    {
      label: "Voices",
      icon: <Microphone size={16} weight="duotone" />,
      completed: stats.voiceGenerations || 0,
      total: stats.voiceGenerations || 0,
      href: `/project/${projectId}/audio-studio`,
    },
    {
      label: "Breakdowns",
      icon: <ListBullets size={16} weight="duotone" />,
      completed: stats.breakdowns.completed || 0,
      total: stats.scenes.total || 0,
      href: `/project/${projectId}/breakdowns`,
    },
  ] : [];

  /* ── Quick tools with descriptions and recommended badges ── */
  const recommendedTools = useMemo(() => {
    const rec = new Set<string>();
    if (stats?.quickActions) {
      const qa = stats.quickActions;
      if (qa.scenesWithoutFiles > 0) rec.add("Generate Images");
      if (qa.scenesWithoutBreakdowns > 0) rec.add("Breakdowns");
      if (qa.charactersWithoutVoice > 0) rec.add("Audio Studio");
    }
    if (stats && (stats.analyses || 0) === 0 && (stats.scenes.total || 0) > 0) rec.add("Script Doctor");
    return rec;
  }, [stats]);

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

  /* ── Pipeline steps data ── */
  const pipelineStepsData = stats ? (() => {
    const steps = [
      { label: "Upload Script", done: completionSteps[0]?.done, href: `/project/${projectId}/upload` },
      { label: "Review Cast", done: completionSteps[1]?.done, href: `/project/${projectId}/characters` },
      { label: "Generate Visuals", done: completionSteps[2]?.done, href: `/project/${projectId}/generate` },
      { label: "Breakdowns", done: completionSteps[3]?.done, href: `/project/${projectId}/breakdowns` },
      { label: "Organize", done: completionSteps[4]?.done, href: `/project/${projectId}/drive` },
    ];
    const firstPendingIdx = steps.findIndex(s => !s.done);
    return steps.map((s, i) => ({ ...s, stepNumber: i + 1, isCurrent: i === firstPendingIdx, isLast: i === steps.length - 1 }));
  })() : [];

  /* ── Estimated runtime ── */
  const estimatedRuntime = useMemo(() => {
    if (!stats) return "";
    const pages = stats.estimatedPages || 0;
    const mins = pages; // ~1 min per page rule of thumb
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `~${h}h ${m > 0 ? `${m}m` : ""}`.trim();
  }, [stats]);

  /* ═══════════════════════════════════════════════════════════════
     LOADING SKELETON
     ═══════════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Hero skeleton */}
          <Skeleton className="h-[300px] w-full rounded-xl" />
          {/* Metrics band skeleton */}
          <div className="grid grid-cols-4 gap-px rounded-xl overflow-hidden border border-border">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-2 py-6 bg-card">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-8 w-14 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
            ))}
          </div>
          {/* Bento grid skeleton */}
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="col-span-2 h-[240px] rounded-xl" />
            <Skeleton className="h-[240px] rounded-xl" />
            <Skeleton className="h-[180px] rounded-xl" />
            <Skeleton className="h-[180px] rounded-xl" />
            <Skeleton className="h-[180px] rounded-xl" />
            <Skeleton className="col-span-2 h-[220px] rounded-xl" />
            <Skeleton className="h-[220px] rounded-xl" />
          </div>
          {/* Scene list skeleton */}
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     EMPTY STATE — 3-step guide
     ═══════════════════════════════════════════════════════════════ */
  if (scenes.length === 0) {
    const emptySteps = [
      {
        number: 1,
        title: "Upload screenplay",
        description: "Import your script in .txt, .fdx, .docx, or .fountain format.",
        icon: <Upload size={28} weight="duotone" className="text-primary" />,
      },
      {
        number: 2,
        title: "AI parses scenes & characters",
        description: "Claude automatically extracts scenes, dialogue, characters, and directions.",
        icon: <Brain size={28} weight="duotone" className="text-primary" />,
      },
      {
        number: 3,
        title: "Generate visuals & audio",
        description: "Create images, videos, voice-overs, and sound effects with AI tools.",
        icon: <Sparkle size={28} weight="duotone" className="text-primary" />,
      },
    ];

    return (
      <>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">Skip to content</a>
        <div id="main-content" className="max-w-6xl mx-auto px-4 md:px-8 py-12">
          <div className="rounded-2xl border border-dashed border-border bg-card">
            <div className="flex flex-col items-center justify-center py-20 md:py-28">
              {/* Central icon */}
              <div className="w-20 h-20 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center mb-10 relative shadow-[0_0_40px_var(--glow-primary)]">
                <FilmSlate size={36} weight="duotone" className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3 text-foreground">No scenes yet</h1>
              <p className="text-sm text-muted-foreground mb-14 text-center max-w-md leading-relaxed">
                Upload and parse a screenplay to activate your production command center.
              </p>

              {/* 3-step guide with dotted connector */}
              <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl w-full mb-14 px-6">
                {/* Dotted connector line (hidden on mobile) */}
                <div className="hidden sm:block absolute top-7 left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] border-t-2 border-dashed border-border" aria-hidden="true" />

                {emptySteps.map((step) => (
                  <div key={step.number} className="flex flex-col items-center text-center gap-4 relative z-10">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-xl bg-card border border-border flex items-center justify-center shadow-lg">
                        {step.icon}
                      </div>
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-[0_0_10px_var(--glow-primary)]">
                        {step.number}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1.5">{step.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => router.push(`/project/${projectId}/upload`)}
                size="lg"
                className={`shadow-[0_0_20px_var(--glow-primary)] text-sm font-semibold px-8 ${focusRingClasses}`}
              >
                <Upload size={16} className="mr-2" />
                Upload Screenplay
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     MAIN DASHBOARD
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col gap-0">

      {/* Skip navigation link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">Skip to content</a>

      {/* ──────────────────────────────────────────────────────────
          1. HERO SECTION
          ────────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden -mx-4 md:-mx-8 lg:mx-0 group/hero" ref={heroRef}>
        {/* Background layer */}
        {project?.coverImage ? (
          <div className="relative h-[280px] md:h-[340px]">
            <Image
              src={`/api/projects/${projectId}/cover`}
              alt={`Cover image for ${project?.title || "project"}`}
              fill
              className="object-cover"
              loading="lazy"
              unoptimized
            />
          </div>
        ) : heroImages.length >= 5 ? (
          <div className="grid grid-cols-4 grid-rows-2 gap-px h-[280px] md:h-[340px] bg-border">
            <div className="col-span-2 row-span-2 relative">
              <Image src={heroImages[0]} alt="Generated scene image" fill className="object-cover" loading="lazy" unoptimized />
            </div>
            {heroImages.slice(1, 5).map((url, i) => (
              <div key={i} className="relative">
                <Image src={url} alt="Generated scene image" fill className="object-cover" loading="lazy" unoptimized />
              </div>
            ))}
          </div>
        ) : heroImages.length > 0 ? (
          <div className={`grid gap-px h-[280px] bg-border ${heroImages.length === 1 ? "grid-cols-1" : heroImages.length === 2 ? "grid-cols-2" : heroImages.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
            {heroImages.map((url, i) => (
              <div key={i} className="relative">
                <Image src={url} alt="Generated scene image" fill className="object-cover" loading="lazy" unoptimized />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[200px] md:h-[260px] bg-gradient-to-br from-primary/8 via-background to-background" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent pointer-events-none" />

        {/* Cover upload */}
        <label
          className={`absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground transition-all duration-200 opacity-0 group-hover/hero:opacity-100 cursor-pointer ${focusRingClasses}`}
          aria-label="Upload cover image"
        >
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

        {/* Title card content */}
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tighter leading-[1.1] text-foreground">
                {project?.title || "Dashboard"}
              </h1>
              {/* Film strip info bar */}
              {stats && (
                <div className="flex items-center gap-0 mt-3 font-mono text-xs tabular-nums text-muted-foreground">
                  <span>{stats.estimatedPages} pages</span>
                  <span className="mx-3 w-px h-3 bg-border" aria-hidden="true" />
                  <span>{stats.wordCount.toLocaleString()} words</span>
                  <span className="mx-3 w-px h-3 bg-border" aria-hidden="true" />
                  <span>{stats.scenes.total} scenes</span>
                  {estimatedRuntime && (
                    <>
                      <span className="mx-3 w-px h-3 bg-border" aria-hidden="true" />
                      <span>{estimatedRuntime}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/project/${projectId}/present`} className={`rounded-lg ${focusRingClasses}`} aria-label="Present screenplay">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 bg-card border-border hover:border-primary/50 hover:shadow-md text-foreground">
                  <Slideshow size={14} />
                  <span className="hidden sm:inline">Present</span>
                </Button>
              </Link>
              <a href={`/api/download/project/${projectId}`} className={`rounded-lg ${focusRingClasses}`} aria-label="Export project">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 bg-card border-border hover:border-primary/50 hover:shadow-md text-foreground">
                  <Export size={14} />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </a>
              <a href={`/api/projects/${projectId}/report`} className={`rounded-lg ${focusRingClasses}`} aria-label="Download report PDF">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 bg-card border-border hover:border-primary/50 hover:shadow-md text-foreground">
                  <FileText size={14} />
                  <span className="hidden sm:inline">Report</span>
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onboarding Checklist ── */}
      {stats && (
        <div className="pt-6">
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
          2. METRICS BAND
          ────────────────────────────────────────────────────────── */}
      <div id="main-content" className="pt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 rounded-xl border border-border bg-card overflow-hidden divide-x divide-border">
          <MetricCell
            value={stats?.scenes.total || scenes.length}
            label="Scenes"
            href={`/project/${projectId}/scenes`}
            icon={<FilmSlate size={18} weight="duotone" />}
          />
          <MetricCell
            value={stats?.characters || 0}
            label="Characters"
            href={`/project/${projectId}/characters`}
            icon={<Users size={18} weight="duotone" />}
          />
          <MetricCell
            value={stats?.dialogues || 0}
            label="Dialogues"
            href={`/project/${projectId}/scenes`}
            icon={<ChatText size={18} weight="duotone" />}
          />
          <MetricCell
            value={stats?.estimatedPages || 0}
            label="Pages"
            href={`/project/${projectId}/versions`}
            icon={<FileText size={18} weight="duotone" />}
          />
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          2.5 PRODUCTION STYLE
          ────────────────────────────────────────────────────────── */}
      <div className="pt-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FilmScript size={18} weight="duotone" className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Production Style</h2>
            <span className="text-[11px] text-muted-foreground ml-1">Adapts AI analysis, pacing, and dialogue rules</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {([
              { key: "general", label: "General", icon: "🎬", desc: "Standard screenplay" },
              { key: "childrens_animation", label: "Children's Animation", icon: "🧸", desc: "Kids TV (ages 2-8)" },
              { key: "documentary", label: "Documentary", icon: "🎥", desc: "Interview & narration" },
              { key: "commercial", label: "Commercial / Ad", icon: "📺", desc: "Short-form, high impact" },
              { key: "music_video", label: "Music Video", icon: "🎵", desc: "Beat-driven, visual-first" },
            ] as const).map((style) => {
              const isActive = (project?.productionStyle || "general") === style.key;
              return (
                <button
                  key={style.key}
                  onClick={async () => {
                    setProject(prev => prev ? { ...prev, productionStyle: style.key } : prev);
                    try {
                      await fetch(`/api/projects/${projectId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ productionStyle: style.key === "general" ? null : style.key }),
                      });
                      toast.success(`Style: ${style.label}`);
                    } catch {
                      toast.error("Failed to update style");
                    }
                  }}
                  className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                      : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xl leading-none">{style.icon}</span>
                  <span className={`text-xs font-medium leading-tight ${isActive ? "text-primary" : "text-foreground"}`}>{style.label}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{style.desc}</span>
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check size={10} className="text-primary-foreground" weight="bold" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          3. BENTO GRID
          ────────────────────────────────────────────────────────── */}
      <div className="pt-6 pb-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── PRODUCTION PROGRESS (spans 2 cols) ── */}
          <div
            data-bento-cell
            className="lg:col-span-2 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <SectionDot>Production Progress</SectionDot>
              {stats && stats.totalAiCost > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lightning size={12} />
                  <span className="font-mono tabular-nums">${stats.totalAiCost.toFixed(2)} spent</span>
                </div>
              )}
            </div>

            {/* Progress mini-cards in horizontal layout */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {productionItems.map(item => {
                const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`group flex items-center gap-3 p-4 rounded-lg bg-muted border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 ${focusRingClasses}`}
                  >
                    <ProgressRing percentage={pct} size={40} strokeWidth={3} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold tabular-nums text-foreground leading-none">
                        {item.completed}
                        {item.total > 0 && item.total !== item.completed && (
                          <span className="text-muted-foreground font-normal text-xs">/{item.total}</span>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium flex items-center gap-1">
                        <span className="group-hover:text-primary transition-colors">{item.icon}</span>
                        {item.label}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Drive files info */}
            {stats && stats.driveFiles.total > 0 && (
              <Link
                href={`/project/${projectId}/drive`}
                className={`inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors ${focusRingClasses} rounded`}
              >
                <Folder size={13} />
                <span className="font-medium">{stats.driveFiles.total} files ({formatBytes(stats.driveFiles.totalSize)})</span>
              </Link>
            )}

            {/* Needs Attention alerts */}
            {attentionItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex flex-col gap-1.5">
                  {attentionItems.map(item => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted border border-border hover:border-primary/50 hover:shadow-md transition-all duration-200 group ${focusRingClasses}`}
                    >
                      <Warning size={13} weight="fill" className="shrink-0 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs text-foreground font-medium flex-1">{item.label}</span>
                      {item.count !== undefined && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-auto font-mono border-0 font-semibold">
                          {item.count}
                        </Badge>
                      )}
                      <CaretRight size={12} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── PIPELINE (1 col, vertical steps) ── */}
          {pipelineStepsData.length > 0 && (
            <div
              data-bento-cell
              className="rounded-xl border border-border bg-card p-6 flex flex-col"
            >
              <SectionDot>Pipeline</SectionDot>

              <div className="flex flex-col gap-0 mt-5 flex-1">
                {pipelineStepsData.map((step) => (
                  <div key={step.label} className="flex items-start gap-3">
                    {/* Vertical line + circle */}
                    <div className="flex flex-col items-center shrink-0">
                      <Link
                        href={step.href}
                        className={`relative w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 ${focusRingClasses} ${
                          step.done
                            ? "bg-primary text-primary-foreground shadow-[0_0_12px_var(--glow-primary)]"
                            : step.isCurrent
                              ? "border-2 border-primary text-primary bg-card"
                              : "border-2 border-border text-muted-foreground bg-card"
                        }`}
                        aria-label={`${step.label}: ${step.done ? "completed" : step.isCurrent ? "current step" : "pending"}`}
                      >
                        {step.done ? <Check size={13} weight="bold" /> : <span>{step.stepNumber}</span>}
                      </Link>
                      {!step.isLast && (
                        <div className={`w-0.5 h-5 transition-colors duration-500 ${step.done ? "bg-primary" : "bg-border"}`} />
                      )}
                    </div>
                    {/* Label */}
                    <Link
                      href={step.href}
                      className={`text-sm font-semibold pt-1 transition-colors ${focusRingClasses} rounded ${
                        step.done ? "text-foreground" : step.isCurrent ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {step.label}
                    </Link>
                  </div>
                ))}
              </div>

              {/* Overall progress ring at bottom */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Overall</span>
                <ProgressRing percentage={completionPct} size={36} strokeWidth={3} />
              </div>
            </div>
          )}

          {/* ── SCENE TYPES (INT/EXT) ── */}
          {stats && stats.scenes.total > 0 && (
            <div
              data-bento-cell
              className="rounded-xl border border-border bg-card p-6"
            >
              <SectionDot>Scene Types</SectionDot>

              <div className="mt-5">
                {/* Stacked bar */}
                <div className="flex gap-0.5 rounded-md overflow-hidden h-6 mb-4">
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

                {/* Legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {stats.scenes.intCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: "oklch(0.585 0.233 264)" }} />
                      <span className="text-xs text-foreground font-medium">INT <span className="font-mono tabular-nums font-semibold text-muted-foreground">{stats.scenes.intCount}</span></span>
                    </div>
                  )}
                  {stats.scenes.extCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: "oklch(0.715 0.165 195)" }} />
                      <span className="text-xs text-foreground font-medium">EXT <span className="font-mono tabular-nums font-semibold text-muted-foreground">{stats.scenes.extCount}</span></span>
                    </div>
                  )}
                  {stats.scenes.intExtCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: "oklch(0.80 0.14 85)" }} />
                      <span className="text-xs text-foreground font-medium">INT/EXT <span className="font-mono tabular-nums font-semibold text-muted-foreground">{stats.scenes.intExtCount}</span></span>
                    </div>
                  )}
                </div>

                {/* Directions breakdown compact */}
                {stats.directions.total > 0 && (
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Actions", value: stats.directions.actions },
                        { label: "Transitions", value: stats.directions.transitions },
                        { label: "B-Roll", value: stats.directions.brolls },
                        { label: "Music", value: stats.directions.music },
                        { label: "Notes", value: stats.directions.notes },
                      ].filter(d => d.value > 0).map(d => (
                        <div key={d.label} className="py-1.5 px-2 rounded-md bg-muted text-center">
                          <span className="text-sm font-bold text-foreground tabular-nums">{d.value}</span>
                          <span className="text-[10px] text-muted-foreground ml-1 font-medium">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DAY/NIGHT ── */}
          {stats && (stats.scenes.dayCount > 0 || stats.scenes.nightCount > 0) && (
            <div
              data-bento-cell
              className="rounded-xl border border-border bg-card p-6"
            >
              <SectionDot>Time of Day</SectionDot>

              <div className="mt-5">
                {/* Stacked bar */}
                <div className="flex gap-0.5 rounded-md overflow-hidden h-6 mb-4">
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

                {/* Legend with sun/moon icons */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {stats.scenes.dayCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Sun size={14} weight="fill" style={{ color: "oklch(0.80 0.14 85)" }} />
                      <span className="text-xs text-foreground font-medium">Day <span className="font-mono tabular-nums font-semibold text-muted-foreground">{stats.scenes.dayCount}</span></span>
                    </div>
                  )}
                  {stats.scenes.nightCount > 0 && (
                    <div className="flex items-center gap-2">
                      <Moon size={14} weight="fill" className="text-primary" />
                      <span className="text-xs text-foreground font-medium">Night <span className="font-mono tabular-nums font-semibold text-muted-foreground">{stats.scenes.nightCount}</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── QUICK TOOLS (2x4 grid) ── */}
          <div
            data-bento-cell
            className="rounded-xl border border-border bg-card p-6"
          >
            <SectionDot>Quick Tools</SectionDot>

            <div className="grid grid-cols-2 gap-2 mt-5">
              {quickTools.map(tool => {
                const isRecommended = recommendedTools.has(tool.label);
                return (
                  <Link
                    key={tool.label}
                    href={tool.href}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                      isRecommended
                        ? "bg-primary/15 border-2 border-primary/40 hover:border-primary"
                        : "bg-card border border-border hover:border-primary/50 hover:shadow-md"
                    } ${focusRingClasses}`}
                  >
                    <span className="text-primary group-hover:text-primary transition-colors shrink-0">{tool.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate leading-tight">{tool.label}</p>
                      {toolDescriptions[tool.label] && (
                        <p className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5">{toolDescriptions[tool.label]}</p>
                      )}
                    </div>
                    {isRecommended && (
                      <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--glow-primary)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── CHARACTER CHART (spans 2 cols) ── */}
          {chartsReady && topCharsChartData.length > 0 && (
            <div
              data-bento-cell
              className="lg:col-span-2 rounded-xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <SectionDot>Dialogue by Character</SectionDot>
                <Link
                  href={`/project/${projectId}/characters`}
                  className={`text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-semibold ${focusRingClasses} rounded`}
                >
                  View all <CaretRight size={10} />
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
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <DynamicTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                        color: "hsl(var(--foreground))",
                      }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <DynamicBar
                      dataKey="lines"
                      fill="hsl(var(--primary))"
                      radius={[0, 6, 6, 0]}
                      barSize={14}
                    />
                  </DynamicBarChart>
                </DynamicResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── ACTIVITY FEED ── */}
          {recentActivity.length > 0 && (
            <div
              data-bento-cell
              className="rounded-xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <SectionDot>Activity</SectionDot>
                <Link
                  href={`/project/${projectId}/versions`}
                  className={`text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-semibold ${focusRingClasses} rounded`}
                >
                  All <CaretRight size={10} />
                </Link>
              </div>
              <div className="flex flex-col gap-0">
                {recentActivity.map((v, i) => (
                  <Link
                    key={v.id}
                    href={`/project/${projectId}/versions`}
                    className={`flex items-start gap-3 py-2.5 group ${focusRingClasses} rounded-lg`}
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      {i < recentActivity.length - 1 && (
                        <div className="w-0.5 h-full min-h-[20px] bg-border mt-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 flex items-baseline gap-2">
                      <span className="text-xs font-bold text-foreground font-mono tabular-nums shrink-0">
                        v{v.versionNumber}
                      </span>
                      {v.label && (
                        <span className="text-xs text-muted-foreground truncate">{v.label}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 pt-0.5">
                      {timeAgo(v.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual Consistency Report */}
      {stats && stats.imageGenerations.completed > 1 && (
        <div className="pb-4">
          <ConsistencyReport projectId={projectId} />
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          4. SCENES LIST
          ────────────────────────────────────────────────────────── */}
      <div className="py-6 pb-16">
        <div className="rounded-xl border border-border bg-card p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <SectionDot>Scenes</SectionDot>
            <span className="text-xs font-mono text-muted-foreground tabular-nums font-semibold uppercase tracking-widest">
              {filtered.length !== scenes.length ? `${filtered.length} / ` : ""}{scenes.length}
            </span>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1 sm:max-w-xs">
              <label htmlFor="scene-search" className="sr-only">Search scenes</label>
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="scene-search"
                placeholder="Search scenes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`pl-8 h-9 text-sm border-border bg-muted placeholder:text-muted-foreground rounded-lg ${focusRingClasses}`}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter scenes">
              <button
                onClick={() => setFilterType("all")}
                aria-pressed={filterType === "all"}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${focusRingClasses} ${
                  filterType === "all"
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--glow-primary)]"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {headingTypes.map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  aria-pressed={filterType === t}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 ${focusRingClasses} ${
                    filterType === t
                      ? "bg-primary text-primary-foreground shadow-[0_0_10px_var(--glow-primary)]"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Scene rows */}
          {filtered.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-sm text-muted-foreground">No scenes match your filters</p>
              <Button variant="outline" size="sm" className={`mt-3 text-xs ${focusRingClasses}`} onClick={() => { setSearch(""); setFilterType("all"); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div>
              {filtered.map((scene, i) => (
                <Link
                  key={scene.id}
                  href={`/project/${projectId}/scenes/${scene.id}`}
                  className={`flex items-center gap-4 py-4 px-4 rounded-lg hover:bg-accent/50 transition-all duration-200 group ${focusRingClasses} ${
                    i % 2 === 1 ? "bg-muted" : ""
                  }`}
                  prefetch={true}
                >
                  {/* Scene number */}
                  <span className="text-sm font-mono font-bold text-muted-foreground w-6 text-right shrink-0 tabular-nums">
                    {scene.sceneNumber}
                  </span>

                  {/* Type badge */}
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md font-bold shrink-0 ${
                    scene.headingType === "INT" ? "bg-primary/20 text-primary" :
                    scene.headingType === "EXT" ? "bg-accent/12 text-accent" :
                    scene.headingType === "INT/EXT" ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {scene.headingType || "--"}
                  </span>

                  {/* Heading + synopsis */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-foreground leading-tight">
                      {scene.heading}
                    </p>
                    {scene.synopsis && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5 leading-tight">{scene.synopsis}</p>
                    )}
                  </div>

                  {/* Time of day */}
                  {scene.timeOfDay && (
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden sm:block tabular-nums uppercase tracking-wider">
                      {scene.timeOfDay}
                    </span>
                  )}

                  {/* Arrow */}
                  <CaretRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
