export interface HashState {
  d?: string;
  v?: string;
  plan?: string;
}

const KEYS = ["d", "v", "plan"] as const;

/** Reads `#d=pt&v=grid&plan=1~...`; the leading `#` is optional, empty values are dropped. */
export function parseHash(hash: string): HashState {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: HashState = {};
  for (const key of KEYS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** Always `d`, `v`, `plan` order; `encodeURIComponent` leaves `~` and `.` intact so plan payloads stay readable. */
export function buildHash(h: HashState): string {
  const parts: string[] = [];
  for (const key of KEYS) {
    const value = h[key];
    if (value) parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return "#" + parts.join("&");
}

/** Fragment-only replaceState: the path and `?now=` query survive, Back is not affected. */
export function writeHash(h: HashState): void {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  history.replaceState(null, "", buildHash(h));
}
