// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Level } from "../../src/data/types";
import { LEVEL_ORDER, SHORT_LABELS, compareLocations, parseLocation, shortLabel } from "../lib/locations";

interface LocationFixture {
  id: number;
  name: string;
  venue: string;
  level: Level;
  room: string | null;
  short: string;
  rule: 1 | 2 | 3 | 4 | 5 | 6;
}

const fixture = JSON.parse(
  readFileSync(new URL("./locations.fixture.json", import.meta.url), "utf8"),
) as LocationFixture[];

describe("locations fixture", () => {
  it("lists all 26 location terms with unique ids", () => {
    expect(fixture).toHaveLength(26);
    expect(new Set(fixture.map((f) => f.id)).size).toBe(26);
  });

  it("uses rules 1-6 for 8/1/5/3/5/4 terms", () => {
    const counts = new Map<number, number>();
    for (const f of fixture) counts.set(f.rule, (counts.get(f.rule) ?? 0) + 1);
    expect([1, 2, 3, 4, 5, 6].map((rule) => counts.get(rule) ?? 0)).toEqual([8, 1, 5, 3, 5, 4]);
  });
});

describe("parseLocation and shortLabel against every term", () => {
  it.each(fixture)("$id $name", (f) => {
    const parsed = parseLocation(f.name);
    expect(parsed).toEqual({ venue: f.venue, level: f.level, room: f.room, rule: f.rule });
    expect(shortLabel(f.id, parsed)).toEqual({ short: f.short, fromMap: true });
  });

  it("reads the two-level term 307 as I+II", () => {
    expect(parseLocation("Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA)").level).toBe("I+II");
  });

  it("reads the SOSALSA terms 309, 310 and 313 as level II and PLENUM 308 as level I", () => {
    expect(parseLocation("Stoiska wystawców - poziom II (SOSALSA)").level).toBe("II");
    expect(parseLocation("Stoiska wystawców - poziom II (SOSALSA) - wyjście na dach").level).toBe("II");
    expect(parseLocation("Stoiska wystawców - poziom II (SOSALSA) - Playground").level).toBe("II");
    expect(parseLocation("Stoiska wystawców - poziom I (PLENUM)").level).toBe("I");
  });

  it("gives the bare venue W4 (312) no level and no room", () => {
    expect(parseLocation("W4")).toEqual({ venue: "W4", level: null, room: null, rule: 6 });
  });

  it("never reads poziom II as poziom I in rule 1", () => {
    expect(parseLocation("Klub bokserski - poziom II - Sala wykładowa nr 4").level).toBe("II");
    expect(parseLocation("Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3").level).toBe("0");
  });

  it("matches poziom case-insensitively and trims the name", () => {
    expect(parseLocation("  Nowa hala - POZIOM iii - Sala wykładowa nr 9 ")).toEqual({
      venue: "Nowa hala",
      level: "III",
      room: "Sala wykładowa nr 9",
      rule: 1,
    });
  });
});

describe("SHORT_LABELS", () => {
  it("has exactly the 26 ids of the spec table", () => {
    const ids = Object.keys(SHORT_LABELS).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(fixture.map((f) => f.id).sort((a, b) => a - b));
  });
});

describe("shortLabel fallback for unmapped terms", () => {
  it("shortens Sala wykładowa in the room", () => {
    const parsed = parseLocation("Nowa hala - poziom I - Sala wykładowa nr 9");
    expect(shortLabel(999, parsed)).toEqual({ short: "Sala wykł. nr 9", fromMap: false });
  });

  it("shortens Sala warsztatowa in the room", () => {
    const parsed = parseLocation("Nowe studio - Sala warsztatowa VII");
    expect(shortLabel(998, parsed)).toEqual({ short: "Warsztat. VII", fromMap: false });
  });

  it("keeps other rooms verbatim", () => {
    const parsed = parseLocation("Stoiska wystawców - poziom III (DACH)");
    expect(shortLabel(997, parsed)).toEqual({ short: "DACH", fromMap: false });
  });

  it("falls back to the venue when there is no room", () => {
    expect(shortLabel(996, parseLocation("Foyer - poziom 0"))).toEqual({ short: "Foyer", fromMap: false });
    expect(shortLabel(995, parseLocation("Namiot"))).toEqual({ short: "Namiot", fromMap: false });
  });
});

describe("LEVEL_ORDER and compareLocations", () => {
  it("orders levels 0, I, I+II, II, III, null", () => {
    expect(LEVEL_ORDER).toEqual(["0", "I", "I+II", "II", "III", null]);
  });

  it("sorts by level before name", () => {
    expect(compareLocations({ level: "II", name: "A" }, { level: "0", name: "Z" })).toBeGreaterThan(0);
    expect(compareLocations({ level: "I", name: "Z" }, { level: "I+II", name: "A" })).toBeLessThan(0);
    expect(compareLocations({ level: "III", name: "A" }, { level: null, name: "A" })).toBeLessThan(0);
  });

  it("uses Polish collation within a level", () => {
    expect(compareLocations({ level: null, name: "Łódź" }, { level: null, name: "Lublin" })).toBeGreaterThan(0);
    expect(compareLocations({ level: null, name: "Łódź" }, { level: null, name: "Maków" })).toBeLessThan(0);
    expect(compareLocations({ level: null, name: "Środa" }, { level: null, name: "Sobota" })).toBeGreaterThan(0);
    expect(compareLocations({ level: null, name: "Środa" }, { level: null, name: "Tarnów" })).toBeLessThan(0);
  });

  it("orders the 26 real terms as the locations array will be written", () => {
    const sorted = [...fixture].sort(compareLocations).map((f) => f.id);
    expect(sorted).toEqual([
      282,
      308, 311, 239, 280,
      307,
      292, 279, 241, 293, 233, 281, 309, 313, 310, 240, 234,
      318, 236, 237, 235, 312, 291, 238, 283, 290,
    ]);
  });
});
