"use client";

import { useRef, type ReactNode } from "react";
import { usePageTransition } from "@/hooks/use-gsap";

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedPage({ children, className }: AnimatedPageProps) {
  const ref = useRef<HTMLDivElement>(null);
  usePageTransition(ref);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
