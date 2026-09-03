import { describe, expect, it } from "vitest";
import type { Session, TimedSession } from "../data/types";
import { makeSession } from "../test/fixtures/build";
import {
  conflictCount,
  maxConcurrency,
  overlapGroups,
  overlaps,
  packLanes,
  packingEnd,
  planConflicts,
} from "./overlaps";

function timed(overrides: Partial<Session> & { id: string; start: number }): TimedSession {
  return makeSession(overrides) as TimedSession;
}

const ids = (list: Session[]): string[] => list.map((s) => s.id);

describe("overlaps", () => {
  it("is true for two sessions sharing a minute on the same day", () => {
    const a = makeSession({ id: "a:pt", start: 600, end: 660 });
    const b = makeSession({ id: "b:pt", start: 630, end: 690 });
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });

  it("is false for touching ends: 10:00–11:00 and 11:00–12:00", () => {
    const a = makeSession({ id: "a:pt", start: 600, end: 660 });
    const b = makeSession({ id: "b:pt", start: 660, end: 720 });
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(b, a)).toBe(false);
  });

  it("is false across days, including the two sessions of one dual-day event", () => {
    const fri = makeSession({ id: "39549:pt", eventId: 39549, day: "pt", start: 540, end: 1080 });
    const sat = makeSession({ id: "39549:sob", eventId: 39549, day: "sob", start: 540, end: 1080 });
    expect(overlaps(fri, sat)).toBe(false);
    const other = makeSession({ id: "b:sob", day: "sob", start: 600, end: 660 });
    expect(overlaps(fri, other)).toBe(false);
  });

  it("is false when either session is all-day", () => {
    const zone = makeSession({ id: "z:pt", start: 540, end: 1080, allDay: true, typeIds: [242] });
    const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
    expect(overlaps(zone, talk)).toBe(false);
    expect(overlaps(talk, zone)).toBe(false);
  });

  it("is false when either session has no start", () => {
    const none = makeSession({ id: "n:pt", start: null, end: null, timeText: "" });
    const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
    expect(overlaps(none, talk)).toBe(false);
    expect(overlaps(talk, none)).toBe(false);
  });

  it("treats a point session as 20 minutes long", () => {
    const point = makeSession({ id: "p:pt", start: 600, end: null });
    const inside = makeSession({ id: "i:pt", start: 619, end: 680 });
    const after = makeSession({ id: "a:pt", start: 620, end: 680 });
    expect(overlaps(point, inside)).toBe(true);
    expect(overlaps(point, after)).toBe(false);
  });

  it("does not consult the all-day flag of a long non-zone session", () => {
    const workshop = makeSession({ id: "w:pt", start: 570, end: 960, typeIds: [5] });
    const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
    expect(overlaps(workshop, talk)).toBe(true);
  });
});

describe("overlapGroups", () => {
  it("returns connected components, bridged sessions included, members sorted by start", () => {
    const a = timed({ id: "a", start: 540, end: 600 });
    const b = timed({ id: "b", start: 570, end: 660 });
    const c = timed({ id: "c", start: 630, end: 690 });
    const d = timed({ id: "d", start: 720, end: 780 });
    const groups = overlapGroups([c, d, a, b]);
    expect(groups.map(ids)).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("keeps touching sessions in separate components", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 660, end: 720 });
    expect(overlapGroups([a, b]).map(ids)).toEqual([["a"], ["b"]]);
  });

  it("never connects sessions on different days", () => {
    const fri = timed({ id: "a:pt", day: "pt", start: 600, end: 660 });
    const sat = timed({ id: "a:sob", day: "sob", start: 600, end: 660 });
    expect(overlapGroups([fri, sat]).map(ids)).toEqual([["a:pt"], ["a:sob"]]);
  });

  it("lays out all-day sessions like any other interval", () => {
    const zone = timed({ id: "z", start: 540, end: 1080, allDay: true, typeIds: [242] });
    const talk = timed({ id: "t", start: 600, end: 620 });
    expect(overlapGroups([zone, talk]).map(ids)).toEqual([["z", "t"]]);
  });

  it("uses the supplied end function", () => {
    const short = timed({ id: "s", start: 600, end: 605 });
    const next = timed({ id: "n", start: 610, end: 640 });
    expect(overlapGroups([short, next]).map(ids)).toEqual([["s"], ["n"]]);
    expect(overlapGroups([short, next], (s) => packingEnd(s, 15)).map(ids)).toEqual([["s", "n"]]);
  });

  it("returns [] for no sessions", () => {
    expect(overlapGroups([])).toEqual([]);
  });
});

