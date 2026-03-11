"use client";

import dynamic from "next/dynamic";

const GSAPProvider = dynamic(
  () => import("@/components/gsap-provider").then((m) => ({ default: m.GSAPProvider })),
  { ssr: false }
);

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((m) => ({ default: m.CommandPalette })),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <GSAPProvider>
      {children}
      <CommandPalette />
    </GSAPProvider>
  );
}
