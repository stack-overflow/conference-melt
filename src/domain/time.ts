import type { Session, TimedSession } from "../data/types";

/** Height, in minutes, given to a point session (start without end) for layout. */
export const POINT_MINUTES = 20;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Minutes since midnight to "HH:MM". */
export function formatTime(m: number): string {
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** "09:05–10:15" (en dash) or "09:05" when end is null. */
export function formatRange(start: number, end: number | null): string {
  return end === null ? formatTime(start) : `${formatTime(start)}–${formatTime(end)}`;
}

/** "1 h 10 min", "2 h" (no minutes part when the remainder is 0), "45 min"; null when end is null. */
export function durationLabel(start: number, end: number | null): string | null {
  if (end === null) return null;
  const total = end - start;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function isAllDay(s: Session): boolean {
  return s.allDay;
}

export function isPoint(s: Session): boolean {
  return s.start !== null && s.end === null;
}

/** End used for layout: the real end, or start + POINT_MINUTES for point sessions. */
export function visualEnd(s: TimedSession): number {
  return s.end ?? s.start + POINT_MINUTES;
}

export function roundDown(m: number, step: number): number {
  return Math.floor(m / step) * step;
}

export function roundUp(m: number, step: number): number {
  return Math.ceil(m / step) * step;
}
