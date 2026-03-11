"use client";

import { useTheme } from "@/lib/theme";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { GitBranch } from "@phosphor-icons/react/dist/csr/GitBranch";
import { FilmScript } from "@phosphor-icons/react/dist/csr/FilmScript";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { FolderOpen } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { Layout } from "@phosphor-icons/react/dist/csr/Layout";
import { Palette } from "@phosphor-icons/react/dist/csr/Palette";
import { BracketsSquare } from "@phosphor-icons/react/dist/csr/BracketsSquare";
import { Sparkle } from "@phosphor-icons/react/dist/csr/Sparkle";
import { Aperture } from "@phosphor-icons/react/dist/csr/Aperture";
import { VideoCamera } from "@phosphor-icons/react/dist/csr/VideoCamera";
import { Waveform } from "@phosphor-icons/react/dist/csr/Waveform";
import { ArrowsOut } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { FilmStrip } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { Stethoscope } from "@phosphor-icons/react/dist/csr/Stethoscope";
import { ChatText } from "@phosphor-icons/react/dist/csr/ChatText";
import { Rows } from "@phosphor-icons/react/dist/csr/Rows";
import { CurrencyDollar } from "@phosphor-icons/react/dist/csr/CurrencyDollar";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Package } from "@phosphor-icons/react/dist/csr/Package";
import { ShareNetwork } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { Slideshow } from "@phosphor-icons/react/dist/csr/Slideshow";
import type { IconWeight } from "@phosphor-icons/react/dist/lib/types";

const PHOSPHOR_MAP: Record<string, React.ComponentType<{ size?: number; weight?: IconWeight }>> = {
  grid: SquaresFour,
  upload: UploadSimple,
  versions: GitBranch,
  scenes: FilmScript,
  users: UsersThree,
  locations: MapPin,
  props: Package,
  drive: FolderOpen,
  moodboards: Layout,
  colorscript: Palette,
  snippets: BracketsSquare,
  generate: Sparkle,
  cameraangles: Aperture,
  video: VideoCamera,
  audio: Waveform,
  upscale: ArrowsOut,
  videoeditor: FilmStrip,
  scriptdoctor: Stethoscope,
  dialoguepolish: ChatText,
  breakdown: Rows,
  budget: CurrencyDollar,
  timeline: SlidersHorizontal,
  shared: ShareNetwork,
  present: Slideshow,
};

const LUCIDE_ICONS: Record<string, React.ReactNode> = {
  grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 10V2M8 2L5 5M8 2L11 5" />
      <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" />
    </svg>
  ),
  scenes: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <path d="M5 5h6M5 8h4M5 11h5" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.5 2-4.5 5-4.5s5 2 5 4.5" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M12 9.5c2 .5 3.5 2 3.5 4.5" />
    </svg>
  ),
  drive: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4a1 1 0 011-1h4l2 2h5a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
    </svg>
  ),
  snippets: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 3h8a1 1 0 011 1v8a1 1 0 01-1 1H5" />
      <path d="M2 5h8a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" />
    </svg>
  ),
  generate: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  ),
  cameraangles: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12l4-3 3 2 4-4 3 3" />
      <circle cx="12" cy="4" r="2" />
      <rect x="1" y="2" width="14" height="12" rx="2" />
    </svg>
  ),
  video: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="11" height="10" rx="1.5" />
      <path d="M12 6l3-2v8l-3-2" />
    </svg>
  ),
  audio: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v14" />
      <path d="M4 4v8" />
      <path d="M12 4v8" />
      <path d="M2 6v4" />
      <path d="M6 3v10" />
      <path d="M10 3v10" />
      <path d="M14 6v4" />
    </svg>
  ),
  upscale: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 14l5-5M2 10v4h4" />
      <path d="M14 2l-5 5M14 6V2h-4" />
    </svg>
  ),
  props: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
      <path d="M6 3v2M10 3v2M5 8h6M5 11h4" />
    </svg>
  ),
  locations: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8z" /><circle cx="8" cy="6" r="1.5" />
    </svg>
  ),
  versions: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 3h12M2 8h12M2 13h8" />
      <path d="M12 11l2 2-2 2" />
    </svg>
  ),
  moodboards: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="4" rx="1" />
      <rect x="1" y="9" width="6" height="4" rx="1" />
      <rect x="9" y="7" width="6" height="8" rx="1" />
    </svg>
  ),
  colorscript: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="3" height="8" rx="0.5" />
      <rect x="5" y="2" width="3" height="10" rx="0.5" />
      <rect x="9" y="5" width="3" height="7" rx="0.5" />
      <rect x="13" y="3" width="2" height="9" rx="0.5" />
    </svg>
  ),
  scriptdoctor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 2v12M4 2l8 6-8 6" />
    </svg>
  ),
  dialoguepolish: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h8M2 12h10" />
      <circle cx="13" cy="12" r="2" />
    </svg>
  ),
  breakdown: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="14" height="3" rx="1" />
      <rect x="1" y="6" width="14" height="3" rx="1" />
      <rect x="1" y="11" width="14" height="3" rx="1" />
    </svg>
  ),
  videoeditor: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="14" height="9" rx="1.5" />
      <path d="M1 12h14" />
      <rect x="2" y="13" width="3" height="2" rx="0.5" />
      <rect x="6" y="13" width="4" height="2" rx="0.5" />
      <rect x="11" y="13" width="3" height="2" rx="0.5" />
    </svg>
  ),
  budget: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v14" />
      <path d="M11 4H6.5a2 2 0 000 4h3a2 2 0 010 4H5" />
    </svg>
  ),
  timeline: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8h14" />
      <circle cx="4" cy="8" r="2" />
      <circle cx="9" cy="8" r="2" />
      <circle cx="13" cy="8" r="1.5" />
    </svg>
  ),
  shared: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="4" r="2" />
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 7l4-2M6 9l4 2" />
    </svg>
  ),
  present: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M6 7l5 3-5 3V7z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const ICON_STYLE_TO_WEIGHT: Record<string, IconWeight> = {
  outline: "regular",
  solid: "fill",
  duotone: "duotone",
};

export function NavIcon({ name }: { name: string }) {
  const { state } = useTheme();
  const lib = state.appearance.iconLibrary ?? "lucide";

  if (lib === "phosphor") {
    const PhIcon = PHOSPHOR_MAP[name];
    if (PhIcon) {
      const weight = ICON_STYLE_TO_WEIGHT[state.appearance.iconStyle] ?? "regular";
      return (
        <span className="shrink-0 opacity-70" aria-hidden="true">
          <PhIcon size={16} weight={weight as IconWeight} />
        </span>
      );
    }
  }

  return (
    <span className="shrink-0 opacity-70" aria-hidden="true">
      {LUCIDE_ICONS[name] || null}
    </span>
  );
}
