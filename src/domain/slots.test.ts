import { describe, expect, it } from "vitest";
import type { Session, TimedSession } from "../data/types";
import { makeSession } from "../test/fixtures/build";
import slotSets from "../test/fixtures/slot-sets.json";
import {
  DEFAULT_TOLERANCE,
  detectSlots,
  rowInterval,
  rowSpan,
  slotIndexOf,
  slotRegularity,
  spanAllowed,
} from "./slots";

interface FixtureRow {
  id: string;
  start: number;
  end: number | null;
}

const SETS = slotSets as Record<string, FixtureRow[]>;

function timed(overrides: Partial<Session> & { id: string; start: number }): TimedSession {
  return makeSession(overrides) as TimedSession;
}

function fromFixture(setId: string): TimedSession[] {
  const rows = SETS[setId];
  if (rows === undefined) throw new Error(`slot-sets.json has no set "${setId}"`);
  return rows.map((row) => {
    const [eventId, day] = row.id.split(":");
    return timed({ id: row.id, eventId: Number(eventId), day, start: row.start, end: row.end });
  });
}

describe("detectSlots", () => {
  it("returns [] for an empty slot set", () => {
    expect(detectSlots([])).toEqual([]);
  });

  it("exports the default tolerance of 15", () => {
    expect(DEFAULT_TOLERANCE).toBe(15);
  });

  it("merges starts within the tolerance into one slot and keeps the members in input order", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 575, end: 635 });
    const c = timed({ id: "c", start: 585, end: 645 });
    const d = timed({ id: "d", start: 600, end: 660 });
    const slots = detectSlots([a, b, c, d]);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({ index: 0, start: 570, lastStart: 600, end: 660, sessionIds: ["a", "b", "c", "d"] });
  });

  it("starts a new slot when the gap to the previous start exceeds the tolerance", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 590, end: 650 });
    const slots = detectSlots([a, b]);
    expect(slots.map((s) => s.start)).toEqual([570, 590]);
  });

  it("starts a new slot when the span from the first start would exceed twice the tolerance (staggered chain)", () => {
    const chain = [570, 585, 600, 615, 630].map((start, i) => timed({ id: `s${i}`, start, end: start + 60 }));
    const slots = detectSlots(chain);
    expect(slots.map((s) => [s.start, s.lastStart])).toEqual([
      [570, 600],
      [615, 630],
    ]);
  });

  it("honours the tolerance option", () => {
    const three = [570, 600, 630].map((start, i) => timed({ id: `s${i}`, start, end: start + 45 }));
    expect(detectSlots(three)).toHaveLength(3);
    expect(detectSlots(three, { tolerance: 30 })).toHaveLength(1);
  });

  it("ends a slot at the next slot's start and the last slot at the members' latest visual end", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 615, end: 700 });
    const c = timed({ id: "c", start: 720, end: 780 });
    expect(detectSlots([a, b, c])).toEqual([
      { index: 0, start: 600, lastStart: 615, end: 720, sessionIds: ["a", "b"] },
      { index: 1, start: 720, lastStart: 720, end: 780, sessionIds: ["c"] },
    ]);
  });

  it("uses start + 20 as the visual end of a trailing point session", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const p = timed({ id: "p", start: 900, end: null });
    const slots = detectSlots([a, p]);
    expect(slots[1]).toEqual({ index: 1, start: 900, lastStart: 900, end: 920, sessionIds: ["p"] });
  });
});

describe("slotIndexOf, rowSpan, rowInterval", () => {
  const a = timed({ id: "a", start: 570, end: 700 });
  const b = timed({ id: "b", start: 645, end: 705 });
  const c = timed({ id: "c", start: 720, end: 780 });
  const slots = detectSlots([a, b, c]);

  it("detects three rows for the synthetic column", () => {
    expect(slots.map((s) => s.start)).toEqual([570, 645, 720]);
  });

  it("finds the slot whose cluster contains the session start", () => {
    expect(slotIndexOf(a, slots)).toBe(0);
    expect(slotIndexOf(b, slots)).toBe(1);
    expect(slotIndexOf(c, slots)).toBe(2);
    expect(slotIndexOf(timed({ id: "x", start: 800 }), slots)).toBe(-1);
  });

  it("spans every later row whose start plus tolerance lies before the visual end", () => {
    expect(rowSpan(a, slots, 15)).toBe(2);
    expect(rowSpan(b, slots, 15)).toBe(1);
    expect(rowSpan(c, slots, 15)).toBe(1);
  });

  it("does not span a row that starts exactly tolerance minutes before the end", () => {
    const edge = timed({ id: "e", start: 570, end: 660 });
    expect(rowSpan(edge, slots, 15)).toBe(1);
  });

  it("returns 1 for a session outside every slot", () => {
    expect(rowSpan(timed({ id: "x", start: 800, end: 1000 }), slots, 15)).toBe(1);
  });

  it("keeps point sessions on one row even when the next slot is inside their 20 minutes", () => {
    const p = timed({ id: "p", start: 570, end: null });
    const q = timed({ id: "q", start: 576, end: 640 });
    const tight = detectSlots([p, q], { tolerance: 5 });
    expect(tight.map((s) => s.start)).toEqual([570, 576]);
    expect(rowSpan(p, tight, 5)).toBe(1);
  });

  it("returns [startRow, startRow + rowSpan)", () => {
    expect(rowInterval(a, slots, 15)).toEqual([0, 2]);
    expect(rowInterval(b, slots, 15)).toEqual([1, 2]);
    expect(rowInterval(c, slots, 15)).toEqual([2, 3]);
  });
});

