import { describe, expect, it } from "vitest";
import type { ScheduleData, Session, TimedSession } from "../../data/types";
import { hasStart } from "../../data/types";
import { detectSlots } from "../../domain/slots";
import { buildIndex, primaryType } from "../../domain/lookup";
import type { Column } from "../../state/derive";
import { makeSession } from "../../test/fixtures/build";
import friLecturesJson from "../../test/fixtures/fri-lectures.json";
import {
  RAIL_WIDTH,
  MAX_STUBS,
  cardStyle,
  densityFor,
  gridArea,
  nowScrollTop,
  slotCells,
  slotPlacements,
  sortByStartTitle,
  timelineGeometry,
  timelineRange,
} from "./gridLayout";

const friLectures = friLecturesJson as unknown as ScheduleData;

function timed(overrides: Partial<Session>): TimedSession {
  const s = makeSession(overrides);
  if (!hasStart(s)) throw new Error("test session needs a start");
  return s;
}

function column(key: string, sessions: TimedSession[], rendered?: string[]): Column {
  return {
    key,
    label: key,
    sublabel: null,
    sessions,
    renderedIds: new Set(rendered ?? sessions.map((s) => s.id)),
    count: sessions.length,
  };
}

function columnsBy(sessions: TimedSession[], keyOf: (s: TimedSession) => string[]): Column[] {
  const map = new Map<string, TimedSession[]>();
  for (const s of sessions) {
    for (const k of keyOf(s)) {
      const list = map.get(k) ?? [];
      list.push(s);
      map.set(k, list);
    }
  }
  return [...map.entries()].map(([key, list]) => column(key, list));
}

describe("densityFor", () => {
  it("returns the comfortable numbers", () => {
    expect(densityFor("comfortable", false)).toEqual({ minColumnWidth: 200, laneMin: 180, rowMin: 88, minCardHeight: 44 });
  });
  it("returns the compact numbers", () => {
    expect(densityFor("compact", false)).toEqual({ minColumnWidth: 160, laneMin: 150, rowMin: 64, minCardHeight: 28 });
  });
  it("raises minCardHeight to 44 on a coarse pointer, keeping the other compact numbers", () => {
    expect(densityFor("compact", true)).toEqual({ minColumnWidth: 160, laneMin: 150, rowMin: 64, minCardHeight: 44 });
    expect(densityFor("comfortable", true).minCardHeight).toBe(44);
  });
  it("exposes the rail width", () => {
    expect(RAIL_WIDTH).toBe(56);
  });
});

describe("timelineRange", () => {
  it("rounds the earliest start down and the latest visual end up to the half hour, then pads 15 minutes", () => {
    const layout = [timed({ id: "1:pt", start: 575, end: 645 }), timed({ id: "2:pt", eventId: 2, start: 615, end: 680 })];
    expect(timelineRange(layout)).toEqual({ start: 555, end: 705 });
  });
  it("keeps exact half hours and still pads", () => {
    expect(timelineRange([timed({ start: 570, end: 630 })])).toEqual({ start: 555, end: 645 });
  });
  it("uses the 20-minute visual end of a point session", () => {
    expect(timelineRange([timed({ start: 570, end: null })])).toEqual({ start: 555, end: 615 });
  });
  it("returns an empty range for an empty layout", () => {
    expect(timelineRange([])).toEqual({ start: 0, end: 0 });
  });
});

