import type { Day, Location, ScheduleData, Session, Speaker, Term } from "../../data/types";

const THURSDAY: Day = {
  id: "czw",
  termId: 276,
  date: "2026-09-03",
  label: "Czwartek",
  short: "Czw",
  labelLong: "Czwartek, 3 września",
};

const FRIDAY: Day = {
  id: "pt",
  termId: 53,
  date: "2026-09-04",
  label: "Piątek",
  short: "Pt",
  labelLong: "Piątek, 4 września",
};

const SATURDAY: Day = {
  id: "sob",
  termId: 18,
  date: "2026-09-05",
  label: "Sobota",
  short: "Sob",
  labelLong: "Sobota, 5 września",
};

const DAYS: Day[] = [THURSDAY, FRIDAY, SATURDAY];

const TYPES: Term[] = [
  { id: 184, slug: "prelekcja", name: "Prelekcja", count: 51 },
  { id: 278, slug: "prelekcja-z-sesja", name: "Prelekcja z sesją", count: 5 },
  { id: 5, slug: "warsztaty", name: "Warsztaty", count: 12 },
  { id: 242, slug: "ogolne", name: "Ogólne", count: 13 },
];

const LOCATIONS: Location[] = [
  {
    id: 308,
    slug: "stoiska-wystawcow-poziom-i-plenum",
    name: "Stoiska wystawców - poziom I (PLENUM)",
    count: 54,
    venue: "Stoiska wystawców",
    level: "I",
    room: "PLENUM",
    short: "Stoiska · Plenum",
    order: 0,
  },
  {
    id: 233,
    slug: "so-salsa-1",
    name: "So Salsa - poziom II - Sala wykładowa nr 1",
    count: 16,
    venue: "So Salsa",
    level: "II",
    room: "Sala wykładowa nr 1",
    short: "Sala wykł. 1",
    order: 1,
  },
  {
    id: 281,
    slug: "so-salsa-1-2",
    name: "SoSalsa - poziom II - Sala wykładowa nr 2",
    count: 16,
    venue: "SoSalsa",
    level: "II",
    room: "Sala wykładowa nr 2",
    short: "Sala wykł. 2",
    order: 2,
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
    order: 3,
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmm(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

function timeTextFor(start: number | null, end: number | null): string {
  if (start === null) return "";
  if (end === null) return hhmm(start);
  return `${hhmm(start)}-${hhmm(end)}`;
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const eventId = overrides.eventId ?? 1;
  const day = overrides.day ?? "pt";
  const start = overrides.start === undefined ? 570 : overrides.start;
  const end = overrides.end === undefined ? 630 : overrides.end;
  return {
    id: `${eventId}:${day}`,
    eventId,
    day,
    title: "Sesja",
    start,
    end,
    allDay: false,
    timeText: timeTextFor(start, end),
    speakerIds: [],
    byline: null,
    typeIds: [184],
    themeIds: [],
    brandIds: [],
    locationIds: [233],
    signup: { status: "included", url: null, label: "W ramach festiwalu" },
    descriptionHtml: "",
    url: `https://swiatlosila.pl/cyfrowe-event/sesja-${eventId}/`,
    ...overrides,
  };
}

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 999,
    slug: "sala-testowa",
    name: "Sala testowa",
    count: 0,
    venue: "Sala testowa",
    level: null,
    room: null,
    short: "Sala testowa",
    order: 99,
    ...overrides,
  };
}

export function makeSpeaker(overrides: Partial<Speaker> = {}): Speaker {
  return {
    id: 100,
    slug: "anna-kowalska",
    name: "Anna Kowalska",
    photo: null,
    photoThumb: null,
    bioHtml: "",
    url: "https://swiatlosila.pl/cyfrowe-prelegent/anna-kowalska/",
    brands: [],
    ...overrides,
  };
}

export function makeDay(overrides: Partial<Day> = {}): Day {
  return { ...FRIDAY, ...overrides };
}

export function makeData(sessions: Session[], overrides: Partial<ScheduleData> = {}): ScheduleData {
  const speakers = overrides.speakers ?? [];
  const eventIds = new Set(sessions.map((s) => s.eventId));
  return {
    meta: {
      source: "https://swiatlosila.pl/harmonogram-2026/",
      fetchedAt: "2026-09-03T10:00:00.000Z",
      year: 2026,
      version: 1,
      eventCount: eventIds.size,
      sessionCount: sessions.length,
      speakerCount: speakers.length,
    },
    days: DAYS.map((d) => ({ ...d })),
    locations: LOCATIONS.map((l) => ({ ...l })),
    types: TYPES.map((t) => ({ ...t })),
    themes: [],
    brands: [],
    signupStatuses: [],
    speakers,
    sessions,
    ...overrides,
  };
}
