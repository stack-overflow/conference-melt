// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Location, Session, Term } from "../data/types";
import { EMPTY_FILTERS, buildSearchIndex, type Filters } from "../domain/filters";
import { buildIndex } from "../domain/lookup";
import { makeData, makeLocation, makeSession } from "../test/fixtures/build";
import { buildColumns, daySets, listGroups, resolveTimeMode, type DaySets } from "./derive";
import type { Settings } from "./store";

const SETTINGS: Settings = {
  columnAxis: "location",
  timeMode: "auto",
  slotTolerance: 15,
  zoom: 2,
  density: "comfortable",
  colorBy: "type",
  showAvatars: true,
  allDayStrip: true,
  planLayout: "list",
  theme: "system",
};

const LOCATIONS: Location[] = [
  makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 0 }),
  makeLocation({ id: 233, slug: "so-salsa-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 1, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 1 }),
  makeLocation({ id: 281, slug: "so-salsa-1-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 1, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 2 }),
  makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 3 }),
];

const A = makeSession({ id: "1:pt", eventId: 1, title: "Światło w studio", start: 570, end: 630, locationIds: [233] });
const B = makeSession({ id: "2:pt", eventId: 2, title: "Portret", start: 585, end: 645, locationIds: [281] });
const C = makeSession({ id: "3:pt", eventId: 3, title: "Bez czasu", start: null, end: null, timeText: "", locationIds: [233] });
const D = makeSession({ id: "4:pt", eventId: 4, title: "Strefa sprzętu", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318] });
const E = makeSession({ id: "5:sob", eventId: 5, day: "sob", title: "Sobotnia", start: 600, end: 660, locationIds: [233] });

const ids = (list: Session[]) => list.map((s) => s.id);

interface SetsOverrides {
  dayId?: string;
  filters?: Partial<Filters>;
  settings?: Partial<Settings>;
  planSet?: string[];
  planView?: boolean;
}

function setsFor(sessions: Session[], over: SetsOverrides = {}, dataOverrides: Partial<Parameters<typeof makeData>[1]> = {}): DaySets {
  const data = makeData(sessions, { locations: LOCATIONS, ...dataOverrides });
  const index = buildIndex(data);
  const search = buildSearchIndex(data, index);
  return daySets({
    data,
    index,
    search,
    dayId: over.dayId ?? "pt",
    filters: { ...EMPTY_FILTERS, ...over.filters },
    settings: { ...SETTINGS, ...over.settings },
    planSet: new Set(over.planSet ?? []),
    planView: over.planView ?? false,
  });
}

describe("daySets", () => {
  const day = [A, B, C, D, E];

  it("splits the day into layout, visible, rendered and the two strips", () => {
    const s = setsFor(day);
    expect(ids(s.all)).toEqual(["1:pt", "2:pt", "3:pt", "4:pt"]);
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt", "2:pt", "3:pt", "4:pt"]);
    expect(ids(s.rendered)).toEqual(["1:pt", "2:pt"]);
    expect([...s.renderedIds]).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.stripAllDay)).toEqual(["4:pt"]);
    expect(ids(s.stripNoTime)).toEqual(["3:pt"]);
  });

  it("moves all-day sessions into the layout set when the strip is off", () => {
    const s = setsFor(day, { settings: { allDayStrip: false } });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt", "4:pt"]);
    expect(ids(s.rendered)).toEqual(["1:pt", "2:pt", "4:pt"]);
    expect(s.stripAllDay).toEqual([]);
  });

  it("hideAllDay removes all-day sessions from every set", () => {
    const s = setsFor(day, { filters: { hideAllDay: true } });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt", "2:pt", "3:pt"]);
    expect(s.stripAllDay).toEqual([]);
  });

  it("the query narrows visible and rendered but never the layout set", () => {
    const s = setsFor(day, { filters: { query: "swiatlo" } });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt"]);
    expect(ids(s.rendered)).toEqual(["1:pt"]);
    expect(s.stripAllDay).toEqual([]);
    expect(s.stripNoTime).toEqual([]);
  });

  it("onlyFavourites narrows visible against the plan set and leaves the layout set alone", () => {
    const s = setsFor(day, { filters: { onlyFavourites: true }, planSet: ["2:pt"] });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["2:pt"]);
    expect(ids(s.rendered)).toEqual(["2:pt"]);
  });

  it("facets narrow the layout set", () => {
    const s = setsFor(day, { filters: { locations: [281] } });
    expect(ids(s.layout)).toEqual(["2:pt"]);
    expect(ids(s.visible)).toEqual(["2:pt"]);
  });

  it("the plan view restricts every set to the plan set first", () => {
    const s = setsFor(day, { planView: true, planSet: ["1:pt", "3:pt", "5:sob"] });
    expect(ids(s.all)).toEqual(["1:pt", "3:pt"]);
    expect(ids(s.layout)).toEqual(["1:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt", "3:pt"]);
    expect(ids(s.stripNoTime)).toEqual(["3:pt"]);
    expect(s.stripAllDay).toEqual([]);
  });

  it("a facet that leaves only strip sessions gives an empty rendered set while the strip keeps them", () => {
    const s = setsFor(day, { filters: { locations: [318] } });
    expect(s.layout).toEqual([]);
    expect(ids(s.visible)).toEqual(["4:pt"]);
    expect(s.rendered).toEqual([]);
    expect(ids(s.stripAllDay)).toEqual(["4:pt"]);
    const data = makeData(day, { locations: LOCATIONS });
    expect(buildColumns(s, "location", data, buildIndex(data))).toEqual([]);
  });

  it("an unknown day yields empty sets", () => {
    const s = setsFor(day, { dayId: "nd" });
    expect(s.all).toEqual([]);
    expect(s.layout).toEqual([]);
    expect(s.visible).toEqual([]);
  });
});

