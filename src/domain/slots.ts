import type { TimedSession } from "../data/types";
import { visualEnd } from "./time";

export interface Slot {
  index: number;
  start: number;
  lastStart: number;
  end: number;
  sessionIds: string[];
}

export const DEFAULT_TOLERANCE = 15;

interface Cluster {
  first: number;
  last: number;
}

/** Spec §5.2 steps 1–3: cluster distinct starts with the gap and 2×tolerance span guards. */
export function detectSlots(sessions: TimedSession[], opts: { tolerance?: number } = {}): Slot[] {
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;
  if (sessions.length === 0) return [];
  const starts = [...new Set(sessions.map((s) => s.start))].sort((a, b) => a - b);
  const clusters: Cluster[] = [];
  for (const start of starts) {
    const current = clusters[clusters.length - 1];
    if (current !== undefined && start - current.last <= tolerance && start - current.first <= 2 * tolerance) {
      current.last = start;
    } else {
      clusters.push({ first: start, last: start });
    }
  }
  return clusters.map((cluster, index) => {
    const members = sessions.filter((s) => s.start >= cluster.first && s.start <= cluster.last);
    const next = clusters[index + 1];
    const end = next !== undefined ? next.first : Math.max(...members.map(visualEnd));
    return {
      index,
      start: cluster.first,
      lastStart: cluster.last,
      end,
      sessionIds: members.map((s) => s.id),
    };
  });
}

export function slotIndexOf(s: TimedSession, slots: Slot[]): number {
  return slots.findIndex((slot) => s.start >= slot.start && s.start <= slot.lastStart);
}

/** Spec §5.2 step 4: own row plus every later row r with slots[r].start + tolerance < visualEnd. Point sessions occupy one row. */
export function rowSpan(s: TimedSession, slots: Slot[], tolerance: number): number {
  const row = slotIndexOf(s, slots);
  if (row < 0 || s.end === null) return 1;
  const end = visualEnd(s);
  let span = 1;
  for (const later of slots.slice(row + 1)) {
    if (later.start + tolerance < end) span += 1;
  }
  return span;
}

export function rowInterval(s: TimedSession, slots: Slot[], tolerance: number): [number, number] {
  const row = slotIndexOf(s, slots);
  return [row, row + rowSpan(s, slots, tolerance)];
}

/** Spec §5.2 step 5: true when no other column session's row interval intersects this session's. */
export function spanAllowed(s: TimedSession, columnSessions: TimedSession[], slots: Slot[], tolerance: number): boolean {
  const [from, to] = rowInterval(s, slots, tolerance);
  return columnSessions.every((other) => {
    if (other.id === s.id) return true;
    const [otherFrom, otherTo] = rowInterval(other, slots, tolerance);
    return !(from < otherTo && otherFrom < to);
  });
}

export interface Regularity {
  medianGap: number;
  sharedRatio: number;
  distinguishable: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1] ?? 0;
  return (lower + upper) / 2;
}

export function slotRegularity(slots: Slot[], sessions: TimedSession[], tolerance: number): Regularity {
  const gaps: number[] = [];
  let previous: Slot | undefined;
  for (const slot of slots) {
    if (previous !== undefined) gaps.push(slot.start - previous.start);
    previous = slot;
  }
  const sharedIds = new Set<string>();
  for (const slot of slots) {
    if (slot.sessionIds.length >= 2) {
      for (const id of slot.sessionIds) sharedIds.add(id);
    }
  }
  const medianGap = median(gaps);
  const sharedRatio = sessions.length === 0 ? 0 : sessions.filter((s) => sharedIds.has(s.id)).length / sessions.length;
  const distinguishable = slots.length >= 2 && medianGap >= 3 * tolerance && sharedRatio >= 0.75;
  return { medianGap, sharedRatio, distinguishable };
}
