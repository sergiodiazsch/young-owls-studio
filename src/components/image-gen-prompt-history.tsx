"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface PromptHistoryEntry {
  prompt: string;
  model: string;
  count: number;
  lastUsed: string;
  favoriteCount: number;
}

interface Props {
  projectId: string;
  onSelectPrompt: (prompt: string) => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ImageGenPromptHistory({ projectId, onSelectPrompt }: Props) {
  const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/generate/image/prompt-history?projectId=${projectId}`)
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {});
  }, [projectId, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2 gap-1">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          History
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-medium">Prompt History</p>
          <p className="text-[10px] text-muted-foreground">{history.length} unique prompts</p>
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No prompts yet — generate some images first
          </div>
        ) : (
          <ScrollArea className="max-h-72">
            <div className="divide-y">
              {history.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelectPrompt(entry.prompt);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs line-clamp-2 mb-1">{entry.prompt}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{timeAgo(entry.lastUsed)}</span>
                    <span>x{entry.count}</span>
                    {entry.favoriteCount > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                        ♥ {entry.favoriteCount}
                      </Badge>
                    )}
                    <span className="ml-auto">{entry.model}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