describe("buildColumns by location", () => {
  const F = makeSession({ id: "6:pt", eventId: 6, title: "Makro", start: 700, end: 760, locationIds: [233, 308] });
  const sessions = [A, B, F];
  const data = makeData(sessions, { locations: LOCATIONS });
  const index = buildIndex(data);

  it("orders columns by Location.order, labels with short and venue, and repeats multi-location sessions", () => {
    const columns = buildColumns(setsFor(sessions), "location", data, index);
    expect(columns.map((c) => c.key)).toEqual(["loc:308", "loc:233", "loc:281"]);
    expect(columns.map((c) => c.label)).toEqual(["Stoiska · Plenum", "Sala wykł. 1", "Sala wykł. 2"]);
    expect(columns.map((c) => c.sublabel)).toEqual(["Stoiska wystawców", "So Salsa", "SoSalsa"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["6:pt"], ["1:pt", "6:pt"], ["2:pt"]]);
    expect(columns.map((c) => c.count)).toEqual([1, 2, 1]);
  });

  it("a search keeps every layout session in the column but drops columns without rendered sessions", () => {
    const columns = buildColumns(setsFor(sessions, { filters: { query: "makro" } }), "location", data, index);
    expect(columns.map((c) => c.key)).toEqual(["loc:308", "loc:233"]);
    const sala1 = columns[1];
    expect(sala1 && ids(sala1.sessions)).toEqual(["1:pt", "6:pt"]);
    expect(sala1 && [...sala1.renderedIds]).toEqual(["6:pt"]);
    expect(sala1?.count).toBe(1);
  });

  it("omits the venue sublabel when it equals the short label", () => {
    const R = makeSession({ id: "7:pt", eventId: 7, title: "Odbiór akredytacji", start: 540, end: 600, locationIds: [318] });
    const d = makeData([R], { locations: LOCATIONS });
    const columns = buildColumns(setsFor([R]), "location", d, buildIndex(d));
    expect(columns).toHaveLength(1);
    expect(columns[0]?.label).toBe("Rejestracja");
    expect(columns[0]?.sublabel).toBeNull();
  });
});

