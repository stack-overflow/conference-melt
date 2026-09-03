import { describe, expect, it } from "vitest";
import type { ScheduleData, Session, Term } from "../data/types";
import { makeData, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import { buildIndex } from "./lookup";
import {
  EMPTY_FILTERS,
  FACETS,
  SIGNUP_ORDER,
  activeFilterCount,
  applyFilters,
  buildSearchIndex,
  facetCounts,
  signupLabel,
  type Filters,
} from "./filters";

const term = (id: number, slug: string, name: string, count = 1): Term => ({ id, slug, name, count });

// Real records from the 2026-09-03 snapshot (ids, titles, terms and speakers as fetched).
const natura = makeSession({
  id: "39555:pt",
  eventId: 39555,
  day: "pt",
  title: "Natura nie powtarza ujęć. O pracy fotografa krajobrazowego",
  start: 645,
  end: 705,
  timeText: "10:45-11:45",
  speakerIds: [46694],
  byline: null,
  typeIds: [184],
  themeIds: [81, 260, 263, 246],
  brandIds: [148],
  locationIds: [281],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
  url: "https://swiatlosila.pl/cyfrowe-event/natura-nie-powtarza-ujec-o-pracy-fotografa-krajobrazowego/",
});

const swiatlo = makeSession({
  id: "39556:pt",
  eventId: 39556,
  day: "pt",
  title: "Światło, które widzisz. Oświetlenie LED w fotografii kreatywnej",
  start: 660,
  end: 720,
  timeText: "11:00-12:00",
  speakerIds: [379],
  byline: null,
  typeIds: [184],
  themeIds: [262, 267, 275],
  brandIds: [108, 109],
  locationIds: [279],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
  url: "https://swiatlosila.pl/cyfrowe-event/swiatlo-ktore-widzisz-oswietlenie-led-w-fotografii-kreatywnej/",
});

const fotogra = makeSession({
  id: "39549:czw",
  eventId: 39549,
  day: "czw",
  title: "Before Fotogra – Color Hunting",
  start: 1020,
  end: 1140,
  timeText: "17:00-19:00",
  speakerIds: [],
  byline: "Sony",
  typeIds: [185, 3],
  themeIds: [251, 256, 271, 272],
  brandIds: [11],
  locationIds: [283],
  signup: {
    status: "open",
    url: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html",
    label: "Zapisy",
  },
  url: "https://swiatlosila.pl/cyfrowe-event/before-fotogra-color-hunting/",
});

const workshop = makeSession({
  id: "41151:pt",
  eventId: 41151,
  day: "pt",
  title: "Warsztaty Masterclass – Moda na błysk",
  start: 570,
  end: 960,
  timeText: "09:30-16:00",
  speakerIds: [],
  byline: null,
  typeIds: [5],
  themeIds: [255, 262, 267, 275],
  brandIds: [95],
  locationIds: [290],
  signup: {
    status: "full",
    url: "https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-moda-na-blysk-katarzyna-budziszyna-danaj-p.html",
    label: "Brak miejsc",
  },
  url: "https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-moda-na-blysk/",
});

// Synthetic records for the all-day and byline-only cases.
const zone = makeSession({
  id: "4:pt",
  eventId: 4,
  day: "pt",
  title: "Strefa sprzętu",
  start: 540,
  end: 1080,
  allDay: true,
  timeText: "09:00-18:00",
  speakerIds: [],
  byline: null,
  typeIds: [242],
  themeIds: [],
  brandIds: [],
  locationIds: [308],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
});

const film = makeSession({
  id: "6:sob",
  eventId: 6,
  day: "sob",
  title: "Pokaz filmowy",
  start: 1140,
  end: 1200,
  timeText: "19:00-20:00",
  speakerIds: [],
  byline: "KLIK FILM",
  typeIds: [5],
  themeIds: [],
  brandIds: [],
  locationIds: [],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
});

const sessions: Session[] = [natura, swiatlo, fotogra, workshop, zone, film];

const data: ScheduleData = makeData(sessions, {
  types: [
    term(184, "prelekcja", "Prelekcja", 51),
    term(5, "warsztaty", "Warsztaty", 12),
    term(242, "ogolne", "Ogólne", 13),
    term(185, "fotogra", "Fotogra", 5),
    term(3, "fotospacer", "Fotospacer", 5),
  ],
  themes: [
    term(81, "fotografia-przyrodnicza", "Fotografia przyrodnicza", 6),
    term(260, "krajobraz", "Krajobraz", 6),
    term(263, "natura", "Natura", 12),
    term(246, "podroz", "Podróż", 11),
    term(262, "moda", "Moda"),
    term(267, "portret", "Portret"),
    term(275, "z-lampa", "Z lampą"),
    term(255, "fotografia-reklamowa", "Fotografia reklamowa"),
    term(251, "fotogra", "Fotogra"),
    term(256, "fotospacer", "Fotospacer"),
    term(271, "stocznia", "Stocznia"),
    term(272, "street", "Street"),
  ],
  brands: [
    term(148, "manfrotto", "Manfrotto", 1),
    term(108, "newell", "Newell"),
    term(109, "voigtlander", "Voigtlander"),
    term(11, "sony", "Sony"),
    term(95, "glareone", "GlareOne"),
  ],
  locations: [
    makeLocation({ id: 281, slug: "so-salsa-1-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 16, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 0 }),
    makeLocation({ id: 279, slug: "klub-bokserski-poziom-ii-sala-wykladowa-nr-4", name: "Klub bokserski - poziom II - Sala wykładowa nr 4", count: 14, venue: "Klub bokserski", level: "II", room: "Sala wykładowa nr 4", short: "Sala wykł. 4", order: 1 }),
    makeLocation({ id: 290, slug: "zero-zero-antresola-sala-warsztatowa-vi", name: "ZERO ZERO Antresola - Sala warsztatowa VI", count: 2, venue: "ZERO ZERO Antresola", level: null, room: "Sala warsztatowa VI", short: "Warsztat. VI (antresola)", order: 2 }),
    makeLocation({ id: 283, slug: "zero-zero-przed-wejsciem", name: "ZERO ZERO (przed wejściem)", count: 1, venue: "ZERO ZERO (przed wejściem)", level: null, room: null, short: "Zero Zero · wejście", order: 3 }),
    makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 54, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 4 }),
  ],
  signupStatuses: [
    term(327, "brak-miejsc", "Brak miejsc", 9),
    term(194, "w-ramach-festiwalu", "W ramach festiwalu", 136),
    term(56, "zapisy", "Zapisy", 8),
  ],
  speakers: [
    makeSpeaker({ id: 46694, slug: "pawel-uchorczak", name: "Paweł Uchorczak", url: "https://swiatlosila.pl/cyfrowe-prelegent/pawel-uchorczak/" }),
    makeSpeaker({ id: 379, slug: "piotr-werner-2", name: "Piotr Werner", url: "https://swiatlosila.pl/cyfrowe-prelegent/piotr-werner-2/" }),
  ],
});

const index = buildIndex(data);
const search = buildSearchIndex(data, index);
const none: ReadonlySet<string> = new Set();

const ids = (list: Session[]): string[] => list.map((s) => s.id);
const withQuery = (query: string, rest: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...rest, query });

