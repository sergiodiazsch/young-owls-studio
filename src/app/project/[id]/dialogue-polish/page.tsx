"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { gsap } from "@/lib/gsap";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/info-tooltip";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type {
  Character,
  Scene,
  DialoguePolishJob,
  DialoguePolishResult,
} from "@/lib/types";

interface PolishResultWithScene extends DialoguePolishResult {
  sceneHeading: string;
  sceneNumber: number;
}

interface JobWithResults extends DialoguePolishJob {
  results: PolishResultWithScene[];
}

interface SceneGroup {
  sceneId: number;
  sceneHeading: string;
  sceneNumber: number;
  results: PolishResultWithScene[];
}

const DIRECTIVE_MAX_LENGTH = 500;

const PRESET_DIRECTIVES: { label: string; title: string }[] = [
  { label: "More sarcastic", title: "Adds irony, dry wit, and cutting remarks" },
  { label: "More formal", title: "Elevates register, removes contractions and slang" },
  { label: "Shorter sentences", title: "Punchy, direct lines. Removes filler words" },
  { label: "More emotional", title: "Amplifies vulnerability, passion, or raw feeling" },
  { label: "More restrained", title: "Character holds back, speaks carefully, leaves things unsaid" },
  { label: "Add subtext", title: "Says one thing, means another. Real meaning between the lines" },
];

