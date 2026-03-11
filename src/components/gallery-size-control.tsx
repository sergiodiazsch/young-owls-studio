"use client";

import type { GallerySize } from "@/hooks/use-gallery-size";

export function GallerySizeControl({
  value,
  onChange,
}: {
  value: GallerySize;
  onChange: (size: GallerySize) => void;
}) {
  return (
    <div className="flex items-center gap-2" aria-label="Thumbnail size">
      {/* Large icon */}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground shrink-0">
        <rect x="1" y="1" width="14" height="14" rx="2" />
      </svg>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as GallerySize)}
        className="w-20 h-1 accent-primary cursor-pointer"
        aria-label="Thumbnail size"
      />
      {/* Small grid icon */}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground shrink-0">
        <rect x="1" y="1" width="4" height="4" rx="0.5" />
        <rect x="6" y="1" width="4" height="4" rx="0.5" />
        <rect x="11" y="1" width="4" height="4" rx="0.5" />
        <rect x="1" y="6" width="4" height="4" rx="0.5" />
        <rect x="6" y="6" width="4" height="4" rx="0.5" />
        <rect x="11" y="6" width="4" height="4" rx="0.5" />
        <rect x="1" y="11" width="4" height="4" rx="0.5" />
        <rect x="6" y="11" width="4" height="4" rx="0.5" />
        <rect x="11" y="11" width="4" height="4" rx="0.5" />
      </svg>
    </div>
  );
}
