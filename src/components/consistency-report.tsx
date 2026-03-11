"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ConsistencyCheck {
  id: number;
  entity_type: string;
  entity_name: string;
  image_a_path: string;
  image_b_path: string;
  result: string;
  reason: string | null;
  checked_at: string;
}

interface Props {
  projectId: string;
}

export function ConsistencyReport({ projectId }: Props) {
  const [checks, setChecks] = useState<ConsistencyCheck[]>([]);
  const [total, setTotal] = useState(0);
  const [inconsistentCount, setInconsistentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/consistency-check?projectId=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setChecks(data.checks || []);
      setTotal(data.total || 0);
      setInconsistentCount(data.inconsistentCount || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function runCheck() {
    setRunning(true);
    toast.info("Running visual consistency check...");
    try {
      const res = await fetch("/api/consistency-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(projectId) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(data.message || "Consistency check complete");
      fetchReport();
    } catch {
      toast.error("Consistency check failed");
    }
    setRunning(false);
  }

  const inconsistent = checks.filter((c) => c.result === "inconsistent");

  if (loading) return null;

  // Only show if there are checks or if we can run them
  return (
    <Card className="border-border/40 backdrop-blur-sm bg-card/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4" />
            </svg>
            <h3 className="text-sm font-semibold">Visual Consistency</h3>
            {total > 0 && (
              <Badge
                variant="outline"
                className={inconsistentCount > 0
                  ? "bg-destructive/10 text-destructive border-destructive/20 text-[10px]"
                  : "bg-primary/10 text-primary border-primary/20 text-[10px]"
                }
              >
                {inconsistentCount > 0
                  ? `${inconsistentCount} issue${inconsistentCount > 1 ? "s" : ""}`
                  : "All consistent"
                }
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={runCheck}
            disabled={running}
          >
            {running ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                Checking...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Run Check
              </>
            )}
          </Button>
        </div>

        {total > 0 && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{total} pairs checked</span>
            <span>{checks.filter((c) => c.result === "consistent").length} consistent</span>
            {inconsistentCount > 0 && (
              <span className="text-destructive">{inconsistentCount} inconsistent</span>
            )}
          </div>
        )}

        {inconsistent.length > 0 && (
          <div className="space-y-2">
            {inconsistent.map((check) => (
              <div
                key={check.id}
                className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] capitalize bg-destructive/10 text-destructive border-destructive/20">
                    {check.entity_type}
                  </Badge>
                  <span className="text-xs font-medium">{check.entity_name}</span>
                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                    Inconsistent
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/storage/${check.image_a_path}`}
                    alt="Image A"
                    className="rounded-md aspect-square object-cover w-full border border-border/30"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/storage/${check.image_b_path}`}
                    alt="Image B"
                    className="rounded-md aspect-square object-cover w-full border border-border/30"
                  />
                </div>
                {check.reason && (
                  <p className="text-[11px] text-muted-foreground">{check.reason}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {total === 0 && !running && (
          <p className="text-xs text-muted-foreground">
            No consistency data yet. Generate images first, then run a check.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