export default function DialoguePolishPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Form state
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>("");
  const [directive, setDirective] = useState("");
  const [selectedSceneIds, setSelectedSceneIds] = useState<number[]>([]);
  const [sceneFilterMode, setSceneFilterMode] = useState<"all" | "selected">(
    "all"
  );

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  // polling managed by useEffect cleanup below

  // Review state
  const [activeJob, setActiveJob] = useState<JobWithResults | null>(null);
  const [sceneGroups, setSceneGroups] = useState<SceneGroup[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // History state
  const [jobs, setJobs] = useState<DialoguePolishJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // Scene selection dialog
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);

  // UX AUDIT FIX: confirmation dialog for job deletion
  const [deleteJobTarget, setDeleteJobTarget] = useState<{ id: number; characterName: string } | null>(null);

  // Loading state
  const [loadingChars, setLoadingChars] = useState(true);

  // GSAP animation refs
  const jobsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // GSAP stagger animation for job history cards
  useEffect(() => {
    if (!jobsRef.current || loadingJobs || jobs.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = jobsRef.current.querySelectorAll("[data-polish-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [loadingJobs, jobs.length]);

  // GSAP stagger animation for review results
  useEffect(() => {
    if (!resultsRef.current || !activeJob || sceneGroups.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = resultsRef.current.querySelectorAll("[data-result-card]");
    if (cards.length === 0) return;
    gsap.from(cards, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", clearProps: "all" });
  }, [activeJob?.id, sceneGroups.length]);

  // Fetch job history (also used for refresh after operations)
  const fetchJobs = useCallback((signal?: AbortSignal) => {
    fetch(`/api/dialogue-polish/jobs?projectId=${projectId}`, signal ? { signal } : undefined)
      .then((r) => r.json())
      .then((data: DialoguePolishJob[]) => {
        setJobs(data);
        setLoadingJobs(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load polish jobs");
        setLoadingJobs(false);
      });
  }, [projectId]);

  // Parallel fetch: characters, scenes, and jobs are all independent
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/characters?projectId=${projectId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/scenes?projectId=${projectId}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`/api/dialogue-polish/jobs?projectId=${projectId}`, { signal: controller.signal }).then((r) => r.json()),
    ])
      .then(([charData, sceneData, jobData]: [Character[], Scene[], DialoguePolishJob[]]) => {
        setCharacters(charData);
        setLoadingChars(false);
        setScenes(sceneData);
        setJobs(jobData);
        setLoadingJobs(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        toast.error("Failed to load page data");
        setLoadingChars(false);
        setLoadingJobs(false);
      });
    return () => controller.abort();
  }, [projectId]);

  // Poll for job progress with exponential backoff
  useEffect(() => {
    if (!activeJobId) return;

    let delay = 2000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/dialogue-polish/jobs/${activeJobId}`);
        const data: JobWithResults = await res.json();

        if (cancelled) return;

        if (data.status === "review" || data.status === "failed") {
          setIsProcessing(false);
          setActiveJobId(null);
          if (data.status === "review") {
            setActiveJob(data);
            groupResults(data.results);
            toast.success(
              `Polish complete! ${data.processedDialogues} dialogues rewritten.`
            );
          } else {
            toast.error(`Polish failed: ${data.error || "Unknown error"}`);
          }
          fetchJobs();
          return;
        }
      } catch {
        // keep polling
      }
      if (!cancelled) {
        delay = Math.min(delay * 2, 30000);
        timeoutId = setTimeout(poll, delay);
      }
    };

    timeoutId = setTimeout(poll, delay);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [activeJobId, fetchJobs]);

  function groupResults(results: PolishResultWithScene[]) {
    const grouped: Record<number, SceneGroup> = {};
    for (const r of results) {
      if (!grouped[r.sceneId]) {
        grouped[r.sceneId] = {
          sceneId: r.sceneId,
          sceneHeading: r.sceneHeading,
          sceneNumber: r.sceneNumber,
          results: [],
        };
      }
      grouped[r.sceneId].results.push(r);
    }
    setSceneGroups(
      Object.values(grouped).sort((a, b) => a.sceneNumber - b.sceneNumber)
    );
  }

  async function handleStartPolish() {
    if (!selectedCharacterId || !directive.trim()) {
      toast.error("Select a character and enter a directive");
      return;
    }

    setIsProcessing(true);

    try {
      const body: {
        projectId: number;
        characterId: number;
        directive: string;
        sceneIds?: number[];
      } = {
        projectId: Number(projectId),
        characterId: Number(selectedCharacterId),
        directive: directive.trim(),
      };

      if (sceneFilterMode === "selected" && selectedSceneIds.length > 0) {
        body.sceneIds = selectedSceneIds;
      }

      const res = await fetch("/api/dialogue-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to start polish");
        setIsProcessing(false);
        return;
      }

      // If the server returns immediately (synchronous processing completed)
      // fetch the job to check status
      const jobRes = await fetch(`/api/dialogue-polish/jobs/${data.id}`);
      const jobData: JobWithResults = await jobRes.json();

      if (jobData.status === "review") {
        setIsProcessing(false);
        setActiveJob(jobData);
        groupResults(jobData.results);
        toast.success(
          `Polish complete! ${jobData.processedDialogues} dialogues rewritten.`
        );
        fetchJobs();
      } else if (jobData.status === "failed") {
        setIsProcessing(false);
        toast.error(`Polish failed: ${jobData.error || "Unknown error"}`);
        fetchJobs();
      } else {
        // Still processing, start polling
        setActiveJobId(data.id);
      }
    } catch {
      toast.error("Failed to start polish");
      setIsProcessing(false);
    }
  }

  async function handleResultStatus(
    resultId: number,
    status: "accepted" | "rejected"
  ) {
    try {
      await fetch(`/api/dialogue-polish/results/${resultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      // Update local state
      setSceneGroups((prev) =>
        prev.map((group) => ({
          ...group,
          results: group.results.map((r) =>
            r.id === resultId ? { ...r, status } : r
          ),
        }))
      );

      if (activeJob) {
        const prevResult = activeJob.results.find((r) => r.id === resultId);
        const prevStatus = prevResult?.status;
        let acceptedDelta = 0;
        let rejectedDelta = 0;

        if (prevStatus === "accepted") acceptedDelta--;
        if (prevStatus === "rejected") rejectedDelta--;
        if (status === "accepted") acceptedDelta++;
        if (status === "rejected") rejectedDelta++;

        setActiveJob((prev) =>
          prev
            ? {
                ...prev,
                acceptedDialogues: (prev.acceptedDialogues ?? 0) + acceptedDelta,
                rejectedDialogues: (prev.rejectedDialogues ?? 0) + rejectedDelta,
                results: prev.results.map((r) =>
                  r.id === resultId ? { ...r, status } : r
                ),
              }
            : null
        );
      }
    } catch {
      toast.error("Failed to update result");
    }
  }

  async function handleAcceptAll() {
    if (!activeJob) return;
    try {
      await fetch(`/api/dialogue-polish/jobs/${activeJob.id}/accept-all`, {
        method: "POST",
      });

      setSceneGroups((prev) =>
        prev.map((group) => ({
          ...group,
          results: group.results.map((r) => ({ ...r, status: "accepted" })),
        }))
      );
      setActiveJob((prev) =>
        prev
          ? {
              ...prev,
              acceptedDialogues: prev.totalDialogues,
              rejectedDialogues: 0,
              results: prev.results.map((r) => ({
                ...r,
                status: "accepted",
              })),
            }
          : null
      );
      toast.success("All results accepted");
    } catch {
      toast.error("Failed to accept all");
    }
  }

  async function handleRejectAll() {
    if (!activeJob) return;
    try {
      await fetch(`/api/dialogue-polish/jobs/${activeJob.id}/reject-all`, {
        method: "POST",
      });

      setSceneGroups((prev) =>
        prev.map((group) => ({
          ...group,
          results: group.results.map((r) => ({ ...r, status: "rejected" })),
        }))
      );
      setActiveJob((prev) =>
        prev
          ? {
              ...prev,
              acceptedDialogues: 0,
              rejectedDialogues: prev.totalDialogues,
              results: prev.results.map((r) => ({
                ...r,
                status: "rejected",
              })),
            }
          : null
      );
      toast.success("All results rejected");
    } catch {
      toast.error("Failed to reject all");
    }
  }

  async function handleApply() {
    if (!activeJob) return;

    const acceptedCount =
      activeJob.results.filter((r) => r.status === "accepted").length ||
      activeJob.acceptedDialogues;

    if (acceptedCount === 0) {
      toast.error("No accepted rewrites to apply");
      return;
    }

    try {
      const res = await fetch(
        `/api/dialogue-polish/jobs/${activeJob.id}/apply`,
        { method: "POST" }
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to apply");
        return;
      }

      setActiveJob((prev) => (prev ? { ...prev, status: "applied" } : null));
      toast.success(`Applied ${data.appliedCount} rewrites to screenplay`);
      fetchJobs();
    } catch {
      toast.error("Failed to apply rewrites");
    }
  }

  async function handleLoadJob(jobId: number) {
    try {
      const res = await fetch(`/api/dialogue-polish/jobs/${jobId}`);
      const data: JobWithResults = await res.json();
      setActiveJob(data);
      groupResults(data.results);
    } catch {
      toast.error("Failed to load job");
    }
  }

  // UX AUDIT FIX: confirmation now handled by ConfirmDialog, removed native confirm()
  async function handleDeleteJob(jobId: number) {
    try {
      await fetch(`/api/dialogue-polish/jobs/${jobId}`, { method: "DELETE" });
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      if (activeJob?.id === jobId) {
        setActiveJob(null);
        setSceneGroups([]);
      }
      toast.success("Job deleted");
    } catch {
      toast.error("Failed to delete job");
    }
  }

  function toggleSceneSelection(sceneId: number) {
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId)
        ? prev.filter((id) => id !== sceneId)
        : [...prev, sceneId]
    );
  }

  // Compute accepted count from scene groups for display
  const acceptedCount = sceneGroups.reduce(
    (sum, g) => sum + g.results.filter((r) => r.status === "accepted").length,
    0
  );

  // Filtered scene groups
  const filteredGroups =
    statusFilter === "all"
      ? sceneGroups
      : sceneGroups
          .map((g) => ({
            ...g,
            results: g.results.filter((r) => r.status === statusFilter),
          }))
          .filter((g) => g.results.length > 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dialogue Polish
        </h1>
        <p className="text-muted-foreground mt-1">
          Rewrite character dialogue with AI-powered voice directives
        </p>
      </div>

      {/* Configuration Card */}
      <Card className="backdrop-blur-sm bg-card/80 border-border/40">
        <CardContent className="p-6 space-y-5">
          {/* UX AUDIT FIX: replaced raw <label> with <Label> for proper semantics */}
          <div className="space-y-2">
            <Label>Character<InfoTooltip text="Only this character's lines will be rewritten. Others stay untouched." /></Label>
            <Select
              value={selectedCharacterId}
              onValueChange={setSelectedCharacterId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a character..." />
              </SelectTrigger>
              <SelectContent>
                {loadingChars ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Loading characters...
                  </div>
                ) : characters.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No characters found. Parse a screenplay first.
                  </div>
                ) : (
                  characters.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ({c.dialogueCount} line
                        {c.dialogueCount !== 1 ? "s" : ""})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Directive text */}
          <div className="space-y-2">
            {/* UX AUDIT FIX: replaced raw <label> with <Label> for accessible form styling */}
            <Label>Directive<InfoTooltip text="How the dialogue should change. Be specific: 'more sarcastic with shorter sentences.'" /></Label>
            <Textarea
              value={directive}
              onChange={(e) => {
                if (e.target.value.length <= DIRECTIVE_MAX_LENGTH) {
                  setDirective(e.target.value);
                }
              }}
              placeholder="Describe how the dialogue should change... e.g. 'Make the dialogue more sarcastic and world-weary, with shorter quips'"
              rows={3}
              maxLength={DIRECTIVE_MAX_LENGTH}
            />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_DIRECTIVES.map((preset) => {
                  const isActive = directive.trim().toLowerCase() === preset.label.toLowerCase();
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setDirective(preset.label)}
                      title={preset.title}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all duration-300 ${
                        isActive
                          ? "bg-primary/15 text-primary border-primary/40 font-medium shadow-[0_0_8px_oklch(0.585_0.233_264/0.15)]"
                          : "bg-background hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <span className={`text-xs tabular-nums shrink-0 ml-2 ${
                directive.length >= DIRECTIVE_MAX_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}>
                {directive.length} / {DIRECTIVE_MAX_LENGTH}
              </span>
            </div>
          </div>

          {/* Scene filter */}
          <div className="space-y-2">
            {/* UX AUDIT FIX: replaced raw <label> with <Label> for accessible form styling */}
            <Label>Scenes<InfoTooltip text="Rewrite across all scenes or only in selected scenes." /></Label>
            <div className="flex items-center gap-3">
              <Select
                value={sceneFilterMode}
                onValueChange={(v) =>
                  setSceneFilterMode(v as "all" | "selected")
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scenes</SelectItem>
                  <SelectItem value="selected">Selected scenes</SelectItem>
                </SelectContent>
              </Select>
              {sceneFilterMode === "selected" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSceneDialogOpen(true)}
                >
                  Choose Scenes
                  {selectedSceneIds.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5">
                      {selectedSceneIds.length}
                    </Badge>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Start button */}
          <Button
            onClick={handleStartPolish}
            disabled={isProcessing || !selectedCharacterId || !directive.trim()}
            className="w-full shadow-[0_0_15px_oklch(0.585_0.233_264/0.2)] hover:shadow-[0_0_25px_oklch(0.585_0.233_264/0.3)] transition-all duration-300"
            size="lg"
          >
            {isProcessing ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="mr-2 animate-spin"
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="mr-2"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Start Polish
              </>
            )}
          </Button>

          {/* Progress bar during processing */}
          {isProcessing && activeJobId && (
            <div className="space-y-2">
              <div className="relative">
                <Progress value={0} className="h-2" />
                <div className="absolute inset-0 h-2 rounded-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Rewriting dialogues with Claude... This may take a moment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Section */}
      {activeJob && activeJob.results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Review Rewrites for {activeJob.characterName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Directive: &ldquo;{activeJob.directive}&rdquo;
                {" -- "}
                {activeJob.results.length} rewrite
                {activeJob.results.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={activeJob.status} />
            </div>
          </div>

          {/* Bulk actions bar */}
          {activeJob.status !== "applied" && (
            <Card className="backdrop-blur-sm bg-card/80 border-border/40">
              <CardContent className="p-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcceptAll}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mr-1.5"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Accept All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRejectAll}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mr-1.5"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Reject All
                </Button>

                <Separator orientation="vertical" className="h-6" />

                {/* Status filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                <Button
                  onClick={handleApply}
                  disabled={acceptedCount === 0 || activeJob.status === "applied"}
                  size="sm"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mr-1.5"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Apply {acceptedCount} Accepted Rewrite
                  {acceptedCount !== 1 ? "s" : ""}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Results grouped by scene */}
          <div ref={resultsRef} className="space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.sceneId} className="space-y-3" data-result-card>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    Scene {group.sceneNumber}
                  </Badge>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {group.sceneHeading}
                  </h3>
                </div>

                {group.results.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    isApplied={activeJob.status === "applied"}
                    onAccept={() => handleResultStatus(result.id, "accepted")}
                    onReject={() => handleResultStatus(result.id, "rejected")}
                  />
                ))}
              </div>
            ))}
          </div>

          {filteredGroups.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No results match the current filter.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Job History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Job History</h2>
        {loadingJobs ? (
          // WOW AUDIT: enhanced loading state with skeleton cards matching job list layout
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-24 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
                      <div className="h-5 w-16 bg-accent dark:bg-white/[0.06] animate-pulse rounded-full" data-slot="skeleton" />
                    </div>
                    <div className="h-3 w-48 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
                    <div className="h-3 w-32 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md" data-slot="skeleton" />
                  </div>
                  <div className="h-8 w-8 bg-accent dark:bg-white/[0.06] animate-pulse rounded-md shrink-0" data-slot="skeleton" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          // WOW AUDIT: enhanced empty job history with icon, radial gradient, and text hierarchy
          <Card className="border-dashed border-2">
            <CardContent className="relative flex flex-col items-center justify-center py-16 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
              <div className="relative w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/5 dark:glow-md animate-float flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="relative text-lg font-semibold mb-1">No polish jobs yet</h3>
              <p className="relative text-sm text-muted-foreground text-center max-w-sm">
                Select a character and directive above to start your first dialogue polish.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div ref={jobsRef} className="space-y-2">
            {jobs.map((job) => (
              <Card
                key={job.id}
                data-polish-card
                className={`cursor-pointer backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300 ${activeJob?.id === job.id ? "ring-2 ring-primary/30 shadow-[0_0_12px_oklch(0.585_0.233_264/0.12)]" : ""}`}
                onClick={() => handleLoadJob(job.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {job.characterName}
                      </span>
                      <StatusBadge status={job.status} />
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        {new Date(job.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate italic">
                      &ldquo;{job.directive}&rdquo;
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {job.totalDialogues} dialogue
                        {job.totalDialogues !== 1 ? "s" : ""}
                      </Badge>
                      {(job.acceptedDialogues ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
                          {job.acceptedDialogues} accepted
                        </Badge>
                      )}
                      {(job.rejectedDialogues ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] font-normal text-red-600 dark:text-red-400 border-red-300 dark:border-red-700">
                          {job.rejectedDialogues} rejected
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* UX AUDIT FIX: delete uses ConfirmDialog instead of direct deletion */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete polish job for ${job.characterName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteJobTarget({ id: job.id, characterName: job.characterName });
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* UX AUDIT FIX: confirmation dialog for destructive job delete action */}
      <ConfirmDialog
        open={deleteJobTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteJobTarget(null); }}
        title="Delete polish job"
        description={`This will permanently delete the polish job${deleteJobTarget?.characterName ? ` for "${deleteJobTarget.characterName}"` : ""} and all its results. This action cannot be undone.`}
        confirmLabel="Delete Job"
        onConfirm={() => { if (deleteJobTarget !== null) return handleDeleteJob(deleteJobTarget.id); }}
      />

      {/* Scene Selection Dialog */}
      <Dialog open={sceneDialogOpen} onOpenChange={setSceneDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Select Scenes</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 overflow-y-auto max-h-[50vh] pr-1">
            {scenes.map((scene) => {
              const isSelected = selectedSceneIds.includes(scene.id);
              return (
                <button
                  key={scene.id}
                  onClick={() => toggleSceneSelection(scene.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-3 transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-accent border border-transparent"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono mr-1.5"
                    >
                      {scene.sceneNumber}
                    </Badge>
                    <span className="truncate">{scene.heading}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center pt-2">
            <p className="text-xs text-muted-foreground">
              {selectedSceneIds.length} scene
              {selectedSceneIds.length !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSceneIds([])}
              >
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSceneIds(scenes.map((s) => s.id))}
              >
                Select All
              </Button>
              <Button size="sm" onClick={() => setSceneDialogOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Sub-components ----

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    pending: { label: "Pending", variant: "secondary" },
    review: { label: "In Review", variant: "default" },
    applied: { label: "Applied", variant: "outline" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const c = config[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function ResultStatusBadge({ status }: { status: string }) {
  if (status === "accepted") {
    return (
      <Badge
        variant="outline"
        className="text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
      >
        Accepted
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-700"
      >
        Rejected
      </Badge>
    );
  }
  return <Badge variant="secondary">Pending</Badge>;
}

function ResultCard({
  result,
  isApplied,
  onAccept,
  onReject,
}: {
  result: PolishResultWithScene;
  isApplied: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isChanged =
    result.originalLine !== result.rewrittenLine ||
    result.originalParenthetical !== result.rewrittenParenthetical;

  return (
    <Card
      className={`backdrop-blur-sm bg-card/80 border-border/40 hover:-translate-y-0.5 hover:shadow-[0_0_15px_oklch(0.585_0.233_264/0.1)] transition-all duration-300 ${
        result.status === "accepted"
          ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10"
          : result.status === "rejected"
            ? "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10 opacity-60"
            : ""
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <ResultStatusBadge status={result.status} />
          {!isChanged && (
            <Badge variant="outline" className="text-xs">
              Unchanged
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Original */}
          <div className="space-y-1 border-l-2 border-muted pl-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Original
            </p>
            {result.originalParenthetical && (
              <p className="text-xs text-muted-foreground italic">
                {result.originalParenthetical}
              </p>
            )}
            <p className="text-sm leading-relaxed">{result.originalLine}</p>
          </div>

          {/* Rewritten */}
          <div className="space-y-1 border-l-2 border-primary pl-3 shadow-[inset_0_0_10px_oklch(0.585_0.233_264/0.03)]">
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">
              Rewritten
            </p>
            {result.rewrittenParenthetical && (
              <p className="text-xs text-primary/70 italic">
                {result.rewrittenParenthetical}
              </p>
            )}
            <p className="text-sm leading-relaxed font-medium">
              {result.rewrittenLine}
            </p>
          </div>
        </div>

        {/* Rationale */}
        {result.changeRationale && (
          <p className="text-xs text-muted-foreground bg-muted/50 backdrop-blur-sm rounded-md px-3 py-2">
            <span className="font-medium">Rationale:</span>{" "}
            {result.changeRationale}
          </p>
        )}

        {/* Accept / Reject buttons */}
        {!isApplied && (
          <div className="flex gap-2">
            <Button
              variant={result.status === "accepted" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={onAccept}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="mr-1"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Accept
            </Button>
            <Button
              variant={result.status === "rejected" ? "destructive" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={onReject}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="mr-1"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
