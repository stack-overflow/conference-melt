import type { Day, Session } from "../data/types";
import { localDateString, nowFor } from "./now";
import { planConflicts, type ConflictPair } from "./overlaps";

/** Plan members in data order; ids missing from the data are ignored. */
export function planSessions(planSet: ReadonlySet<string>, sessions: Session[]): Session[] {
  return sessions.filter((s) => planSet.has(s.id));
}

export function planForDay(plan: Session[], dayId: string): Session[] {
  return plan.filter((s) => s.day === dayId);
}

export interface PlanSummary {
  perDay: { day: Day; count: number }[];
  conflicts: { day: Day; pairs: ConflictPair[] }[];
  conflictCount: number;
}

export function planSummary(plan: Session[], days: Day[]): PlanSummary {
  const perDay = days.map((day) => ({ day, count: planForDay(plan, day.id).length }));
  const pairs = planConflicts(plan);
  const conflicts: PlanSummary["conflicts"] = [];
  for (const day of days) {
    const dayPairs = pairs.filter((p) => p.a.day === day.id);
    if (dayPairs.length > 0) conflicts.push({ day, pairs: dayPairs });
  }
  return { perDay, conflicts, conflictCount: pairs.length };
}

/** Earliest plan session with start >= now on the day whose date is today's local date, else null. */
export function nextUp(plan: Session[], days: Day[], now: Date): Session | null {
  const today = localDateString(now);
  const day = days.find((d) => d.date === today);
  if (day === undefined) return null;
  const nowMinutes = nowFor(day, now);
  if (nowMinutes === null) return null;
  let best: Session | null = null;
  let bestStart = Number.POSITIVE_INFINITY;
  for (const s of plan) {
    if (s.day !== day.id || s.start === null || s.start < nowMinutes) continue;
    if (s.start < bestStart) {
      best = s;
      bestStart = s.start;
    }
  }
  return best;
}
