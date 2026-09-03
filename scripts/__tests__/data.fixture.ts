import type { Day, Location, ScheduleData, Session, Term } from "../../src/data/types";

/** A complete Session; `id` must be "<eventId>:<dayId>". */
export function sessionOf(id: string, overrides: Partial<Session> = {}): Session {
  const [eventId, day] = id.split(":");
  return {
    id,
    eventId: Number(eventId),
    day: day ?? "pt",
    title: `Sesja ${id}`,
    start: 570,
    end: 630,
    allDay: false,
    timeText: "09:30-10:30",
    speakerIds: [],
    byline: null,
    typeIds: [184],
    themeIds: [],
    brandIds: [],
    locationIds: [233],
    signup: { status: "included", url: null, label: "W ramach festiwalu" },
    descriptionHtml: "",
    url: `https://swiatlosila.pl/cyfrowe-event/${eventId ?? "x"}/`,
    ...overrides,
  };
}

export const DAYS: Day[] = [
  { id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" },
  { id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" },
];

export const TYPES: Term[] = [
  { id: 242, slug: "ogolne", name: "Ogólne", count: 1 },
  { id: 184, slug: "prelekcja", name: "Prelekcja", count: 4 },
  { id: 278, slug: "prelekcja-z-sesja", name: "Prelekcja z sesją", count: 1 },
  { id: 5, slug: "warsztaty", name: "Warsztaty", count: 1 },
];

export const LOCATIONS: Location[] = [
  {
    id: 233,
    slug: "so-salsa-sala-1",
    name: "So Salsa - poziom II - Sala wykładowa nr 1",
    count: 5,
    venue: "So Salsa",
    level: "II",
    room: "Sala wykładowa nr 1",
    short: "Sala wykł. 1",
    order: 0,
  },
  {
    id: 281,
    slug: "sosalsa-sala-2",
    name: "SoSalsa - poziom II - Sala wykładowa nr 2",
    count: 1,
    venue: "SoSalsa",
    level: "II",
    room: "Sala wykładowa nr 2",
    short: "Sala wykł. 2",
    order: 1,
  },
  {
    id: 318,
    slug: "rejestracja",
    name: "Rejestracja",
    count: 1,
    venue: "Rejestracja",
    level: null,
    room: null,
    short: "Rejestracja",
    order: 2,
  },
];

export function dataOf(sessions: Session[]): ScheduleData {
  return {
    meta: {
      source: "https://swiatlosila.pl/harmonogram-2026/",
      fetchedAt: "2026-09-03T12:00:00.000Z",
      year: 2026,
      version: 1,
      eventCount: new Set(sessions.map((s) => s.eventId)).size,
      sessionCount: sessions.length,
      speakerCount: 0,
    },
    days: DAYS,
    locations: LOCATIONS,
    types: TYPES,
    themes: [],
    brands: [],
    signupStatuses: [],
    speakers: [],
    sessions,
  };
}