describe("buildColumns by type", () => {
  const TYPES: Term[] = [
    { id: 184, slug: "prelekcja", name: "Prelekcja", count: 1 },
    { id: 278, slug: "prelekcja-z-sesja", name: "Prelekcja z sesją", count: 1 },
    { id: 5, slug: "warsztaty", name: "Warsztaty", count: 1 },
    { id: 242, slug: "ogolne", name: "Ogólne", count: 1 },
    { id: 900, slug: "dyskusja", name: "Dyskusja", count: 1 },
    { id: 901, slug: "cwiczenia", name: "Ćwiczenia", count: 1 },
  ];
  const t1 = makeSession({ id: "1:pt", eventId: 1, title: "Punkt info", typeIds: [242] });
  const t2 = makeSession({ id: "2:pt", eventId: 2, title: "Warsztat", typeIds: [5] });
  const t3 = makeSession({ id: "3:pt", eventId: 3, title: "Wykład z warsztatem", typeIds: [5, 184] });
  const t4 = makeSession({ id: "4:pt", eventId: 4, title: "Panel", typeIds: [900] });
  const t5 = makeSession({ id: "5:pt", eventId: 5, title: "Trening", typeIds: [901] });
  const t6 = makeSession({ id: "6:pt", eventId: 6, title: "Bez typu", typeIds: [] });
  const sessions = [t1, t2, t3, t4, t5, t6];
  const data = makeData(sessions, { locations: LOCATIONS, types: TYPES });
  const index = buildIndex(data);

  it("groups by primary type in priority order, then Polish collation, with a trailing Bez typu", () => {
    const columns = buildColumns(setsFor(sessions, {}, { types: TYPES }), "type", data, index);
    expect(columns.map((c) => c.key)).toEqual(["type:184", "type:5", "type:242", "type:901", "type:900", "type:none"]);
    expect(columns.map((c) => c.label)).toEqual(["Prelekcja", "Warsztaty", "Ogólne", "Ćwiczenia", "Dyskusja", "Bez typu"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["3:pt"], ["2:pt"], ["1:pt"], ["5:pt"], ["4:pt"], ["6:pt"]]);
    expect(columns.every((c) => c.sublabel === null)).toBe(true);
  });
});

describe("buildColumns by brand", () => {
  const BRANDS: Term[] = [
    { id: 10, slug: "canon", name: "Canon", count: 1 },
    { id: 12, slug: "nikon", name: "Nikon", count: 1 },
    { id: 11, slug: "sony", name: "Sony", count: 1 },
  ];
  const b1 = makeSession({ id: "1:pt", eventId: 1, title: "Sony show", brandIds: [11] });
  const b2 = makeSession({ id: "2:pt", eventId: 2, title: "Canon i Sony", brandIds: [10, 11] });
  const b3 = makeSession({ id: "3:pt", eventId: 3, title: "Niezależna", brandIds: [] });
  const b4 = makeSession({ id: "4:pt", eventId: 4, title: "Nikon show", brandIds: [12] });
  const sessions = [b1, b2, b3, b4];
  const data = makeData(sessions, { locations: LOCATIONS, brands: BRANDS });
  const index = buildIndex(data);

  it("uses the first brand, brands array order and a trailing Bez marki", () => {
    const columns = buildColumns(setsFor(sessions, {}, { brands: BRANDS }), "brand", data, index);
    expect(columns.map((c) => c.key)).toEqual(["brand:10", "brand:12", "brand:11", "brand:none"]);
    expect(columns.map((c) => c.label)).toEqual(["Canon", "Nikon", "Sony", "Bez marki"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["2:pt"], ["4:pt"], ["1:pt"], ["3:pt"]]);
  });
});

