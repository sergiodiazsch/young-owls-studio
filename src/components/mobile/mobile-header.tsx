"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo } from "react";

/* MOBILE AGENT: iOS-style top bar with back navigation and page title */
export function MobileHeader({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Derive page title and whether to show back button
  const { title, showBack, backLabel } = useMemo(() => {
    const base = `/project/${projectId}`;
    const segments = pathname.replace(base, "").split("/").filter(Boolean);

    if (segments.length === 0) {
      return { title: projectTitle || "Overview", showBack: false, backLabel: "" };
    }

    const titleMap: Record<string, string> = {
      scenes: "Scenes",
      characters: "Characters",
      locations: "Locations",
      upload: "Upload",
      versions: "Versions",
      drive: "Asset Library",
      moodboards: "Moodboards",
      "color-script": "Color Script",
      snippets: "Snippets",
      generate: "Image Gen",
      "camera-angles": "Camera Angles",
      "generate-video": "Video Gen",
      "audio-studio": "Audio Studio",
      upscale: "Upscale",
      "video-editor": "Video Editor",
      "script-doctor": "Script Doctor",
      "dialogue-polish": "Dialogue Polish",
      breakdowns: "Breakdown",
      budget: "Budget",
    };

    const firstSegment = segments[0];
    const pageTitle = titleMap[firstSegment] || firstSegment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // If we're in a detail page (2+ segments), back goes to the list
    if (segments.length >= 2) {
      const parentTitle = titleMap[firstSegment] || firstSegment;
      return {
        title: pageTitle,
        showBack: true,
        backLabel: parentTitle,
      };
    }

    // If we're on a section page, back goes to overview
    return {
      title: pageTitle,
      showBack: true,
      backLabel: projectTitle || "Home",
    };
  }, [pathname, projectId, projectTitle]);

  return (
    <header
      className="sticky top-0 z-30 md:hidden mobile-top-bar"
    >
      <div
        className="flex items-center h-14 px-4 gap-3"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Back button */}
        {showBack && (
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-primary -ml-1 min-h-[44px] min-w-[44px] active:opacity-70 active:duration-75 shrink-0"
            aria-label={`Go back to ${backLabel}`}
          >
            <svg
              width="10"
              height="16"
              viewBox="0 0 10 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 2L2 8l6 6" />
            </svg>
            <span className="text-[15px] font-normal truncate max-w-[100px]">{backLabel}</span>
          </button>
        )}

        {/* Title */}
        <h1
          className={`text-[17px] font-semibold truncate ${
            showBack ? "flex-1 text-center pr-10" : "flex-1"
          }`}
        >
          {title}
        </h1>
      </div>
    </header>
  );
}