describe("packingEnd", () => {
  it("is the larger of the visual end and start + minMinutes", () => {
    expect(packingEnd(timed({ id: "a", start: 600, end: 605 }), 15)).toBe(615);
    expect(packingEnd(timed({ id: "b", start: 600, end: 660 }), 15)).toBe(660);
    expect(packingEnd(timed({ id: "p", start: 600, end: null }), 25)).toBe(625);
    expect(packingEnd(timed({ id: "q", start: 600, end: null }), 0)).toBe(620);
  });
});

describe("packLanes", () => {
  it("packs a three-way overlap into three lanes", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 615, end: 675 });
    const c = timed({ id: "c", start: 630, end: 690 });
    const lanes = packLanes([a, b, c], 0);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 3 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 3 });
    expect(lanes.get("c")).toEqual({ lane: 2, lanes: 3 });
  });

  it("reuses a lane once its last session has ended (bridging component)", () => {
    const a = timed({ id: "a", start: 540, end: 600 });
    const b = timed({ id: "b", start: 570, end: 660 });
    const c = timed({ id: "c", start: 630, end: 690 });
    const d = timed({ id: "d", start: 720, end: 780 });
    const lanes = packLanes([a, b, c, d], 0);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("d")).toEqual({ lane: 0, lanes: 1 });
  });

  it("gives the longer of two sessions with the same start the lower lane", () => {
    const long = timed({ id: "long", start: 600, end: 700 });
    const short = timed({ id: "short", start: 600, end: 630 });
    const lanes = packLanes([short, long], 0);
    expect(lanes.get("long")?.lane).toBe(0);
    expect(lanes.get("short")?.lane).toBe(1);
  });

  it("returns lanes = 2 for a 09:00–18:00 all-day session and a 10:00–10:20 session while overlaps stays false", () => {
    const zone = timed({ id: "z", start: 540, end: 1080, allDay: true, typeIds: [242] });
    const talk = timed({ id: "t", start: 600, end: 620 });
    const lanes = packLanes([zone, talk], 0);
    expect(lanes.get("z")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("t")).toEqual({ lane: 1, lanes: 2 });
    expect(overlaps(zone, talk)).toBe(false);
  });

  it("puts two sessions that collide only through packing ends in one component with lanes = 2", () => {
    const short = timed({ id: "s", start: 600, end: 605 });
    const next = timed({ id: "n", start: 610, end: 640 });
    const loose = packLanes([short, next], 0);
    expect(loose.get("s")).toEqual({ lane: 0, lanes: 1 });
    expect(loose.get("n")).toEqual({ lane: 0, lanes: 1 });
    const tight = packLanes([short, next], 15);
    expect(tight.get("s")).toEqual({ lane: 0, lanes: 2 });
    expect(tight.get("n")).toEqual({ lane: 1, lanes: 2 });
  });

  it("never assigns two overlapping sessions the same lane", () => {
    const starts = [570, 575, 585, 600, 600, 615, 630, 645, 660, 700, 705, 720];
    const list = starts.map((start, i) => timed({ id: `s${i}`, start, end: start + 60 + (i % 3) * 15 }));
    const lanes = packLanes(list, 12);
    for (const a of list) {
      for (const b of list) {
        if (a.id === b.id) continue;
        const la = lanes.get(a.id);
        const lb = lanes.get(b.id);
        if (la === undefined || lb === undefined) throw new Error("missing lane");
        if (a.start < packingEnd(b, 12) && b.start < packingEnd(a, 12)) expect(la.lane).not.toBe(lb.lane);
      }
    }
  });

  it("returns an empty map for no sessions", () => {
    expect(packLanes([], 0).size).toBe(0);
  });
});