describe("spanAllowed", () => {
  const a = timed({ id: "a", start: 570, end: 700 });
  const b = timed({ id: "b", start: 645, end: 705 });
  const c = timed({ id: "c", start: 720, end: 780 });
  const slots = detectSlots([a, b, c]);

  it("is false when another session in the column occupies a row inside the span", () => {
    expect(spanAllowed(a, [a, b, c], slots, 15)).toBe(false);
  });

  it("is false for the confined session whose row the spanning session covers", () => {
    expect(spanAllowed(b, [a, b, c], slots, 15)).toBe(false);
  });

  it("is true once the intersecting session is removed from the column", () => {
    expect(spanAllowed(a, [a, c], slots, 15)).toBe(true);
  });

  it("is true for a one-row session whose row nobody else spans into", () => {
    expect(spanAllowed(c, [a, b, c], slots, 15)).toBe(true);
  });

  it("ignores the session itself", () => {
    expect(spanAllowed(a, [a], slots, 15)).toBe(true);
  });
});

describe("slotRegularity", () => {
  it("returns zeros and not distinguishable for an empty list", () => {
    expect(slotRegularity([], [], 15)).toEqual({ medianGap: 0, sharedRatio: 0, distinguishable: false });
  });

  it("returns medianGap 0 with a single slot", () => {
    const only = [timed({ id: "a", start: 600, end: 660 }), timed({ id: "b", start: 605, end: 665 })];
    const r = slotRegularity(detectSlots(only), only, 15);
    expect(r).toEqual({ medianGap: 0, sharedRatio: 1, distinguishable: false });
  });

  it("takes the mean of the two middle gaps for an even gap count", () => {
    const singles = [570, 600, 660, 720, 750].map((start, i) => timed({ id: `s${i}`, start, end: start + 25 }));
    const r = slotRegularity(detectSlots(singles), singles, 15);
    expect(r.medianGap).toBe(45);
    expect(r.sharedRatio).toBe(0);
    expect(r.distinguishable).toBe(false);
  });

  it("takes the middle gap for an odd gap count", () => {
    const singles = [570, 600, 660, 720].map((start, i) => timed({ id: `s${i}`, start, end: start + 25 }));
    expect(slotRegularity(detectSlots(singles), singles, 15).medianGap).toBe(60);
  });

  it("counts the fraction of sessions sitting in slots with two or more sessions", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 575, end: 635 });
    const c = timed({ id: "c", start: 660, end: 720 });
    const d = timed({ id: "d", start: 665, end: 725 });
    const e = timed({ id: "e", start: 750, end: 800 });
    const shared = [a, b, c, d];
    expect(slotRegularity(detectSlots(shared), shared, 15)).toEqual({ medianGap: 90, sharedRatio: 1, distinguishable: true });
    const withLoner = [a, b, c, d, e];
    const r = slotRegularity(detectSlots(withLoner), withLoner, 15);
    expect(r.sharedRatio).toBeCloseTo(0.8, 5);
    expect(r.distinguishable).toBe(true);
  });

  it("is not distinguishable when the median gap is below three tolerances", () => {
    const a = timed({ id: "a", start: 570, end: 610 });
    const b = timed({ id: "b", start: 575, end: 615 });
    const c = timed({ id: "c", start: 610, end: 650 });
    const d = timed({ id: "d", start: 615, end: 655 });
    const all = [a, b, c, d];
    const r = slotRegularity(detectSlots(all), all, 15);
    expect(r.medianGap).toBe(40);
    expect(r.sharedRatio).toBe(1);
    expect(r.distinguishable).toBe(false);
  });

  it("is not distinguishable when fewer than three quarters of the sessions share a slot", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 575, end: 635 });
    const c = timed({ id: "c", start: 660, end: 720 });
    const d = timed({ id: "d", start: 750, end: 810 });
    const all = [a, b, c, d];
    const r = slotRegularity(detectSlots(all), all, 15);
    expect(r.medianGap).toBe(90);
    expect(r.sharedRatio).toBe(0.5);
    expect(r.distinguishable).toBe(false);
  });
});

