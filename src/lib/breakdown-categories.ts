export const BREAKDOWN_CATEGORIES: Record<string, { label: string; color: string }> = {
  // Image types
  environment_wide: { label: "Environment (Wide)", color: "#3B82F6" },
  environment_detail: { label: "Environment (Detail)", color: "#60A5FA" },
  character_full: { label: "Character (Full Body)", color: "#F59E0B" },
  character_medium: { label: "Character (Medium)", color: "#FBBF24" },
  character_closeup: { label: "Character (Close-up)", color: "#F97316" },
  character_in_environment: { label: "Character in Environment", color: "#10B981" },
  prop_detail: { label: "Prop / Detail", color: "#8B5CF6" },
  transition_art: { label: "Transition Art", color: "#EC4899" },
  establishing: { label: "Establishing Shot", color: "#06B6D4" },
  // Audio types
  dialogue: { label: "Dialogue / Voice", color: "#EF4444" },
  audio_ambience: { label: "Ambience", color: "#6366F1" },
  audio_sfx: { label: "Sound Effect", color: "#7C3AED" },
  audio_music: { label: "Music", color: "#A855F7" },
  audio_foley: { label: "Foley", color: "#9333EA" },
  // Legacy (backward compat)
  cast_speaking: { label: "Cast (Speaking)", color: "#FF0000" },
  cast_silent: { label: "Cast (Silent)", color: "#FFA500" },
  props: { label: "Props", color: "#8B4513" },
  notes: { label: "Notes", color: "#808080" },
};