describe("timelineGeometry", () => {
  const comfortable = densityFor("comfortable", false);
  const compact = densityFor("compact", false);

  it("gives a 60-minute card a height of 60 × zoom and a top relative to the range start", () => {
    const s = timed({ id: "1:pt", start: 600, end: 660 });
    const g = timelineGeometry(column("c", [s]), { start: 585, end: 705 }, 2, comfortable);
    expect(g.cards.get("1:pt")).toEqual({ top: 30, height: 120, lane: 0, lanes: 1 });
    expect(g.columnLanes).toBe(1);
    expect(g.columnWidth).toBe(200);
  });

  it("uses minColumnWidth for a one-lane column in compact density", () => {
    const s = timed({ id: "1:pt", start: 600, end: 660 });
    expect(timelineGeometry(column("c", [s]), { start: 585, end: 705 }, 2, compact).columnWidth).toBe(160);
  });

  it("gives an 8-lane column a width of 8 × laneMin and 1/8 widths, while a 2-lane component in the same column keeps lanes = 2", () => {
    const eight = Array.from({ length: 8 }, (_, i) => timed({ id: `${i + 1}:pt`, eventId: i + 1, title: `S${i}`, start: 600, end: 660 }));
    const two = [timed({ id: "21:pt", eventId: 21, start: 840, end: 900 }), timed({ id: "22:pt", eventId: 22, start: 840, end: 900 })];
    const g = timelineGeometry(column("c", [...eight, ...two]), { start: 585, end: 915 }, 2, comfortable);
    expect(g.columnLanes).toBe(8);
    expect(g.columnWidth).toBe(1440);
    expect(timelineGeometry(column("c", [...eight, ...two]), { start: 585, end: 915 }, 2, compact).columnWidth).toBe(1200);
    for (const s of eight) expect(g.cards.get(s.id)?.lanes).toBe(8);
    expect(new Set(eight.map((s) => g.cards.get(s.id)?.lane)).size).toBe(8);
    expect(g.cards.get("21:pt")?.lanes).toBe(2);
    expect(g.cards.get("22:pt")?.lanes).toBe(2);
    expect(new Set([g.cards.get("21:pt")?.lane, g.cards.get("22:pt")?.lane])).toEqual(new Set([0, 1]));
  });

  it("stretches short cards to minCardHeight and packs with minMinutes = ceil(minCardHeight / zoom)", () => {
    const point = timed({ id: "1:pt", start: 600, end: null });
    const next = timed({ id: "2:pt", eventId: 2, start: 630, end: 700 });
    const slow = timelineGeometry(column("c", [point, next]), { start: 585, end: 735 }, 1.2, comfortable);
    // ceil(44 / 1.2) = 37 → the point's packing end 637 collides with 630, so both share a two-lane component
    expect(slow.cards.get("1:pt")).toEqual({ top: 18, height: 44, lane: 0, lanes: 2 });
    expect(slow.cards.get("2:pt")?.lanes).toBe(2);
    expect(slow.columnWidth).toBe(360);
    const fast = timelineGeometry(column("c", [point, next]), { start: 585, end: 735 }, 4, comfortable);
    // ceil(44 / 4) = 11 → packing end 620 < 630, separate components
    expect(fast.cards.get("1:pt")).toEqual({ top: 60, height: 80, lane: 0, lanes: 1 });
    expect(fast.cards.get("2:pt")?.lanes).toBe(1);
  });
});

describe("cardStyle", () => {
  it("writes px offsets and calc() lane fractions exactly as spec §7.2", () => {
    expect(cardStyle({ top: 90, height: 120, lane: 3, lanes: 8 })).toEqual({
      top: "90px",
      height: "120px",
      left: "calc(3 * 100% / 8)",
      width: "calc(100% / 8)",
    });
    expect(cardStyle({ top: 0, height: 44, lane: 0, lanes: 1 })).toEqual({
      top: "0px",
      height: "44px",
      left: "calc(0 * 100% / 1)",
      width: "calc(100% / 1)",
    });
  });
});

