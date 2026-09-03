// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { RawData, WpEvent } from "../lib/api";
import { normalizeAll } from "../lib/normalize";
import { validate } from "../lib/validate";
import { makeRaw } from "./raw.fixture";

const OPTS = {
  year: 2026,
  fetchedAt: "2026-09-03T12:00:00.000Z",
  source: "https://swiatlosila.pl/harmonogram-2026/",
};

function eventOf(raw: RawData, id: number): WpEvent {
  const event = raw.events.find((e) => e.id === id);
  if (event === undefined) throw new Error(`fixture has no event ${id}`);
  return event;
}

/** Pads the fixture with 50 Friday copies of event 1001 so the 50-event floor is met. */
function withManyEvents(raw: RawData): RawData {
  const template = eventOf(raw, 1001);
  const fillers: WpEvent[] = Array.from({ length: 50 }, (_, i) => ({
    ...template,
    id: 5000 + i,
    slug: `filler-${i}`,
    link: `https://swiatlosila.pl/cyfrowe-event/filler-${i}/`,
    content: { rendered: "<p>12:00-13:00</p>" },
    "cyfrowe-event-day": [53],
  }));
  return { ...raw, events: [...raw.events, ...fillers] };
}

function run(raw: RawData): { errors: string[]; warnings: string[] } {
  const { data } = normalizeAll(raw, OPTS);
  return validate(data, raw);
}

describe("validate errors", () => {
  it("accepts a consistent snapshot", () => {
    expect(run(withManyEvents(makeRaw())).errors).toEqual([]);
  });

  it("rejects fewer than 50 events", () => {
    expect(run(makeRaw()).errors).toEqual(["Too few events: 3 (minimum 50)"]);
  });

  it("rejects fewer than 3 days", () => {
    const raw = withManyEvents(makeRaw());
    for (const term of raw.terms["cyfrowe-event-day"]) if (term.id === 276) term.count = 0;
    raw.events = raw.events.filter((e) => e.id !== 1003);
    expect(run(raw).errors).toEqual(["Too few days: 2 (minimum 3)"]);
  });

  it("rejects a day term in use without a parseable date", () => {
    const raw = withManyEvents(makeRaw());
    for (const term of raw.terms["cyfrowe-event-day"]) if (term.id === 276) term.name = "⏱️ Dzień otwarcia";
    const { errors } = run(raw);
    expect(errors).toContain('Day term 276 "⏱️ Dzień otwarcia" has no parseable date');
    expect(errors).toContain("Too few days: 2 (minimum 3)");
    expect(errors).toHaveLength(2);
  });

  it("rejects a session whose location is not a fetched term", () => {
    const raw = withManyEvents(makeRaw());
    eventOf(raw, 1001)["cyfrowe-event-location"] = [999];
    expect(run(raw).errors).toEqual(["Session 1001:pt references unknown location 999"]);
  });

  it("rejects a session whose type is not a fetched term", () => {
    const raw = withManyEvents(makeRaw());
    eventOf(raw, 1001)["cyfrowe-event-type"] = [184, 999];
    expect(run(raw).errors).toEqual(["Session 1001:pt references unknown type 999"]);
  });

  it("rejects an event whose day term was not fetched", () => {
    const raw = withManyEvents(makeRaw());
    eventOf(raw, 1001)["cyfrowe-event-day"] = [53, 999];
    expect(run(raw).errors).toEqual(["Event 1001 references unknown day term 999"]);
  });
});

describe("validate warnings", () => {
  it("warns about a speaker without a photo and nothing else on the fixture", () => {
    expect(run(makeRaw()).warnings).toEqual(["Speaker 128 Karol Bartnik has no photo"]);
  });

  it("warns about a session of 300 minutes or more that is not allDay", () => {
    const raw = makeRaw();
    eventOf(raw, 1001).content = { rendered: "<p>09:30-16:00</p>" };
    expect(run(raw).warnings).toContain('Session 1001:pt "Światło – wstęp" runs 390 minutes but is not allDay');
  });

  it("does not warn about the 540-minute Ogólne zone, which is allDay", () => {
    const { warnings } = run(makeRaw());
    expect(warnings.filter((w) => w.includes("1002:"))).toEqual([]);
  });

  it("warns about a session without a parseable time", () => {
    const raw = makeRaw();
    eventOf(raw, 1001).content = { rendered: "<p>Godzina wkrótce</p>" };
    expect(run(raw).warnings).toContain('Session 1001:pt "Światło – wstęp" has no parseable time');
  });
});