describe("calibration sets from src/test/fixtures/slot-sets.json (spec §5.2, tolerance 15)", () => {
  const TABLE = [
    { set: "sat-lectures", n: 29, slots: 8, medianGap: 75, shared: 0.97, distinguishable: true },
    { set: "sat-prelekcja-only", n: 26, slots: 8, medianGap: 75, shared: 0.96, distinguishable: true },
    { set: "fri-lectures", n: 27, slots: 13, medianGap: 45, shared: 0.78, distinguishable: true },
    { set: "fri-prelekcja-only", n: 25, slots: 14, medianGap: 45, shared: 0.72, distinguishable: false },
    { set: "fri-lecture-rooms", n: 29, slots: 12, medianGap: 45, shared: 0.83, distinguishable: true },
    { set: "fri-all", n: 72, slots: 16, medianGap: 40, shared: 0.93, distinguishable: false },
    { set: "sat-all", n: 70, slots: 15, medianGap: 40, shared: 0.96, distinguishable: false },
    { set: "fri-equipment", n: 31, slots: 12, medianGap: 40, shared: 0.87, distinguishable: false },
  ];

  for (const row of TABLE) {
    it(`${row.set}: ${row.n} sessions, ${row.slots} slots, median gap ${row.medianGap}, shared ${row.shared}, distinguishable ${row.distinguishable}`, () => {
      const sessions = fromFixture(row.set);
      expect(sessions).toHaveLength(row.n);
      const slots = detectSlots(sessions, { tolerance: 15 });
      const r = slotRegularity(slots, sessions, 15);
      expect(slots).toHaveLength(row.slots);
      expect(r.medianGap).toBe(row.medianGap);
      expect(r.sharedRatio).toBeCloseTo(row.shared, 2);
      expect(r.distinguishable).toBe(row.distinguishable);
    });
  }

  it("every fixture session belongs to exactly one slot", () => {
    for (const row of TABLE) {
      const sessions = fromFixture(row.set);
      const slots = detectSlots(sessions);
      const ids = slots.flatMap((s) => s.sessionIds);
      expect(ids).toHaveLength(sessions.length);
      expect(new Set(ids).size).toBe(sessions.length);
      for (const s of sessions) expect(slotIndexOf(s, slots)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("row spans against the fri-lectures slot rows", () => {
  const friLectures = fromFixture("fri-lectures");
  const slots = detectSlots(friLectures, { tolerance: 15 });

  it("has the 13 slot rows starting 09:30, 10:45, 12:00, 13:20, 13:40, 14:30, 15:00, 15:45, 16:15, 17:00, 17:30, 18:15, 18:40", () => {
    expect(slots.map((s) => s.start)).toEqual([570, 645, 720, 800, 820, 870, 900, 945, 975, 1020, 1050, 1095, 1120]);
  });

  it("the 09:30–16:00 workshop (event 41151) starts in row 0 and spans 7 rows", () => {
    const workshop = timed({
      id: "41151:pt",
      eventId: 41151,
      day: "pt",
      title: "Warsztaty Masterclass – Moda na błysk",
      start: 570,
      end: 960,
      typeIds: [5],
      locationIds: [290],
    });
    expect(slotIndexOf(workshop, slots)).toBe(0);
    expect(rowSpan(workshop, slots, 15)).toBe(7);
    expect(rowInterval(workshop, slots, 15)).toEqual([0, 7]);
    expect(slots[6]?.start).toBe(900);
    expect(slots[7]?.start).toBe(945);
  });

  it("the 13:20–14:20 lecture (39564:pt) spans two rows, its second row being 13:40", () => {
    const lecture = friLectures.find((s) => s.id === "39564:pt");
    if (lecture === undefined) throw new Error("fixture is missing 39564:pt");
    expect(lecture.start).toBe(800);
    expect(lecture.end).toBe(860);
    expect(slotIndexOf(lecture, slots)).toBe(3);
    expect(rowSpan(lecture, slots, 15)).toBe(2);
    expect(slots[4]?.start).toBe(820);
  });

  it("the lecture may span in a column holding only itself but not next to a 13:40 session", () => {
    const lecture = friLectures.find((s) => s.id === "39564:pt");
    if (lecture === undefined) throw new Error("fixture is missing 39564:pt");
    const at1340 = friLectures.filter((s) => s.start === 820);
    expect(at1340.length).toBeGreaterThan(0);
    expect(spanAllowed(lecture, [lecture], slots, 15)).toBe(true);
    expect(spanAllowed(lecture, [lecture, ...at1340], slots, 15)).toBe(false);
  });
});