describe("slotPlacements on the synthetic spec §10 case", () => {
  const A = timed({ id: "1:pt", eventId: 1, title: "A", start: 570, end: 645 }); // 09:30–10:45
  const B = timed({ id: "2:pt", eventId: 2, title: "B", start: 615, end: 690 }); // 10:15–11:30
  const C = timed({ id: "3:pt", eventId: 3, title: "C", start: 660, end: 735 }); // 11:00–12:15
  const slots = detectSlots([A, B, C], { tolerance: 15 });

  it("detects three rows", () => {
    expect(slots.map((s) => s.start)).toEqual([570, 615, 660]);
  });

  it("confines the first two with one stub each and gives the third a bare card", () => {
    const col = column("all", [A, B, C]);
    expect(slotPlacements(col, 0, slots, 15, col.renderedIds)).toEqual([
      { kind: "card", sessionId: "1:pt", column: 0, row: 0, span: 1 },
      { kind: "stub", sessionId: "1:pt", column: 0, row: 1, span: 1 },
      { kind: "card", sessionId: "2:pt", column: 0, row: 1, span: 1 },
      { kind: "stub", sessionId: "2:pt", column: 0, row: 2, span: 1 },
      { kind: "card", sessionId: "3:pt", column: 0, row: 2, span: 1 },
    ]);
  });

  it("emits nothing for layout-set sessions outside the rendered set but lets them block spanning", () => {
    const col = column("all", [A, B, C], ["1:pt"]);
    expect(slotPlacements(col, 0, slots, 15, col.renderedIds)).toEqual([
      { kind: "card", sessionId: "1:pt", column: 0, row: 0, span: 1 },
      { kind: "stub", sessionId: "1:pt", column: 0, row: 1, span: 1 },
    ]);
  });

  it("spans when the column holds no intersecting interval", () => {
    const col = column("solo", [A]);
    expect(slotPlacements(col, 2, slots, 15, col.renderedIds)).toEqual([
      { kind: "span", sessionId: "1:pt", column: 2, row: 0, span: 2 },
    ]);
  });

  it("groups placements per cell with stubs before cards and caps stubs at three", () => {
    const long = Array.from({ length: 5 }, (_, i) => timed({ id: `${10 + i}:pt`, eventId: 10 + i, title: `L${i}`, start: 600, end: 690 }));
    const D = timed({ id: "20:pt", eventId: 20, title: "D", start: 630, end: 645 });
    const E = timed({ id: "21:pt", eventId: 21, title: "E", start: 660, end: 675 });
    const all = [...long, D, E];
    const rows = detectSlots(all, { tolerance: 15 });
    expect(rows.map((r) => r.start)).toEqual([600, 630, 660]);
    const cells = slotCells(slotPlacements(column("all", all), 0, rows, 15, new Set(all.map((s) => s.id))));
    expect(cells.map((c) => [c.column, c.row])).toEqual([[0, 0], [0, 1], [0, 2]]);
    expect(cells[0]).toMatchObject({ overflow: 0, stubs: [] });
    expect(cells[0].cards.map((p) => p.sessionId)).toEqual(["10:pt", "11:pt", "12:pt", "13:pt", "14:pt"]);
    expect(cells[1].stubs).toHaveLength(MAX_STUBS);
    expect(cells[1].stubs.map((p) => p.sessionId)).toEqual(["10:pt", "11:pt", "12:pt"]);
    expect(cells[1].overflow).toBe(2);
    expect(cells[1].cards.map((p) => p.sessionId)).toEqual(["20:pt"]);
    expect(cells[2]).toMatchObject({ overflow: 2 });
    expect(cells[2].cards.map((p) => p.sessionId)).toEqual(["21:pt"]);
  });

  it("orders sessions by start then title with Polish collation", () => {
    const x = timed({ id: "1:pt", title: "Światło", start: 600, end: 660 });
    const y = timed({ id: "2:pt", eventId: 2, title: "Zima", start: 600, end: 660 });
    const z = timed({ id: "3:pt", eventId: 3, title: "Anatomia", start: 590, end: 660 });
    expect([y, x, z].sort(sortByStartTitle).map((s) => s.id)).toEqual(["3:pt", "1:pt", "2:pt"]);
  });
});

