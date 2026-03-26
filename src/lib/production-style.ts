/**
 * Production Style — prompt injection for AI tools.
 * Each style adds domain-specific rules for pacing, framing, dialogue, etc.
 */

export const PRODUCTION_STYLES = {
  childrens_animation: {
    label: "Children's Animation",
    description: "Optimized for kids TV shows (Bluey, Peppa Pig, Pixar shorts style)",
  },
  general: {
    label: "General",
    description: "Standard screenplay analysis — no domain-specific rules",
  },
  documentary: {
    label: "Documentary",
    description: "Interview-driven, narration-heavy, real-world pacing",
  },
  commercial: {
    label: "Commercial / Ad",
    description: "Short-form, high-impact, fast pacing",
  },
  music_video: {
    label: "Music Video",
    description: "Beat-driven, visual-first, minimal dialogue",
  },
} as const;

export type ProductionStyleKey = keyof typeof PRODUCTION_STYLES;

/**
 * Returns additional prompt text to inject into AI system prompts
 * based on the project's production style. Returns empty string for
 * "general" or null/undefined styles.
 */
// Universal directing rules applied to ALL styles (including "general")
const UNIVERSAL_DIRECTING_RULES = `
DIALOGUE SHOT DISCIPLINE (apply to ALL productions):
- When a character SPEAKS, frame the shot so ONLY the speaking character's face is visible. Use close-ups, medium close-ups, or over-the-shoulder shots where the camera is BEHIND the non-speaking character (showing only the back of their head or shoulder, never their face).
- NEVER frame a dialogue shot as a wide two-shot or group shot where multiple characters' faces are clearly visible — this creates visual confusion about who is speaking.
- For REACTION shots of the listener, cut to a separate shot of just the listening character.
- In scenes with 3+ characters, isolate the speaker in their own shot. Show the group listening in a separate wide where the speaker is NOT visible or is seen from behind.
- Two-shots and group shots are ONLY for non-dialogue moments: walking together, establishing spatial relationships, physical comedy, or silent emotional beats.
`;

export function getProductionStylePrompt(style: string | null | undefined): string {
  if (!style || style === "general") return UNIVERSAL_DIRECTING_RULES;

  const prompts: Record<string, string> = {
    childrens_animation: `
PRODUCTION STYLE: CHILDREN'S ANIMATION (ages 2-8)
Apply these rules to ALL analysis, breakdown, and editing decisions:

PACING & RHYTHM:
- Target episode length: 7-11 minutes (short-form) or 22 minutes (long-form)
- Individual scenes should be SHORT: 30-90 seconds max. Kids lose attention after 60s on one setup.
- Fast scene transitions — cut, don't fade. Wipes and fun transitions are OK.
- Repetition is GOOD: kids love callbacks, repeated phrases, running gags (Bluey's "for real life", Peppa's "a bit of a…")
- Build a rhythm: setup → complication → resolution within each scene, and across the episode
- "Rule of three" for jokes and story beats — works perfectly for this age group
- Every 2-3 minutes needs a new energy spike (physical comedy, music moment, surprise)

SHOT PLANNING & FRAMING:
- Favor WIDE and MEDIUM shots — kids need to see the full body and environment to understand spatial relationships
- Close-ups should be BRIEF and used for emotional beats only (a character's reaction, a surprise reveal)
- Keep camera movements SIMPLE: gentle pans, slow zooms. No handheld shake, no complex tracking shots.
- Shot duration: 3-5 seconds per shot. Never hold longer than 6 seconds.
- Establishing shots are essential — always show WHERE we are before WHAT happens
- Character eyelines should be clear — kids need to see who is talking to whom
- Bright, saturated color palettes. High contrast between characters and backgrounds.
- DIALOGUE FRAMING: When a character speaks, frame the shot so ONLY the speaker's face is visible. Use close-ups or over-the-shoulder angles where other characters are seen from behind. This keeps visual focus clear for young viewers — one face, one voice, no confusion about who is talking. In group scenes, isolate the speaker and cut to a separate reaction shot of listeners.

DIALOGUE & WRITING:
- Short sentences. 5-10 words per line max.
- Characters should SAY what they feel — subtext doesn't work for this audience. "I'm sad because..." is correct here.
- Avoid sarcasm, irony, or double meanings — they confuse young viewers
- Each character needs a DISTINCT voice pattern: catchphrases, specific vocabulary, speech rhythm
- Dialogue should be slightly slower than real speech — kids need processing time
- Name characters frequently in dialogue — kids are still learning to track who is who
- Include moments of DIRECT ADDRESS or rhetorical questions to engage the viewer ("Can YOU see the butterfly?")

STORY STRUCTURE:
- Clear, simple A-plot. No subplots for short-form. One simple B-plot max for 22-min format.
- The PROBLEM should be introduced within the first 30 seconds
- Resolution should include a LESSON or TAKEAWAY — but embedded naturally, never preachy
- Emotional stakes should be age-appropriate: losing a toy > existential crisis
- Happy or hopeful endings. Even bittersweet endings need a clear positive note.
- Characters should GROW or LEARN something specific by the end

AUDIO & MUSIC:
- Music should be prominent — it guides emotional state for pre-literate viewers
- Sound effects should be exaggerated and fun (cartoon physics: boings, whooshes, pops)
- Ambient sound should be MINIMAL — it competes with dialogue comprehension
- Consider singalong or musical moments — they increase engagement
- Silence is powerful but BRIEF: 1-2 seconds max before kids disengage`,

    documentary: `
PRODUCTION STYLE: DOCUMENTARY
Apply these rules to ALL analysis, breakdown, and editing decisions:
- Favor talking-head interviews alternated with B-roll sequences
- Pacing is slower and more contemplative — let subjects breathe
- Narration carries the story; dialogue is secondary
- Shot durations can be longer (5-15 seconds) for atmospheric B-roll
- Music should be understated, never competing with narration
- Structure follows thesis → evidence → conclusion arcs
- Visual variety is key: archival footage, graphics, on-location, interviews`,

    commercial: `
PRODUCTION STYLE: COMMERCIAL / ADVERTISEMENT
Apply these rules to ALL analysis, breakdown, and editing decisions:
- Total duration: 15-60 seconds typically
- Every second counts — no wasted frames
- Hook in the first 2 seconds
- Quick cuts (1-3 seconds per shot)
- Product/message must be clear and memorable
- End with strong CTA (call to action)
- Music/sound design is critical for brand identity
- Dialogue should be punchy, quotable, minimal`,

    music_video: `
PRODUCTION STYLE: MUSIC VIDEO
Apply these rules to ALL analysis, breakdown, and editing decisions:
- Cuts should align with beat/rhythm of the music
- Visual storytelling over dialogue
- Performance shots interspersed with narrative
- Color grading and lighting are primary storytelling tools
- Shot variety: wide performance, close-up details, abstract visuals
- Pacing follows the song's energy curve (verse vs. chorus)
- Transitions can be creative and stylized`,
  };

  return UNIVERSAL_DIRECTING_RULES + (prompts[style] || "");
}
