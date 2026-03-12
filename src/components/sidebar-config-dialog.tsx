"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { SidebarItem, SidebarGroup } from "@/hooks/use-sidebar-config";

interface Props {
  groupedItems: Array<SidebarGroup & { items: SidebarItem[] }>;
  onToggleVisibility: (id: string) => void;
  onMoveItem: (id: string, direction: "up" | "down") => void;
  onReset: () => void;
}

export function SidebarConfigDialog({
  groupedItems,
  onToggleVisibility,
  onMoveItem,
  onReset,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full"
          title="Customize sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-80">
            <path d="M2 4h12M2 8h12M2 12h12" />
            <circle cx="5" cy="4" r="1.5" fill="currentColor" />
            <circle cx="11" cy="8" r="1.5" fill="currentColor" />
            <circle cx="7" cy="12" r="1.5" fill="currentColor" />
          </svg>
          Customize Sidebar
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Sidebar</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {groupedItems.map((group) => (
            <div key={group.id}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => onMoveItem(item.id, "up")}
                        disabled={idx === 0}
                        aria-label={`Move ${item.label} up`}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 10l4-4 4 4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onMoveItem(item.id, "down")}
                        disabled={idx === group.items.length - 1}
                        aria-label={`Move ${item.label} down`}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 6l4 4 4-4" />
                        </svg>
                      </button>
                    </div>

                    {/* Label */}
                    <span className={`text-sm flex-1 ${!item.visible ? "text-muted-foreground line-through" : ""}`}>
                      {item.label}
                    </span>

                    {/* Visibility toggle */}
                    <Switch
                      checked={item.visible}
                      onCheckedChange={() => onToggleVisibility(item.id)}
                      aria-label={`Toggle ${item.label} visibility`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
            Reset to Defaults
          </Button>
        </div>

        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Reset Sidebar"
          description="This will restore all sidebar items to their original order and visibility. Your customizations will be lost."
          confirmLabel="Reset"
          variant="destructive"
          onConfirm={onReset}
        />
      </DialogContent>
    </Dialog>
  );
}
