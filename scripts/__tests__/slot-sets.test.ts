// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SLOT_SETS, slotSetMembers } from "../lib/slot-sets";
import { dataOf, sessionOf } from "./data.fixture";

const SESSIONS = [
  sessionOf("10:pt", { typeIds: [184], locationIds: [233], start: 570, end: 645 }),
  sessionOf("11:pt", { typeIds: [278], locationIds: [281], start: 660, end: 735 }),
  sessionOf("12:pt", { typeIds: [5], locationIds: [233], start: 570, end: 960 }),
  sessionOf("13:sob", { typeIds: [184], locationIds: [233], start: 600, end: 675 }),
  sessionOf("14:pt", { typeIds: [242], locationIds: [318], start: 540, end: 1080, allDay: true }),
  sessionOf("15:pt", { typeIds: [184], locationIds: [233], start: null, end: null, timeText: "" }),
  sessionOf("16:pt", { typeIds: [184], locationIds: [233], start: 810, end: null, timeText: "13:30" }),
];
const DATA = dataOf(SESSIONS);

function byId(id: string) {
  return SLOT_SETS.find((def) => def.id === id);
}

describe("SLOT_SETS", () => {
  it("defines the eight calibration sets of spec §5.2 in table order", () => {
    expect(SLOT_SETS.map((def) => def.id)).toEqual([
      "sat-lectures",
      "sat-prelekcja-only",
      "fri-lectures",
      "fri-prelekcja-only",
      "fri-lecture-rooms",
      "fri-all",
      "sat-all",
      "fri-equipment",
    ]);
  });

  it("uses the exact WordPress term ids from the spec table", () => {
    expect(byId("sat-lectures")).toEqual({ id: "sat-lectures", day: "sob", typeIds: [184, 278] });
    expect(byId("sat-prelekcja-only")).toEqual({ id: "sat-prelekcja-only", day: "sob", typeIds: [184] });
    expect(byId("fri-lectures")).toEqual({ id: "fri-lectures", day: "pt", typeIds: [184, 278] });
    expect(byId("fri-prelekcja-only")).toEqual({ id: "fri-prelekcja-only", day: "pt", typeIds: [184] });
    expect(byId("fri-lecture-rooms")).toEqual({
      id: "fri-lecture-rooms",
      day: "pt",
      locationIds: [282, 279, 233, 281, 280],
    });
    expect(byId("fri-all")).toEqual({ id: "fri-all", day: "pt" });
    expect(byId("sat-all")).toEqual({ id: "sat-all", day: "sob" });
    expect(byId("fri-equipment")).toEqual({ id: "fri-equipment", day: "pt", typeIds: [214, 215] });
  });
});

describe("slotSetMembers", () => {
  it("keeps timed, non-allDay sessions of the day matching any listed type, in sessions order", () => {
    const ids = slotSetMembers({ id: "x", day: "pt", typeIds: [184, 278] }, DATA).map((s) => s.id);
    expect(ids).toEqual(["10:pt", "11:pt", "16:pt"]);
  });

  it("matches any listed location", () => {
    const ids = slotSetMembers({ id: "x", day: "pt", locationIds: [281, 318] }, DATA).map((s) => s.id);
    expect(ids).toEqual(["11:pt"]);
  });

  it("takes the whole day when no predicate is given, still excluding allDay and no-start sessions", () => {
    const ids = slotSetMembers({ id: "x", day: "pt" }, DATA).map((s) => s.id);
    expect(ids).toEqual(["10:pt", "11:pt", "12:pt", "16:pt"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(slotSetMembers({ id: "x", day: "sob", typeIds: [5] }, DATA)).toEqual([]);
  });
});
