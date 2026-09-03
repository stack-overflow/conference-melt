import { describe, expect, it } from "vitest";
import type { Day } from "../data/types";
import { makeData, makeDay, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import { buildIcs, escapeIcsText, foldIcsLine } from "./ics";
import { buildIndex } from "./lookup";

const octets = (s: string): number => new TextEncoder().encode(s).length;
/** Logical (unfolded) lines of an iCalendar text; the trailing CRLF yields a final "" element that is dropped. */
const logicalLines = (ics: string): string[] => ics.replace(/\r\n[ \t]/g, "").split("\r\n").slice(0, -1);

const DAYS: Day[] = [
  makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" }),
  makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" }),
];
const LOCATIONS = [
  makeLocation({ id: 233, name: "So Salsa - poziom II - Sala wykładowa nr 1", venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 3 }),
  makeLocation({ id: 281, name: "SoSalsa - poziom II - Sala wykładowa nr 2", venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 4 }),
  makeLocation({ id: 282, name: "Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3", venue: "Drizzly Grizzly", level: "0", room: "Sala wykładowa nr 3", short: "Sala wykł. 3", order: 0 }),
];
const SPEAKERS = [
  makeSpeaker({ id: 379, slug: "piotr-werner-2", name: "Piotr Werner" }),
  makeSpeaker({ id: 46589, slug: "jakub-kazmierczyk", name: "Jakub Kaźmierczyk" }),
];
const META = { source: "https://swiatlosila.pl/harmonogram-2026/", fetchedAt: "2026-09-03T12:54:11.000Z", year: 2026, version: 1 as const, eventCount: 3, sessionCount: 3, speakerCount: 2 };

const evening = makeSession({
  id: "39619:sob", eventId: 39619, day: "sob",
  title: "Gdzie AI nie da rady, tam tablet wyśle",
  start: 1110, end: 1170, timeText: "18:30-19:30", locationIds: [282], speakerIds: [46589],
  url: "https://swiatlosila.pl/cyfrowe-event/gdzie-ai-nie-da-rady-tam-tablet-wysle/",
});
const point = makeSession({
  id: "2:pt", eventId: 2, day: "pt", title: "Sesja", start: 570, end: null, timeText: "09:30",
  locationIds: [233, 281], speakerIds: [379, 46589], url: "https://example.test/2",
});
const noStart = makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Bez czasu", start: null, end: null, timeText: "", url: "https://example.test/3" });
const special = makeSession({
  id: "4:pt", eventId: 4, day: "pt", title: "A;B\\C", start: 600, end: 660, locationIds: [], speakerIds: [],
  byline: "Sorger Fabian", url: "https://example.test/4",
});
const LONG_TITLE = "Dlaczego jedni fotografowie zostają w pamięci, a inni tylko robią zdjęcia? O zaufaniu, doświadczeniu i emocjach, które stają się dziś większą przewagą niż perfekcyjne portfolio";
const long = makeSession({ id: "39551:pt", eventId: 39551, day: "pt", title: LONG_TITLE, start: 585, end: 645, locationIds: [], speakerIds: [], url: "https://example.test/39551" });

const data = makeData([evening, point, noStart, special, long], { meta: META, days: DAYS, locations: LOCATIONS, speakers: SPEAKERS });
const index = buildIndex(data);

describe("escapeIcsText", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeIcsText("A;B\\C, D\nE")).toBe("A\\;B\\\\C\\, D\\nE");
    expect(escapeIcsText("x\r\ny")).toBe("x\\ny");
  });

  it("leaves plain text alone", () => {
    expect(escapeIcsText("Oficjalne otwarcie festiwalu")).toBe("Oficjalne otwarcie festiwalu");
  });
});

