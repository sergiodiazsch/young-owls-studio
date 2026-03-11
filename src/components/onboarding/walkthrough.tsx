"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { WalkthroughStep } from "./walkthrough-steps";

interface WalkthroughProps {
  isActive: boolean;
  step: WalkthroughStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const POPOVER_GAP = 16;
const SPOTLIGHT_PADDING_DEFAULT = 8;

function getTargetRect(
  selector: string,
  padding: number
): TargetRect | null {
  if (selector === "body") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };
}

function computePopoverPosition(
  targetRect: TargetRect | null,
  placement: WalkthroughStep["placement"],
  popoverWidth: number,
  popoverHeight: number
): { top: number; left: number } {
  if (!targetRect) {
    return {
      top: window.innerHeight / 2 - popoverHeight / 2,
      left: window.innerWidth / 2 - popoverWidth / 2,
    };
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = targetRect.top + targetRect.height + POPOVER_GAP;
      left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
      break;
    case "top":
      top = targetRect.top - popoverHeight - POPOVER_GAP;
      left = targetRect.left + targetRect.width / 2 - popoverWidth / 2;
      break;
    case "left":
      top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
      left = targetRect.left - popoverWidth - POPOVER_GAP;
      break;
    case "right":
      top = targetRect.top + targetRect.height / 2 - popoverHeight / 2;
      left = targetRect.left + targetRect.width + POPOVER_GAP;
      break;
  }

  // Clamp within viewport
  const margin = 12;
  left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));

  return { top, left };
}

export function Walkthrough({
  isActive,
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: WalkthroughProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [animating, setAnimating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(currentStep);

  const isFullScreen = step.target === "body";
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Mount portal
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    return () => { setMounted(false); };
  }, []);

  // Animate in/out when active changes
  useEffect(() => {
    if (isActive) {
      const frameId = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frameId);
    } else {
      const frameId = requestAnimationFrame(() => setVisible(false));
      return () => cancelAnimationFrame(frameId);
    }
  }, [isActive]);

  // Trigger step transition animation
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      const frameId = requestAnimationFrame(() => setAnimating(true));
      const timer = setTimeout(() => setAnimating(false), 50);
      prevStepRef.current = currentStep;
      return () => { cancelAnimationFrame(frameId); clearTimeout(timer); };
    }
  }, [currentStep]);

  // Calculate positions
  const recalculate = useCallback(() => {
    const padding = step.spotlightPadding ?? SPOTLIGHT_PADDING_DEFAULT;
    const rect = getTargetRect(step.target, padding);
    setTargetRect(rect);

    const popoverEl = popoverRef.current;
    const pw = popoverEl?.offsetWidth ?? 380;
    const ph = popoverEl?.offsetHeight ?? 200;
    const pos = computePopoverPosition(rect, step.placement, pw, ph);
    setPopoverPos(pos);
  }, [step]);

  useEffect(() => {
    if (!isActive) return;
    // Small delay to let DOM settle (e.g., for page navigation)
    const t = setTimeout(recalculate, 80);
    return () => clearTimeout(t);
  }, [isActive, currentStep, recalculate]);

  useEffect(() => {
    if (!isActive) return;
    window.addEventListener("resize", recalculate);
    window.addEventListener("scroll", recalculate, true);
    return () => {
      window.removeEventListener("resize", recalculate);
      window.removeEventListener("scroll", recalculate, true);
    };
  }, [isActive, recalculate]);

  // Keyboard controls
  useEffect(() => {
    if (!isActive) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isActive, onNext, onPrev, onSkip]);

  if (!mounted || !isActive) return null;

  // Spotlight clip path
  const spotlightStyle: CSSProperties =
    targetRect && !isFullScreen
      ? {
          boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.75)`,
          position: "fixed",
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: 8,
          zIndex: 99998,
          pointerEvents: "none",
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }
      : {};

  const overlayStyle: CSSProperties = isFullScreen
    ? {
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 99998,
        transition: "opacity 0.4s ease",
        opacity: visible ? 1 : 0,
      }
    : { display: "none" };

  const popoverStyle: CSSProperties = {
    position: "fixed",
    top: popoverPos.top,
    left: popoverPos.left,
    zIndex: 99999,
    transition: animating
      ? "none"
      : "top 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
    opacity: visible && !animating ? 1 : 0,
    transform: visible && !animating ? "scale(1) translateY(0)" : "scale(0.92) translateY(8px)",
    pointerEvents: visible ? "auto" : "none",
  };

  return createPortal(
    <>
      {/* Full screen overlay for welcome/complete steps */}
      <div style={overlayStyle} role="button" tabIndex={-1} aria-label="Skip walkthrough" onClick={onSkip} onKeyDown={(e) => { if (e.key === "Escape") onSkip(); }} />

      {/* Spotlight cutout for targeted steps */}
      {!isFullScreen && <div style={spotlightStyle} />}

      {/* Click blocker for non-fullscreen steps — click to skip tour */}
      {!isFullScreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99997,
            cursor: "default",
          }}
          onClick={onSkip}
        />
      )}

      {/* Popover */}
      <div
        ref={popoverRef}
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
      >
        <div
          className="w-[380px] rounded-xl border border-white/[0.12] text-white shadow-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(30, 30, 40, 0.97) 0%, rgba(20, 20, 30, 0.98) 100%)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-t-xl bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #6366f1, #a78bfa, #c084fc)",
                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>

          <div className="p-5">
            {/* Step counter */}
            <div className="mb-3 flex items-center justify-between">
              <span
                className="text-[11px] font-medium tracking-wider uppercase"
                style={{ color: "rgba(167, 139, 250, 0.9)" }}
              >
                Step {currentStep + 1} of {totalSteps}
              </span>
              <button
                onClick={onSkip}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
              >
                Skip tour
              </button>
            </div>

            {/* Title */}
            <h3 className="mb-2 text-[17px] font-semibold leading-snug tracking-tight text-white">
              {step.title}
            </h3>

            {/* Description */}
            <p className="mb-5 text-[13.5px] leading-relaxed text-white/60">
              {step.description}
            </p>

            {/* Step dots */}
            <div className="mb-4 flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === currentStep ? 20 : 6,
                    backgroundColor:
                      i === currentStep
                        ? "#a78bfa"
                        : i < currentStep
                          ? "rgba(167, 139, 250, 0.4)"
                          : "rgba(255, 255, 255, 0.12)",
                  }}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  onClick={onSkip}
                  className="rounded-full px-3 py-2 text-[13px] font-medium text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
                >
                  Skip
                </button>
                <button
                  onClick={onPrev}
                  disabled={currentStep === 0}
                  className="rounded-full px-4 py-2 text-[13px] font-medium text-white/50 transition-all hover:bg-white/[0.06] hover:text-white/80 disabled:pointer-events-none disabled:opacity-0"
                >
                  Back
                </button>
              </div>
              <button
                onClick={onNext}
                className="rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
                }}
              >
                {currentStep === totalSteps - 1 ? "Get Started" : "Next"}
              </button>
            </div>
          </div>

          {/* Keyboard hint */}
          <div
            className="flex items-center justify-center gap-3 border-t border-white/[0.06] px-5 py-2.5"
            style={{ color: "rgba(255, 255, 255, 0.22)" }}
          >
            <span className="flex items-center gap-1 text-[10px]">
              <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">
                Esc
              </kbd>
              skip
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">
                &larr;
              </kbd>
              <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">
                &rarr;
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <kbd className="rounded border border-white/10 bg-white/[0.04] px-1 py-0.5 font-mono text-[9px]">
                Enter
              </kbd>
              next
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
