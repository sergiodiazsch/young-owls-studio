import type { ParsedScreenplay, ParsedScene } from "./types";

/**
 * Local screenplay parser using pattern matching.
 * Handles standard screenplay formatting with blank lines between
 * character names, parentheticals, and dialogue.
 * Supports bilingual screenplays (English dialogue + Spanish directions).
 */

// Scene heading: INT. or EXT. (with variations)
// Supports optional leading scene number + whitespace (e.g. "1   INT. LOCATION - DAY   1")
const HEADING_RE = /^(?:\d+\s+)?(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.)[\s]+(.+)/i;

// Transitions — English and Spanish
const TRANSITION_RE = /^(FADE IN:|FADE OUT[.:]|FADE TO:|CUT TO:|SMASH CUT TO:|SMASH CUT A:|MATCH CUT TO:|DISSOLVE TO:|WIPE TO:|IRIS IN:|IRIS OUT:|JUMP CUT TO:|CORTE A:|DISUELVE A:|FUNDE A:)(.*)$/i;

// Character name: ALL CAPS (including accented) with optional extension (V.O., O.S., CONT'D, etc.)
const CHARACTER_RE = /^([A-ZÀ-ÖØ-ÞŁŃ][A-ZÀ-ÖØ-ÞŁŃ\s.'\-#0-9]{0,40})(\s*\(V\.O\.\)|\s*\(O\.S\.\)|\s*\(O\.C\.\)|\s*\(CONT'D\)|\s*\(CONT\))?$/;

