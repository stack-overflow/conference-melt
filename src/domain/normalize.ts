/**
 * Folds text for matching (spec §5.4): ł→l and Ł→L first (they have no canonical
 * decomposition), then NFD, strip combining marks, lowercase. Shared by the fetch
 * script's speaker matching and the app's search.
 */
export function normalizeText(s: string): string {
  return s
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const TOKEN = /\p{L}+|\p{N}+/gu;

/** Word tokens of the normalized text as a set, for order-insensitive name comparison. */
export function nameTokens(s: string): Set<string> {
  return new Set(normalizeText(s).match(TOKEN) ?? []);
}