describe("constants", () => {
  it("EMPTY_FILTERS has every facet empty and both toggles off", () => {
    expect(EMPTY_FILTERS).toEqual({
      types: [],
      themes: [],
      brands: [],
      locations: [],
      signup: [],
      query: "",
      onlyFavourites: false,
      hideAllDay: false,
    });
  });

  it("FACETS and SIGNUP_ORDER are in the spec order", () => {
    expect(FACETS).toEqual(["types", "themes", "brands", "locations", "signup"]);
    expect(SIGNUP_ORDER).toEqual(["open", "full", "included", "free", "soon", "unknown"]);
  });
});

describe("buildSearchIndex", () => {
  it("indexes every session by id", () => {
    expect(search.size).toBe(sessions.length);
    for (const s of sessions) expect(search.has(s.id)).toBe(true);
  });

  it("folds title, speakers, byline, themes, brands, locations and types into one normalized string", () => {
    const entry = search.get("39555:pt") ?? "";
    expect(entry).toContain("natura nie powtarza ujec");
    expect(entry).toContain("pawel uchorczak");
    expect(entry).toContain("krajobraz");
    expect(entry).toContain("manfrotto");
    expect(entry).toContain("sala wykladowa nr 2");
    expect(entry).toContain("prelekcja");
    expect(search.get("39549:czw") ?? "").toContain("sony");
    expect(search.get("6:sob") ?? "").toContain("klik film");
  });
});

