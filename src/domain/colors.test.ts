import { describe, expect, it } from "vitest";
import type { Term } from "../data/types";
import { makeData, makeSession } from "../test/fixtures/build";
import { buildIndex } from "./lookup";
import { TYPE_HUES, hashHue, hueFor } from "./colors";

const term = (id: number, slug: string, name: string, count = 1): Term => ({ id, slug, name, count });

const data = makeData([], {
  types: [
    term(184, "prelekcja", "Prelekcja", 51),
    term(278, "prelekcja-z-sesja", "Prelekcja z sesją", 5),
    term(5, "warsztaty", "Warsztaty", 12),
    term(3, "fotospacer", "Fotospacer", 5),
    term(185, "fotogra", "Fotogra", 5),
    term(314, "playground", "PLAYGROUND", 8),
    term(214, "dzialania-w-strefie-sprzetu", "DZIAŁANIA W STREFIE SPRZĘTU", 59),
    term(215, "strefa-teleobiektywow", "STREFA TELEOBIEKTYWÓW", 1),
    term(242, "ogolne", "Ogólne", 13),
    term(143, "inne", "Inne", 0),
  ],
});
const index = buildIndex(data);

const NEUTRAL = { hue: 0, chroma: 0 };
const CHROMA = 0.16;

describe("TYPE_HUES", () => {
  it("holds the spec §8 hues by type name", () => {
    expect(TYPE_HUES).toEqual({
      Prelekcja: 45,
      "Prelekcja z sesją": 25,
      Warsztaty: 340,
      Fotospacer: 95,
      Fotogra: 95,
      PLAYGROUND: 175,
      "DZIAŁANIA W STREFIE SPRZĘTU": 240,
      "STREFA TELEOBIEKTYWÓW": 260,
    });
  });

  it("does not list Ogólne, which is neutral", () => {
    expect("Ogólne" in TYPE_HUES).toBe(false);
  });
});

describe("hashHue", () => {
  it("returns one of the 12 evenly spaced hues", () => {
    for (let id = 1; id <= 500; id += 1) {
      const hue = hashHue(id);
      expect(hue % 30).toBe(0);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(330);
    }
  });

  it("is deterministic and reaches every hue", () => {
    expect(hashHue(233)).toBe(hashHue(233));
    const seen = new Set<number>();
    for (let id = 1; id <= 200; id += 1) seen.add(hashHue(id));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  });

  it("maps the real location and brand ids to fixed hues", () => {
    expect(hashHue(233)).toBe(60);
    expect(hashHue(281)).toBe(180);
    expect(hashHue(282)).toBe(90);
    expect(hashHue(279)).toBe(270);
    expect(hashHue(280)).toBe(60);
    expect(hashHue(308)).toBe(0);
    expect(hashHue(318)).toBe(30);
    expect(hashHue(10)).toBe(120);
  });
});

describe("hueFor by type", () => {
  it("uses the type hue of the primary type with chroma 0.16", () => {
    expect(hueFor(makeSession({ typeIds: [184] }), "type", index)).toEqual({ hue: 45, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [278] }), "type", index)).toEqual({ hue: 25, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [5] }), "type", index)).toEqual({ hue: 340, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [3] }), "type", index)).toEqual({ hue: 95, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [185] }), "type", index)).toEqual({ hue: 95, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [314] }), "type", index)).toEqual({ hue: 175, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [214] }), "type", index)).toEqual({ hue: 240, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [215] }), "type", index)).toEqual({ hue: 260, chroma: CHROMA });
  });

  it("picks the primary type by the §7.2 priority order, not by position", () => {
    expect(hueFor(makeSession({ typeIds: [5, 184] }), "type", index)).toEqual({ hue: 45, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [242, 215] }), "type", index)).toEqual({ hue: 260, chroma: CHROMA });
  });

  it("is neutral for Ogólne", () => {
    expect(hueFor(makeSession({ typeIds: [242] }), "type", index)).toEqual(NEUTRAL);
  });

  it("falls back to hue 300 for a type outside the map", () => {
    expect(hueFor(makeSession({ typeIds: [143] }), "type", index)).toEqual({ hue: 300, chroma: CHROMA });
  });

  it("is neutral for a session without types", () => {
    expect(hueFor(makeSession({ typeIds: [] }), "type", index)).toEqual(NEUTRAL);
  });
});

describe("hueFor by location and brand", () => {
  it("hashes the first location id", () => {
    expect(hueFor(makeSession({ locationIds: [233] }), "location", index)).toEqual({ hue: 60, chroma: CHROMA });
    expect(hueFor(makeSession({ locationIds: [281, 233] }), "location", index)).toEqual({ hue: 180, chroma: CHROMA });
  });

  it("hashes the first brand id", () => {
    expect(hueFor(makeSession({ brandIds: [10] }), "brand", index)).toEqual({ hue: 120, chroma: CHROMA });
    expect(hueFor(makeSession({ brandIds: [10, 11] }), "brand", index)).toEqual({ hue: 120, chroma: CHROMA });
  });

  it("is neutral without a location or a brand", () => {
    expect(hueFor(makeSession({ locationIds: [] }), "location", index)).toEqual(NEUTRAL);
    expect(hueFor(makeSession({ brandIds: [] }), "brand", index)).toEqual(NEUTRAL);
  });

  it("ignores the type when colouring by location or brand", () => {
    const s = makeSession({ typeIds: [242], locationIds: [233], brandIds: [10] });
    expect(hueFor(s, "location", index).chroma).toBe(CHROMA);
    expect(hueFor(s, "brand", index).chroma).toBe(CHROMA);
  });
});
