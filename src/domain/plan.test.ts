import { describe, expect, it } from "vitest";
import type { Day, Session } from "../data/types";
import { makeDay, makeSession } from "../test/fixtures/build";
import { nextUp, planForDay, planSessions, planSummary } from "./plan";

const DAYS: Day[] = [
  makeDay({ id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" }),
  makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" }),
  makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" }),
];

// Friday: A and B overlap (09:30–10:30 vs 10:00–11:00); C touches B's end (11:00–12:00) so B/C do not overlap.
const A = makeSession({ id: "10:pt", eventId: 10, day: "pt", title: "A", start: 570, end: 630 });
const B = makeSession({ id: "11:pt", eventId: 11, day: "pt", title: "B", start: 600, end: 660 });
const C = makeSession({ id: "12:pt", eventId: 12, day: "pt", title: "C", start: 660, end: 720 });
// Saturday: D and E collide; Z is an all-day zone (never a conflict); N has no start.
const D = makeSession({ id: "13:sob", eventId: 13, day: "sob", title: "D", start: 570, end: 630 });
const E = makeSession({ id: "14:sob", eventId: 14, day: "sob", title: "E", start: 570, end: 630 });
const Z = makeSession({ id: "15:sob", eventId: 15, day: "sob", title: "Rejestracja", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318] });
const N = makeSession({ id: "16:sob", eventId: 16, day: "sob", title: "N", start: null, end: null, timeText: "" });
const ALL: Session[] = [A, B, C, D, E, Z, N];

const idsOf = (sessions: Session[]): string[] => sessions.map((s) => s.id);
const pairIds = (pairs: { a: Session; b: Session }[]): string[][] => pairs.map((p) => [p.a.id, p.b.id].sort());

describe("planSessions", () => {
  it("returns plan members in data order regardless of set insertion order", () => {
    const plan = planSessions(new Set(["14:sob", "10:pt", "12:pt"]), ALL);
    expect(idsOf(plan)).toEqual(["10:pt", "12:pt", "14:sob"]);
  });

  it("ignores ids that are not in the data", () => {
    const plan = planSessions(new Set(["999:pt", "10:pt"]), ALL);
    expect(idsOf(plan)).toEqual(["10:pt"]);
  });

  it("returns an empty list for an empty plan set", () => {
    expect(planSessions(new Set(), ALL)).toEqual([]);
  });
});

describe("planForDay", () => {
  it("keeps only the sessions of the given day", () => {
    expect(idsOf(planForDay(ALL, "sob"))).toEqual(["13:sob", "14:sob", "15:sob", "16:sob"]);
    expect(planForDay(ALL, "czw")).toEqual([]);
  });
});

describe("planSummary", () => {
  it("counts plan sessions per day in days order, including days with none", () => {
    const summary = planSummary(ALL, DAYS);
    expect(summary.perDay.map((p) => [p.day.id, p.count])).toEqual([
      ["czw", 0],
      ["pt", 3],
      ["sob", 4],
    ]);
  });

  it("groups conflict pairs by day and counts them", () => {
    const summary = planSummary(ALL, DAYS);
    expect(summary.conflicts.map((c) => c.day.id)).toEqual(["pt", "sob"]);
    expect(pairIds(summary.conflicts[0]!.pairs)).toEqual([["10:pt", "11:pt"]]);
    expect(pairIds(summary.conflicts[1]!.pairs)).toEqual([["13:sob", "14:sob"]]);
    expect(summary.conflictCount).toBe(2);
  });

  it("never lists all-day zones, touching ends or no-start sessions as conflicts", () => {
    const summary = planSummary([B, C, Z, N, D], DAYS);
    expect(summary.conflicts).toEqual([]);
    expect(summary.conflictCount).toBe(0);
  });

  it("returns zero counts and no conflicts for an empty plan", () => {
    const summary = planSummary([], DAYS);
    expect(summary.perDay.map((p) => p.count)).toEqual([0, 0, 0]);
    expect(summary.conflicts).toEqual([]);
    expect(summary.conflictCount).toBe(0);
  });
});

describe("nextUp", () => {
  it("returns the earliest plan session starting at or after now on a festival day", () => {
    expect(nextUp([C, B, A], DAYS, new Date(2026, 8, 4, 9, 0))?.id).toBe("10:pt");
  });

  it("treats a session starting exactly now as next", () => {
    expect(nextUp([A, B, C], DAYS, new Date(2026, 8, 4, 10, 0))?.id).toBe("11:pt");
  });

  it("returns null when every plan session of today has started", () => {
    expect(nextUp([A, B, C], DAYS, new Date(2026, 8, 4, 13, 0))).toBeNull();
  });

  it("never picks a session from another day", () => {
    expect(nextUp([D, E], DAYS, new Date(2026, 8, 4, 8, 0))).toBeNull();
  });

  it("returns null off the festival days", () => {
    expect(nextUp(ALL, DAYS, new Date(2026, 8, 6, 10, 0))).toBeNull();
    expect(nextUp(ALL, DAYS, new Date(2026, 8, 2, 10, 0))).toBeNull();
  });

  it("ignores sessions without a start", () => {
    expect(nextUp([N, D], DAYS, new Date(2026, 8, 5, 9, 0))?.id).toBe("13:sob");
    expect(nextUp([N], DAYS, new Date(2026, 8, 5, 9, 0))).toBeNull();
  });
});
