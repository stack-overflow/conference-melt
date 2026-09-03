import type { Day, Location, ScheduleData, Session, Speaker, Term } from "../data/types";

export interface DataIndex {
  sessionById: Map<string, Session>;
  sessionIds: Set<string>;
  speakerById: Map<number, Speaker>;
  locationById: Map<number, Location>;
  typeById: Map<number, Term>;
  themeById: Map<number, Term>;
  brandById: Map<number, Term>;
  dayById: Map<string, Day>;
  sessionsByDay: Map<string, Session[]>;
}

function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Builds every lookup map once per data load. Every day in `data.days` gets a `sessionsByDay` entry, possibly empty. */
export function buildIndex(data: ScheduleData): DataIndex {
  const sessionsByDay = new Map<string, Session[]>(data.days.map((d) => [d.id, []]));
  for (const s of data.sessions) {
    const list = sessionsByDay.get(s.day);
    if (list) {
      list.push(s);
    } else {
      sessionsByDay.set(s.day, [s]);
    }
  }
  return {
    sessionById: new Map(data.sessions.map((s) => [s.id, s])),
    sessionIds: new Set(data.sessions.map((s) => s.id)),
    speakerById: byId(data.speakers),
    locationById: byId(data.locations),
    typeById: byId(data.types),
    themeById: byId(data.themes),
    brandById: byId(data.brands),
    dayById: new Map(data.days.map((d) => [d.id, d])),
    sessionsByDay,
  };
}

/** Type priority for the primary type and the `type` column axis (spec §7.2). */
export const TYPE_PRIORITY: string[] = [
  "Prelekcja",
  "Prelekcja z sesją",
  "Warsztaty",
  "Fotospacer",
  "Fotogra",
  "PLAYGROUND",
  "DZIAŁANIA W STREFIE SPRZĘTU",
  "STREFA TELEOBIEKTYWÓW",
  "Ogólne",
];

/** Position in TYPE_PRIORITY; unlisted types rank after every listed one. */
export function typeRank(name: string): number {
  const i = TYPE_PRIORITY.indexOf(name);
  return i === -1 ? TYPE_PRIORITY.length : i;
}

const collator = new Intl.Collator("pl");

function compareTypes(a: Term, b: Term): number {
  const byRank = typeRank(a.name) - typeRank(b.name);
  return byRank !== 0 ? byRank : collator.compare(a.name, b.name);
}

/** The session's first type in TYPE_PRIORITY order; among unlisted types the first by Polish collation. Null when no type id is known. */
export function primaryType(s: Session, index: DataIndex): Term | null {
  let best: Term | null = null;
  for (const id of s.typeIds) {
    const term = index.typeById.get(id);
    if (!term) continue;
    if (best === null || compareTypes(term, best) < 0) best = term;
  }
  return best;
}

/** Known locations of a session, in `locationIds` order. */
export function locationsOf(s: Session, index: DataIndex): Location[] {
  return s.locationIds.flatMap((id) => {
    const location = index.locationById.get(id);
    return location ? [location] : [];
  });
}

/** Known speakers of a session, in `speakerIds` order. */
export function speakersOf(s: Session, index: DataIndex): Speaker[] {
  return s.speakerIds.flatMap((id) => {
    const speaker = index.speakerById.get(id);
    return speaker ? [speaker] : [];
  });
}

/** Location shorts joined by " / "; empty string when the session has no known location. */
export function locationLabel(s: Session, index: DataIndex): string {
  return locationsOf(s, index)
    .map((l) => l.short)
    .join(" / ");
}
