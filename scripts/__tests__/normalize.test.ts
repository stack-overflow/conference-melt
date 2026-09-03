// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { WpSpeaker } from "../lib/api";
import { normalizeAll } from "../lib/normalize";
import { makeRaw } from "./raw.fixture";

const OPTS = {
  year: 2026,
  fetchedAt: "2026-09-03T12:00:00.000Z",
  source: "https://swiatlosila.pl/harmonogram-2026/",
};

const UPLOADS = "https://swiatlosila.pl/wp-content/uploads/2024/08";

describe("normalizeAll", () => {
  const { data, warnings } = normalizeAll(makeRaw(), OPTS);

  it("fills meta with the options and counts", () => {
    expect(data.meta).toEqual({
      source: OPTS.source,
      fetchedAt: OPTS.fetchedAt,
      year: 2026,
      version: 1,
      eventCount: 3,
      sessionCount: 4,
      speakerCount: 2,
    });
  });

  it("emits only day terms in use, sorted by date", () => {
    expect(data.days.map((day) => day.id)).toEqual(["czw", "pt", "sob"]);
    expect(data.days[1]).toEqual({
      id: "pt",
      termId: 53,
      date: "2026-09-04",
      label: "Piątek",
      short: "Pt",
      labelLong: "Piątek, 4 września",
    });
  });

  it("emits locations in use in level-then-name order with parsed fields", () => {
    expect(data.locations.map((location) => location.id)).toEqual([233, 318]);
    expect(data.locations[0]).toEqual({
      id: 233,
      slug: "so-salsa-sala-1",
      name: "So Salsa - poziom II - Sala wykładowa nr 1",
      count: 2,
      venue: "So Salsa",
      level: "II",
      room: "Sala wykładowa nr 1",
      short: "Sala wykł. 1",
      order: 0,
    });
    expect(data.locations[1]).toMatchObject({
      id: 318,
      venue: "Rejestracja",
      level: null,
      room: null,
      short: "Rejestracja",
      order: 1,
    });
  });

  it("sorts term arrays by name with Polish collation and drops unused terms", () => {
    expect(data.types.map((t) => t.name)).toEqual(["Ćwiczenia", "Ogólne", "Prelekcja"]);
    expect(data.themes.map((t) => t.id)).toEqual([500]);
    expect(data.brands.map((t) => t.id)).toEqual([600]);
    expect(data.signupStatuses.map((t) => t.name)).toEqual(["W ramach festiwalu", "Zapisy"]);
  });

  it("emits speakers sorted by id with photos, bios and brands", () => {
    expect(data.speakers.map((s) => s.id)).toEqual([128, 134]);
    const emil = data.speakers[1];
    expect(emil).toMatchObject({
      id: 134,
      slug: "emil-bilinski-x",
      name: "Emil Biliński",
      url: "https://swiatlosila.pl/cyfrowe-prelegent/emil-bilinski-x/",
      photo: `${UPLOADS}/600_Bilinski_Emil_profoto.jpg`,
      photoThumb: `${UPLOADS}/600_Bilinski_Emil_profoto-300x300.jpg`,
      brands: ["Sony"],
    });
    expect(emil?.bioHtml).toMatch(/^<p>Bio\.<\/p>\s*<hr>\s*<p>Talk\.<\/p>$/);
    expect(data.speakers[0]).toMatchObject({
      id: 128,
      name: "Karol Bartnik",
      photo: null,
      photoThumb: null,
      brands: [],
    });
  });

  it("creates one session per (event, day), ordered by event id then day position", () => {
    expect(data.sessions.map((s) => s.id)).toEqual(["1001:pt", "1002:pt", "1002:sob", "1003:czw"]);
  });

  it("parses time, speakers, byline, signup and description of a lecture", () => {
    const session = data.sessions.find((s) => s.id === "1001:pt");
    expect(session).toEqual({
      id: "1001:pt",
      eventId: 1001,
      day: "pt",
      title: "Światło – wstęp",
      start: 645,
      end: 720,
      allDay: false,
      timeText: "10:45-12:00",
      speakerIds: [134],
      byline: null,
      typeIds: [184],
      themeIds: [500],
      brandIds: [600],
      locationIds: [233],
      signup: { status: "open", url: "https://www.cyfrowe.pl/swiatlosila-wstep-p.html", label: "Zapisy" },
      descriptionHtml: "<p>Opis <strong>prelekcji</strong>.</p>",
      url: "https://swiatlosila.pl/cyfrowe-event/swiatlo-wstep/",
    });
  });

  it("marks a 09:00-18:00 Ogólne zone as allDay on both of its days, skipping the blank first <p>", () => {
    const zone = data.sessions.filter((s) => s.eventId === 1002);
    expect(zone.map((s) => s.day)).toEqual(["pt", "sob"]);
    for (const session of zone) {
      expect(session).toMatchObject({
        start: 540,
        end: 1080,
        allDay: true,
        timeText: "09:00-18:00",
        speakerIds: [],
        byline: null,
        signup: { status: "unknown", url: null, label: "Brak informacji" },
        descriptionHtml: "",
      });
    }
  });

  it("keeps a point time, a plain-text byline and term-array ordering of typeIds", () => {
    const session = data.sessions.find((s) => s.id === "1003:czw");
    expect(session).toMatchObject({
      start: 570,
      end: null,
      allDay: false,
      timeText: "09:30",
      byline: "Cyfrowe.pl",
      typeIds: [300, 242],
      signup: { status: "included", url: null, label: "W ramach festiwalu" },
    });
  });

  it("warns exactly once, about the anchor resolved by name", () => {
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^Event 1001 .*resolved by name to 134 Emil Biliński$/);
  });

  it("leaves an anchor whose text matches two speakers by name unresolved and keeps its text in the byline", () => {
    const raw = makeRaw();
    const twin = (id: number, slug: string): WpSpeaker => ({
      id,
      slug,
      link: `https://swiatlosila.pl/cyfrowe-prelegent/${slug}/`,
      title: { rendered: "Jan Kowalski" },
      content: { rendered: "<p>Bio.</p>" },
      featured_media: 0,
      "cyfrowe-prelegent-type": [24],
    });
    raw.speakers.push(twin(901, "jan-kowalski"), twin(902, "jan-kowalski-2"));
    raw.events.push({
      id: 1004,
      slug: "swiatlo-w-studio",
      link: "https://swiatlosila.pl/cyfrowe-event/swiatlo-w-studio/",
      title: { rendered: "Światło w studio" },
      content: {
        rendered:
          '<p>13:00-14:00, <a href="https://swiatlosila.pl/cyfrowe-prelegent/stary-slug/">Kowalski Jan</a></p>',
      },
      "cyfrowe-event-type": [184],
      "cyfrowe-event-theme": [],
      "cyfrowe-event-brand": [],
      "cyfrowe-event-location": [233],
      "cyfrowe-event-day": [53],
      "cyfrowe-event-zapisy": [],
    });
    const result = normalizeAll(raw, OPTS);
    const session = result.data.sessions.find((s) => s.id === "1004:pt");
    expect(session).toMatchObject({ speakerIds: [], byline: "Kowalski Jan" });
    expect(result.warnings).toContainEqual(expect.stringContaining("did not resolve; its text stays in the byline"));
    expect(result.warnings.filter((w) => w.startsWith("Event 1004 "))).toEqual([
      'Event 1004 "Światło w studio": speaker anchor "Kowalski Jan" (https://swiatlosila.pl/cyfrowe-prelegent/stary-slug/) did not resolve; its text stays in the byline',
    ]);
  });

  it("produces identical data regardless of the raw input order", () => {
    const raw = makeRaw();
    raw.events.reverse();
    raw.speakers.reverse();
    for (const list of Object.values(raw.terms)) list.reverse();
    expect(normalizeAll(raw, OPTS).data).toEqual(data);
  });
});
