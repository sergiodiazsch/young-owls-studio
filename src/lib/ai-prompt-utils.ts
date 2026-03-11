import { getCharactersByProject, getPropsByProject } from "@/lib/db/queries";

/**
 * Scans a prompt for @CharacterName and @PropName mentions and appends each
 * matched entity's ai_generation_notes (if any) to the end of the prompt.
 *
 * Returns the enhanced prompt, or the original if no notes are found.
 */
export async function appendCharacterNotes(prompt: string, projectId: number): Promise<string> {
  // Quick bail — no @ mentions at all
  if (!prompt.includes("@")) return prompt;

  const [characters, props] = await Promise.all([
    getCharactersByProject(projectId),
    getPropsByProject(projectId),
  ]);

  const lowerPrompt = prompt.toLowerCase();
  const sections: string[] = [];

  // Character notes
  const charNotes: string[] = [];
  for (const char of characters) {
    if (!char.aiGenerationNotes) continue;
    if (lowerPrompt.includes(`@${char.name.toLowerCase()}`)) {
      charNotes.push(`[${char.name}]: ${char.aiGenerationNotes}`);
    }
  }
  if (charNotes.length > 0) {
    sections.push(`Character details:\n${charNotes.join("\n")}`);
  }

  // Prop notes
  const propNotes: string[] = [];
  for (const prop of props) {
    if (!prop.aiGenerationNotes) continue;
    if (lowerPrompt.includes(`@${prop.name.toLowerCase()}`)) {
      propNotes.push(`[${prop.name}]: ${prop.aiGenerationNotes}`);
    }
  }
  if (propNotes.length > 0) {
    sections.push(`Prop details:\n${propNotes.join("\n")}`);
  }

  if (sections.length === 0) return prompt;
  return `${prompt}\n\n${sections.join("\n\n")}`;
}