// Inline dialogue format: CHARACTER: dialogue text (common in Spanish screenplays)
const INLINE_DIALOGUE_RE = /^([A-ZÀ-ÖØ-ÞŁŃ][A-ZÀ-ÖØ-ÞŁŃ\s.'\-]{0,40}):\s+(.+)$/;

const PARENTHETICAL_RE = /^\(.+\)$/;
// Markdown-style parentheticals: *shrill*, *whispers*, etc.
const MD_PARENTHETICAL_RE = /^\*([^*]+)\*$/;

// Special element markers
const BROLL_RE = /^B-?ROLL:?\s*(.*)/i;
const MUSIC_RE = /^MUSI[CK]A?:?\s*(.*)/i;
const NOTE_RE = /^NOTA?:?\s*(.*)/i;

// Section markers — includes #WORD# format (e.g. #INTRO#)
const SECTION_RE = /^(ACT\s+(ONE|TWO|THREE|FOUR|FIVE|\d+)|COLD\s+OPEN|TEASER|TAG|END\s+OF\s+(ACT|EPISODE)|#[A-Z][A-Z\s]*#)$/i;

function extractHeadingParts(heading: string): { headingType: string; location: string; timeOfDay: string } {
  const match = heading.match(HEADING_RE);
  if (!match) return { headingType: "", location: "", timeOfDay: "" };

  const prefix = match[1].toUpperCase().replace("I/E.", "INT/EXT.");
  // Strip trailing tabs + scene numbers (e.g. "\t\t\t\t1")
  const rest = match[2].replace(/\t+\d*\s*$/, "").trim();

  const dashIndex = rest.lastIndexOf(" - ");
  if (dashIndex >= 0) {
    return {
      headingType: prefix.replace(".", ""),
      location: rest.slice(0, dashIndex).trim(),
      timeOfDay: rest.slice(dashIndex + 3).trim(),
    };
  }

  return { headingType: prefix.replace(".", ""), location: rest, timeOfDay: "" };
}

/** Strip Markdown formatting from a string: ### headings, *italic*, **bold** */
function stripMarkdown(text: string): string {
  return text.replace(/^#+\s*/, "").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").trim();
}

function inferTitle(rawText: string, filename?: string): { title: string; subtitle: string } {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (HEADING_RE.test(lines[i])) break;
    if (SECTION_RE.test(lines[i])) continue;
    if (lines[i].length > 2 && lines[i].length < 80 && !lines[i].startsWith("FADE")) {
      const title = stripMarkdown(lines[i]);
      const nextLine = lines[i + 1];
      const subtitle = nextLine && !HEADING_RE.test(nextLine) && !SECTION_RE.test(nextLine) ? stripMarkdown(nextLine) : "";
      return { title, subtitle };
    }
  }

  if (filename) {
    return { title: filename.replace(/\.\w+$/, "").replace(/[_-]/g, " "), subtitle: "" };
  }

  return { title: "Untitled Screenplay", subtitle: "" };
}

/** Normalize text from DOCX: collapse excessive blank lines so the parser works correctly */
function normalizeBlankLines(text: string): string {
  // Collapse 3+ consecutive newlines down to 2 (one blank line)
  return text.replace(/\n{3,}/g, "\n\n");
}

// Words that indicate an action/direction line, not a character name
const ACTION_WORDS = new Set([
  // Articles & pronouns
  "THE", "A", "AN", "HIS", "HER", "THEIR", "ITS", "THIS", "THAT", "THESE", "THOSE",
  // Verbs
  "IS", "ARE", "WAS", "WERE", "HAS", "HAVE", "HAD", "GOES", "RUNS", "WALKS",
  "OPENS", "CLOSES", "TURNS", "LOOKS", "SEES", "TAKES", "GETS", "COMES", "MOVES",
  "SITS", "STANDS", "FALLS", "PULLS", "PUSHES", "PICKS", "PUTS", "THROWS",
  "ENTERS", "EXITS", "LEAVES", "STARTS", "STOPS", "BEGINS", "ENDS",
  // Prepositions
  "WITH", "FROM", "INTO", "THROUGH", "OVER", "UNDER", "BEHIND", "BETWEEN",
  "ACROSS", "AROUND", "TOWARD", "TOWARDS", "AGAINST", "ALONG", "UPON",
  // Camera/editing terms
  "ANGLE", "WIDER", "CLOSER", "CLOSE", "CONTINUOUS", "INTERCUT", "RESUME",
  "FLASHBACK", "DREAM", "MONTAGE", "SERIES", "SUPER", "TITLE", "CARD",
  "BACK", "SAME", "LATER", "MEANWHILE", "SUDDENLY",
  // Spanish common words
  "EL", "LA", "LOS", "LAS", "UN", "UNA", "UNOS", "UNAS", "DEL", "AL",
  "SE", "LE", "LO", "QUE", "CON", "POR", "PARA", "SIN", "SOBRE",
  "MIENTRAS", "DESPUÉS", "ANTES",
]);

// Common screenplay direction phrases that look like character names
const DIRECTION_PHRASES_RE = /^(ANGLE ON|CLOSE ON|WIDER ON|WIDE SHOT|CLOSE UP|MEDIUM SHOT|BACK TO|SAME TIME|MOMENTS? LATER|THE NEXT|TIME CUT|SERIES OF|END OF|TITLE CARD|SUPER:|ON SCREEN|WE SEE|WE HEAR|ON THE|IN THE|AT THE|PULL BACK|PUSH IN|PAN TO|ZOOM IN|ZOOM OUT|ZOOM|SMASH TO)/i;

/** Check if a line looks like a character cue (ALL CAPS, not too long, not a known keyword) */
function isCharacterCue(trimmed: string): string | null {
  if (trimmed.length < 2 || trimmed.length > 50) return null;
  if (trimmed !== trimmed.toUpperCase()) return null;
  if (HEADING_RE.test(trimmed)) return null;
  if (TRANSITION_RE.test(trimmed)) return null;
  if (BROLL_RE.test(trimmed)) return null;
  if (MUSIC_RE.test(trimmed)) return null;
  if (NOTE_RE.test(trimmed)) return null;
  if (SECTION_RE.test(trimmed)) return null;

  // Reject common direction phrases
  if (DIRECTION_PHRASES_RE.test(trimmed)) return null;

  // Character names don't end with sentence punctuation
  if (/[.!?;,]$/.test(trimmed)) return null;

  const match = trimmed.match(CHARACTER_RE);
  if (!match) return null;

  const name = match[1].trim();
  const words = name.split(/\s+/);

  // Character names are typically 1-3 words (e.g. "MARCO", "DR. SMITH", "OFFICER JAMES")
  if (words.length > 4) return null;

  // If any word in the name is a common action/direction word, it's not a character
  // Exception: single-word "names" that ARE action words are rejected
  // But multi-word names like "DR. JAMES" where "DR." is not an action word are ok
  if (words.length === 1 && ACTION_WORDS.has(words[0])) return null;
  if (words.length >= 2) {
    // If the FIRST word is an article/verb/preposition, it's action not a name
    if (ACTION_WORDS.has(words[0])) return null;
  }

  return name;
}

/** Check if a line uses inline dialogue format: CHARACTER: dialogue text */
function isInlineDialogue(trimmed: string): { character: string; line: string } | null {
  // Skip known patterns that use colons (MUSIC:, NOTA:, FADE IN:, etc.)
  if (TRANSITION_RE.test(trimmed)) return null;
  if (BROLL_RE.test(trimmed)) return null;
  if (MUSIC_RE.test(trimmed)) return null;
  if (NOTE_RE.test(trimmed)) return null;
  if (HEADING_RE.test(trimmed)) return null;

  const match = trimmed.match(INLINE_DIALOGUE_RE);
  if (!match) return null;

  const name = match[1].trim();
  // Verify the name part is all uppercase
  if (name !== name.toUpperCase()) return null;
  // Skip if it looks like a scene heading prefix
  if (/^(INT|EXT|INT\/EXT)$/.test(name)) return null;

  return { character: name, line: match[2].trim() };
}

export function parseScreenplayLocal(rawText: string, filename?: string): ParsedScreenplay {
  // Normalize blank lines from DOCX extraction (mammoth adds \n\n between paragraphs,
  // empty paragraphs in the DOCX create 3+ consecutive newlines that break dialogue detection)
  const normalizedText = normalizeBlankLines(rawText);
  const lines = normalizedText.split("\n");
  const scenes: ParsedScene[] = [];
  const characterSet = new Map<string, number>();

  let currentScene: ParsedScene | null = null;
  let elementOrder = 0;
  let sceneNumber = 0;
  let currentSection = "";

  // Dialogue state machine
  let dialogueState: "none" | "character-seen" | "in-dialogue" = "none";
  let currentCharacter = "";
  let currentParenthetical = "";
  let blankLineCount = 0;
  let pendingAction: string[] = [];

  function flushAction() {
    if (pendingAction.length > 0 && currentScene) {
      const content = pendingAction.join("\n").trim();
      if (content) {
        currentScene.elements.push({
          type: "action",
          content,
          sortOrder: elementOrder++,
        });
      }
      pendingAction = [];
    }
  }

  function endDialogue() {
    dialogueState = "none";
    currentCharacter = "";
    currentParenthetical = "";
  }

  function startScene(heading: string) {
    flushAction();
    endDialogue();
    sceneNumber++;
    // Clean heading: strip leading scene numbers and trailing tabs+numbers
    const cleanHeading = heading.trim().replace(/^\d+\s+/, "").replace(/\t+\d*\s*$/, "").trim();
    const { headingType, location, timeOfDay } = extractHeadingParts(heading);

    currentScene = {
      sceneNumber,
      heading: cleanHeading,
      headingType,
      location,
      timeOfDay,
      section: currentSection,
      synopsis: "",
      elements: [],
    };
    scenes.push(currentScene);
    elementOrder = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Track blank lines
    if (!trimmed) {
      blankLineCount++;
      // After 3+ consecutive blank lines, end dialogue block
      // (increased from 2 to handle DOCX files with extra spacing)
      if (blankLineCount >= 3 && dialogueState !== "none") {
        endDialogue();
      }
      continue;
    }
    blankLineCount = 0;

    // Section markers (COLD OPEN, ACT ONE, etc.)
    if (SECTION_RE.test(trimmed)) {
      currentSection = trimmed;
      continue;
    }

    // Scene heading
    if (HEADING_RE.test(trimmed)) {
      startScene(trimmed);
      continue;
    }

    // If no scene started yet, skip (title page content)
    if (!currentScene) continue;
    const scene: ParsedScene = currentScene;

    // Transition
    if (TRANSITION_RE.test(trimmed)) {
      flushAction();
      endDialogue();
      scene.elements.push({
        type: "transition",
        content: trimmed,
        sortOrder: elementOrder++,
      });
      continue;
    }

    // B-Roll
    const brollMatch = trimmed.match(BROLL_RE);
    if (brollMatch) {
      flushAction();
      endDialogue();
      scene.elements.push({
        type: "broll",
        content: brollMatch[1] || trimmed,
        sortOrder: elementOrder++,
      });
      continue;
    }

    // Music cue (MUSIC: or MUSICA:)
    const musicMatch = trimmed.match(MUSIC_RE);
    if (musicMatch) {
      flushAction();
      endDialogue();
      scene.elements.push({
        type: "music",
        content: musicMatch[1] || trimmed,
        sortOrder: elementOrder++,
      });
      continue;
    }

    // Note (NOTE: or NOTA:)
    const noteMatch = trimmed.match(NOTE_RE);
    if (noteMatch) {
      flushAction();
      endDialogue();
      scene.elements.push({
        type: "note",
        content: noteMatch[1] || trimmed,
        sortOrder: elementOrder++,
      });
      continue;
    }

    // Parenthetical — valid in character-seen or in-dialogue state
    // Supports both (text) and *text* (markdown italic) formats
    if (dialogueState === "character-seen" || dialogueState === "in-dialogue") {
      if (PARENTHETICAL_RE.test(trimmed)) {
        currentParenthetical = trimmed.slice(1, -1);
        continue;
      }
      const mdParenMatch = trimmed.match(MD_PARENTHETICAL_RE);
      if (mdParenMatch) {
        currentParenthetical = mdParenMatch[1];
        continue;
      }
    }

    // Inline dialogue format: CHARACTER: dialogue text
    const inlineMatch = isInlineDialogue(trimmed);
    if (inlineMatch && currentScene) {
      flushAction();
      endDialogue();
      scene.elements.push({
        type: "dialogue",
        character: inlineMatch.character,
        line: inlineMatch.line,
        sortOrder: elementOrder++,
      });
      characterSet.set(inlineMatch.character, (characterSet.get(inlineMatch.character) || 0) + 1);
      continue;
    }

    // Character name detection
    const charName = isCharacterCue(trimmed);
    if (charName) {
      flushAction();
      endDialogue();
      currentCharacter = charName;
      dialogueState = "character-seen";
      characterSet.set(currentCharacter, characterSet.get(currentCharacter) || 0);
      continue;
    }

    // Dialogue line — after seeing a character name (with optional blank lines/parentheticals in between)
    if ((dialogueState === "character-seen" || dialogueState === "in-dialogue") && currentCharacter) {
      flushAction();
      scene.elements.push({
        type: "dialogue",
        character: currentCharacter,
        parenthetical: currentParenthetical || undefined,
        line: trimmed,
        sortOrder: elementOrder++,
      });
      characterSet.set(currentCharacter, (characterSet.get(currentCharacter) || 0) + 1);
      currentParenthetical = "";
      dialogueState = "in-dialogue";
      continue;
    }

    // Default: action/description
    endDialogue();
    pendingAction.push(trimmed);
  }

  // Flush remaining
  flushAction();

  // Generate synopsis for each scene
  for (const scene of scenes) {
    const actionText = scene.elements
      .filter((e) => e.type === "action")
      .map((e) => e.content)
      .join(" ");
    const dialoguePreview = scene.elements
      .filter((e) => e.type === "dialogue")
      .slice(0, 2)
      .map((e) => `${e.character}: ${e.line}`)
      .join(" | ");
    scene.synopsis = (actionText.slice(0, 150) + (dialoguePreview ? " — " + dialoguePreview.slice(0, 100) : "")) || `Scene at ${scene.location}`;
  }

  // Build character list
  const characters = Array.from(characterSet.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      description: `${count} dialogue line${count !== 1 ? "s" : ""}`,
    }));

  const { title, subtitle } = inferTitle(rawText, filename);

  return { title, subtitle, scenes, characters };
}
