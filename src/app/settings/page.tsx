"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useTheme } from "@/lib/theme";
import { useWalkthrough } from "@/hooks/use-walkthrough";

const ThemeCustomizer = dynamic(
  () => import("@/components/theme-customizer").then((m) => ({ default: m.ThemeCustomizer })),
  { ssr: false }
);
import { getDefaultConfigItems, DEFAULT_GROUPS, type SidebarConfigItem } from "@/hooks/use-sidebar-config";

interface SettingInfo {
  value: string | null;
  hasValue: boolean;
  updatedAt: string;
}

interface VerifyResult {
  key: string;
  status: "ok" | "error" | "missing";
  message: string;
}

const API_KEYS = [
  {
    key: "elevenlabs_api_key",
    label: "ElevenLabs",
    description: "Required for AI voice generation (text-to-speech)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
        <path d="M12 6a6 6 0 016 6v0a6 6 0 01-6 6v0a6 6 0 01-6-6v0a6 6 0 016-6z" />
        <path d="M9 12h6" />
      </svg>
    ),
    docsUrl: "https://elevenlabs.io/docs/api-reference/text-to-speech",
  },
  {
    key: "fal_api_key",
    label: "fal.ai",
    description: "Required for AI image generation",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="20" height="20" rx="3" />
        <circle cx="8" cy="8" r="2" />
        <path d="M2 16l5-5 4 4 3-3 8 8" />
      </svg>
    ),
    docsUrl: "https://fal.ai/docs",
  },
  {
    key: "anthropic_api_key",
    label: "Anthropic (Claude)",
    description: "Required for screenplay parsing, script analysis, breakdowns, and dialogue polish",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    docsUrl: "https://docs.anthropic.com/en/docs/quickstart",
  },
];

const FONT_LABELS: Record<string, string> = {
  geist: "Geist",
  inter: "Inter",
  jetbrains: "JetBrains Mono",
  "ibm-plex": "IBM Plex Sans",
  "space-grotesk": "Space Grotesk",
  "libre-baskerville": "Libre Baskerville",
};

