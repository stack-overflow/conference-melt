// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Day } from "../data/types";
import { buildIndex } from "../domain/lookup";
import { encodePlan } from "../domain/share";
import { makeData, makeSession } from "../test/fixtures/build";
import { resolveBoot } from "./boot";

const DAYS: Day[] = [
  { id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" },
  { id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" },
  { id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" },
];

function sessionsFor(day: string, count: number, firstEvent: number) {
  return Array.from({ length: count }, (_, i) =>
    makeSession({
      id: `${firstEvent + i}:${day}`,
      eventId: firstEvent + i,
      day,
      start: 570 + i * 60,
      end: 630 + i * 60,
    }),
  );
}

// Thursday holds 1 session, Friday and Saturday 6 each, so defaultDay skips Thursday.
const data = makeData(
  [...sessionsFor("czw", 1, 100), ...sessionsFor("pt", 6, 200), ...sessionsFor("sob", 6, 300)],
  { days: DAYS },
);
const index = buildIndex(data);
const saturday = new Date(2026, 8, 5, 10, 0);
const friday = new Date(2026, 8, 4, 10, 0);

type BootArgs = Parameters<typeof resolveBoot>[0];

function boot(over: Partial<BootArgs> = {}) {
  return resolveBoot({ hash: "", persistedView: null, persistedFavourites: [], viewportWidth: 1200, data, index, now: saturday, ...over });
}

describe("resolveBoot view precedence", () => {
  it("a valid v in the hash wins over storage and the viewport", () => {
    expect(boot({ hash: "#d=pt&v=list", persistedView: "plan", viewportWidth: 1200 })).toEqual({
      day: "pt",
      view: "list",
      sharedPlan: null,
      favourites: [],
      droppedFavourites: 0,
    });
  });

  it("an unknown v is skipped in favour of the persisted view", () => {
    expect(boot({ hash: "#v=foo", persistedView: "plan" }).view).toBe("plan");
  });

  it("the persisted view is used when the hash has none", () => {
    expect(boot({ persistedView: "list", viewportWidth: 1200 }).view).toBe("list");
  });

  it("the viewport decides when neither the hash nor storage has a view", () => {
    expect(boot({ viewportWidth: 699 }).view).toBe("list");
    expect(boot({ viewportWidth: 700 }).view).toBe("grid");
  });
});

describe("resolveBoot day precedence", () => {
  it("a valid d in the hash wins over defaultDay", () => {
    expect(boot({ hash: "#d=czw", now: saturday }).day).toBe("czw");
  });

  it("an unknown d falls back to defaultDay", () => {
    expect(boot({ hash: "#d=nd", now: saturday }).day).toBe("sob");
    expect(boot({ hash: "#d=nd", now: friday }).day).toBe("pt");
  });

  it("defaultDay skips days with 5 sessions or fewer and handles dates outside the festival", () => {
    expect(boot({ now: new Date(2026, 8, 1, 9, 0) }).day).toBe("pt");
    expect(boot({ now: new Date(2026, 8, 20, 9, 0) }).day).toBe("pt");
  });
});

describe("resolveBoot shared plan", () => {
  it("decodes plan into sharedPlan and counts ids missing from the data", () => {
    const hash = `#d=pt&v=grid&plan=${encodePlan(["200:pt", "301:sob"])}.rrp`;
    expect(boot({ hash }).sharedPlan).toEqual({ ids: ["200:pt", "301:sob"], unknown: 1 });
  });

  it("an unknown version prefix yields a shared plan with no ids", () => {
    expect(boot({ hash: "#plan=9~5kp" }).sharedPlan).toEqual({ ids: [], unknown: 0 });
  });

  it("no plan parameter yields null", () => {
    expect(boot({ hash: "#d=pt&v=grid" }).sharedPlan).toBeNull();
    expect(boot({ hash: "#d=pt&v=grid&plan=" }).sharedPlan).toBeNull();
  });
});

describe("resolveBoot favourites", () => {
  it("drops persisted ids the data does not know and counts them", () => {
    const result = boot({ persistedFavourites: ["200:pt", "999:pt", "301:sob", "100:nd"] });
    expect(result.favourites).toEqual(["200:pt", "301:sob"]);
    expect(result.droppedFavourites).toBe(2);
  });

  it("keeps known ids in their stored order and reports zero dropped", () => {
    const result = boot({ persistedFavourites: ["301:sob", "100:czw", "200:pt"] });
    expect(result.favourites).toEqual(["301:sob", "100:czw", "200:pt"]);
    expect(result.droppedFavourites).toBe(0);
    expect(boot()).toMatchObject({ favourites: [], droppedFavourites: 0 });
  });
});