describe("applyFilters query", () => {
  it("finds 'Światło' with the query 'swiatlo'", () => {
    expect(ids(applyFilters(sessions, withQuery("swiatlo"), none, search))).toEqual(["39556:pt"]);
  });

  it("finds 'Paweł' with the query 'pawel'", () => {
    expect(ids(applyFilters(sessions, withQuery("pawel"), none, search))).toEqual(["39555:pt"]);
  });

  it("normalizes the query itself, so 'ŚWIATŁO' also matches", () => {
    expect(ids(applyFilters(sessions, withQuery("ŚWIATŁO"), none, search))).toEqual(["39556:pt"]);
  });

  it("matches theme names, brand names, location names, type names and the byline", () => {
    expect(ids(applyFilters(sessions, withQuery("moda"), none, search))).toEqual(["39556:pt", "41151:pt"]);
    expect(ids(applyFilters(sessions, withQuery("manfrotto"), none, search))).toEqual(["39555:pt"]);
    expect(ids(applyFilters(sessions, withQuery("antresola"), none, search))).toEqual(["41151:pt"]);
    expect(ids(applyFilters(sessions, withQuery("prelekcja"), none, search))).toEqual(["39555:pt", "39556:pt"]);
    expect(ids(applyFilters(sessions, withQuery("klik"), none, search))).toEqual(["6:sob"]);
  });

  it("returns nothing for a query nobody matches and everything for a blank query", () => {
    expect(applyFilters(sessions, withQuery("zzz"), none, search)).toEqual([]);
    expect(ids(applyFilters(sessions, withQuery("   "), none, search))).toEqual(ids(sessions));
  });

  it("skips the query with ignoreQuery", () => {
    expect(ids(applyFilters(sessions, withQuery("zzz"), none, search, { ignoreQuery: true }))).toEqual(ids(sessions));
  });
});

describe("applyFilters facets", () => {
  it("ORs values inside a facet", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184] }, none, search))).toEqual(["39555:pt", "39556:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184, 5] }, none, search))).toEqual([
      "39555:pt",
      "39556:pt",
      "41151:pt",
      "6:sob",
    ]);
  });

  it("ANDs across facets", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184], brands: [148] }, none, search))).toEqual(["39555:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184], brands: [11] }, none, search))).toEqual([]);
  });

  it("matches a session carrying any of the wanted term ids", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, themes: [262] }, none, search))).toEqual(["39556:pt", "41151:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, locations: [308] }, none, search))).toEqual(["4:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [3] }, none, search))).toEqual(["39549:czw"]);
  });

  it("filters the signup facet by status value", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, signup: ["open"] }, none, search))).toEqual(["39549:czw"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, signup: ["full", "included"] }, none, search))).toEqual([
      "39555:pt",
      "39556:pt",
      "41151:pt",
      "4:pt",
      "6:sob",
    ]);
  });

  it("combines a facet with the query", () => {
    expect(ids(applyFilters(sessions, withQuery("pawel", { types: [184] }), none, search))).toEqual(["39555:pt"]);
    expect(ids(applyFilters(sessions, withQuery("pawel", { types: [5] }), none, search))).toEqual([]);
  });
});

