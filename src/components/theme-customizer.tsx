"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import type { ThemeAppearance, CustomTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_OPTIONS: { value: ThemeAppearance["font"]; label: string; family: string; description: string }[] = [
  { value: "figtree", label: "Figtree", family: "var(--font-figtree)", description: "Clean and modern geometric sans — the default" },
  { value: "geist", label: "Geist", family: "var(--font-geist-sans)", description: "Vercel's sharp humanist sans-serif" },
  { value: "inter", label: "Inter", family: "var(--font-inter)", description: "Highly readable UI typeface by Rasmus Andersson" },
  { value: "space-grotesk", label: "Space Grotesk", family: "var(--font-space-grotesk)", description: "Proportional geometric sans with personality" },
  { value: "ibm-plex", label: "IBM Plex Sans", family: "var(--font-ibm-plex-sans)", description: "Corporate neo-grotesque with warmth" },
  { value: "libre-baskerville", label: "Libre Baskerville", family: "var(--font-libre-baskerville)", description: "Classic serif — elegant and traditional" },
  { value: "syne", label: "Syne", family: "var(--font-syne)", description: "Bold geometric display font — expressive and distinctive" },
  { value: "jetbrains", label: "JetBrains Mono", family: "var(--font-jetbrains-mono)", description: "Monospace font for a technical feel" },
];

const RADIUS_OPTIONS: { value: ThemeAppearance["borderRadius"]; label: string; px: number }[] = [
  { value: "none", label: "None", px: 0 },
  { value: "sm", label: "Small", px: 4 },
  { value: "md", label: "Medium", px: 6 },
  { value: "lg", label: "Large", px: 8 },
  { value: "xl", label: "XL", px: 12 },
  { value: "2xl", label: "2XL", px: 16 },
];

const SHADOW_OPTIONS: { value: ThemeAppearance["shadows"]; label: string; shadow: string }[] = [
  { value: "none", label: "None", shadow: "none" },
  { value: "subtle", label: "Subtle", shadow: "0 1px 3px rgba(0,0,0,0.08)" },
  { value: "medium", label: "Medium", shadow: "0 4px 12px rgba(0,0,0,0.12)" },
  { value: "dramatic", label: "Dramatic", shadow: "0 8px 30px rgba(0,0,0,0.2)" },
];

const SPACING_OPTIONS: { value: "compact" | "default" | "spacious"; label: string; gap: number }[] = [
  { value: "compact", label: "Compact", gap: 2 },
  { value: "default", label: "Default", gap: 4 },
  { value: "spacious", label: "Spacious", gap: 6 },
];

const PADDING_OPTIONS: { value: "compact" | "default" | "spacious"; label: string; pad: number }[] = [
  { value: "compact", label: "Compact", pad: 4 },
  { value: "default", label: "Default", pad: 8 },
  { value: "spacious", label: "Spacious", pad: 12 },
];

const COLOR_FIELDS: { key: string; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground" },
  { key: "card", label: "Card" },
  { key: "accent", label: "Accent" },
  { key: "border", label: "Border" },
];

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Color Picker Row
// ---------------------------------------------------------------------------

function ColorPickerRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="w-8 h-8 rounded-md border border-border shadow-sm transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring"
            style={{ backgroundColor: value }}
            aria-label={`Pick ${label} color`}
          />
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-3" align="end">
          <Label className="text-xs font-medium">{label}</Label>
          <div
            className="h-10 w-full rounded-md border"
            style={{ backgroundColor: value }}
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="oklch(0.5 0.15 200)"
            className="font-mono text-xs h-8"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ThemeCustomizer() {
  const {
    state,
    mode,
    preset,
    presets,
    setMode,
    setPreset,
    setAppearance,
    setCustomTheme,
  } = useTheme();

  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  const appearance = state.appearance;

  // Initialize custom colors from current preset when opening
  function openCustomSection() {
    const base = mode === "dark" ? preset.dark : preset.light;
    const initial: Record<string, string> = {};
    for (const { key } of COLOR_FIELDS) {
      initial[key] = (base as unknown as Record<string, string>)[key] ?? "";
    }
    setCustomColors(initial);
    setCustomOpen(true);
  }

  function handleSaveCustom() {
    if (!customName.trim()) return;
    const lightOverrides: Record<string, string> = {};
    const darkOverrides: Record<string, string> = {};

    for (const { key } of COLOR_FIELDS) {
      if (customColors[key]) {
        // Apply to current mode
        if (mode === "dark") {
          darkOverrides[key] = customColors[key];
        } else {
          lightOverrides[key] = customColors[key];
        }
      }
    }

    const custom: CustomTheme = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      basedOn: preset.id,
      light: lightOverrides,
      dark: darkOverrides,
      appearance: {},
      createdAt: new Date().toISOString(),
    };

    setCustomTheme(custom);
    setCustomName("");
  }

  function handleResetToPreset() {
    setCustomTheme(null);
    setCustomOpen(false);
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" data-tour="theme-toggle" className="h-8 w-8">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="13.5" cy="17.5" r="2.5" />
            <circle cx="20" cy="10" r="1.5" />
            <circle cx="20" cy="16" r="1.5" />
          </svg>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:max-w-[400px] p-0 flex flex-col h-full">
        <SheetHeader className="px-5 pt-5 pb-0 shrink-0">
          <SheetTitle className="text-lg">Customize Theme</SheetTitle>
          <SheetDescription>Personalize your workspace</SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          <div className="space-y-6 pt-4 pb-8">
            {/* ============================================================ */}
            {/* Section 1: Theme Presets */}
            {/* ============================================================ */}
            <div>
              <SectionHeader>Theme Presets</SectionHeader>
              <div className="grid grid-cols-2 gap-2.5">
                {presets.map((p) => {
                  const isActive = state.presetId === p.id && !state.customTheme;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      className={cn(
                        "relative rounded-lg border p-3 text-left transition-all hover:border-foreground/20 hover:shadow-sm",
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border bg-card"
                      )}
                    >
                      {isActive && (
                        <div className="absolute top-2 right-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </div>
                      )}
                      <div className="flex gap-1.5 mb-2">
                        <div
                          className="w-5 h-5 rounded-full border border-black/10"
                          style={{ backgroundColor: p.preview.light }}
                          title="Light primary"
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-white/10"
                          style={{ backgroundColor: p.preview.dark }}
                          title="Dark primary"
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: p.light.background }}
                          title="Light bg"
                        />
                        <div
                          className="w-5 h-5 rounded-full border border-border"
                          style={{ backgroundColor: p.dark.background }}
                          title="Dark bg"
                        />
                      </div>
                      <p className="text-[13px] font-semibold leading-tight truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{p.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* ============================================================ */}
            {/* Section 2: Mode Toggle */}
            {/* ============================================================ */}
            <div>
              <SectionHeader>Color Mode</SectionHeader>
              <div className="flex gap-1.5 bg-muted rounded-lg p-1">
                {([
                  { value: "light" as const, label: "Light", icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5" />
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                  )},
                  { value: "dark" as const, label: "Dark", icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                    </svg>
                  )},
                  { value: "system" as const, label: "System", icon: (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  )},
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all",
                      state.mode === opt.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* ============================================================ */}
            {/* Section 3: Appearance Controls */}
            {/* ============================================================ */}
            <div className="space-y-5">
              <SectionHeader>Appearance</SectionHeader>

              {/* -- Typography -- */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Typography</Label>
                <p className="text-[11px] text-muted-foreground mb-2">Choose the font used across the entire interface.</p>
                <div className="grid gap-1.5">
                  {FONT_OPTIONS.map((f) => {
                    const isActive = appearance.font === f.value;
                    return (
                      <button
                        key={f.value}
                        onClick={() => setAppearance({ font: f.value })}
                        className={cn(
                          "text-left rounded-lg border p-2.5 transition-all duration-200",
                          isActive
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-foreground/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium" style={{ fontFamily: f.family }}>{f.label}</span>
                          {isActive && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary shrink-0">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{f.description}</p>
                      </button>
                    );
                  })}
                </div>
                <p
                  className="text-sm text-muted-foreground mt-2 p-3 rounded-lg bg-muted/50 border transition-all duration-300"
                  style={{ fontFamily: FONT_OPTIONS.find((f) => f.value === appearance.font)?.family }}
                >
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
              </div>

              {/* -- Border Radius -- */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Border Radius</Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ borderRadius: opt.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all",
                        appearance.borderRadius === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <div
                        className="w-7 h-7 border-2 border-foreground/60"
                        style={{ borderRadius: opt.px }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* -- Shadows -- */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Shadows</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SHADOW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ shadows: opt.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all",
                        appearance.shadows === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <div
                        className="w-8 h-6 rounded bg-card border border-border"
                        style={{ boxShadow: opt.shadow }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* -- Card Spacing -- */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Card Spacing</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {SPACING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ cardSpacing: opt.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-all",
                        appearance.cardSpacing === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <div className="flex flex-col items-center" style={{ gap: opt.gap }}>
                        <div className="w-10 h-2 rounded-sm bg-foreground/20" />
                        <div className="w-10 h-2 rounded-sm bg-foreground/20" />
                        <div className="w-10 h-2 rounded-sm bg-foreground/20" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground mt-1">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* -- Card Padding -- */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Card Padding</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PADDING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ cardPadding: opt.value })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-md border p-2.5 transition-all",
                        appearance.cardPadding === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <div
                        className="w-12 h-8 rounded border border-foreground/20 flex items-center justify-center"
                        style={{ padding: opt.pad }}
                      >
                        <div className="w-full h-full rounded-sm bg-foreground/15" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground mt-1">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* -- Icon Library -- */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Icon Library</Label>
                <p className="text-[11px] text-muted-foreground mb-2">Choose the icon set used in the sidebar.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { value: "lucide" as const, label: "Lucide", desc: "Clean outlined icons" },
                    { value: "phosphor" as const, label: "Phosphor", desc: "Versatile with multiple weights" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ iconLibrary: opt.value })}
                      className={cn(
                        "text-left rounded-lg border p-2.5 transition-all duration-200",
                        appearance.iconLibrary === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* -- Icon Style -- */}
              {appearance.iconLibrary === "phosphor" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Icon Style</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { value: "outline" as const, label: "Outline" },
                      { value: "solid" as const, label: "Solid" },
                      { value: "duotone" as const, label: "Duotone" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAppearance({ iconStyle: opt.value })}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-md border p-2 transition-all text-[10px] font-medium",
                          appearance.iconStyle === opt.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-foreground/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* -- Animations -- */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Animations</Label>
                  <p className="text-[11px] text-muted-foreground">Enable smooth transitions and motion</p>
                </div>
                <Switch
                  checked={appearance.animations}
                  onCheckedChange={(checked) => setAppearance({ animations: checked })}
                />
              </div>
            </div>

            <Separator />

            {/* ============================================================ */}
            {/* Section 4: Custom Theme (Advanced) */}
            {/* ============================================================ */}
            <div>
              <button
                onClick={() => (customOpen ? setCustomOpen(false) : openCustomSection())}
                className="flex items-center justify-between w-full group"
              >
                <SectionHeader>Custom Theme (Advanced)</SectionHeader>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={cn(
                    "text-muted-foreground transition-transform",
                    customOpen ? "rotate-180" : ""
                  )}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {customOpen && (
                <div className="space-y-4 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-xs text-muted-foreground">
                    Customize colors based on the <span className="font-medium text-foreground">{preset.name}</span> preset.
                  </p>

                  <div className="space-y-3">
                    {COLOR_FIELDS.map(({ key, label }) => (
                      <ColorPickerRow
                        key={key}
                        label={label}
                        value={customColors[key] ?? ""}
                        onChange={(v) => setCustomColors((prev) => ({ ...prev, [key]: v }))}
                      />
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs">Theme Name</Label>
                    <Input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="My Custom Theme"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveCustom}
                      disabled={!customName.trim()}
                      size="sm"
                      className="flex-1"
                    >
                      Save as Custom Theme
                    </Button>
                    <Button
                      onClick={handleResetToPreset}
                      variant="outline"
                      size="sm"
                    >
                      Reset to Preset
                    </Button>
                  </div>

                  {state.customTheme && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-2.5">
                      <p className="text-xs font-medium text-primary">
                        Active custom theme: {state.customTheme.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Based on {preset.name}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Standalone trigger for use in other layouts
// ---------------------------------------------------------------------------

export function ThemeCustomizerTrigger({ className: _className }: { className?: string }) {
  return (
    <ThemeCustomizer />
  );
}
