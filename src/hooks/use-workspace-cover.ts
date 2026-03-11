"use client";

import { useState, useCallback, useEffect } from "react";

export interface WorkspaceCover {
  imageUrl: string;
  overlayEnabled: boolean;
  overlayColor: string;
  overlayOpacity: number;
  textColor: string;
}

const STORAGE_KEY = "workspace-cover";

const DEFAULT_COVER: WorkspaceCover = {
  imageUrl: "",
  overlayEnabled: true,
  overlayColor: "#000000",
  overlayOpacity: 0.5,
  textColor: "#ffffff",
};

export function useWorkspaceCover() {
  const [cover, setCover] = useState<WorkspaceCover>(DEFAULT_COVER);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = { ...DEFAULT_COVER, ...JSON.parse(raw) };
        queueMicrotask(() => { setCover(parsed); setLoaded(true); });
      } else {
        queueMicrotask(() => setLoaded(true));
      }
    } catch {
      // ignore
      queueMicrotask(() => setLoaded(true));
    }
  }, []);

  const update = useCallback((partial: Partial<WorkspaceCover>) => {
    setCover((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage full
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setCover(DEFAULT_COVER);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const hasCover = loaded && cover.imageUrl.length > 0;

  return { cover, hasCover, loaded, update, clear };
}
