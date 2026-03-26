"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface SharedAsset {
  id: number;
  asset_type: string;
  source_project_id: number;
  source_entity_id: number;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  metadata: string | null;
  shared_at: string;
  project_title?: string;
}

const TYPE_LABELS: Record<string, string> = {
  character: "Character",
  location: "Location",
  prop: "Prop",
};

const TYPE_COLORS: Record<string, string> = {
  character: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  location: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  prop: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function LibraryPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<number | null>(null);
  const [imported, setImported] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>("all");

  const fetchAssets = useCallback(async () => {
    try {
      const url = filter === "all"
        ? `/api/shared-assets`
        : `/api/shared-assets?type=${filter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data: SharedAsset[] = await res.json();
      // Exclude assets from current project
      setAssets(data.filter((a) => a.source_project_id !== Number(projectId)));
    } catch {
      toast.error("Failed to load library");
    }
    setLoading(false);
  }, [filter, projectId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  async function handleImport(asset: SharedAsset) {
    setImporting(asset.id);
    try {
      const res = await fetch("/api/shared-assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedAssetId: asset.id,
          targetProjectId: Number(projectId),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        throw new Error(err.error);
      }
      setImported((prev) => new Set([...prev, asset.id]));
      toast.success(`${asset.name} imported as ${TYPE_LABELS[asset.asset_type] || asset.asset_type}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    }
    setImporting(null);
  }

  const filtered = assets;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Asset Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import shared characters, locations, and props from other projects.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "character", "location", "prop"].map((t) => (
          <Button
            key={t}
            variant={filter === t ? "default" : "outline"}
            size="sm"
            className="text-xs capitalize"
            onClick={() => setFilter(t)}
          >
            {t === "all" ? "All" : `${TYPE_LABELS[t]}s`}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/40 p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground mb-4">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <p className="text-sm text-muted-foreground">No shared assets available</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Share characters or locations from any project to see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => {
            const isImported = imported.has(asset.id);
            const isImporting = importing === asset.id;
            return (
              <Card
                key={asset.id}
                className={`border-border/40 backdrop-blur-sm bg-card/60 transition-all ${
                  isImported ? "opacity-60" : "hover:border-border/60"
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{asset.name}</h3>
                      {asset.project_title && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          from {asset.project_title}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${TYPE_COLORS[asset.asset_type] || ""}`}
                    >
                      {TYPE_LABELS[asset.asset_type] || asset.asset_type}
                    </Badge>
                  </div>

                  {asset.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
                  )}

                  {asset.thumbnail_path && (
                    <div className="aspect-video rounded-md overflow-hidden bg-black/20 border border-border/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/storage/${asset.thumbnail_path}`}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    variant={isImported ? "secondary" : "default"}
                    disabled={isImported || isImporting}
                    onClick={() => handleImport(asset)}
                  >
                    {isImporting ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                        </svg>
                        Importing...
                      </>
                    ) : isImported ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                        </svg>
                        Imported
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Import to Project
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