describe("buildColumns by level", () => {
  const LEVEL_LOCATIONS: Location[] = [
    makeLocation({ id: 282, slug: "drizzly-grizzly", name: "Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3", count: 1, venue: "Drizzly Grizzly", level: "0", room: "Sala wykładowa nr 3", short: "Sala wykł. 3", order: 0 }),
    makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 1 }),
    makeLocation({ id: 307, slug: "stoiska-wystawcow-poziom-i-plenum-i-poziom-ii-sosalsa", name: "Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA)", count: 1, venue: "Stoiska wystawców", level: "I+II", room: "PLENUM · SOSALSA", short: "Stoiska · Plenum i SoSalsa", order: 2 }),
    makeLocation({ id: 233, slug: "so-salsa-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 1, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 3 }),
    makeLocation({ id: 999, slug: "dach", name: "Dach - poziom III", count: 1, venue: "Dach", level: "III", room: null, short: "Dach III", order: 4 }),
    makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 5 }),
  ];
  const l1 = makeSession({ id: "1:pt", eventId: 1, title: "Zero", locationIds: [282] });
  const l2 = makeSession({ id: "2:pt", eventId: 2, title: "Jeden", locationIds: [308] });
  const l3 = makeSession({ id: "3:pt", eventId: 3, title: "Jeden i dwa", locationIds: [307] });
  const l4 = makeSession({ id: "4:pt", eventId: 4, title: "Dwa poziomy", locationIds: [233, 308] });
  const l5 = makeSession({ id: "5:pt", eventId: 5, title: "Trzy", locationIds: [999] });
  const l6 = makeSession({ id: "6:pt", eventId: 6, title: "Bez poziomu", locationIds: [318] });
  const l7 = makeSession({ id: "7:pt", eventId: 7, title: "Bez miejsca", locationIds: [] });
  const sessions = [l1, l2, l3, l4, l5, l6, l7];
  const data = makeData(sessions, { locations: LEVEL_LOCATIONS });
  const index = buildIndex(data);

  it("labels every level in order sequence and repeats sessions spanning several levels", () => {
    const columns = buildColumns(setsFor(sessions, {}, { locations: LEVEL_LOCATIONS }), "level", data, index);
    expect(columns.map((c) => c.key)).toEqual(["level:0", "level:I", "level:I+II", "level:II", "level:III", "level:none"]);
    expect(columns.map((c) => c.label)).toEqual(["Poziom 0", "Poziom I", "Poziom I i II", "Poziom II", "Poziom III", "Inne"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["1:pt"], ["2:pt", "4:pt"], ["3:pt"], ["4:pt"], ["5:pt"], ["6:pt", "7:pt"]]);
  });
});

describe("buildColumns with no axis", () => {
  const sessions = [A, B];
  const data = makeData(sessions, { locations: LOCATIONS });
  const index = buildIndex(data);

  it("returns one Wszystkie column holding every layout session", () => {
    const columns = buildColumns(setsFor(sessions), "none", data, index);
    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ key: "all", label: "Wszystkie", sublabel: null, count: 2 });
    expect(columns[0] && ids(columns[0].sessions)).toEqual(["1:pt", "2:pt"]);
  });

  it("returns no column when nothing is rendered", () => {
    const columns = buildColumns(setsFor(sessions, { filters: { query: "brak takiego" } }), "none", data, index);
    expect(columns).toEqual([]);
  });
});

const S1 = makeSession({ id: "11:pt", eventId: 11, title: "Pierwsza", start: 570, end: 645, locationIds: [233] });
const S2 = makeSession({ id: "12:pt", eventId: 12, title: "Druga", start: 615, end: 690, locationIds: [281] });
const S3 = makeSession({ id: "13:pt", eventId: 13, title: "Trzecia", start: 660, end: 735, locationIds: [308] });
const STAGGERED = [S1, S2, S3];

const R1 = makeSession({ id: "21:pt", eventId: 21, title: "Rano A", start: 570, end: 630, locationIds: [233] });
const R2 = makeSession({ id: "22:pt", eventId: 22, title: "Rano B", start: 570, end: 630, locationIds: [281] });
const R3 = makeSession({ id: "23:pt", eventId: 23, title: "Unikat", start: 645, end: 705, locationIds: [233] });
const R4 = makeSession({ id: "24:pt", eventId: 24, title: "Później B", start: 645, end: 705, locationIds: [281] });
const REGULAR = [R1, R2, R3, R4];

describe("resolveTimeMode", () => {
  it("auto resolves to timeline when the layout set is not distinguishable and forced modes win", () => {
    const layout = setsFor(STAGGERED).layout;
    const auto = resolveTimeMode(SETTINGS, layout);
    expect(auto.mode).toBe("timeline");
    expect(auto.auto).toBe(true);
    expect(auto.slots.map((s) => s.start)).toEqual([570, 615, 660]);
    expect(auto.regularity.distinguishable).toBe(false);

    const forced = resolveTimeMode({ ...SETTINGS, timeMode: "slots" }, layout);
    expect(forced.mode).toBe("slots");
    expect(forced.auto).toBe(false);
    expect(forced.slots).toHaveLength(3);

    expect(resolveTimeMode({ ...SETTINGS, timeMode: "timeline" }, layout).mode).toBe("timeline");
  });

  it("auto resolves to slots for a regular, shared layout set", () => {
    const resolved = resolveTimeMode(SETTINGS, setsFor(REGULAR).layout);
    expect(resolved.mode).toBe("slots");
    expect(resolved.auto).toBe(true);
    expect(resolved.slots.map((s) => s.start)).toEqual([570, 645]);
    expect(resolved.regularity).toEqual({ medianGap: 75, sharedRatio: 1, distinguishable: true });
  });

  it("an empty layout set gives no slots and the timeline", () => {
    const resolved = resolveTimeMode(SETTINGS, []);
    expect(resolved.slots).toEqual([]);
    expect(resolved.mode).toBe("timeline");
  });
});

