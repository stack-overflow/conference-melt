/**
 * Polish plural selection: 1 → `one`, 2–4 (except 12–14) → `few`, everything else → `many`.
 * The 11–14 exception is decided by the last two digits, so 22 takes `few` but 112 takes `many`.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (n === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** "1 wydarzenie", "2 wydarzenia", "5 wydarzeń" — the count with its declined noun. */
export function events(n: number): string {
  return `${n} ${plural(n, "wydarzenie", "wydarzenia", "wydarzeń")}`;
}
