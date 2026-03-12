"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { gsap } from "@/lib/gsap";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { InfoTooltip } from "@/components/info-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import dynamic from "next/dynamic";

const TensionChart = dynamic(() => import("./tension-chart"), {
  ssr: false,
  loading: () => <div className="h-[250px] w-full bg-muted/30 rounded-lg animate-pulse" />,
});

import { Stethoscope } from "@phosphor-icons/react/dist/csr/Stethoscope";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { XCircle } from "@phosphor-icons/react/dist/csr/XCircle";
import { Spinner } from "@phosphor-icons/react/dist/csr/Spinner";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { FilmScript } from "@phosphor-icons/react/dist/csr/FilmScript";

import type { AnalysisResult, ScriptAnalysis, ScriptIssue, SceneModificationOption } from "@/lib/types";

// ── Types ──

type AnalysisType = "full" | "structure" | "characters" | "dialogue" | "pacing" | "custom";
type SeverityFilter = "all" | "critical" | "major" | "minor" | "suggestion";
type PageView = "new" | "detail";

interface AnalysisWithIssues extends ScriptAnalysis {
  issues: ScriptIssue[];
}

// ── Severity Colors (semantic only) ──

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30 shadow-[0_0_8px_oklch(0.577_0.245_27.33/0.15)]",
  major: "bg-destructive/10 text-destructive/80 border-destructive/20 shadow-[0_0_6px_oklch(0.577_0.245_27.33/0.1)]",
  minor: "bg-muted text-muted-foreground border-border",
  suggestion: "bg-primary/10 text-primary border-primary/20 shadow-[0_0_6px_oklch(0.585_0.233_264/0.1)]",
};

const CATEGORY_COLORS: Record<string, string> = {
  structure: "bg-primary/15 text-primary border-primary/25",
  pacing: "bg-[oklch(0.75_0.15_85/0.15)] text-[oklch(0.75_0.15_85)] border-[oklch(0.75_0.15_85/0.25)]",
  character: "bg-[oklch(0.72_0.17_162/0.15)] text-[oklch(0.72_0.17_162)] border-[oklch(0.72_0.17_162/0.25)]",
  dialogue: "bg-accent/15 text-accent border-accent/25",
  continuity: "bg-[oklch(0.65_0.2_15/0.15)] text-[oklch(0.65_0.2_15)] border-[oklch(0.65_0.2_15/0.25)]",
  theme: "bg-[oklch(0.65_0.2_300/0.15)] text-[oklch(0.65_0.2_300)] border-[oklch(0.65_0.2_300/0.25)]",
  logic: "bg-destructive/15 text-destructive border-destructive/25",
  tone: "bg-[oklch(0.6_0.22_290/0.15)] text-[oklch(0.6_0.22_290)] border-[oklch(0.6_0.22_290/0.25)]",
};

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
          <CheckCircle weight="fill" className="w-3 h-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-1">
          <XCircle weight="fill" className="w-3 h-3" />
          Failed
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] gap-1">
          <Spinner className="w-3 h-3 animate-spin" />
          Processing
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] gap-1">
          <Spinner className="w-3 h-3 animate-spin" />
          Pending
        </Badge>
      );
  }
}

// ── Analysis Type Card Icons (SVG) ──

function AnalysisTypeIcon({ type, className }: { type: AnalysisType; className?: string }) {
  const cn = className ?? "w-5 h-5";
  switch (type) {
    case "full":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
          <path d="M16 16l2 2" />
        </svg>
      );
    case "structure":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "characters":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "dialogue":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8M8 13h4" />
        </svg>
      );
    case "pacing":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case "custom":
      return (
        <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
  }
}

// ── Score Card Component ──

