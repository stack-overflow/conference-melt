import { hasStart, type Day, type ScheduleData, type Session, type TimedSession } from "../data/types";
import { locationLabel, speakersOf, type DataIndex } from "./lookup";
import { formatRange } from "./time";

export interface PlanLinesEntry {
  day: Day | null;
  lines: string[];
}

const SEPARATOR = " · ";
const NO_TIME_HEADING = "Bez godziny";
const collator = new Intl.Collator("pl");

/** `09:30–10:30 · Title · Sala wykł. 1 · Speaker`; the `data` argument is part of the shared signature, the index carries everything the line needs. */
export function sessionLine(s: Session, _data: ScheduleData, index: DataIndex): string {
  const parts: string[] = [];
  if (s.start !== null) parts.push(formatRange(s.start, s.end));
  parts.push(s.title);
  const location = locationLabel(s, index);
  if (location !== "") parts.push(location);
  const speakers = speakersOf(s, index)
    .map((speaker) => speaker.name)
    .join(", ");
  if (speakers !== "") parts.push(speakers);
  else if (s.byline !== null && s.byline !== "") parts.push(s.byline);
  return parts.join(SEPARATOR);
}

function byStartThenTitle(a: TimedSession, b: TimedSession): number {
  return a.start - b.start || collator.compare(a.title, b.title);
}

export function planLines(sessions: Session[], data: ScheduleData, index: DataIndex): PlanLinesEntry[] {
  const entries: PlanLinesEntry[] = [];
  const timed = sessions.filter(hasStart);
  for (const day of data.days) {
    const ofDay = timed.filter((s) => s.day === day.id).sort(byStartThenTitle);
    if (ofDay.length > 0) entries.push({ day, lines: ofDay.map((s) => sessionLine(s, data, index)) });
  }
  const untimed = sessions.filter((s) => s.start === null);
  if (untimed.length > 0) entries.push({ day: null, lines: untimed.map((s) => sessionLine(s, data, index)) });
  return entries;
}

export function planAsText(sessions: Session[], data: ScheduleData, index: DataIndex): string {
  return planLines(sessions, data, index)
    .map((entry) => [entry.day === null ? NO_TIME_HEADING : entry.day.labelLong, ...entry.lines].join("\n"))
    .join("\n\n");
}
