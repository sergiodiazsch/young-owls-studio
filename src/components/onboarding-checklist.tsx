"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface OnboardingProps {
  hasScenes: boolean;
  charactersComplete: boolean;
  hasImages: boolean;
  hasBreakdowns: boolean;
  hasLocations: boolean;
  projectId: string;
}

interface Step {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export function OnboardingChecklist({
  hasScenes,
  charactersComplete,
  hasImages,
  hasBreakdowns,
  hasLocations,
  projectId,
}: OnboardingProps) {
  const storageKey = `onboarding-dismissed-${projectId}`;
  const [dismissed, setDismissed] = useState(true); // default hidden until checked

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === "true");
  }, [storageKey]);

  const steps: Step[] = [
    { key: "scenes", label: "Upload screenplay", done: hasScenes, href: `/project/${projectId}/upload` },
    { key: "characters", label: "Review characters", done: charactersComplete, href: `/project/${projectId}/characters` },
    { key: "images", label: "Generate visuals", done: hasImages, href: `/project/${projectId}/generate` },
    { key: "breakdowns", label: "Create breakdowns", done: hasBreakdowns, href: `/project/${projectId}/breakdowns` },
    { key: "locations", label: "Set up locations", done: hasLocations, href: `/project/${projectId}/locations` },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;

  function handleDismiss() {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Getting Started</h3>
              <p className="text-[10px] text-muted-foreground">
                {allDone ? "All steps complete!" : `${doneCount} of ${total} steps complete`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }}
          />
        </div>

        {/* All done message */}
        {allDone ? (
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-primary/5 border border-primary/15">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-primary">You are all set!</p>
              <p className="text-[10px] text-muted-foreground">Your project is ready for production.</p>
            </div>
          </div>
        ) : (
          /* Step list */
          <div className="space-y-0.5">
            {steps.map((step) => (
              <Link
                key={step.key}
                href={step.done ? "#" : step.href}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all group ${
                  step.done
                    ? "cursor-default"
                    : "hover:bg-primary/5 cursor-pointer"
                }`}
                onClick={step.done ? (e) => e.preventDefault() : undefined}
              >
                {/* Check icon */}
                {step.done ? (
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0 group-hover:border-primary/50 transition-colors" />
                )}

                {/* Label */}
                <span
                  className={`text-xs font-medium flex-1 transition-colors ${
                    step.done
                      ? "text-primary line-through decoration-primary/30"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {step.label}
                </span>

                {/* Arrow for incomplete steps */}
                {!step.done && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-muted-foreground"
                  >
                    <path d="M6 3l5 5-5 5" />
                  </svg>
                )}
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
