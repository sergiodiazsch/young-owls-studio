"use client";

import { useState, useCallback } from "react";

/** 1 = largest thumbnails, 5 = smallest thumbnails (more per row) */
export type GallerySize = 1 | 2 | 3 | 4 | 5;

const STORAGE_KEY = "gallery-size";
const DEFAULT_SIZE: GallerySize = 3;

/** Grid column classes indexed by size (1–5) for each content type */
export const GRID_COLS = {
  video: {
    1: "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2",
    2: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    3: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    4: "grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7",
    5: "grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9",
  },
  image: {
    1: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
    2: "grid-cols-2 md:grid-cols-3 lg:grid-cols-3",
    3: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    4: "grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
    5: "grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10",
  },
  camera: {
    1: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
    2: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    3: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
    4: "grid-cols-5 sm:grid-cols-7 md:grid-cols-9 lg:grid-cols-12",
    5: "grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-14",
  },
} as const;

function isValidSize(v: unknown): v is GallerySize {
  return typeof v === "number" && v >= 1 && v <= 5;
}

export function useGallerySize(defaultSize: GallerySize = DEFAULT_SIZE): [GallerySize, (size: GallerySize) => void] {
  const [size, setSize] = useState<GallerySize>(() => {
    if (typeof window === "undefined") return defaultSize;
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return isValidSize(stored) ? stored : defaultSize;
  });

  const updateSize = useCallback((newSize: GallerySize) => {
    setSize(newSize);
    localStorage.setItem(STORAGE_KEY, String(newSize));
  }, []);

  return [size, updateSize];
}
