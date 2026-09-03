import type { TimedSession } from "../../data/types";
import type { Slot } from "../../domain/slots";
import { rowInterval, spanAllowed } from "../../domain/slots";
import { packLanes } from "../../domain/overlaps";
import { roundDown, roundUp, visualEnd } from "../../domain/time";
import type { Settings } from "../../state/store";
import type { Column } from "../../state/derive";

export const RAIL_WIDTH = 56;

/** Internal: padding added on both sides of the timeline range (spec §7.2). */
const RANGE_PADDING = 15;
/** Internal: rounding step of the timeline range, in minutes. */
const RANGE_STEP = 30;
/** Internal, used by SlotBody: stubs shown per cell before "+N w trakcie". */
export const MAX_STUBS = 3;

export interface Density {
  minColumnWidth: number;
  laneMin: number;
  rowMin: number;
  minCardHeight: number;
}

const COMFORTABLE: Density = { minColumnWidth: 200, laneMin: 180, rowMin: 88, minCardHeight: 44 };
const COMPACT: Density = { minColumnWidth: 160, laneMin: 150, rowMin: 64, minCardHeight: 28 };

export function densityFor(density: Settings["density"], coarsePointer: boolean): Density {
  const base = density === "compact" ? COMPACT : COMFORTABLE;
  return coarsePointer ? { ...base, minCardHeight: 44 } : { ...base };
}

/** Internal: true when the primary pointer is coarse; false when matchMedia is unavailable (jsdom). */
export function coarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Internal: true when the user asked for reduced motion; false when matchMedia is unavailable. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface TimelineRange {
  start: number;
  end: number;
}

export function timelineRange(layout: TimedSession[]): TimelineRange {
  if (layout.length === 0) return { start: 0, end: 0 };
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const s of layout) {
    earliest = Math.min(earliest, s.start);
    latest = Math.max(latest, visualEnd(s));
  }
  return {
    start: roundDown(earliest, RANGE_STEP) - RANGE_PADDING,
    end: roundUp(latest, RANGE_STEP) + RANGE_PADDING,
  };
}

export interface CardGeometry {
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

export function timelineGeometry(
  column: Column,
  range: TimelineRange,
  zoom: number,
  density: Density,
): { columnWidth: number; columnLanes: number; cards: Map<string, CardGeometry> } {
  const minMinutes = Math.ceil(density.minCardHeight / zoom);
  const lanes = packLanes(column.sessions, minMinutes);
  const cards = new Map<string, CardGeometry>();
  let columnLanes = 0;
  for (const s of column.sessions) {
    const info = lanes.get(s.id) ?? { lane: 0, lanes: 1 };
    columnLanes = Math.max(columnLanes, info.lanes);
    cards.set(s.id, {
      top: (s.start - range.start) * zoom,
      height: Math.max((visualEnd(s) - s.start) * zoom, density.minCardHeight),
      lane: info.lane,
      lanes: info.lanes,
    });
  }
  const columnWidth = Math.max(density.minColumnWidth, columnLanes * density.laneMin);
  return { columnWidth, columnLanes, cards };
}

export function cardStyle(g: CardGeometry): { top: string; height: string; left: string; width: string } {
  return {
    top: `${g.top}px`,
    height: `${g.height}px`,
    left: `calc(${g.lane} * 100% / ${g.lanes})`,
    width: `calc(100% / ${g.lanes})`,
  };
}

/** Internal, used by TimelineBody and SlotBody: DOM order inside a column follows start time, then title. */
export function sortByStartTitle(a: TimedSession, b: TimedSession): number {
  return a.start - b.start || a.title.localeCompare(b.title, "pl");
}

export interface SlotPlacement {
  kind: "card" | "span" | "stub";
  sessionId: string;
  column: number;
  row: number;
  span: number;
}

export function slotPlacements(
  column: Column,
  columnIndex: number,
  slots: Slot[],
  tolerance: number,
  renderedIds: Set<string>,
): SlotPlacement[] {
  const out: SlotPlacement[] = [];
  const ordered = [...column.sessions].sort(sortByStartTitle);
  for (const s of ordered) {
    if (!renderedIds.has(s.id)) continue;
    const [startRow, endRow] = rowInterval(s, slots, tolerance);
    if (startRow < 0) continue;
    const span = endRow - startRow;
    if (span > 1 && spanAllowed(s, column.sessions, slots, tolerance)) {
      out.push({ kind: "span", sessionId: s.id, column: columnIndex, row: startRow, span });
      continue;
    }
    out.push({ kind: "card", sessionId: s.id, column: columnIndex, row: startRow, span: 1 });
    for (let row = startRow + 1; row < endRow; row += 1) {
      out.push({ kind: "stub", sessionId: s.id, column: columnIndex, row, span: 1 });
    }
  }
  return out;
}

/** Internal, used by SlotBody: one entry per (column, row) wrapper with content; spans are not cells. */
export interface SlotCell {
  column: number;
  row: number;
  stubs: SlotPlacement[];
  overflow: number;
  cards: SlotPlacement[];
}

export function slotCells(placements: SlotPlacement[]): SlotCell[] {
  const byKey = new Map<string, SlotCell>();
  const allStubs = new Map<string, number>();
  for (const p of placements) {
    if (p.kind === "span") continue;
    const key = `${p.column}:${p.row}`;
    let cell = byKey.get(key);
    if (!cell) {
      cell = { column: p.column, row: p.row, stubs: [], overflow: 0, cards: [] };
      byKey.set(key, cell);
    }
    if (p.kind === "stub") {
      const seen = (allStubs.get(key) ?? 0) + 1;
      allStubs.set(key, seen);
      if (seen <= MAX_STUBS) cell.stubs.push(p);
      else cell.overflow += 1;
    } else {
      cell.cards.push(p);
    }
  }
  return [...byKey.values()].sort((a, b) => a.column - b.column || a.row - b.row);
}

export function gridArea(p: SlotPlacement): { gridColumn: string; gridRow: string } {
  const gridColumn = String(p.column + 2);
  const startRow = p.row + 2;
  const gridRow = p.kind === "span" ? `${startRow} / span ${p.span}` : String(startRow);
  return { gridColumn, gridRow };
}

/** Internal, used by ScheduleGrid: scrollTop that puts the now line a third of the way down the viewport. */
export function nowScrollTop(lineTop: number, viewportHeight: number): number {
  return Math.max(0, Math.round(lineTop - viewportHeight / 3));
}