function ScoreCard({
  label,
  score,
  loading,
}: {
  label: string;
  score: number;
  loading: boolean;
}) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-primary";
    if (s >= 60) return "text-muted-foreground";
    if (s >= 40) return "text-destructive/70";
    return "text-destructive";
  };

  const getTrackColor = (s: number) => {
    if (s >= 80) return "bg-primary";
    if (s >= 60) return "bg-primary/50";
    if (s >= 40) return "bg-destructive/50";
    return "bg-destructive";
  };

  if (loading) {
    return (
      <Card className="flex-1 min-w-[140px] backdrop-blur-sm bg-card/80 border-border/40">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 min-w-[140px] backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-3xl font-bold mt-1 ${getColor(score)}`} style={{ textShadow: score >= 60 ? '0 0 20px oklch(0.585 0.233 264 / 0.3)' : undefined }}>
          {score}
        </p>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getTrackColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Issue Card Component ──

function IssueCard({
  issue,
  projectId,
  onToggleResolved,
  onApply,
  onDismiss,
  isApplying,
  isDismissed,
}: {
  issue: ScriptIssue;
  projectId: string;
  onToggleResolved: (id: number, resolved: boolean) => void;
  onApply: (issue: ScriptIssue, sceneIds: number[]) => void;
  onDismiss: (issueId: number) => void;
  isApplying?: boolean;
  isDismissed?: boolean;
}) {
  let sceneIds: number[] = [];
  let characterNames: string[] = [];
  try { if (issue.sceneIds) sceneIds = JSON.parse(issue.sceneIds); } catch {}
  try { if (issue.characterNames) characterNames = JSON.parse(issue.characterNames); } catch {}

  const severityGlow = issue.severity === "critical"
    ? "shadow-[0_0_12px_oklch(0.577_0.245_27.33/0.12)]"
    : issue.severity === "major"
      ? "shadow-[0_0_8px_oklch(0.577_0.245_27.33/0.08)]"
      : "";

  const CATEGORY_BAR_COLORS: Record<string, string> = {
    structure: "bg-primary",
    pacing: "bg-[oklch(0.75_0.15_85)]",
    character: "bg-[oklch(0.72_0.17_162)]",
    dialogue: "bg-accent",
    continuity: "bg-[oklch(0.65_0.2_15)]",
    theme: "bg-[oklch(0.65_0.2_300)]",
    logic: "bg-destructive",
    tone: "bg-[oklch(0.6_0.22_290)]",
  };

  const isAppliedOrDismissed = issue.isResolved || isDismissed;

  return (
    <Card
      className={`backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300 overflow-hidden ${severityGlow} ${isAppliedOrDismissed ? "opacity-50" : ""}`}
    >
      <div className="flex">
        <div className={`w-1 shrink-0 ${CATEGORY_BAR_COLORS[issue.category] || "bg-muted"}`} />
        <CardContent className="p-4 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className={SEVERITY_COLORS[issue.severity] || ""}>{issue.severity}</Badge>
              <Badge variant="outline" className={CATEGORY_COLORS[issue.category] || ""}>{issue.category}</Badge>
              {issue.isResolved && !isDismissed && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Applied</Badge>
              )}
              {isDismissed && (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Dismissed</Badge>
              )}
            </div>
            <h4 className="font-semibold text-sm">{issue.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
            {issue.recommendation && (
              <div className="mt-2 rounded-md bg-muted/50 backdrop-blur-sm p-2.5 text-xs text-muted-foreground">
                <span className="font-semibold">Recommendation:</span> {issue.recommendation}
              </div>
            )}
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {sceneIds.length > 0 && (
                <span className="text-xs text-muted-foreground">Scenes: {sceneIds.join(", ")}</span>
              )}
              {characterNames.length > 0 && (
                <span className="text-xs text-muted-foreground">Characters: {characterNames.join(", ")}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {issue.recommendation && sceneIds.length > 0 && !isAppliedOrDismissed && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => onApply(issue, sceneIds)}
                disabled={isApplying}
              >
                {isApplying ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                )}
                {isApplying ? "Generating options…" : "Apply"}
              </Button>
            )}
            {!isAppliedOrDismissed && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onDismiss(issue.id)}
              >
                Dismiss
              </Button>
            )}
            {isAppliedOrDismissed && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => onToggleResolved(issue.id, false)}
              >
                Undo
              </Button>
            )}
            {sceneIds.length > 0 && (
              <a
                href={`/project/${projectId}/scenes/${sceneIds[0]}`}
                className="text-[10px] text-center text-muted-foreground hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Go to scene →
              </a>
            )}
          </div>
        </div>
      </CardContent>
      </div>
    </Card>
  );
}

// ── Analysis Type Definitions ──

const ANALYSIS_TYPES: { value: AnalysisType; label: string; description: string; tip: string }[] = [
  {
    value: "full",
    label: "Full Analysis",
    description: "Structure, pacing, characters, dialogue, and themes with scores and tension curves.",
    tip: "Covers structure, pacing, characters, dialogue, and themes. Produces scores, tension curve, and issues.",
  },
  {
    value: "structure",
    label: "Structure",
    description: "Act breaks, inciting incident, midpoint, climax, and resolution assessment.",
    tip: "Act breaks, inciting incident, midpoint, climax, resolution. Is your dramatic arc compelling?",
  },
  {
    value: "characters",
    label: "Characters",
    description: "Arcs, depth, introductions, flat characters, and voice distinctness.",
    tip: "Character arcs, depth, introductions. Identifies flat characters and voice distinctness.",
  },
  {
    value: "dialogue",
    label: "Dialogue",
    description: "On-the-nose detection, strong highlights, and voice distinctness scoring.",
    tip: "On-the-nose detection, strong dialogue highlights, voice distinctness score.",
  },
  {
    value: "pacing",
    label: "Pacing",
    description: "Rhythm, tempo, slow or rushed sections, and tension curve generation.",
    tip: "Rhythm and tempo. Finds slow/rushed sections. Generates tension curve.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Write your own focus -- a subplot, relationship, tone, or any concern.",
    tip: "Write your own analysis focus -- a subplot, relationship, tone, or any specific concern.",
  },
];

// ── Helper: extract score from stored result ──

function extractScore(analysis: ScriptAnalysis): number | null {
  if (analysis.status !== "completed" || !analysis.result) return null;
  try {
    const parsed: AnalysisResult = JSON.parse(analysis.result);
    return parsed.overallScore ?? null;
  } catch {
    return null;
  }
}

// ── Main Page ──

export default function ScriptDoctorPage() {
  const params = useParams();
  const projectId = params.id as string;

  // State
  const [pageView, setPageView] = useState<PageView>("new");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("full");
  const [customPrompt, setCustomPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisWithIssues | null>(null);
  const [parsedResult, setParsedResult] = useState<AnalysisResult | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [issueSearch, setIssueSearch] = useState("");
  const [historyList, setHistoryList] = useState<ScriptAnalysis[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deleteAnalysisTarget, setDeleteAnalysisTarget] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // GSAP stagger animation on analysis type cards
  useEffect(() => {
    if (!gridRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = gridRef.current.querySelectorAll("[data-type-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [pageView]);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingStartRef = useRef<number>(0);

  // ── Load analysis history ──

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/script-doctor/analyses?projectId=${projectId}`
      );
      if (res.ok) {
        const data: ScriptAnalysis[] = await res.json();
        setHistoryList(data);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Compute last-run timestamps per analysis type ──

  const lastRunByType = useMemo(() => {
    const map: Partial<Record<AnalysisType, string>> = {};
    for (const h of historyList) {
      const t = h.analysisType as AnalysisType;
      if (h.status === "completed" && !map[t]) {
        map[t] = h.createdAt;
      }
    }
    return map;
  }, [historyList]);

  // ── Load a specific analysis ──

  const loadAnalysis = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/script-doctor/analyses/${id}`);
      if (!res.ok) {
        toast.error("Failed to load analysis");
        return;
      }
      const data: AnalysisWithIssues = await res.json();
      setCurrentAnalysis(data);
      setCurrentAnalysisId(data.id);
      setPageView("detail");

      if (data.result) {
        try {
          const parsed: AnalysisResult = JSON.parse(data.result);
          setParsedResult(parsed);
        } catch {
          setParsedResult(null);
        }
      } else {
        setParsedResult(null);
      }
    } catch {
      toast.error("Failed to load analysis");
    }
  }, []);

  // ── Polling for analysis completion ──

  const startPolling = useCallback(
    (id: number) => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
      pollingStartRef.current = Date.now();
      const POLL_INTERVAL = 3000;
      const MAX_POLL_TIME = 5 * 60 * 1000;

      const poll = async () => {
        if (Date.now() - pollingStartRef.current > MAX_POLL_TIME) {
          pollingRef.current = null;
          setAnalyzing(false);
          toast.error("Analysis timed out. The server may be overloaded -- please try again.");
          return;
        }

        try {
          const res = await fetch(`/api/script-doctor/analyses/${id}`);
          if (!res.ok) {
            pollingRef.current = setTimeout(poll, POLL_INTERVAL);
            return;
          }
          const data: AnalysisWithIssues = await res.json();

          if (data.status === "completed") {
            pollingRef.current = null;
            setAnalyzing(false);
            setCurrentAnalysis(data);
            setPageView("detail");
            if (data.result) {
              try {
                setParsedResult(JSON.parse(data.result));
              } catch {
                setParsedResult(null);
              }
            }
            toast.success("Analysis complete!");
            loadHistory();
            return;
          } else if (data.status === "failed") {
            pollingRef.current = null;
            setAnalyzing(false);
            setCurrentAnalysis(data);
            setPageView("detail");
            toast.error(`Analysis failed: ${data.error || "Unknown error"}`);
            return;
          }
        } catch {
          // continue polling
        }
        pollingRef.current = setTimeout(poll, POLL_INTERVAL);
      };
      pollingRef.current = setTimeout(poll, POLL_INTERVAL);
    },
    [loadHistory]
  );

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, []);

  // ── Start analysis ──

  const handleStartAnalysis = async () => {
    if (analysisType === "custom" && !customPrompt.trim()) {
      toast.error("Please enter a custom analysis prompt");
      return;
    }

    setAnalyzing(true);
    setParsedResult(null);
    setCurrentAnalysis(null);
    setSeverityFilter("all");
    setCategoryFilter("all");
    setIssueSearch("");
    setPageView("detail");

    try {
      const res = await fetch("/api/script-doctor/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          analysisType,
          customPrompt: analysisType === "custom" ? customPrompt : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnalyzing(false);
        setPageView("new");
        toast.error(data.error || "Failed to start analysis");
        return;
      }

      setCurrentAnalysisId(data.id);
      startPolling(data.id);

      // Trigger the heavy processing via SSE stream
      (async () => {
        try {
          const processRes = await fetch("/api/script-doctor/analyze/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              analysisId: data.id,
              projectId: data.projectId,
              analysisType: data.analysisType,
              customPrompt: data.customPrompt,
            }),
          });
          if (!processRes.ok) {
            const errText = await processRes.text().catch(() => "Processing failed");
            toast.error(errText || "Processing failed to start");
            return;
          }
          const reader = processRes.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // Check for error messages in the stream
              const chunk = decoder.decode(value, { stream: true });
              if (chunk.includes("error:")) {
                const errorMatch = chunk.match(/data: error:(.+)/);
                if (errorMatch) {
                  toast.error(`Analysis error: ${errorMatch[1].trim()}`);
                }
              }
            }
          }
        } catch (err) {
          console.error("[ScriptDoctor] Process stream error:", err);
        }
      })();
    } catch {
      setAnalyzing(false);
      setPageView("new");
      toast.error("Failed to start analysis");
    }
  };

  // ── Apply recommendation (3 options modal) ──

  const [applyingIssueId, setApplyingIssueId] = useState<number | null>(null);
  const [rewriteOptions, setRewriteOptions] = useState<SceneModificationOption[]>([]);
  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);
  const [rewriteIssue, setRewriteIssue] = useState<{ issue: ScriptIssue; sceneId: number } | null>(null);
  const [applyingOptionIdx, setApplyingOptionIdx] = useState<number | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const handleApplyRecommendation = async (issue: ScriptIssue, sceneIds: number[]) => {
    if (!issue.recommendation || sceneIds.length === 0) return;
    setApplyingIssueId(issue.id);

    const sceneId = sceneIds[0];
    const prompt = `Apply the following script doctor recommendation:\n\nIssue: ${issue.title}\nCategory: ${issue.category}\nDescription: ${issue.description}\n\nRecommendation: ${issue.recommendation}\n\nGenerate 3 distinct rewrite options. Each should preserve the original tone and intent while addressing the issue in a different way.`;

    try {
      const res = await fetch(`/api/scenes/${sceneId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const options: SceneModificationOption[] = data.options || [];

      if (options.length === 0) {
        toast.error("No rewrite options generated");
        setApplyingIssueId(null);
        return;
      }

      setRewriteOptions(options);
      setRewriteIssue({ issue, sceneId });
      setRewriteModalOpen(true);
    } catch {
      toast.error("Failed to generate rewrite options");
    }
    setApplyingIssueId(null);
  };

  const handleSelectOption = async (idx: number) => {
    if (!rewriteIssue) return;
    const option = rewriteOptions[idx];
    setApplyingOptionIdx(idx);

    try {
      const res = await fetch(`/api/scenes/${rewriteIssue.sceneId}/apply-modification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elements: option.elements,
          synopsis: option.synopsis,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Rewrite applied successfully");
      handleToggleResolved(rewriteIssue.issue.id, true);
      setRewriteModalOpen(false);
    } catch {
      toast.error("Failed to apply rewrite");
    }
    setApplyingOptionIdx(null);
  };

  const handleDismiss = (issueId: number) => {
    setDismissedIds((prev) => new Set([...prev, issueId]));
    handleToggleResolved(issueId, true);
    toast.success("Recommendation dismissed");
  };

  // ── Toggle issue resolved ──

  const handleToggleResolved = async (issueId: number, resolved: boolean) => {
    try {
      const res = await fetch(`/api/script-doctor/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResolved: resolved }),
      });

      if (!res.ok) {
        toast.error("Failed to update issue");
        return;
      }

      if (currentAnalysis) {
        setCurrentAnalysis({
          ...currentAnalysis,
          issues: currentAnalysis.issues.map((iss) =>
            iss.id === issueId ? { ...iss, isResolved: resolved ? 1 : 0 } : iss
          ),
        });
      }
    } catch {
      toast.error("Failed to update issue");
    }
  };

  // ── Delete analysis ──

  const handleDeleteAnalysis = async (id: number) => {
    try {
      const res = await fetch(`/api/script-doctor/analyses/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Analysis deleted");
        if (currentAnalysisId === id) {
          setCurrentAnalysis(null);
          setParsedResult(null);
          setCurrentAnalysisId(null);
          setPageView("new");
        }
        loadHistory();
      }
    } catch {
      toast.error("Failed to delete analysis");
    }
  };

  // ── Filter issues by severity, category, and search ──

  const filteredIssues = currentAnalysis?.issues.filter((iss) => {
    if (severityFilter !== "all" && iss.severity !== severityFilter) return false;
    if (categoryFilter !== "all" && iss.category !== categoryFilter) return false;
    if (issueSearch) {
      const q = issueSearch.toLowerCase();
      return (
        iss.description?.toLowerCase().includes(q) ||
        iss.recommendation?.toLowerCase().includes(q) ||
        iss.category?.toLowerCase().includes(q)
      );
    }
    return true;
  }) ?? [];

  // ── Issue counts by severity ──

  const issueCounts = {
    all: currentAnalysis?.issues.length ?? 0,
    critical: currentAnalysis?.issues.filter((i) => i.severity === "critical").length ?? 0,
    major: currentAnalysis?.issues.filter((i) => i.severity === "major").length ?? 0,
    minor: currentAnalysis?.issues.filter((i) => i.severity === "minor").length ?? 0,
    suggestion: currentAnalysis?.issues.filter((i) => i.severity === "suggestion").length ?? 0,
  };

  // ── Unique categories from current analysis ──
  const issueCategories = useMemo(() => {
    if (!currentAnalysis?.issues) return [];
    return [...new Set(currentAnalysis.issues.map((i) => i.category).filter(Boolean))];
  }, [currentAnalysis?.issues]);

  // ── Whether we have results to show ──
  const hasResults = parsedResult && currentAnalysis?.status === "completed" && !analyzing;

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resultsRef.current || !hasResults) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = resultsRef.current.querySelectorAll("[data-doctor-section]");
    if (sections.length === 0) return;
    gsap.from(sections, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [hasResults, currentAnalysisId]);

  // ── Format analysis type label ──

  const getTypeLabel = (type: string) => {
    const found = ANALYSIS_TYPES.find((at) => at.value === type);
    return found ? found.label : type;
  };

  // ── Render: History Sidebar ──

  function renderHistorySidebar() {
    return (
      <div className="w-full space-y-3">
        {/* New Analysis button at top of sidebar */}
        <Button
          onClick={() => {
            setPageView("new");
            setCurrentAnalysis(null);
            setParsedResult(null);
            setCurrentAnalysisId(null);
          }}
          className="w-full gap-2"
          variant={pageView === "new" ? "default" : "outline"}
          size="sm"
        >
          <Plus weight="bold" className="w-4 h-4" />
          New Analysis
        </Button>

        <Separator />

        {/* History heading */}
        <div className="flex items-center gap-2 px-1">
          <ClockCounterClockwise className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            History
          </h3>
          {!historyLoading && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {historyList.length} total
            </span>
          )}
        </div>

        {/* History list */}
        <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-2">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-2">
                <MagnifyingGlass className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                No analyses yet. Run your first one to get started.
              </p>
            </div>
          ) : (
            historyList.map((analysis) => {
              const isActive = currentAnalysisId === analysis.id && pageView === "detail";
              const score = extractScore(analysis);
              return (
                <button
                  key={analysis.id}
                  type="button"
                  onClick={() => loadAnalysis(analysis.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-all duration-300 group ${
                    isActive
                      ? "border-primary bg-primary/[0.04] shadow-[0_0_10px_oklch(0.585_0.233_264/0.1)]"
                      : "border-border/40 hover:border-primary/40 hover:bg-accent/40 hover:shadow-[0_0_10px_oklch(0.585_0.233_264/0.06)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {getTypeLabel(analysis.analysisType)}
                        </Badge>
                        <StatusBadge status={analysis.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-muted-foreground truncate">
                          {new Date(analysis.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {score !== null && (
                          <span className="text-[11px] font-semibold text-primary ml-auto shrink-0">
                            {score}/100
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete ${analysis.analysisType} analysis`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteAnalysisTarget(analysis.id);
                      }}
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Render: New Analysis Form ──

  function renderNewAnalysis() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">New Analysis</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Select an analysis type and let AI review your screenplay.
          </p>
        </div>

        {/* Analysis type grid */}
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ANALYSIS_TYPES.map((at) => {
            const isSelected = analysisType === at.value;
            const lastRun = lastRunByType[at.value];
            return (
              <button
                data-type-card
                key={at.value}
                type="button"
                disabled={analyzing}
                onClick={() => setAnalysisType(at.value)}
                className={`group relative text-left rounded-xl border-2 p-4 backdrop-blur-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  isSelected
                    ? "border-primary bg-primary/[0.04] shadow-[0_0_15px_oklch(0.585_0.233_264/0.12)]"
                    : "border-border/40 bg-card/80 hover:border-primary/40 hover:bg-accent/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)]"
                } ${analyzing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "bg-primary/10 text-muted-foreground group-hover:text-primary"
                    }`}
                  >
                    <AnalysisTypeIcon type={at.value} className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{at.label}</span>
                      <InfoTooltip text={at.tip} />
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                      {at.description}
                    </p>
                    {lastRun && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Last run: {new Date(lastRun).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Custom prompt textarea */}
        {analysisType === "custom" && (
          <div>
            <p className="text-sm font-medium mb-2">Custom Prompt</p>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter specific analysis instructions... e.g. 'Focus on the romantic subplot between characters A and B. Evaluate if the dialogue feels authentic and if their arc is satisfying.'"
              rows={3}
              disabled={analyzing}
            />
          </div>
        )}

        {/* Start Analysis Button -- uses semantic primary colors */}
        <Button
          onClick={handleStartAnalysis}
          disabled={analyzing}
          size="lg"
          className="w-full font-semibold text-base h-12 gap-2 shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300"
        >
          {analyzing ? (
            <>
              <Spinner className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Stethoscope weight="bold" className="w-5 h-5" />
              Start Analysis
            </>
          )}
        </Button>

        {/* Empty state hint */}
        {!analyzing && historyList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-primary/5 flex items-center justify-center mb-3">
              <FilmScript className="w-7 h-7 text-primary/60" />
            </div>
            <p className="text-sm font-medium mb-1">Your AI script consultant</p>
            <p className="text-[13px] text-muted-foreground text-center max-w-sm leading-relaxed">
              Select an analysis type above and discover insights about your screenplay.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Detail View (loading, error, or results) ──

  function renderDetailView() {
    return (
      <div className="space-y-5">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setPageView("new");
            setCurrentAnalysis(null);
            setParsedResult(null);
            setCurrentAnalysisId(null);
            setAnalyzing(false);
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Loading State */}
        {analyzing && (
          <Card className="backdrop-blur-sm bg-card/80 border-border/40 shadow-[0_0_20px_oklch(0.585_0.233_264/0.1)]">
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-2 shadow-[0_0_20px_oklch(0.585_0.233_264/0.2)] animate-pulse">
                <Spinner className="w-6 h-6 text-primary animate-spin" />
              </div>
              <p className="font-medium">Analyzing your screenplay...</p>
              <p className="text-sm text-muted-foreground">
                This may take 30-60 seconds depending on the length of your script.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {currentAnalysis?.status === "failed" && !analyzing && (
          <Card className="border-destructive/30">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 mb-3">
                <Warning weight="fill" className="w-5 h-5 text-destructive" />
              </div>
              <p className="font-medium text-destructive">
                Analysis Failed
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentAnalysis.error || "An unknown error occurred"}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setPageView("new");
                  setCurrentAnalysis(null);
                  setParsedResult(null);
                }}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {hasResults && (
          <div ref={resultsRef} className="space-y-5">
            {/* Overall Score + Logline */}
            <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center justify-center min-w-[80px]">
                    <span className="text-4xl font-bold" style={{ textShadow: '0 0 25px oklch(0.585 0.233 264 / 0.35)' }}>{parsedResult.overallScore}</span>
                    <span className="text-xs text-muted-foreground mt-1">Overall</span>
                  </div>
                  <Separator orientation="vertical" className="h-auto self-stretch" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{parsedResult.logline}</p>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {parsedResult.synopsis}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score Cards */}
            <div data-doctor-section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ScoreCard
                label="Structure"
                score={parsedResult.structure.score}
                loading={false}
              />
              <ScoreCard
                label="Pacing"
                score={parsedResult.pacing.score}
                loading={false}
              />
              <ScoreCard
                label="Characters"
                score={
                  parsedResult.characters.length > 0
                    ? Math.round(
                        parsedResult.characters.reduce(
                          (sum, c) => sum + c.arcScore,
                          0
                        ) / parsedResult.characters.length
                      )
                    : 0
                }
                loading={false}
              />
              <ScoreCard
                label="Dialogue"
                score={parsedResult.dialogue.score}
                loading={false}
              />
            </div>

            {/* Tension Curve */}
            {parsedResult.pacing.tensionCurve.length > 0 && (
              <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold mb-3">Tension Curve</h3>
                  <TensionChart data={parsedResult.pacing.tensionCurve} />
                  {parsedResult.pacing.notes && (
                    <p className="text-xs text-muted-foreground mt-3">
                      {parsedResult.pacing.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Issues */}
            <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Issues</h3>
                  <span className="text-xs text-muted-foreground">
                    {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Search + category filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search issues..."
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      className="w-full text-sm pl-8 pr-3 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  {issueCategories.length > 1 && (
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="text-xs px-2 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      <option value="all">All categories</option>
                      {issueCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>

                <Tabs
                  value={severityFilter}
                  onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
                >
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="all">
                      All ({issueCounts.all})
                    </TabsTrigger>
                    <TabsTrigger value="critical">
                      Critical ({issueCounts.critical})
                    </TabsTrigger>
                    <TabsTrigger value="major">
                      Major ({issueCounts.major})
                    </TabsTrigger>
                    <TabsTrigger value="minor">
                      Minor ({issueCounts.minor})
                    </TabsTrigger>
                    <TabsTrigger value="suggestion">
                      Suggestion ({issueCounts.suggestion})
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-3 space-y-3">
                    {filteredIssues.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {issueSearch
                          ? `No issues matching "${issueSearch}"`
                          : severityFilter === "all"
                            ? "No issues found - your script is looking great!"
                            : `No ${severityFilter} issues found.`}
                      </p>
                    ) : (
                      filteredIssues.map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          projectId={projectId}
                          onToggleResolved={handleToggleResolved}
                          onApply={handleApplyRecommendation}
                          onDismiss={handleDismiss}
                          isApplying={applyingIssueId === issue.id}
                          isDismissed={dismissedIds.has(issue.id)}
                        />
                      ))
                    )}
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Character Arcs */}
            {parsedResult.characters.length > 0 && (
              <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Character Arcs</h3>
                  <div className="space-y-3">
                    {parsedResult.characters.map((char) => (
                      <div key={char.name} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {char.name}
                            </span>
                            {char.hasArc ? (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                                Has Arc
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px]">
                                Flat Arc
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {char.arcScore}/100
                          </span>
                        </div>
                        <Progress value={char.arcScore} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {char.development}
                        </p>
                        {char.strengths.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {char.strengths.map((s, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] bg-primary/10 text-primary border-primary/20"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {char.weaknesses.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {char.weaknesses.map((w, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-[10px] bg-destructive/10 text-destructive border-destructive/20"
                              >
                                {w}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Themes */}
            {parsedResult.themes.identified.length > 0 && (
              <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Themes</h3>
                  <div className="space-y-3">
                    {parsedResult.themes.identified.map((theme, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Badge
                          variant="outline"
                          className={
                            theme.strength === "strong"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : theme.strength === "moderate"
                                ? "bg-muted text-muted-foreground border-border"
                                : "bg-muted text-muted-foreground border-muted"
                          }
                        >
                          {theme.strength}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{theme.theme}</p>
                          {theme.scenes.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Scenes: {theme.scenes.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {parsedResult.themes.notes && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {parsedResult.themes.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Mood & Color */}
            {parsedResult.moodAndColor && parsedResult.moodAndColor.scenes.length > 0 && (
              <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Mood & Color</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5 h-7"
                      onClick={() => {
                        const data = {
                          episode_anchor_mood: parsedResult.moodAndColor!.episodeAnchorMood,
                          scenes: parsedResult.moodAndColor!.scenes.map(s => ({
                            scene_number: s.sceneNumber,
                            dominant_mood: s.dominantMood,
                            recommended_brightness_percent: s.recommendedBrightnessPercent,
                            color_palette: s.colorPalette,
                            mood_notes: s.moodNotes,
                          })),
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `mood-color-${currentAnalysis?.id || "export"}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export JSON
                    </Button>
                  </div>

                  {/* Anchor Mood Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Episode Mood:</span>
                    <Badge className="bg-primary/15 text-primary border-primary/25 text-sm font-semibold capitalize shadow-[0_0_10px_oklch(0.585_0.233_264/0.2)]">
                      {parsedResult.moodAndColor.episodeAnchorMood}
                    </Badge>
                  </div>

                  {/* Per-scene mood pills */}
                  <div className="space-y-2">
                    {parsedResult.moodAndColor.scenes.map((scene) => (
                      <div key={scene.sceneNumber} className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/10 p-2.5">
                        <span className="text-[10px] font-mono text-muted-foreground w-6 shrink-0 text-right">
                          S{scene.sceneNumber}
                        </span>
                        <Badge variant="outline" className="text-[11px] capitalize shrink-0">
                          {scene.dominantMood}
                        </Badge>
                        {/* Color palette swatches */}
                        <div className="flex gap-1 shrink-0">
                          {scene.colorPalette.map((color, ci) => (
                            <div
                              key={ci}
                              className="w-5 h-5 rounded-sm border border-border/50"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                        {/* Brightness indicator */}
                        <div className="flex items-center gap-1.5 shrink-0" title={`Brightness: ${scene.recommendedBrightnessPercent}%`}>
                          <div className="w-12 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${scene.recommendedBrightnessPercent}%`,
                                background: `linear-gradient(90deg, oklch(0.4 0 0), oklch(0.95 0 0))`,
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-muted-foreground w-7">
                            {scene.recommendedBrightnessPercent}%
                          </span>
                        </div>
                        {/* Notes (truncated, shown on hover) */}
                        <p className="text-[10px] text-muted-foreground truncate min-w-0" title={scene.moodNotes}>
                          {scene.moodNotes}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Structure Details */}
            <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold">Structure Analysis</h3>

                {/* Act Breaks */}
                {parsedResult.structure.actBreaks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Act Breaks
                    </p>
                    {parsedResult.structure.actBreaks.map((ab) => (
                      <div
                        key={ab.act}
                        className="rounded-md bg-muted/50 p-3 text-sm"
                      >
                        <span className="font-semibold">Act {ab.act}</span>{" "}
                        <span className="text-muted-foreground">
                          (Scenes {ab.startsAtScene}-{ab.endsAtScene})
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {ab.assessment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key Moments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {parsedResult.structure.incitingIncident && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Inciting Incident
                      </p>
                      <p className="text-sm mt-1">
                        Scene {parsedResult.structure.incitingIncident.sceneId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parsedResult.structure.incitingIncident.assessment}
                      </p>
                    </div>
                  )}
                  {parsedResult.structure.midpoint && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Midpoint
                      </p>
                      <p className="text-sm mt-1">
                        Scene {parsedResult.structure.midpoint.sceneId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parsedResult.structure.midpoint.assessment}
                      </p>
                    </div>
                  )}
                  {parsedResult.structure.climax && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Climax
                      </p>
                      <p className="text-sm mt-1">
                        Scene {parsedResult.structure.climax.sceneId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parsedResult.structure.climax.assessment}
                      </p>
                    </div>
                  )}
                  {parsedResult.structure.resolution && (
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Resolution
                      </p>
                      <p className="text-sm mt-1">
                        Scene {parsedResult.structure.resolution.sceneId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {parsedResult.structure.resolution.assessment}
                      </p>
                    </div>
                  )}
                </div>

                {parsedResult.structure.notes && (
                  <p className="text-xs text-muted-foreground">
                    {parsedResult.structure.notes}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Dialogue Details */}
            <Card data-doctor-section className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Dialogue Analysis</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Voice Distinctness:
                    </span>
                    <span className="text-xs font-semibold">
                      {parsedResult.dialogue.voiceDistinctness}/100
                    </span>
                  </div>
                </div>

                {/* On-the-nose */}
                {parsedResult.dialogue.onTheNose.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      On-the-Nose Dialogue
                    </p>
                    {parsedResult.dialogue.onTheNose.map((item, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-destructive/5 border border-destructive/15 p-3 text-sm"
                      >
                        <span className="font-semibold">{item.character}:</span>{" "}
                        <span className="italic">&quot;{item.line}&quot;</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Highlights */}
                {parsedResult.dialogue.highlights.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Highlights
                    </p>
                    {parsedResult.dialogue.highlights.map((item, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-primary/5 border border-primary/15 p-3 text-sm"
                      >
                        <span className="font-semibold">{item.character}:</span>{" "}
                        <span className="italic">&quot;{item.line}&quot;</span>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {parsedResult.dialogue.notes && (
                  <p className="text-xs text-muted-foreground">
                    {parsedResult.dialogue.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ── Main Layout: sidebar + content ──

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Stethoscope weight="duotone" className="w-7 h-7 text-primary" />
          <h1 className="text-[28px] font-bold leading-tight">AI Script Doctor</h1>
        </div>
        <p className="text-[13px] text-muted-foreground ml-10">
          Professional-grade screenplay analysis powered by AI
        </p>
      </div>

      {/* Split Layout: Sidebar + Main Content */}
      <div className="flex gap-6">
        {/* Left Sidebar: History */}
        <aside className="hidden md:block w-[280px] shrink-0">
          <Card className="sticky top-6 backdrop-blur-sm bg-card/80 border-border/40">
            <CardContent className="p-4">
              {renderHistorySidebar()}
            </CardContent>
          </Card>
        </aside>

        {/* Mobile: History as collapsible section above content */}
        <div className="md:hidden w-full space-y-4">
          {/* Mobile history toggle -- always visible */}
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer rounded-lg border p-3 hover:bg-accent/40 transition-colors list-none">
              <div className="flex items-center gap-2">
                <ClockCounterClockwise className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Analysis History ({historyList.length})
                </span>
              </div>
              <svg
                className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </summary>
            <div className="mt-2 rounded-lg border p-3">
              {renderHistorySidebar()}
            </div>
          </details>

          {/* Mobile content */}
          {pageView === "new" ? renderNewAnalysis() : renderDetailView()}
        </div>

        {/* Desktop Main Content */}
        <main className="hidden md:block flex-1 min-w-0">
          {pageView === "new" ? renderNewAnalysis() : renderDetailView()}
        </main>
      </div>

      {/* Confirmation dialog for destructive analysis delete action */}
      <ConfirmDialog
        open={deleteAnalysisTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteAnalysisTarget(null); }}
        title="Delete analysis"
        description="This analysis and all its results will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteAnalysisTarget !== null) return handleDeleteAnalysis(deleteAnalysisTarget); }}
      />

      {/* Rewrite Options Modal */}
      <Dialog open={rewriteModalOpen} onOpenChange={setRewriteModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto backdrop-blur-md bg-card/95 border-border/40">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Choose a Rewrite Option
              {rewriteIssue && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  — {rewriteIssue.issue.title}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3 pt-2">
            {rewriteOptions.map((option, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/40 p-4 space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{option.label || `Option ${idx + 1}`}</h4>
                  <Badge variant="outline" className="text-[10px]">
                    {option.elements.length} elements
                  </Badge>
                </div>
                {option.synopsis && (
                  <p className="text-xs text-muted-foreground">{option.synopsis}</p>
                )}
                <div className="rounded-md bg-muted/30 p-3 max-h-48 overflow-y-auto text-xs space-y-1.5">
                  {option.elements.slice(0, 8).map((el, i) => (
                    <div key={i} className="text-muted-foreground">
                      {el.type === "dialogue" ? (
                        <div>
                          <span className="font-medium text-foreground">{el.character}</span>
                          {el.parenthetical && <span className="italic text-muted-foreground"> ({el.parenthetical})</span>}
                          <p className="pl-3 mt-0.5">{el.content || el.line}</p>
                        </div>
                      ) : (
                        <p className="italic">{el.content}</p>
                      )}
                    </div>
                  ))}
                  {option.elements.length > 8 && (
                    <p className="text-[10px] text-muted-foreground/60">+{option.elements.length - 8} more...</p>
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={() => handleSelectOption(idx)}
                  disabled={applyingOptionIdx !== null}
                >
                  {applyingOptionIdx === idx ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                        <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                      </svg>
                      Applying...
                    </>
                  ) : (
                    "Select this option"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
