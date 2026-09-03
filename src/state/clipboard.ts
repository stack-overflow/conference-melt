/**
 * Copies `text` through `navigator.clipboard.writeText`.
 * Resolves `false` (never throws) when the API is missing or the write is refused,
 * so callers can fall back to the "Skopiuj ręcznie" sheet.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const clipboard: Partial<Clipboard> | undefined = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
