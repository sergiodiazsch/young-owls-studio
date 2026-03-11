export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export interface ThemeAppearance {
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shadows: 'none' | 'subtle' | 'medium' | 'dramatic';
  cardSpacing: 'compact' | 'default' | 'spacious';
  cardPadding: 'compact' | 'default' | 'spacious';
  font: 'figtree' | 'geist' | 'inter' | 'jetbrains' | 'ibm-plex' | 'space-grotesk' | 'libre-baskerville' | 'syne';
  iconLibrary: 'lucide' | 'phosphor';
  iconStyle: 'outline' | 'solid' | 'duotone';
  animations: boolean;
  reducedMotion: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  preview: { light: string; dark: string };
  light: ThemeColors;
  dark: ThemeColors;
  appearance: Partial<ThemeAppearance>;
}

export interface CustomTheme {
  id: string;
  name: string;
  basedOn: string;
  light: Partial<ThemeColors>;
  dark: Partial<ThemeColors>;
  appearance: Partial<ThemeAppearance>;
  createdAt: string;
}

export interface ThemeState {
  mode: 'light' | 'dark' | 'system';
  presetId: string;
  customTheme: CustomTheme | null;
  appearance: ThemeAppearance;
}

export const DEFAULT_APPEARANCE: ThemeAppearance = {
  borderRadius: 'md',
  shadows: 'medium',
  cardSpacing: 'default',
  cardPadding: 'default',
  font: 'geist',
  iconLibrary: 'phosphor',
  iconStyle: 'outline',
  animations: true,
  reducedMotion: false,
};
