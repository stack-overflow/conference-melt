/**
 * Parsing of WordPress event content and taxonomy names (spec §4.2).
 */
import type { SignupStatus } from "../../src/data/types";
import { decodeEntities, isBlankHtml, stripTags } from "./sanitize";

const COMMENT_RE = /<!--[\s\S]*?-->/g;
// Attribute run inside a tag; quoted values may contain ">".
const ATTRS = `(?:"[^"]*"|'[^']*'|[^>"'])*`;
const PARAGRAPH_SOURCE = `<p\\b${ATTRS}>([\\s\\S]*?)</p\\s*>`;
const ANCHOR_SOURCE = `<a\\b(${ATTRS})>([\\s\\S]*?)</a\\s*>`;
const TIME_RE = /^\s*(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/;
const DAY_RE = /(Czwartek|Piątek|Sobota|Niedziela|Poniedziałek|Wtorek|Środa)\s*\((\d{1,2})\s+(\S+)\)/;
const ALL_DAY_MINUTES = 300;
const ALL_DAY_TYPE_SLUG = "ogolne";

export function paragraphs(html: string): string[] {
  const src = html.replace(COMMENT_RE, "");
  const re = new RegExp(PARAGRAPH_SOURCE, "gi");
  const result: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) result.push(m[1] ?? "");
  return result;
}

export function firstParagraph(html: string): string {
  return paragraphs(html).find((p) => !isBlankHtml(p)) ?? "";
}

export interface ParsedTime { start: number | null; end: number | null; timeText: string; endDiscarded: boolean }

function toMinutes(hours: string, minutes: string): number | null {
  const h = Number(hours);
  const min = Number(minutes);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function parseTime(text: string): ParsedTime {
  const none: ParsedTime = { start: null, end: null, timeText: "", endDiscarded: false };
  const m = TIME_RE.exec(text);
  if (!m) return none;
  const start = toMinutes(m[1] ?? "", m[2] ?? "");
  if (start === null) return none;
  const timeText = m[0];
  const endHours: string | undefined = m[3];
  const endMinutes: string | undefined = m[4];
  if (endHours === undefined || endMinutes === undefined) return { start, end: null, timeText, endDiscarded: false };
  const end = toMinutes(endHours, endMinutes);
  if (end === null) return none;
  if (end <= start) return { start, end: null, timeText, endDiscarded: true };
  return { start, end, timeText, endDiscarded: false };
}

export interface Anchor { href: string; text: string; dataType: string | null; dataId: string | null; host: string }

function attribute(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(attrs);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "");
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function extractAnchors(html: string): Anchor[] {
  const re = new RegExp(ANCHOR_SOURCE, "gi");
  const anchors: Anchor[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const href = attribute(attrs, "href") ?? "";
    anchors.push({
      href,
      text: stripTags(m[2] ?? ""),
      dataType: attribute(attrs, "data-type"),
      dataId: attribute(attrs, "data-id"),
      host: hostOf(href),
    });
  }
  return anchors;
}

export function isSiteHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "swiatlosila.pl" || h === "www.swiatlosila.pl";
}

export function parseByline(text: string, timeText: string, removeTexts: string[]): string | null {
  let rest = timeText === "" ? text : text.replace(timeText, "");
  for (const t of removeTexts) {
    if (t !== "") rest = rest.replace(t, "");
  }
  const cleaned = rest
    .replace(/\s+/g, " ")
    .replace(/^[\s,/]+/, "")
    .replace(/[\s,/]+$/, "")
    .replace(/[\s,/]*[,/][\s,/]*/g, " / ");
  return cleaned === "" ? null : cleaned;
}

const SIGNUP_BY_TERM = new Map<string, SignupStatus>([
  ["Zapisy", "open"],
  ["Brak miejsc", "full"],
  ["W ramach festiwalu", "included"],
  ["WSTĘP WOLNY", "free"],
  ["Zapisy wkrótce", "soon"],
]);

export function signupStatusFromTerm(name: string | undefined): SignupStatus {
  if (name === undefined) return "unknown";
  return SIGNUP_BY_TERM.get(decodeEntities(name).trim()) ?? "unknown";
}

export interface ParsedDay { id: string; label: string; short: string; labelLong: string; date: string }

const WEEKDAYS = new Map<string, { id: string; short: string }>([
  ["Czwartek", { id: "czw", short: "Czw" }],
  ["Piątek", { id: "pt", short: "Pt" }],
  ["Sobota", { id: "sob", short: "Sob" }],
  ["Niedziela", { id: "nd", short: "Nd" }],
  ["Poniedziałek", { id: "pon", short: "Pon" }],
  ["Wtorek", { id: "wt", short: "Wt" }],
  ["Środa", { id: "sr", short: "Śr" }],
]);

const MONTHS = new Map<string, number>([
  ["stycznia", 1], ["lutego", 2], ["marca", 3], ["kwietnia", 4], ["maja", 5], ["czerwca", 6],
  ["lipca", 7], ["sierpnia", 8], ["września", 9], ["października", 10], ["listopada", 11], ["grudnia", 12],
]);

export function parseDay(termName: string, year: number): ParsedDay | null {
  const m = DAY_RE.exec(decodeEntities(termName));
  if (!m) return null;
  const label = m[1] ?? "";
  const dayNumber = m[2] ?? "";
  const monthName = m[3] ?? "";
  const weekday = WEEKDAYS.get(label);
  const month = MONTHS.get(monthName.toLowerCase());
  if (weekday === undefined || month === undefined) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${dayNumber.padStart(2, "0")}`;
  return { id: weekday.id, label, short: weekday.short, labelLong: `${label}, ${dayNumber} ${monthName}`, date };
}

export function isAllDayEvent(start: number | null, end: number | null, typeSlugs: string[]): boolean {
  if (start === null || end === null) return false;
  return end - start >= ALL_DAY_MINUTES && typeSlugs.includes(ALL_DAY_TYPE_SLUG);
}
