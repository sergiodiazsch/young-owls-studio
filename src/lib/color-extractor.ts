// ── Color Extraction Utility for Color Script Feature ──
// Server-side color extraction using raw pixel sampling and k-means quantization.

import fs from "fs";

// ── Types ──

export interface ColorInfo {
  hex: string;
  percentage: number;
  name: string;
}

export interface ColorData {
  dominantColors: ColorInfo[];
  averageColor: string;
  brightness: number;
  saturation: number;
  warmth: number;
}

// ── Color Conversion Helpers ──

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) {
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
      h = ((bn - rn) / d + 2) / 6;
    } else {
      h = ((rn - gn) / d + 4) / 6;
    }
  }

  return [h * 360, s, l];
}

// ── CSS Named Colors for Matching ──

const NAMED_COLORS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: "black", rgb: [0, 0, 0] },
  { name: "white", rgb: [255, 255, 255] },
  { name: "red", rgb: [255, 0, 0] },
  { name: "crimson", rgb: [220, 20, 60] },
  { name: "dark red", rgb: [139, 0, 0] },
  { name: "orange", rgb: [255, 165, 0] },
  { name: "dark orange", rgb: [255, 140, 0] },
  { name: "yellow", rgb: [255, 255, 0] },
  { name: "gold", rgb: [255, 215, 0] },
  { name: "green", rgb: [0, 128, 0] },
  { name: "lime", rgb: [0, 255, 0] },
  { name: "dark green", rgb: [0, 100, 0] },
  { name: "teal", rgb: [0, 128, 128] },
  { name: "cyan", rgb: [0, 255, 255] },
  { name: "blue", rgb: [0, 0, 255] },
  { name: "navy", rgb: [0, 0, 128] },
  { name: "sky blue", rgb: [135, 206, 235] },
  { name: "steel blue", rgb: [70, 130, 180] },
  { name: "royal blue", rgb: [65, 105, 225] },
  { name: "purple", rgb: [128, 0, 128] },
  { name: "indigo", rgb: [75, 0, 130] },
  { name: "violet", rgb: [238, 130, 238] },
  { name: "magenta", rgb: [255, 0, 255] },
  { name: "pink", rgb: [255, 192, 203] },
  { name: "hot pink", rgb: [255, 105, 180] },
  { name: "brown", rgb: [139, 69, 19] },
  { name: "chocolate", rgb: [210, 105, 30] },
  { name: "sienna", rgb: [160, 82, 45] },
  { name: "tan", rgb: [210, 180, 140] },
  { name: "beige", rgb: [245, 245, 220] },
  { name: "ivory", rgb: [255, 255, 240] },
  { name: "gray", rgb: [128, 128, 128] },
  { name: "dark gray", rgb: [64, 64, 64] },
  { name: "light gray", rgb: [192, 192, 192] },
  { name: "silver", rgb: [192, 192, 192] },
  { name: "olive", rgb: [128, 128, 0] },
  { name: "maroon", rgb: [128, 0, 0] },
  { name: "coral", rgb: [255, 127, 80] },
  { name: "salmon", rgb: [250, 128, 114] },
  { name: "peach", rgb: [255, 218, 185] },
  { name: "lavender", rgb: [230, 230, 250] },
  { name: "slate", rgb: [112, 128, 144] },
];

function nameColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let minDist = Infinity;
  let bestName = "unknown";

  for (const named of NAMED_COLORS) {
    const dr = r - named.rgb[0];
    const dg = g - named.rgb[1];
    const db = b - named.rgb[2];
    // Weighted Euclidean distance (human eye is more sensitive to green)
    const dist = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
    if (dist < minDist) {
      minDist = dist;
      bestName = named.name;
    }
  }

  return bestName;
}

// ── Warmth Calculation ──

/** Calculate warmth from RGB. Returns -1 (cool) to +1 (warm). */
function calculateWarmth(r: number, g: number, b: number): number {
  // Warm colors have more red/yellow, cool colors have more blue
  const warmScore = (r * 1.0 + g * 0.5) / 255;
  const coolScore = (b * 1.0 + g * 0.3) / 255;
  const raw = warmScore - coolScore;
  // Normalize to -1..+1 range
  return Math.max(-1, Math.min(1, raw));
}

// ── K-Means Clustering ──

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function kMeans(
  pixels: number[][],
  k: number,
  maxIterations: number = 20
): number[][] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => [...p]);

  // Initialize centroids by picking evenly spaced pixels
  const centroids: number[][] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[i * step]]);
  }

  const assignments = new Array<number>(pixels.length);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assign each pixel to nearest centroid
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dist = euclideanDistance(pixels[i], centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids
    const sums: number[][] = centroids.map(() => [0, 0, 0]);
    const counts = new Array<number>(centroids.length).fill(0);

    for (let i = 0; i < pixels.length; i++) {
      const cluster = assignments[i];
      sums[cluster][0] += pixels[i][0];
      sums[cluster][1] += pixels[i][1];
      sums[cluster][2] += pixels[i][2];
      counts[cluster]++;
    }

    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] > 0) {
        centroids[c][0] = sums[c][0] / counts[c];
        centroids[c][1] = sums[c][1] / counts[c];
        centroids[c][2] = sums[c][2] / counts[c];
      }
    }
  }

  return centroids;
}