describe("slotPlacements on the fri-lectures fixture", () => {
  const index = buildIndex(friLectures);
  const layout = friLectures.sessions.filter(hasStart).filter((s) => !s.allDay);
  const slots = detectSlots(layout, { tolerance: 15 });

  it("has 13 rows with 13:20 at row 3 and 13:40 at row 4", () => {
    expect(layout).toHaveLength(27);
    expect(slots).toHaveLength(13);
    expect(slots[3]).toMatchObject({ start: 800, lastStart: 800 });
    expect(slots[4]).toMatchObject({ start: 820, lastStart: 830 });
  });

  it("confines the 13:20–14:20 lecture under the type axis with a stub in the 13:40 row", () => {
    const columns = columnsBy(layout, (s) => [primaryType(s, index)?.name ?? "?"]);
    const prelekcja = columns.findIndex((c) => c.key === "Prelekcja");
    expect(prelekcja).toBeGreaterThanOrEqual(0);
    const placements = slotPlacements(columns[prelekcja], prelekcja, slots, 15, columns[prelekcja].renderedIds);
    const mine = placements.filter((p) => p.sessionId === "39564:pt");
    expect(mine).toEqual([
      { kind: "card", sessionId: "39564:pt", column: prelekcja, row: 3, span: 1 },
      { kind: "stub", sessionId: "39564:pt", column: prelekcja, row: 4, span: 1 },
    ]);
  });

  it("lets every spanning session span under the location axis, including 13:20–14:20 over two rows", () => {
    const columns = columnsBy(layout, (s) => s.locationIds.map(String));
    const all = columns.flatMap((c, i) => slotPlacements(c, i, slots, 15, c.renderedIds));
    expect(all.filter((p) => p.kind === "stub")).toHaveLength(0);
    const room = columns.findIndex((c) => c.key === "279");
    expect(all.find((p) => p.sessionId === "39564:pt")).toEqual({ kind: "span", sessionId: "39564:pt", column: room, row: 3, span: 2 });
    expect(all.filter((p) => p.kind === "span")).toHaveLength(9);
  });

  it("keeps the confinement when only that card is rendered", () => {
    const columns = columnsBy(layout, (s) => [primaryType(s, index)?.name ?? "?"]);
    const col = columns.find((c) => c.key === "Prelekcja");
    if (!col) throw new Error("missing Prelekcja column");
    const placements = slotPlacements(col, 0, slots, 15, new Set(["39564:pt"]));
    expect(placements).toEqual([
      { kind: "card", sessionId: "39564:pt", column: 0, row: 3, span: 1 },
      { kind: "stub", sessionId: "39564:pt", column: 0, row: 4, span: 1 },
    ]);
  });

  it("places each session at most once per column as a card", () => {
    const columns = columnsBy(layout, () => ["all"]);
    const placements = slotPlacements(columns[0], 0, slots, 15, columns[0].renderedIds);
    const cards = placements.filter((p) => p.kind !== "stub").map((p) => p.sessionId);
    expect(new Set(cards).size).toBe(cards.length);
    expect(cards).toHaveLength(27);
  });
});

describe("gridArea", () => {
  it("offsets column and row by two", () => {
    expect(gridArea({ kind: "card", sessionId: "x", column: 1, row: 2, span: 1 })).toEqual({ gridColumn: "3", gridRow: "4" });
    expect(gridArea({ kind: "stub", sessionId: "x", column: 0, row: 0, span: 1 })).toEqual({ gridColumn: "2", gridRow: "2" });
  });
  it("writes 'r / span k' for spanning cards", () => {
    expect(gridArea({ kind: "span", sessionId: "x", column: 0, row: 3, span: 2 })).toEqual({ gridColumn: "2", gridRow: "5 / span 2" });
  });
});

describe("nowScrollTop", () => {
  it("puts the line a third of the way down the viewport, never above zero", () => {
    expect(nowScrollTop(600, 900)).toBe(300);
    expect(nowScrollTop(100, 900)).toBe(0);
    expect(nowScrollTop(0, 0)).toBe(0);
  });
});
