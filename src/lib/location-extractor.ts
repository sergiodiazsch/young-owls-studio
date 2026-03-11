import type { Scene } from "./types";

interface ExtractedLocation {
  rawHeadings: string[];
  normalizedName: string;
  intExt: "int" | "ext" | "int/ext";
  timesOfDay: string[];
  sceneIds: number[];
  sceneCount: number;
}

/**
 * Title-case a location name, handling apostrophes correctly.
 * "DETECTIVE'S OFFICE" -> "Detective's Office"
 * "O'BRIEN'S BAR" -> "O'Brien's Bar"
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

export function extractLocations(scenes: Scene[]): ExtractedLocation[] {
  const locationMap = new Map<string, ExtractedLocation>();

  for (const scene of scenes) {
    const heading = scene.heading || "";

    // Determine INT/EXT from the pre-parsed headingType when available,
    // otherwise parse it from the heading string.
    let intExt: "int" | "ext" | "int/ext" = "int";
    if (scene.headingType) {
      const ht = scene.headingType.replace(/\./g, "").toLowerCase();
      if (ht.includes("int") && ht.includes("ext")) intExt = "int/ext";
      else if (ht.includes("ext")) intExt = "ext";
      else if (ht.includes("int")) intExt = "int";
    } else {
      const intExtMatch = heading.match(/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.?)\s*/i);
      if (intExtMatch) {
        const val = intExtMatch[1].replace(/\./g, "").toLowerCase();
        if (val.includes("int") && val.includes("ext")) intExt = "int/ext";
        else if (val.includes("ext")) intExt = "ext";
        else intExt = "int";
      }
    }

    // Use the pre-parsed location field from the scene when available.
    // Fall back to re-parsing the heading only if scene.location is empty.
    let location = (scene.location || "").trim();

    if (!location) {
      // Fallback: parse location from heading by stripping INT./EXT. prefix and time-of-day suffix
      location = heading
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.?)\s*/i, "")
        .replace(/\s*-\s*(DAY|NIGHT|MORNING|EVENING|DAWN|DUSK|LATER|CONTINUOUS|SAME TIME|MOMENTS LATER).*$/i, "")
        .trim();
    }

    // Skip scenes with no meaningful location (e.g. FADE IN, section headers)
    if (!location) continue;

    // Normalize to title case
    const normalized = toTitleCase(location);

    // Simple key for grouping (lowercase, no punctuation)
    const key = normalized.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

    // Skip if key is empty after normalization
    if (!key) continue;

    const timeOfDay = scene.timeOfDay || "";

    if (locationMap.has(key)) {
      const existing = locationMap.get(key)!;
      existing.sceneIds.push(scene.id);
      existing.sceneCount++;
      if (!existing.rawHeadings.includes(heading)) existing.rawHeadings.push(heading);
      if (timeOfDay && !existing.timesOfDay.includes(timeOfDay)) existing.timesOfDay.push(timeOfDay);
      // Merge intExt if scenes have different types
      if (existing.intExt !== intExt) existing.intExt = "int/ext";
    } else {
      locationMap.set(key, {
        rawHeadings: [heading],
        normalizedName: normalized,
        intExt,
        timesOfDay: timeOfDay ? [timeOfDay] : [],
        sceneIds: [scene.id],
        sceneCount: 1,
      });
    }
  }

  return Array.from(locationMap.values()).sort((a, b) => b.sceneCount - a.sceneCount);
}