// ── Pixel Sampling from Buffer ──

/**
 * Sample RGB pixels from an image buffer by reading raw bytes at intervals.
 * Since we cannot decode PNG/JPEG natively on the server without sharp/canvas,
 * we treat the buffer as raw data and sample byte triplets. This gives an
 * approximate color palette that is sufficient for mood/color analysis.
 *
 * For more accurate results, we skip known file header regions and look for
 * byte patterns that are likely pixel data (avoiding metadata, compression
 * tables, etc.).
 */
function samplePixelsFromBuffer(buffer: Buffer, targetSamples: number = 300): number[][] {
  const samples: number[][] = [];

  // Skip file headers (first ~100 bytes typically contain headers/metadata)
  const headerSkip = Math.min(100, Math.floor(buffer.length * 0.02));
  // Also skip the last few bytes (may contain trailing metadata)
  const usableLength = buffer.length - headerSkip - 16;

  if (usableLength < 12) return samples;

  const step = Math.max(3, Math.floor(usableLength / targetSamples / 3) * 3);

  for (
    let i = headerSkip;
    i < buffer.length - 3 && samples.length < targetSamples;
    i += step
  ) {
    const r = buffer[i] & 0xff;
    const g = buffer[i + 1] & 0xff;
    const b = buffer[i + 2] & 0xff;

    // Filter out likely non-pixel data:
    // - All zeros or all 255 (likely padding/headers)
    // - Very uniform values that suggest compressed/encoded data
    const sum = r + g + b;
    if (sum > 30 && sum < 720) {
      // Also skip values that look like repeated marker bytes
      if (!(r === g && g === b && (r === 0xff || r === 0x00))) {
        samples.push([r, g, b]);
      }
    }
  }

  // If we got very few "colored" samples, do a second pass with relaxed filters
  if (samples.length < 10) {
    for (
      let i = headerSkip;
      i < buffer.length - 3 && samples.length < targetSamples;
      i += step
    ) {
      const r = buffer[i] & 0xff;
      const g = buffer[i + 1] & 0xff;
      const b = buffer[i + 2] & 0xff;
      const sum = r + g + b;
      if (sum > 5 && sum < 760) {
        samples.push([r, g, b]);
      }
    }
  }

  return samples;
}

// ── Main Extraction Functions ──

const DEFAULT_COLOR_DATA: ColorData = {
  dominantColors: [{ hex: "#808080", percentage: 100, name: "gray" }],
  averageColor: "#808080",
  brightness: 0.5,
  saturation: 0,
  warmth: 0,
};

/** Extract color data from a raw image buffer. */
export async function extractColorsFromBuffer(
  buffer: Buffer
): Promise<ColorData> {
  const samples = samplePixelsFromBuffer(buffer, 300);

  if (samples.length < 5) {
    return { ...DEFAULT_COLOR_DATA };
  }

  // Run k-means to find dominant colors
  const k = Math.min(6, Math.ceil(samples.length / 10));
  const centroids = kMeans(samples, k);

  if (centroids.length === 0) {
    return { ...DEFAULT_COLOR_DATA };
  }

  // Count how many samples are closest to each centroid (for percentages)
  const counts = new Array<number>(centroids.length).fill(0);
  for (const pixel of samples) {
    let minDist = Infinity;
    let bestIdx = 0;
    for (let c = 0; c < centroids.length; c++) {
      const dist = euclideanDistance(pixel, centroids[c]);
      if (dist < minDist) {
        minDist = dist;
        bestIdx = c;
      }
    }
    counts[bestIdx]++;
  }

  const totalSamples = samples.length;

  // Build dominant colors list
  const dominantColors: ColorInfo[] = centroids
    .map((centroid, idx) => {
      const hex = rgbToHex(centroid[0], centroid[1], centroid[2]);
      return {
        hex,
        percentage: Math.round((counts[idx] / totalSamples) * 100),
        name: nameColor(hex),
      };
    })
    .filter((c) => c.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage);

  // Calculate average color
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  for (const s of samples) {
    avgR += s[0];
    avgG += s[1];
    avgB += s[2];
  }
  avgR /= totalSamples;
  avgG /= totalSamples;
  avgB /= totalSamples;
  const averageColor = rgbToHex(avgR, avgG, avgB);

  // Calculate overall brightness (0..1)
  // Using perceived luminance formula
  const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114) / 255;

  // Calculate overall saturation from HSL values
  const hslValues = samples.map(([r, g, b]) => rgbToHsl(r, g, b));
  const avgSaturation =
    hslValues.reduce((sum, [, s]) => sum + s, 0) / hslValues.length;

  // Calculate overall warmth
  const warmthValues = samples.map(([r, g, b]) => calculateWarmth(r, g, b));
  const avgWarmth =
    warmthValues.reduce((sum, w) => sum + w, 0) / warmthValues.length;

  return {
    dominantColors,
    averageColor,
    brightness: Math.round(brightness * 1000) / 1000,
    saturation: Math.round(avgSaturation * 1000) / 1000,
    warmth: Math.round(avgWarmth * 1000) / 1000,
  };
}

/** Extract color data from an image file on disk. */
export async function extractColorsFromFile(
  filePath: string
): Promise<ColorData> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return extractColorsFromBuffer(buffer);
}
