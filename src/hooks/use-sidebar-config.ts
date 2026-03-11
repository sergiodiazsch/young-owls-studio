"use client";

import { useState, useCallback, useEffect } from "react";

export interface SidebarItem {
  id: string;
  href: string;
  label: string;
  icon: string;
  group: string;
  visible: boolean;
  order: number;
}

export interface SidebarGroup {
  id: string;
  label: string;
  order: number;
}

const DEFAULT_GROUPS: SidebarGroup[] = [
  { id: "script", label: "Project", order: 0 },
  { id: "scenes", label: "Scenes", order: 1 },
  { id: "library", label: "Library", order: 2 },
  { id: "generate", label: "Generate", order: 3 },
  { id: "analyze", label: "Analyze", order: 4 },
];

function getDefaultItems(projectId: string): SidebarItem[] {
  return [
    // Script
    { id: "overview", href: `/project/${projectId}`, label: "Overview", icon: "grid", group: "script", visible: true, order: 0 },
    { id: "upload", href: `/project/${projectId}/upload`, label: "Upload", icon: "upload", group: "script", visible: true, order: 1 },
    { id: "versions", href: `/project/${projectId}/versions`, label: "Versions", icon: "versions", group: "script", visible: true, order: 2 },
    // Scenes
    { id: "scenes", href: `/project/${projectId}/scenes`, label: "Scenes", icon: "scenes", group: "scenes", visible: true, order: 0 },
    { id: "characters", href: `/project/${projectId}/characters`, label: "Characters", icon: "users", group: "scenes", visible: true, order: 1 },
    { id: "locations", href: `/project/${projectId}/locations`, label: "Locations", icon: "locations", group: "scenes", visible: true, order: 2 },
    { id: "props", href: `/project/${projectId}/props`, label: "Props", icon: "props", group: "scenes", visible: true, order: 3 },
    // Library
    { id: "drive", href: `/project/${projectId}/drive`, label: "Asset Library", icon: "drive", group: "library", visible: true, order: 0 },
    { id: "moodboards", href: `/project/${projectId}/moodboards`, label: "Moodboards", icon: "moodboards", group: "library", visible: true, order: 1 },
    { id: "color-script", href: `/project/${projectId}/color-script`, label: "Color Script", icon: "colorscript", group: "library", visible: true, order: 2 },
    { id: "snippets", href: `/project/${projectId}/snippets`, label: "Snippets", icon: "snippets", group: "library", visible: true, order: 3 },
    { id: "shared-library", href: `/project/${projectId}/library`, label: "Shared Library", icon: "shared", group: "library", visible: true, order: 4 },
    // Generate
    { id: "generate", href: `/project/${projectId}/generate`, label: "Image Gen", icon: "generate", group: "generate", visible: true, order: 0 },
    { id: "camera-angles", href: `/project/${projectId}/camera-angles`, label: "Camera Angles", icon: "cameraangles", group: "generate", visible: true, order: 1 },
    { id: "generate-video", href: `/project/${projectId}/generate-video`, label: "Video Gen", icon: "video", group: "generate", visible: true, order: 2 },
    { id: "audio-studio", href: `/project/${projectId}/audio-studio`, label: "Audio Studio", icon: "audio", group: "generate", visible: true, order: 3 },
    { id: "upscale", href: `/project/${projectId}/upscale`, label: "Upscale", icon: "upscale", group: "generate", visible: true, order: 4 },
    { id: "video-editor", href: `/project/${projectId}/video-editor`, label: "Video Editor", icon: "videoeditor", group: "generate", visible: true, order: 5 },
    // Analyze
    { id: "script-doctor", href: `/project/${projectId}/script-doctor`, label: "Script Doctor", icon: "scriptdoctor", group: "analyze", visible: true, order: 0 },
    { id: "dialogue-polish", href: `/project/${projectId}/dialogue-polish`, label: "Dialogue Polish", icon: "dialoguepolish", group: "analyze", visible: true, order: 1 },
    { id: "breakdowns", href: `/project/${projectId}/breakdowns`, label: "Breakdown", icon: "breakdown", group: "analyze", visible: true, order: 2 },
    { id: "budget", href: `/project/${projectId}/budget`, label: "Budget", icon: "budget", group: "analyze", visible: true, order: 3 },
    { id: "timeline-review", href: `/project/${projectId}/timeline-review`, label: "Timeline Review", icon: "timeline", group: "analyze", visible: true, order: 4 },
    { id: "present", href: `/project/${projectId}/present`, label: "Present", icon: "present", group: "analyze", visible: true, order: 5 },
  ];
}

const STORAGE_KEY = "sidebar-config";

export interface SidebarConfigItem {
  id: string;
  label: string;
  icon: string;
  group: string;
  visible: boolean;
  order: number;
}

export function getDefaultConfigItems(): SidebarConfigItem[] {
  return getDefaultItems("_").map(({ id, label, icon, group, visible, order }) => ({ id, label, icon, group, visible, order }));
}

export { DEFAULT_GROUPS };

export function useSidebarConfig(projectId: string) {
  const [items, setItems] = useState<SidebarItem[]>(() => getDefaultItems(projectId));
  const [groups] = useState<SidebarGroup[]>(DEFAULT_GROUPS);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: SidebarItem[] = JSON.parse(raw);
        // Merge with defaults — always use default group (reorganization), preserve visibility/order
        const defaults = getDefaultItems(projectId);
        const merged = defaults.map((d) => {
          const s = saved.find((s) => s.id === d.id);
          if (s) return { ...d, visible: s.visible, order: s.order };
          return d;
        });
        queueMicrotask(() => { setItems(merged); setLoaded(true); });
      } else {
        queueMicrotask(() => setLoaded(true));
      }
    } catch {
      // ignore parse errors
      queueMicrotask(() => setLoaded(true));
    }
  }, [projectId]);

  // Save to localStorage
  const save = useCallback((newItems: SidebarItem[]) => {
    setItems(newItems);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // storage full or blocked
    }
  }, [projectId]);

  const toggleVisibility = useCallback((id: string) => {
    save(items.map((item) => item.id === id ? { ...item, visible: !item.visible } : item));
  }, [items, save]);

  const moveItem = useCallback((id: string, direction: "up" | "down") => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const groupItems = items
      .filter((i) => i.group === item.group)
      .sort((a, b) => a.order - b.order);
    const idx = groupItems.findIndex((i) => i.id === id);
    if (direction === "up" && idx > 0) {
      const swapWith = groupItems[idx - 1];
      save(items.map((i) => {
        if (i.id === id) return { ...i, order: swapWith.order };
        if (i.id === swapWith.id) return { ...i, order: item.order };
        return i;
      }));
    } else if (direction === "down" && idx < groupItems.length - 1) {
      const swapWith = groupItems[idx + 1];
      save(items.map((i) => {
        if (i.id === id) return { ...i, order: swapWith.order };
        if (i.id === swapWith.id) return { ...i, order: item.order };
        return i;
      }));
    }
  }, [items, save]);

  const resetToDefaults = useCallback(() => {
    save(getDefaultItems(projectId));
  }, [projectId, save]);

  // Build grouped & sorted items for rendering
  const groupedItems = groups
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      ...g,
      items: items
        .filter((i) => i.group === g.id)
        .sort((a, b) => a.order - b.order),
    }));

  return {
    items,
    groups,
    groupedItems,
    loaded,
    toggleVisibility,
    moveItem,
    resetToDefaults,
  };
}
