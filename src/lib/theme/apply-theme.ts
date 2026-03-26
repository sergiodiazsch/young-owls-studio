import type { ThemeColors, ThemeAppearance } from './types';

/**
 * Convert a camelCase string to kebab-case for CSS variable names.
 * e.g. "cardForeground" -> "card-foreground"
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const FONT_FAMILY_MAP: Record<ThemeAppearance['font'], string> = {
  figtree: 'var(--font-figtree), system-ui, sans-serif',
  geist: 'var(--font-geist-sans), system-ui, sans-serif',
  inter: 'var(--font-inter), system-ui, sans-serif',
  jetbrains: 'var(--font-jetbrains-mono), monospace',
  'ibm-plex': 'var(--font-ibm-plex-sans), system-ui, sans-serif',
  'space-grotesk': 'var(--font-space-grotesk), system-ui, sans-serif',
  'libre-baskerville': 'var(--font-libre-baskerville), Georgia, serif',
  syne: 'var(--font-syne), system-ui, sans-serif',
};

/**
 * Apply theme colors as CSS custom properties on document.documentElement.
 * Each ThemeColors key is mapped to a `--{kebab-case-key}` CSS variable.
 */
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;
  const entries = Object.entries(colors) as [keyof ThemeColors, string][];

  for (const [key, value] of entries) {
    const cssVar = `--${camelToKebab(key)}`;
    root.style.setProperty(cssVar, value);
  }

  // Derive glow variables from primary/accent colors so they update with theme
  if (colors.primary) {
    // Strip trailing ')' if present, add alpha for glow effect
    const base = colors.primary.replace(/\)$/, '').trim();
    root.style.setProperty('--glow-primary', `${base} / 25%)`);
  }
  if (colors.accent) {
    const base = colors.accent.replace(/\)$/, '').trim();
    root.style.setProperty('--glow-accent', `${base} / 20%)`);
  }
}

/**
 * Apply appearance settings as CSS variables, data attributes, and classes.
 */
export function applyAppearance(appearance: ThemeAppearance): void {
  const root = document.documentElement;

  // Border radius mapping
  const radiusMap: Record<ThemeAppearance['borderRadius'], string> = {
    none: '0',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
  };
  root.style.setProperty('--radius', radiusMap[appearance.borderRadius]);

  // Shadow level
  root.dataset.shadows = appearance.shadows;

  // Card spacing & padding
  root.dataset.cardSpacing = appearance.cardSpacing;
  root.dataset.cardPadding = appearance.cardPadding;

  // Font — set data attribute for CSS and directly apply font-family on body
  // to bypass @theme inline specificity issues in Tailwind v4
  root.dataset.font = appearance.font;
  const fontFamily = FONT_FAMILY_MAP[appearance.font] || FONT_FAMILY_MAP.figtree;
  document.body.style.setProperty('font-family', fontFamily, 'important');

  // Icon style
  root.dataset.iconStyle = appearance.iconStyle;

  // Animations / reduced motion
  if (!appearance.animations || appearance.reducedMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
}
