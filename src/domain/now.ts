import type { Day, Session } from "../data/types";
import { hasStart } from "../data/types";
import { visualEnd } from "./time";

export const SOON_MINUTES = 15;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Spec §5.6: `?now=v` when it parses to a finite time (date-only values become local midnight), else the real clock. */
export function resolveNow(search: string, realNow: () => Date = () => new Date()): Date {
  const raw = new URLSearchParams(search).get("now");
  if (raw === null || raw === "") return realNow();
  const value = DATE_ONLY.test(raw) ? `${raw}T00:00` : raw;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : realNow();
}

export interface Clock {
  now(): Date;
}

export function createClock(search: string, realNow: () => number = () => Date.now()): Clock {
  const bootedAt = realNow();
  const base = resolveNow(search, () => new Date(bootedAt)).getTime();
  return {
    now: () => new Date(base + (realNow() - bootedAt)),
  };
}

export function nowFor(day: Day, now: Date): number | null {
  if (localDateString(now) !== day.date) return null;
  return now.getHours() * 60 + now.getMinutes();
}

export type LiveState = "past" | "live" | "soon" | "upcoming";

export function liveState(s: Session, nowMinutes: number | null): LiveState {
  if (!hasStart(s) || nowMinutes === null) return "upcoming";
  const end = visualEnd(s);
  if (end <= nowMinutes) return "past";
  if (s.start <= nowMinutes) return "live";
  const until = s.start - nowMinutes;
  if (until > 0 && until <= SOON_MINUTES) return "soon";
  return "upcoming";
}

export function isToday(day: Day, now: Date): boolean {
  return day.date === localDateString(now);
}

export function isTomorrow(day: Day, now: Date): boolean {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return day.date === localDateString(tomorrow);
}

const BUSY_THRESHOLD = 5;

export function defaultDay(days: Day[], now: Date, sessionsPerDay: Map<string, number>): Day {
  const first = days[0];
  if (first === undefined) throw new Error("defaultDay: the day list is empty");
  const today = localDateString(now);
  const busy = days.filter((d) => (sessionsPerDay.get(d.id) ?? 0) > BUSY_THRESHOLD);
  return busy.find((d) => d.date >= today) ?? busy[0] ?? first;
}

export function minutesUntil(start: number, nowMinutes: number): number {
  return start - nowMinutes;
}