export default function SettingsPage() {
  const router = useRouter();
  const { preset, state, mode } = useTheme();
  const walkthrough = useWalkthrough();
  const [settings, setSettings] = useState<Record<string, SettingInfo>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Sidebar config
  const [sidebarItems, setSidebarItems] = useState<SidebarConfigItem[]>(() => getDefaultConfigItems());
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sidebar-config");
      if (raw) {
        const saved = JSON.parse(raw);
        const defaults = getDefaultConfigItems();
        const merged = defaults.map((d: SidebarConfigItem) => {
          const s = saved.find((s: SidebarConfigItem) => s.id === d.id);
          if (s) return { ...d, visible: s.visible, order: s.order };
          return d;
        });
        setSidebarItems(merged);
      }
    } catch { /* ignore */ }
  }, []);

  const saveSidebarItems = useCallback((items: SidebarConfigItem[]) => {
    setSidebarItems(items);
    try { localStorage.setItem("sidebar-config", JSON.stringify(items)); } catch { /* ignore */ }
  }, []);

  const toggleSidebarVisibility = useCallback((id: string) => {
    saveSidebarItems(sidebarItems.map((item) => item.id === id ? { ...item, visible: !item.visible } : item));
  }, [sidebarItems, saveSidebarItems]);

  const moveSidebarItem = useCallback((id: string, direction: "up" | "down") => {
    const item = sidebarItems.find((i) => i.id === id);
    if (!item) return;
    const groupItems = sidebarItems.filter((i) => i.group === item.group).sort((a, b) => a.order - b.order);
    const idx = groupItems.findIndex((i) => i.id === id);
    if (direction === "up" && idx > 0) {
      const sw = groupItems[idx - 1];
      saveSidebarItems(sidebarItems.map((i) => {
        if (i.id === id) return { ...i, order: sw.order };
        if (i.id === sw.id) return { ...i, order: item.order };
        return i;
      }));
    } else if (direction === "down" && idx < groupItems.length - 1) {
      const sw = groupItems[idx + 1];
      saveSidebarItems(sidebarItems.map((i) => {
        if (i.id === id) return { ...i, order: sw.order };
        if (i.id === sw.id) return { ...i, order: item.order };
        return i;
      }));
    }
  }, [sidebarItems, saveSidebarItems]);

  const resetSidebar = useCallback(() => {
    saveSidebarItems(getDefaultConfigItems());
  }, [saveSidebarItems]);

  const sidebarGrouped = DEFAULT_GROUPS
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      ...g,
      items: sidebarItems.filter((i) => i.group === g.id).sort((a, b) => a.order - b.order),
    }));

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { setSettings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    const body: Record<string, string> = {};
    for (const { key } of API_KEYS) {
      if (values[key] !== undefined && values[key] !== "") {
        body[key] = values[key];
      }
    }

    try {
      const saveRes = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!saveRes.ok) throw new Error("Save failed");

      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
      setValues({});
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify(apiKey: string) {
    setVerifying((prev) => ({ ...prev, [apiKey]: true }));
    try {
      const res = await fetch("/api/settings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      });
      const result = await res.json();
      setVerifyResults((prev) => ({ ...prev, [apiKey]: result }));
      if (result.status === "ok") {
        toast.success(result.message);
      } else if (result.status === "error") {
        toast.error(result.message);
      }
    } catch {
      toast.error("Verification failed — network error");
    } finally {
      setVerifying((prev) => ({ ...prev, [apiKey]: false }));
    }
  }

  async function handleVerifyAll() {
    for (const { key } of API_KEYS) {
      if (settings[key]?.hasValue) {
        handleVerify(key);
      }
    }
  }

  const hasChanges = Object.values(values).some((v) => v);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:-translate-x-0.5 transition-transform">
                  <path d="M10 2L4 8l6 6" />
                </svg>
                Home
              </button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Configure API keys and preferences
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}
        {/* Appearance Section */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 border-l-2 border-primary/50 pl-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="6" cy="12" r="2.5" />
                <circle cx="13.5" cy="17.5" r="2.5" />
                <circle cx="20" cy="10" r="1.5" />
                <circle cx="20" cy="16" r="1.5" />
              </svg>
              Appearance
            </CardTitle>
            <CardDescription>
              Customize the look and feel of your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ backgroundColor: preset.preview.light }}
                    title="Light primary"
                  />
                  <div
                    className="w-6 h-6 rounded-full border border-border"
                    style={{ backgroundColor: preset.preview.dark }}
                    title="Dark primary"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {FONT_LABELS[state.appearance.font] ?? state.appearance.font} &middot; {mode === "dark" ? "Dark" : "Light"} mode
                  </p>
                </div>
              </div>
              <ThemeCustomizer />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Onboarding Tour</p>
                <p className="text-xs text-muted-foreground">Replay the introductory walkthrough</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  walkthrough.restart();
                  router.push("/");
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                Replay Tour
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Layout Section */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 border-l-2 border-primary/50 pl-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
              Sidebar Layout
            </CardTitle>
            <CardDescription>
              Toggle visibility and reorder sidebar items. Changes apply to all projects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sidebarGrouped.map((group) => (
              <div key={group.id}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 hover:bg-primary/5 transition-colors duration-200">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveSidebarItem(item.id, "up")}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 10l4-4 4 4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveSidebarItem(item.id, "down")}
                          disabled={idx === group.items.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 6l4 4 4-4" />
                          </svg>
                        </button>
                      </div>
                      <span className={`text-sm flex-1 ${!item.visible ? "text-muted-foreground line-through" : ""}`}>
                        {item.label}
                      </span>
                      <Switch
                        checked={item.visible}
                        onCheckedChange={() => toggleSidebarVisibility(item.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetSidebar}>
                Reset to Defaults
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys Section */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 border-l-2 border-primary/50 pl-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              API Keys
            </CardTitle>
            <CardDescription>
              Connect external AI services. Keys are stored locally and never shared.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {API_KEYS.map(({ key, label, description, icon }, i) => (
              <div key={key}>
                {i > 0 && <Separator className="mb-6" />}
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-muted-foreground border border-primary/10">
                    {icon}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={key} className="text-sm font-semibold">{label}</Label>
                      {settings[key]?.hasValue ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-primary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                          Not configured
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={key}
                          type={showKeys[key] ? "text" : "password"}
                          placeholder={settings[key]?.hasValue ? "Enter new key to replace..." : "Paste your API key here..."}
                          value={values[key] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                          className="pr-9 focus:shadow-[0_0_10px_var(--glow-primary)] transition-shadow duration-300"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showKeys[key] ? "Hide API key" : "Show API key"}
                          tabIndex={-1}
                        >
                          {showKeys[key] ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          )}
                        </button>
                      </div>
                      {settings[key]?.hasValue && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-9 px-3 text-xs"
                          disabled={!!verifying[key]}
                          onClick={() => handleVerify(key)}
                        >
                          {verifying[key] ? (
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : "Verify"}
                        </Button>
                      )}
                    </div>
                    {verifyResults[key] && (
                      <div className={`text-xs px-2.5 py-1.5 rounded-md backdrop-blur-sm border ${
                        verifyResults[key].status === "ok"
                          ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_8px_var(--glow-primary)]"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}>
                        {verifyResults[key].message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex-1 h-11 shadow-[0_0_15px_var(--glow-primary)] hover:shadow-md transition-shadow duration-300"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : "Save Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={handleVerifyAll}
                disabled={Object.values(verifying).some(Boolean)}
                className="h-11 px-6"
              >
                Verify All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="backdrop-blur-sm bg-card/80 border-border/40">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Young Owls Screenplay Studio</p>
                <p className="text-xs text-muted-foreground">AI-powered screenplay tools</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-mono">v1.0</span>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
