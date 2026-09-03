/**
 * Location term parsing, short labels and ordering (spec §4.2 "Locations").
 */
import type { Level } from "../../src/data/types";

export interface ParsedLocation { venue: string; level: Level; room: string | null; rule: 1 | 2 | 3 | 4 | 5 | 6 }

// Level alternation is longest-first so "II" is never read as "I".
const RULE_1 = /^(.*?)\s*-\s*poziom\s*(0|III|II|I)\s*-\s*(.+)$/i;
const RULE_2 = /^(.*?)\s*-\s*poziom\s*I\s*\(([^)]+)\)\s*i\s*poziom\s*II\s*\(([^)]+)\)$/i;
const RULE_3 = /^(.*?)\s*-\s*poziom\s*(0|III|II|I)\s*\(([^)]+)\)(?:\s*-\s*(.+))?$/i;
const RULE_4 = /^(.*?)\s*-\s*poziom\s*(0|III|II|I)$/i;
const RULE_5 = /^(.*?)\s*-\s*(Sala .+)$/;

const LEVEL_BY_TEXT = new Map<string, Level>([["0", "0"], ["I", "I"], ["II", "II"], ["III", "III"]]);

function levelOf(text: string): Level {
  return LEVEL_BY_TEXT.get(text.toUpperCase()) ?? null;
}

export function parseLocation(name: string): ParsedLocation {
  const trimmed = name.trim();
  let m = RULE_1.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: levelOf(m[2] ?? ""), room: m[3] ?? "", rule: 1 };
  m = RULE_2.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: "I+II", room: `${m[2] ?? ""} · ${m[3] ?? ""}`, rule: 2 };
  m = RULE_3.exec(trimmed);
  if (m) {
    const detail = m[4];
    const room = detail === undefined ? (m[3] ?? "") : `${m[3] ?? ""} · ${detail}`;
    return { venue: m[1] ?? "", level: levelOf(m[2] ?? ""), room, rule: 3 };
  }
  m = RULE_4.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: levelOf(m[2] ?? ""), room: null, rule: 4 };
  m = RULE_5.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: null, room: m[2] ?? "", rule: 5 };
  return { venue: trimmed, level: null, room: null, rule: 6 };
}

export const SHORT_LABELS: Record<number, string> = {
  282: "Sala wykł. 3",
  292: "Warsztat. II",
  279: "Sala wykł. 4",
  241: "Playground",
  318: "Rejestracja",
  293: "Warsztat. I",
  233: "Sala wykł. 1",
  281: "Sala wykł. 2",
  308: "Stoiska · Plenum",
  311: "Stoiska · Canon",
  307: "Stoiska · Plenum i SoSalsa",
  309: "Stoiska · SoSalsa",
  313: "Stoiska · Playground",
  310: "Stoiska · Dach",
  239: "Strefa sprzętu I",
  240: "Strefa sprzętu II",
  236: "Warsztat. IV",
  237: "Warsztat. V",
  235: "Warsztat. III",
  234: "Warsztat. II (ring)",
  312: "W4",
  280: "Sala wykł. 5",
  291: "Wkrótce",
  283: "Zero Zero · wejście",
  238: "Warsztat. VI",
  290: "Warsztat. VI (antresola)",
};

export function shortLabel(id: number, parsed: ParsedLocation): { short: string; fromMap: boolean } {
  const mapped: string | undefined = SHORT_LABELS[id];
  if (mapped !== undefined) return { short: mapped, fromMap: true };
  if (parsed.room !== null) {
    const short = parsed.room.replace("Sala wykładowa", "Sala wykł.").replace("Sala warsztatowa", "Warsztat.");
    return { short, fromMap: false };
  }
  return { short: parsed.venue, fromMap: false };
}

export const LEVEL_ORDER: Level[] = ["0", "I", "I+II", "II", "III", null];

const collator = new Intl.Collator("pl");

export function compareLocations(a: { level: Level; name: string }, b: { level: Level; name: string }): number {
  const byLevel = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
  if (byLevel !== 0) return byLevel;
  return collator.compare(a.name, b.name);
}
