import { hasStart, type ScheduleData, type Session, type TimedSession } from "../data/types";
import { locationsOf, speakersOf, type DataIndex } from "./lookup";
import { visualEnd } from "./time";

const CRLF = "\r\n";
const LINE_OCTETS = 75;
const MINUTES_PER_DAY = 1440;

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newline. */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

function utf8Octets(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** Folds at 75 octets of UTF-8; iterating by code point means no character is ever split. */
export function foldIcsLine(line: string): string {
  const pieces: string[] = [];
  let piece = "";
  let octets = 0;
  for (const ch of line) {
    const size = utf8Octets(ch);
    if (octets + size > LINE_OCTETS) {
      pieces.push(piece);
      piece = " ";
      octets = 1;
    }
    piece += ch;
    octets += size;
  }
  pieces.push(piece);
  return pieces.join(CRLF);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** `20260903T125411Z` from an ISO timestamp; an unparseable value falls back to the Unix epoch. */
function utcStamp(iso: string): string {
  const parsed = new Date(iso).getTime();
  const date = new Date(Number.isNaN(parsed) ? 0 : parsed);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Floating local date-time `20260904T093000` from a `YYYY-MM-DD` day and minutes since its midnight (past 24:00 rolls into the next day). */
function floatingTime(date: string, minutes: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const dayOffset = Math.floor(minutes / MINUTES_PER_DAY);
  const t = new Date(Date.UTC(year, month - 1, day + dayOffset, 0, minutes % MINUTES_PER_DAY));
  return `${pad(t.getUTCFullYear(), 4)}${pad(t.getUTCMonth() + 1, 2)}${pad(t.getUTCDate(), 2)}T${pad(t.getUTCHours(), 2)}${pad(t.getUTCMinutes(), 2)}00`;
}

function eventLines(s: TimedSession, date: string, stamp: string, index: DataIndex): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${s.id}@swiatlosila-plan`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${floatingTime(date, s.start)}`,
    `DTEND:${floatingTime(date, visualEnd(s))}`,
    `SUMMARY:${escapeIcsText(s.title)}`,
  ];
  const location = locationsOf(s, index)
    .map((l) => l.name)
    .join(", ");
  if (location !== "") lines.push(`LOCATION:${escapeIcsText(location)}`);
  const description: string[] = [];
  const speakers = speakersOf(s, index)
    .map((speaker) => speaker.name)
    .join(", ");
  if (speakers !== "") description.push(speakers);
  if (s.byline !== null && s.byline !== "") description.push(s.byline);
  description.push(s.url);
  lines.push(`DESCRIPTION:${escapeIcsText(description.join("\n"))}`, `URL:${s.url}`, "END:VEVENT");
  return lines;
}

export function buildIcs(sessions: Session[], data: ScheduleData, index: DataIndex): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//swiatlosila-plan//PL", "CALSCALE:GREGORIAN"];
  const stamp = utcStamp(data.meta.fetchedAt);
  for (const s of sessions) {
    if (!hasStart(s)) continue;
    const day = index.dayById.get(s.day);
    if (day === undefined) continue;
    lines.push(...eventLines(s, day.date, stamp, index));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