describe("foldIcsLine", () => {
  it("leaves lines of 75 octets or fewer untouched", () => {
    expect(foldIcsLine("a".repeat(75))).toBe("a".repeat(75));
    expect(foldIcsLine("")).toBe("");
  });

  it("folds at 75 octets with a CRLF and one leading space", () => {
    expect(foldIcsLine("a".repeat(76))).toBe(`${"a".repeat(75)}\r\n a`);
  });

  it("counts octets, not characters, and never splits a two-byte character", () => {
    // "SUMMARY:" is 8 octets; 33 × "ą" (2 octets each) fills the line to 74; the 34th would exceed 75.
    expect(foldIcsLine(`SUMMARY:${"ą".repeat(40)}`)).toBe(`SUMMARY:${"ą".repeat(33)}\r\n ${"ą".repeat(7)}`);
  });

  it("never splits a four-byte character (surrogate pair)", () => {
    const folded = foldIcsLine(`X:${"🎥".repeat(20)}`);
    expect(folded).toBe(`X:${"🎥".repeat(18)}\r\n ${"🎥".repeat(2)}`);
    for (const line of folded.split("\r\n")) expect(() => encodeURIComponent(line)).not.toThrow();
  });

  it("folds the longest real title so every physical line fits and unfolding restores it", () => {
    const logical = `SUMMARY:${escapeIcsText(LONG_TITLE)}`;
    const folded = foldIcsLine(logical);
    expect(folded).toBe(
      "SUMMARY:Dlaczego jedni fotografowie zostają w pamięci\\, a inni tylko robi\r\n" +
        " ą zdjęcia? O zaufaniu\\, doświadczeniu i emocjach\\, które stają się d\r\n" +
        " ziś większą przewagą niż perfekcyjne portfolio",
    );
    expect(folded.split("\r\n").map(octets)).toEqual([75, 75, 52]);
    expect(folded.replace(/\r\n /g, "")).toBe(logical);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs([evening, point, noStart, special, long], data, index);
  const lines = logicalLines(ics);

  it("emits the calendar header and footer", () => {
    expect(lines.slice(0, 4)).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//swiatlosila-plan//PL", "CALSCALE:GREGORIAN"]);
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("uses CRLF line endings, ends with CRLF and keeps every physical line within 75 octets", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    for (const line of ics.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it("writes one VEVENT per session with a start and skips sessions without one", () => {
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(4);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(4);
    expect(lines.some((l) => l.startsWith("UID:3:pt@"))).toBe(false);
  });

  it("renders a real session with a comma in its title", () => {
    const start = lines.indexOf("UID:39619:sob@swiatlosila-plan");
    expect(lines.slice(start - 1, start + 9)).toEqual([
      "BEGIN:VEVENT",
      "UID:39619:sob@swiatlosila-plan",
      "DTSTAMP:20260903T125411Z",
      "DTSTART:20260905T183000",
      "DTEND:20260905T193000",
      "SUMMARY:Gdzie AI nie da rady\\, tam tablet wyśle",
      "LOCATION:Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3",
      "DESCRIPTION:Jakub Kaźmierczyk\\nhttps://swiatlosila.pl/cyfrowe-event/gdzie-ai-nie-da-rady-tam-tablet-wysle/",
      "URL:https://swiatlosila.pl/cyfrowe-event/gdzie-ai-nie-da-rady-tam-tablet-wysle/",
      "END:VEVENT",
    ]);
  });

  it("ends point sessions 20 minutes after their start and joins several locations and speakers with escaped commas", () => {
    const start = lines.indexOf("UID:2:pt@swiatlosila-plan");
    expect(lines.slice(start + 2, start + 7)).toEqual([
      "DTSTART:20260904T093000",
      "DTEND:20260904T095000",
      "SUMMARY:Sesja",
      "LOCATION:So Salsa - poziom II - Sala wykładowa nr 1\\, SoSalsa - poziom II - Sala wykładowa nr 2",
      "DESCRIPTION:Piotr Werner\\, Jakub Kaźmierczyk\\nhttps://example.test/2",
    ]);
  });

  it("escapes semicolons and backslashes in the summary, puts the byline in the description and omits an empty LOCATION", () => {
    const start = lines.indexOf("UID:4:pt@swiatlosila-plan");
    expect(lines.slice(start + 2, start + 7)).toEqual([
      "DTSTART:20260904T100000",
      "DTEND:20260904T110000",
      "SUMMARY:A\\;B\\\\C",
      "DESCRIPTION:Sorger Fabian\\nhttps://example.test/4",
      "URL:https://example.test/4",
    ]);
  });

  it("folds the long summary in the output and unfolds back to the escaped title", () => {
    expect(ics).toContain("SUMMARY:Dlaczego jedni fotografowie zostają w pamięci\\, a inni tylko robi\r\n ą zdjęcia?");
    expect(lines).toContain(`SUMMARY:${escapeIcsText(LONG_TITLE)}`);
  });

  it("rolls a session that ends after midnight into the next day", () => {
    const late = makeSession({ id: "5:sob", eventId: 5, day: "sob", title: "Late", start: 1435, end: null, url: "https://example.test/5" });
    const lateLines = logicalLines(buildIcs([late], data, index));
    expect(lateLines).toContain("DTSTART:20260905T235500");
    expect(lateLines).toContain("DTEND:20260906T001500");
  });

  it("falls back to the Unix epoch for DTSTAMP when fetchedAt is not a date", () => {
    const broken = makeData([evening], { meta: { ...META, fetchedAt: "garbage" }, days: DAYS, locations: LOCATIONS, speakers: SPEAKERS });
    expect(logicalLines(buildIcs([evening], broken, buildIndex(broken)))).toContain("DTSTAMP:19700101T000000Z");
  });

  it("renders an empty plan as a calendar with no events", () => {
    expect(logicalLines(buildIcs([], data, index))).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//swiatlosila-plan//PL", "CALSCALE:GREGORIAN", "END:VCALENDAR"]);
  });
});