describe("listGroups", () => {
  const C2 = makeSession({ id: "8:pt", eventId: 8, title: "Makro", start: 615, end: 660, locationIds: [308] });
  const P = makeSession({ id: "9:pt", eventId: 9, title: "Wyniki", start: 810, end: null, timeText: "13:30", locationIds: [233] });
  const day = [A, B, C, D, C2, P];

  it("in timeline mode buckets rows by hour with Całodniowe first and Bez godziny last", () => {
    const sets = setsFor(day, { settings: { timeMode: "timeline" } });
    const groups = listGroups(sets, resolveTimeMode({ ...SETTINGS, timeMode: "timeline" }, sets.layout), SETTINGS);
    expect(groups.map((g) => [g.key, g.label, ids(g.sessions), g.total, g.parallel])).toEqual([
      ["allday", "Całodniowe", ["4:pt"], 1, 1],
      ["hour:9", "09:00–10:00", ["1:pt", "2:pt"], 2, 2],
      ["hour:10", "10:00–11:00", ["8:pt"], 1, 1],
      ["hour:13", "13:00–14:00", ["9:pt"], 1, 1],
      ["notime", "Bez godziny", ["3:pt"], 1, 0],
    ]);
  });

  it("with the strip off, all-day sessions sit in their start group", () => {
    const settings: Settings = { ...SETTINGS, timeMode: "timeline", allDayStrip: false };
    const sets = setsFor(day, { settings });
    const groups = listGroups(sets, resolveTimeMode(settings, sets.layout), settings);
    expect(groups.map((g) => g.key)).toEqual(["hour:9", "hour:10", "hour:13", "notime"]);
    expect(groups[0] && ids(groups[0].sessions)).toEqual(["4:pt", "1:pt", "2:pt"]);
    expect(groups[0]?.parallel).toBe(3);
  });

  it("in forced slot mode the groups are the detected slots", () => {
    const settings: Settings = { ...SETTINGS, timeMode: "slots" };
    const sets = setsFor(STAGGERED, { settings });
    const groups = listGroups(sets, resolveTimeMode(settings, sets.layout), settings);
    expect(groups.map((g) => [g.key, g.label, ids(g.sessions), g.total, g.parallel])).toEqual([
      ["slot:0", "09:30", ["11:pt"], 1, 1],
      ["slot:1", "10:15", ["12:pt"], 1, 1],
      ["slot:2", "11:00", ["13:pt"], 1, 1],
    ]);
  });

  it("labels a slot with several starts as a range", () => {
    const X1 = makeSession({ id: "31:pt", eventId: 31, title: "Start 09:30", start: 570, end: 630, locationIds: [233] });
    const X2 = makeSession({ id: "32:pt", eventId: 32, title: "Start 09:40", start: 580, end: 640, locationIds: [281] });
    const settings: Settings = { ...SETTINGS, timeMode: "slots" };
    const sets = setsFor([X1, X2], { settings });
    const groups = listGroups(sets, resolveTimeMode(settings, sets.layout), settings);
    expect(groups.map((g) => [g.key, g.label, g.total, g.parallel])).toEqual([["slot:0", "09:30–09:40", 2, 2]]);
  });

  it("a search omits groups without visible rows but keeps the slot rows of the layout set", () => {
    const sets = setsFor(REGULAR, { filters: { query: "unikat" } });
    const resolved = resolveTimeMode(SETTINGS, sets.layout);
    expect(resolved.mode).toBe("slots");
    expect(resolved.slots).toHaveLength(2);
    const groups = listGroups(sets, resolved, SETTINGS);
    expect(groups.map((g) => [g.key, g.label, ids(g.sessions)])).toEqual([["slot:1", "10:45", ["23:pt"]]]);
  });
});
