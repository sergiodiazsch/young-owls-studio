"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  assetType: "character" | "location" | "prop";
  entityId: number;
  projectId: number;
  name: string;
  description?: string | null;
  thumbnailPath?: string | null;
}

export function ShareAssetToggle({ assetType, entityId, projectId, name, description, thumbnailPath }: Props) {
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/shared-assets/check?assetType=${assetType}&sourceEntityId=${entityId}`);
      if (res.ok) {
        const data = await res.json();
        setShared(data.shared);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [assetType, entityId]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  async function toggle() {
    setToggling(true);
    try {
      if (shared) {
        const res = await fetch(`/api/shared-assets?type=${assetType}&entityId=${entityId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setShared(false);
        toast.success("Removed from library");
      } else {
        const res = await fetch("/api/shared-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetType,
            sourceProjectId: projectId,
            sourceEntityId: entityId,
            name,
            description: description || undefined,
            thumbnailPath: thumbnailPath || undefined,
          }),
        });
        if (!res.ok) throw new Error();
        setShared(true);
        toast.success("Shared to library");
      }
    } catch {
      toast.error("Failed to update sharing");
    }
    setToggling(false);
  }

  if (loading) return null;

  return (
    <Button
      variant={shared ? "secondary" : "outline"}
      size="sm"
      className={`text-xs gap-1.5 transition-all ${shared ? "border-primary/40 text-primary" : ""}`}
      onClick={toggle}
      disabled={toggling}
    >
      {toggling ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          {shared ? (
            <>
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </>
          ) : (
            <>
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </>
          )}
        </svg>
      )}
      {shared ? "Shared" : "Share to Library"}
    </Button>
  );
}
