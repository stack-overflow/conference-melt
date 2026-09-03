import { describe, expect, it } from "vitest";
import type { Day, Session } from "../data/types";
import { makeData, makeDay, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import { buildIndex } from "./lookup";
import { planAsText, planLines, sessionLine } from "./text";

const DAYS: Day[] = [
  makeDay({ id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" }),
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

const lecture = makeSession({
  id: "39587:sob", eventId: 39587, day: "sob",
  title: "Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać",
  start: 555, end: 630, timeText: "09:15-10:30", typeIds: [278], locationIds: [233], speakerIds: [379],
});
const evening = makeSession({
  id: "39619:sob", eventId: 39619, day: "sob",
  title: "Gdzie AI nie da rady, tam tablet wyśle",
  start: 1110, end: 1170, timeText: "18:30-19:30", locationIds: [282], speakerIds: [46589],
});
const opening = makeSession({
  id: "33705:pt", eventId: 33705, day: "pt", title: "Oficjalne otwarcie festiwalu",
  start: 570, end: null, timeText: "09:30", typeIds: [242], locationIds: [281], speakerIds: [],
});
const bylineOnly = makeSession({
  id: "46722:pt", eventId: 46722, day: "pt", title: "Storytelling in the streets of Gdansk (po angielsku)",
  start: 780, end: 870, timeText: "13:00-14:30", locationIds: [], speakerIds: [], byline: "Sorger Fabian",
});
const beta = makeSession({ id: "2:pt", eventId: 2, day: "pt", title: "Beta", start: 570, end: 630, locationIds: [233, 281], speakerIds: [379, 46589] });
const alfa = makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Alfa", start: 570, end: 630, locationIds: [], speakerIds: [] });
const noTime = makeSession({ id: "4:sob", eventId: 4, day: "sob", title: "Bez czasu", start: null, end: null, timeText: "", locationIds: [233], speakerIds: [379] });

const ALL: Session[] = [evening, lecture, opening, bylineOnly, beta, alfa, noTime];
const data = makeData(ALL, { days: DAYS, locations: LOCATIONS, speakers: SPEAKERS });
const index = buildIndex(data);

describe("sessionLine", () => {
  it("joins time, title, location short and speaker with middle dots", () => {
    expect(sessionLine(lecture, data, index)).toBe("09:15–10:30 · Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać · Sala wykł. 1 · Piotr Werner");
  });

  it("joins several speakers with commas and several locations with slashes", () => {
    expect(sessionLine(beta, data, index)).toBe("09:30–10:30 · Beta · Sala wykł. 1 / Sala wykł. 2 · Piotr Werner, Jakub Kaźmierczyk");
  });

  it("shows a single time for point sessions and omits the speaker part when nobody is listed", () => {
    expect(sessionLine(opening, data, index)).toBe("09:30 · Oficjalne otwarcie festiwalu · Sala wykł. 2");
  });

  it("falls back to the byline when no speaker resolved and omits an empty location", () => {
    expect(sessionLine(bylineOnly, data, index)).toBe("13:00–14:30 · Storytelling in the streets of Gdansk (po angielsku) · Sorger Fabian");
  });

  it("omits both trailing parts when the session has neither location nor people", () => {
    expect(sessionLine(alfa, data, index)).toBe("09:30–10:30 · Alfa");
  });

  it("omits the time part for a session without a start", () => {
    expect(sessionLine(noTime, data, index)).toBe("Bez czasu · Sala wykł. 1 · Piotr Werner");
  });
});

describe("planLines", () => {
  it("returns one entry per day with sessions, in days order, plus a final no-start entry", () => {
    const entries = planLines(ALL, data, index);
    expect(entries.map((e) => e.day?.id ?? null)).toEqual(["pt", "sob", null]);
  });

  it("sorts each day's lines chronologically, ties by title", () => {
    const entries = planLines(ALL, data, index);
    expect(entries[0]!.lines).toEqual([
      "09:30–10:30 · Alfa",
      "09:30–10:30 · Beta · Sala wykł. 1 / Sala wykł. 2 · Piotr Werner, Jakub Kaźmierczyk",
      "09:30 · Oficjalne otwarcie festiwalu · Sala wykł. 2",
      "13:00–14:30 · Storytelling in the streets of Gdansk (po angielsku) · Sorger Fabian",
    ]);
    expect(entries[1]!.lines).toEqual([
      "09:15–10:30 · Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać · Sala wykł. 1 · Piotr Werner",
      "18:30–19:30 · Gdzie AI nie da rady, tam tablet wyśle · Sala wykł. 3 · Jakub Kaźmierczyk",
    ]);
    expect(entries[2]!.lines).toEqual(["Bez czasu · Sala wykł. 1 · Piotr Werner"]);
  });

  it("omits the no-start entry when every session has a start", () => {
    const entries = planLines([lecture, opening], data, index);
    expect(entries.map((e) => e.day?.id ?? null)).toEqual(["pt", "sob"]);
  });

  it("returns no entries for an empty plan", () => {
    expect(planLines([], data, index)).toEqual([]);
  });
});

describe("planAsText", () => {
  it("renders labelLong headings, Bez godziny for the no-start entry, and blank lines between entries", () => {
    expect(planAsText(ALL, data, index)).toBe(
      [
        "Piątek, 4 września",
        "09:30–10:30 · Alfa",
        "09:30–10:30 · Beta · Sala wykł. 1 / Sala wykł. 2 · Piotr Werner, Jakub Kaźmierczyk",
        "09:30 · Oficjalne otwarcie festiwalu · Sala wykł. 2",
        "13:00–14:30 · Storytelling in the streets of Gdansk (po angielsku) · Sorger Fabian",
        "",
        "Sobota, 5 września",
        "09:15–10:30 · Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać · Sala wykł. 1 · Piotr Werner",
        "18:30–19:30 · Gdzie AI nie da rady, tam tablet wyśle · Sala wykł. 3 · Jakub Kaźmierczyk",
        "",
        "Bez godziny",
        "Bez czasu · Sala wykł. 1 · Piotr Werner",
      ].join("\n"),
    );
  });

  it("renders an empty plan as an empty string", () => {
    expect(planAsText([], data, index)).toBe("");
  });
});
