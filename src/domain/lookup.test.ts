import { describe, expect, it } from "vitest";
import type { Term } from "../data/types";
import { makeData, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import {
  TYPE_PRIORITY,
  buildIndex,
  locationLabel,
  locationsOf,
  primaryType,
  speakersOf,
  typeRank,
} from "./lookup";

const EXTRA_TYPES: Term[] = [
  { id: 3, slug: "fotospacer", name: "Fotospacer", count: 5 },
  { id: 185, slug: "fotogra", name: "Fotogra", count: 5 },
  { id: 214, slug: "dzialania-w-strefie-sprzetu", name: "DZIAŁANIA W STREFIE SPRZĘTU", count: 59 },
  { id: 215, slug: "strefa-teleobiektywow", name: "STREFA TELEOBIEKTYWÓW", count: 1 },
  { id: 314, slug: "playground", name: "PLAYGROUND", count: 8 },
  { id: 142, slug: "streaming", name: "Streaming", count: 0 },
  { id: 143, slug: "inne", name: "Inne", count: 0 },
];

describe("buildIndex", () => {
  const a = makeSession({ eventId: 1, day: "pt" });
  const b = makeSession({ eventId: 2, day: "sob", start: 600, end: 660 });
  const c = makeSession({ eventId: 2, day: "pt", start: 600, end: 660 });
  const speaker = makeSpeaker({ id: 134, slug: "emil-bilinski-x", name: "Emil Biliński" });
  const data = makeData([a, b, c], {
    speakers: [speaker],
    themes: [{ id: 7, slug: "portret", name: "Portret", count: 3 }],
    brands: [{ id: 9, slug: "sony", name: "Sony", count: 4 }],
  });
  const index = buildIndex(data);

  it("maps sessions by id and collects the id set", () => {
    expect(index.sessionById.get("2:sob")).toBe(b);
    expect(index.sessionById.get("2:pt")).toBe(c);
    expect(index.sessionIds).toEqual(new Set(["1:pt", "2:sob", "2:pt"]));
  });

  it("groups sessions by day in data order, with an entry for every day", () => {
    expect(index.sessionsByDay.get("pt")).toEqual([a, c]);
    expect(index.sessionsByDay.get("sob")).toEqual([b]);
    expect(index.sessionsByDay.get("czw")).toEqual([]);
  });

  it("maps types, themes, brands, locations, speakers and days by id", () => {
    expect(index.typeById.get(184)?.name).toBe("Prelekcja");
    expect(index.themeById.get(7)?.name).toBe("Portret");
    expect(index.brandById.get(9)?.name).toBe("Sony");
    expect(index.locationById.get(233)?.short).toBe("Sala wykł. 1");
    expect(index.speakerById.get(134)).toBe(speaker);
    expect(index.dayById.get("sob")?.date).toBe("2026-09-05");
  });

  it("works on empty data", () => {
    const empty = buildIndex(makeData([]));
    expect(empty.sessionIds.size).toBe(0);
    expect(empty.sessionsByDay.get("pt")).toEqual([]);
    expect(empty.speakerById.size).toBe(0);
  });
});

describe("TYPE_PRIORITY and typeRank", () => {
  it("lists the nine types in spec §7.2 order", () => {
    expect(TYPE_PRIORITY).toEqual([
      "Prelekcja",
      "Prelekcja z sesją",
      "Warsztaty",
      "Fotospacer",
      "Fotogra",
      "PLAYGROUND",
      "DZIAŁANIA W STREFIE SPRZĘTU",
      "STREFA TELEOBIEKTYWÓW",
      "Ogólne",
    ]);
  });

  it("ranks listed types by position and unlisted types after all of them", () => {
    expect(typeRank("Prelekcja")).toBe(0);
    expect(typeRank("Prelekcja z sesją")).toBe(1);
    expect(typeRank("Ogólne")).toBe(8);
    expect(typeRank("Streaming")).toBe(9);
    expect(typeRank("")).toBe(9);
  });
});

describe("primaryType", () => {
  const base = makeData([]);
  const index = buildIndex({ ...base, types: [...base.types, ...EXTRA_TYPES] });

  it("returns the only type of a single-type session", () => {
    expect(primaryType(makeSession({ typeIds: [184] }), index)?.id).toBe(184);
  });

  it("prefers Fotospacer over Fotogra regardless of typeIds order (event 39549)", () => {
    expect(primaryType(makeSession({ typeIds: [185, 3] }), index)?.name).toBe("Fotospacer");
    expect(primaryType(makeSession({ typeIds: [3, 185] }), index)?.name).toBe("Fotospacer");
  });

  it("prefers STREFA TELEOBIEKTYWÓW over Ogólne (event 46493)", () => {
    expect(primaryType(makeSession({ typeIds: [242, 215] }), index)?.id).toBe(215);
  });

  it("prefers any listed type over an unlisted one", () => {
    expect(primaryType(makeSession({ typeIds: [143, 242] }), index)?.name).toBe("Ogólne");
  });

  it("orders unlisted types by name with Polish collation", () => {
    expect(primaryType(makeSession({ typeIds: [142, 143] }), index)?.name).toBe("Inne");
  });

  it("skips unknown type ids", () => {
    expect(primaryType(makeSession({ typeIds: [999, 184] }), index)?.id).toBe(184);
  });

  it("returns null when no type id is known", () => {
    expect(primaryType(makeSession({ typeIds: [999] }), index)).toBeNull();
    expect(primaryType(makeSession({ typeIds: [] }), index)).toBeNull();
  });
});

describe("locationsOf and locationLabel", () => {
  const playground = makeLocation({
    id: 313,
    slug: "stoiska-wystawcow-poziom-ii-sosalsa-playground",
    name: "Stoiska wystawców - poziom II (SOSALSA) - Playground",
    count: 8,
    venue: "Stoiska wystawców",
    level: "II",
    room: "SOSALSA · Playground",
    short: "Stoiska · Playground",
    order: 4,
  });
  const base = makeData([]);
  const index = buildIndex({ ...base, locations: [...base.locations, playground] });

  it("returns locations in locationIds order (event 46526)", () => {
    const s = makeSession({ locationIds: [308, 313] });
    expect(locationsOf(s, index).map((l) => l.id)).toEqual([308, 313]);
    expect(locationLabel(s, index)).toBe("Stoiska · Plenum / Stoiska · Playground");
  });

  it("keeps the session's own order even when it differs from Location.order", () => {
    const s = makeSession({ locationIds: [313, 308] });
    expect(locationsOf(s, index).map((l) => l.id)).toEqual([313, 308]);
    expect(locationLabel(s, index)).toBe("Stoiska · Playground / Stoiska · Plenum");
  });

  it("uses the short label of a single location", () => {
    expect(locationLabel(makeSession({ locationIds: [233] }), index)).toBe("Sala wykł. 1");
  });

  it("skips unknown ids and gives an empty label without locations", () => {
    expect(locationsOf(makeSession({ locationIds: [999] }), index)).toEqual([]);
    expect(locationLabel(makeSession({ locationIds: [999] }), index)).toBe("");
    expect(locationLabel(makeSession({ locationIds: [] }), index)).toBe("");
  });
});

describe("speakersOf", () => {
  const emil = makeSpeaker({ id: 134, slug: "emil-bilinski-x", name: "Emil Biliński" });
  const karol = makeSpeaker({ id: 128, slug: "karol-bartnik-2", name: "Karol Bartnik" });
  const index = buildIndex(makeData([], { speakers: [emil, karol] }));

  it("returns speakers in speakerIds order", () => {
    expect(speakersOf(makeSession({ speakerIds: [128, 134] }), index)).toEqual([karol, emil]);
  });

  it("skips unknown ids", () => {
    expect(speakersOf(makeSession({ speakerIds: [1, 134] }), index)).toEqual([emil]);
  });

  it("returns an empty list for a session without speakers", () => {
    expect(speakersOf(makeSession(), index)).toEqual([]);
  });
});
