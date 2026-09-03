export const SHARE_VERSION = "1~";

/** Day id -> single-letter share code. Unique across every id the normalizer can emit. */
export const DAY_CODES: Record<string, string> = {
  czw: "c",
  pt: "p",
  sob: "s",
  nd: "n",
  pon: "m",
  wt: "t",
  sr: "r",
};

const CODE_DAYS: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_CODES).map(([dayId, code]) => [code, dayId]),
);

const TOKEN = /^([0-9a-z]+)([cpsnmtr])$/;

export function encodePlan(ids: string[]): string {
  const tokens: string[] = [];
  for (const id of ids) {
    const sep = id.indexOf(":");
    if (sep < 0) continue;
    const eventId = Number(id.slice(0, sep));
    const code: string | undefined = DAY_CODES[id.slice(sep + 1)];
    if (!Number.isInteger(eventId) || eventId < 0 || code === undefined) continue;
    tokens.push(eventId.toString(36) + code);
  }
  return SHARE_VERSION + tokens.join(".");
}

export function decodePlan(str: string, sessionIds: ReadonlySet<string>): { ids: string[]; unknown: number } {
  if (!str.startsWith(SHARE_VERSION)) return { ids: [], unknown: 0 };
  const ids: string[] = [];
  const seen = new Set<string>();
  let unknown = 0;
  for (const token of str.slice(SHARE_VERSION.length).split(".")) {
    if (token === "") continue;
    const match = TOKEN.exec(token);
    if (match === null) {
      unknown += 1;
      continue;
    }
    const [, eventPart = "", code = ""] = match;
    const dayId: string | undefined = CODE_DAYS[code];
    if (dayId === undefined) {
      unknown += 1;
      continue;
    }
    const id = `${parseInt(eventPart, 36)}:${dayId}`;
    if (!sessionIds.has(id)) {
      unknown += 1;
      continue;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids, unknown };
}

export function buildShareUrl(href: string, dayId: string, ids: string[]): string {
  const u = new URL(href);
  u.search = "";
  u.hash = `#d=${dayId}&v=plan&plan=${encodePlan(ids)}`;
  return u.href;
}