describe("applyFilters toggles", () => {
  it("hides all-day sessions with hideAllDay", () => {
    const kept = applyFilters(sessions, { ...EMPTY_FILTERS, hideAllDay: true }, none, search);
    expect(ids(kept)).not.toContain("4:pt");
    expect(kept).toHaveLength(sessions.length - 1);
  });

  it("keeps only plan sessions with onlyFavourites", () => {
    const plan = new Set(["41151:pt", "6:sob"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, onlyFavourites: true }, plan, search))).toEqual(["41151:pt", "6:sob"]);
  });

  it("skips favourites-only with ignoreFavourites", () => {
    const plan = new Set(["41151:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, onlyFavourites: true }, plan, search, { ignoreFavourites: true }))).toEqual(ids(sessions));
  });

  it("still applies facets and hideAllDay when both ignore options are set", () => {
    const filters: Filters = { ...EMPTY_FILTERS, types: [242, 5], query: "zzz", onlyFavourites: true, hideAllDay: true };
    expect(ids(applyFilters(sessions, filters, none, search, { ignoreQuery: true, ignoreFavourites: true }))).toEqual(["41151:pt", "6:sob"]);
  });
});

describe("facetCounts", () => {
  it("ignores the counted facet's own selection but applies every other facet and the query", () => {
    const counts = facetCounts(sessions, withQuery("natura", { types: [5] }), "types", none, search);
    expect(counts.get(184)).toBe(1);
    expect(counts.get(5)).toBeUndefined();
    expect(counts.size).toBe(1);
  });

  it("counts every option the remaining sessions carry", () => {
    const counts = facetCounts(sessions, { ...EMPTY_FILTERS, types: [184] }, "brands", none, search);
    expect([...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
      [108, 1],
      [109, 1],
      [148, 1],
    ]);
  });

  it("keys the signup facet by status", () => {
    const counts = facetCounts(sessions, EMPTY_FILTERS, "signup", none, search);
    expect(counts.get("included")).toBe(4);
    expect(counts.get("open")).toBe(1);
    expect(counts.get("full")).toBe(1);
    expect(counts.get("unknown")).toBeUndefined();
  });

  it("applies hideAllDay and favourites-only", () => {
    const hidden = facetCounts(sessions, { ...EMPTY_FILTERS, hideAllDay: true }, "locations", none, search);
    expect(hidden.get(308)).toBeUndefined();
    expect(hidden.get(281)).toBe(1);
    const plan = new Set(["4:pt"]);
    const favs = facetCounts(sessions, { ...EMPTY_FILTERS, onlyFavourites: true }, "locations", plan, search);
    expect([...favs.entries()]).toEqual([[308, 1]]);
  });

  it("counts all options when the facet's own selection matches nothing", () => {
    const counts = facetCounts(sessions, { ...EMPTY_FILTERS, types: [999] }, "types", none, search);
    expect(counts.get(184)).toBe(2);
    expect(counts.get(5)).toBe(2);
    expect(counts.get(185)).toBe(1);
    expect(counts.get(3)).toBe(1);
    expect(counts.get(242)).toBe(1);
  });
});

describe("activeFilterCount", () => {
  it("is 0 for EMPTY_FILTERS and for a whitespace query", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount(withQuery("   "))).toBe(0);
  });

  it("adds every facet value, a non-blank query and each toggle", () => {
    const filters: Filters = {
      types: [184, 5],
      themes: [],
      brands: [148],
      locations: [],
      signup: ["open"],
      query: "a",
      onlyFavourites: true,
      hideAllDay: true,
    };
    expect(activeFilterCount(filters)).toBe(7);
  });
});

describe("signupLabel", () => {
  it("returns the matching term name from the data", () => {
    expect(signupLabel("open", data)).toBe("Zapisy");
    expect(signupLabel("full", data)).toBe("Brak miejsc");
    expect(signupLabel("included", data)).toBe("W ramach festiwalu");
  });

  it("returns 'Brak informacji' for unknown", () => {
    expect(signupLabel("unknown", data)).toBe("Brak informacji");
  });

  it("falls back to the canonical term name when the data has no such term", () => {
    expect(signupLabel("free", data)).toBe("WSTĘP WOLNY");
    expect(signupLabel("soon", data)).toBe("Zapisy wkrótce");
  });
});
