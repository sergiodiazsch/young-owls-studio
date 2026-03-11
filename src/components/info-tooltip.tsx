"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InfoTooltipProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function InfoTooltip({ text, side = "top" }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-muted-foreground/30 text-muted-foreground/60 hover:text-muted-foreground hover:border-muted-foreground/50 transition-colors text-[9px] font-medium leading-none ml-1 align-middle"
          >
            i
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[280px]">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
