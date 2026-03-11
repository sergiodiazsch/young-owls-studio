import mammoth from "mammoth";

/** Extract raw text from a .docx buffer. */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });

  if (result.messages && result.messages.length > 0) {
    const errors = result.messages.filter(m => m.type === "error");
    if (errors.length > 0) {
      throw new Error(`DOCX parsing errors: ${errors.map(e => e.message).join("; ")}`);
    }
  }

  if (!result.value || result.value.trim().length === 0) {
    throw new Error("DOCX file appears to be empty or could not be read");
  }

  return result.value;
}
