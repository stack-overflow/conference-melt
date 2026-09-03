import type { Session, TimedSession } from "../data/types";
import { hasStart } from "../data/types";
import { visualEnd } from "./time";

export type EndOf = (s: TimedSession) => number;

/** Spec §5.3: the only place the allDay guard lives. */
export function overlaps(a: Session, b: Session): boolean {
  if (a.day !== b.day) return false;
  if (a.allDay || b.allDay) return false;
  if (!hasStart(a) || !hasStart(b)) return false;
  return a.start < visualEnd(b) && b.start < visualEnd(a);
}

function groupByDay(sessions: TimedSession[]): TimedSession[][] {
  const groups = new Map<string, TimedSession[]>();
  for (const s of sessions) {
    const group = groups.get(s.day);
    if (group === undefined) groups.set(s.day, [s]);
    else group.push(s);
  }
  return [...groups.values()];
}

/** Connected components of the same-day interval graph, by a sweep line over starts. */
export function overlapGroups(sessions: TimedSession[], endOf: EndOf = visualEnd): TimedSession[][] {
  const components: TimedSession[][] = [];
  for (const daySessions of groupByDay(sessions)) {
    const sorted = [...daySessions].sort((a, b) => a.start - b.start);
    let current: TimedSession[] = [];
    let reach = Number.NEGATIVE_INFINITY;
    for (const s of sorted) {
      if (current.length > 0 && s.start < reach) {
        current.push(s);
        reach = Math.max(reach, endOf(s));
      } else {
        current = [s];
        components.push(current);
        reach = endOf(s);
      }
    }
  }
  return components;
}

export interface LaneInfo {
  lane: number;
  lanes: number;
}

export function packingEnd(s: TimedSession, minMinutes: number): number {
  return Math.max(visualEnd(s), s.start + minMinutes);
}

/** Greedy interval packing per connected component (components computed with packing ends). */
export function packLanes(sessions: TimedSession[], minMinutes: number): Map<string, LaneInfo> {
  const endOf: EndOf = (s) => packingEnd(s, minMinutes);
  const result = new Map<string, LaneInfo>();
  for (const component of overlapGroups(sessions, endOf)) {
    const ordered = [...component].sort((a, b) => a.start - b.start || endOf(b) - endOf(a));
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();
    for (const s of ordered) {
      const free = laneEnds.findIndex((end) => end <= s.start);
      const lane = free >= 0 ? free : laneEnds.length;
      laneEnds[lane] = endOf(s);
      laneOf.set(s.id, lane);
    }
    for (const [id, lane] of laneOf) result.set(id, { lane, lanes: laneEnds.length });
  }
  return result;
}

interface SweepEvent {
  at: number;
  delta: 1 | -1;
}

export function maxConcurrency(sessions: TimedSession[]): number {
  let best = 0;
  for (const daySessions of groupByDay(sessions)) {
    const events: SweepEvent[] = [];
    for (const s of daySessions) {
      events.push({ at: s.start, delta: 1 });
      events.push({ at: visualEnd(s), delta: -1 });
    }
    events.sort((a, b) => a.at - b.at || a.delta - b.delta);
    let running = 0;
    for (const event of events) {
      running += event.delta;
      if (running > best) best = running;
    }
  }
  return best;
}

export interface ConflictPair {
  a: Session;
  b: Session;
}

function compareDayStart(a: TimedSession, b: TimedSession): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return a.start - b.start;
}

/** Pairs are generated from the (day, start)-sorted list, so they come out sorted by a.day then a.start. */
export function planConflicts(planSessions: Session[]): ConflictPair[] {
  const ordered = planSessions.filter(hasStart).sort(compareDayStart);
  const pairs: ConflictPair[] = [];
  ordered.forEach((a, i) => {
    for (const b of ordered.slice(i + 1)) {
      if (overlaps(a, b)) pairs.push({ a, b });
    }
  });
  return pairs;
}

export function conflictCount(s: Session, planSessions: Session[]): number {
  return planSessions.filter((other) => other.id !== s.id && overlaps(s, other)).length;
}