describe("maxConcurrency", () => {
  it("is 0 for no sessions", () => {
    expect(maxConcurrency([])).toBe(0);
  });

  it("counts the largest number of sessions running at one minute", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 630, end: 690 });
    const c = timed({ id: "c", start: 660, end: 720 });
    expect(maxConcurrency([a, b, c])).toBe(2);
    const d = timed({ id: "d", start: 650, end: 720 });
    expect(maxConcurrency([a, b, d])).toBe(3);
  });

  it("does not count touching sessions as concurrent", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 660, end: 720 });
    expect(maxConcurrency([a, b])).toBe(1);
  });

  it("counts per day", () => {
    const fri = timed({ id: "a:pt", day: "pt", start: 600, end: 660 });
    const sat = timed({ id: "a:sob", day: "sob", start: 600, end: 660 });
    expect(maxConcurrency([fri, sat])).toBe(1);
  });

  it("counts a point session for 20 minutes", () => {
    const point = timed({ id: "p", start: 600, end: null });
    const talk = timed({ id: "t", start: 615, end: 660 });
    expect(maxConcurrency([point, talk])).toBe(2);
  });
});

describe("planConflicts", () => {
  const a = makeSession({ id: "1:pt", eventId: 1, start: 600, end: 660 });
  const b = makeSession({ id: "2:pt", eventId: 2, start: 630, end: 690 });
  const sat = makeSession({ id: "3:sob", eventId: 3, day: "sob", start: 600, end: 660 });
  const later = makeSession({ id: "4:pt", eventId: 4, start: 700, end: 760 });
  const zone = makeSession({ id: "5:pt", eventId: 5, start: 540, end: 1080, allDay: true, typeIds: [242] });
  const noTime = makeSession({ id: "6:pt", eventId: 6, start: null, end: null, timeText: "" });

  it("lists each overlapping pair once with the earlier session as a", () => {
    const pairs = planConflicts([b, a, sat, later, zone, noTime]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.a.id).toBe("1:pt");
    expect(pairs[0]?.b.id).toBe("2:pt");
  });

  it("returns [] when nothing overlaps", () => {
    expect(planConflicts([a, later, sat])).toEqual([]);
    expect(planConflicts([])).toEqual([]);
  });

  it("sorts pairs by day then by start", () => {
    const x = makeSession({ id: "9:pt", eventId: 9, start: 900, end: 960 });
    const y = makeSession({ id: "10:pt", eventId: 10, start: 930, end: 990 });
    const s1 = makeSession({ id: "7:sob", eventId: 7, day: "sob", start: 600, end: 660 });
    const s2 = makeSession({ id: "8:sob", eventId: 8, day: "sob", start: 630, end: 690 });
    const pairs = planConflicts([s1, s2, x, y, a, b]);
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([
      ["1:pt", "2:pt"],
      ["9:pt", "10:pt"],
      ["7:sob", "8:sob"],
    ]);
  });

  it("lists every partner of a session that conflicts with several", () => {
    const c = makeSession({ id: "11:pt", eventId: 11, start: 640, end: 700 });
    const pairs = planConflicts([a, b, c]);
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([
      ["1:pt", "2:pt"],
      ["1:pt", "11:pt"],
      ["2:pt", "11:pt"],
    ]);
  });
});

describe("conflictCount", () => {
  const a = makeSession({ id: "1:pt", eventId: 1, start: 600, end: 660 });
  const b = makeSession({ id: "2:pt", eventId: 2, start: 630, end: 690 });
  const c = makeSession({ id: "3:pt", eventId: 3, start: 650, end: 700 });
  const zone = makeSession({ id: "5:pt", eventId: 5, start: 540, end: 1080, allDay: true, typeIds: [242] });

  it("counts the plan sessions overlapping the session, excluding itself and all-day zones", () => {
    expect(conflictCount(a, [a, b, c, zone])).toBe(2);
    expect(conflictCount(c, [a, b, c, zone])).toBe(2);
    expect(conflictCount(zone, [a, b, c, zone])).toBe(0);
  });

  it("is 0 when the session is alone in the plan", () => {
    expect(conflictCount(a, [a])).toBe(0);
    expect(conflictCount(a, [])).toBe(0);
  });
});
