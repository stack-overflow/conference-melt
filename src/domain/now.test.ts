import { describe, expect, it } from "vitest";
import { makeDay, makeSession } from "../test/fixtures/build";
import {
  SOON_MINUTES,
  createClock,
  defaultDay,
  isToday,
  isTomorrow,
  liveState,
  localDateString,
  minutesUntil,
  nowFor,
  resolveNow,
} from "./now";

const czw = makeDay({ id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" });
const pt = makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" });
const sob = makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" });
const days = [czw, pt, sob];
const counts = new Map<string, number>([
  ["czw", 1],
  ["pt", 82],
  ["sob", 80],
]);

const fixed = (): Date => new Date(2026, 8, 4, 10, 30);

describe("localDateString", () => {
  it("formats the local calendar date with zero padding", () => {
    expect(localDateString(new Date(2026, 8, 4, 10, 30))).toBe("2026-09-04");
    expect(localDateString(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(localDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("resolveNow", () => {
  it("parses a date-time without an offset as local time", () => {
    expect(resolveNow("?now=2026-09-04T10:30", fixed)).toEqual(new Date(2026, 8, 4, 10, 30));
  });

  it("parses a date-time with an offset as that instant", () => {
    expect(resolveNow("?now=2026-09-04T08:30:00%2B02:00", fixed).getTime()).toBe(Date.UTC(2026, 8, 4, 6, 30));
    expect(resolveNow("?now=2026-09-04T06:30:00Z", fixed).getTime()).toBe(Date.UTC(2026, 8, 4, 6, 30));
  });

  it("resolves a date-only override to local midnight", () => {
    expect(resolveNow("?now=2026-09-04", fixed)).toEqual(new Date(2026, 8, 4, 0, 0));
  });

  it("falls back to the real clock without a now parameter", () => {
    expect(resolveNow("", fixed)).toEqual(fixed());
    expect(resolveNow("?d=pt&v=grid", fixed)).toEqual(fixed());
  });

  it("falls back to the real clock for an unparseable or empty override", () => {
    expect(resolveNow("?now=yesterday", fixed)).toEqual(fixed());
    expect(resolveNow("?now=", fixed)).toEqual(fixed());
    expect(resolveNow("?now=2026-13-45", fixed)).toEqual(fixed());
  });

  it("reads now next to other parameters", () => {
    expect(resolveNow("?d=pt&now=2026-09-05T09:00&v=list", fixed)).toEqual(new Date(2026, 8, 5, 9, 0));
  });

  it("uses the real Date when no realNow is given", () => {
    const before = Date.now();
    const resolved = resolveNow("").getTime();
    expect(resolved).toBeGreaterThanOrEqual(before);
    expect(resolved).toBeLessThanOrEqual(Date.now());
  });
});

describe("createClock", () => {
  it("advances an override by the elapsed real time", () => {
    let ticks = 1_000_000;
    const clock = createClock("?now=2026-09-04T10:30", () => ticks);
    expect(clock.now()).toEqual(new Date(2026, 8, 4, 10, 30));
    ticks += 90_000;
    expect(clock.now()).toEqual(new Date(2026, 8, 4, 10, 31, 30));
  });

  it("follows the real clock without an override", () => {
    let ticks = 5_000;
    const clock = createClock("", () => ticks);
    expect(clock.now().getTime()).toBe(5_000);
    ticks = 65_000;
    expect(clock.now().getTime()).toBe(65_000);
  });

  it("uses Date.now when no realNow is given", () => {
    const before = Date.now();
    const clock = createClock("");
    expect(clock.now().getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("nowFor", () => {
  it("returns minutes since local midnight on the day's date", () => {
    expect(nowFor(pt, new Date(2026, 8, 4, 10, 30))).toBe(630);
    expect(nowFor(pt, new Date(2026, 8, 4, 0, 0))).toBe(0);
    expect(nowFor(pt, new Date(2026, 8, 4, 23, 59))).toBe(1439);
  });

  it("returns null on any other date", () => {
    expect(nowFor(sob, new Date(2026, 8, 4, 10, 30))).toBeNull();
    expect(nowFor(pt, new Date(2026, 8, 5, 10, 30))).toBeNull();
  });
});

describe("liveState", () => {
  const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
  const point = makeSession({ id: "p:pt", start: 600, end: null });
  const noTime = makeSession({ id: "n:pt", start: null, end: null, timeText: "" });

  it("exports SOON_MINUTES = 15", () => {
    expect(SOON_MINUTES).toBe(15);
  });

  it("is upcoming when the session has no start or now is null", () => {
    expect(liveState(noTime, 630)).toBe("upcoming");
    expect(liveState(talk, null)).toBe("upcoming");
  });

  it("is live from the start minute up to but excluding the end minute", () => {
    expect(liveState(talk, 600)).toBe("live");
    expect(liveState(talk, 630)).toBe("live");
    expect(liveState(talk, 659)).toBe("live");
  });

  it("is past from the end minute onwards", () => {
    expect(liveState(talk, 660)).toBe("past");
    expect(liveState(talk, 900)).toBe("past");
  });

  it("is soon within 15 minutes before the start, inclusive", () => {
    expect(liveState(talk, 585)).toBe("soon");
    expect(liveState(talk, 599)).toBe("soon");
  });

  it("is upcoming more than 15 minutes before the start", () => {
    expect(liveState(talk, 584)).toBe("upcoming");
    expect(liveState(talk, 0)).toBe("upcoming");
  });

  it("treats a point session as 20 minutes long", () => {
    expect(liveState(point, 600)).toBe("live");
    expect(liveState(point, 619)).toBe("live");
    expect(liveState(point, 620)).toBe("past");
    expect(liveState(point, 585)).toBe("soon");
  });
});

describe("isToday and isTomorrow", () => {
  it("compares the day's date with the local date of now", () => {
    expect(isToday(pt, new Date(2026, 8, 4, 10, 30))).toBe(true);
    expect(isToday(pt, new Date(2026, 8, 4, 0, 0))).toBe(true);
    expect(isToday(pt, new Date(2026, 8, 5, 0, 0))).toBe(false);
  });

  it("isTomorrow is true only for the calendar day after now", () => {
    expect(isTomorrow(sob, new Date(2026, 8, 4, 10, 30))).toBe(true);
    expect(isTomorrow(sob, new Date(2026, 8, 4, 23, 59))).toBe(true);
    expect(isTomorrow(sob, new Date(2026, 8, 5, 0, 0))).toBe(false);
    expect(isTomorrow(pt, new Date(2026, 8, 4, 10, 30))).toBe(false);
  });

  it("isTomorrow crosses a month boundary", () => {
    const october = makeDay({ id: "czw", date: "2026-10-01", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 1 października" });
    expect(isTomorrow(october, new Date(2026, 8, 30, 22, 0))).toBe(true);
  });
});

describe("defaultDay", () => {
  it("before the festival picks the first busy day", () => {
    expect(defaultDay(days, new Date(2026, 8, 1, 12, 0), counts)).toBe(pt);
  });

  it("on the one-session Thursday still picks Friday", () => {
    expect(defaultDay(days, new Date(2026, 8, 3, 12, 0), counts)).toBe(pt);
  });

  it("during the festival picks today", () => {
    expect(defaultDay(days, new Date(2026, 8, 4, 10, 30), counts)).toBe(pt);
    expect(defaultDay(days, new Date(2026, 8, 5, 10, 30), counts)).toBe(sob);
  });

  it("after the festival falls back to the first busy day", () => {
    expect(defaultDay(days, new Date(2026, 8, 7, 9, 0), counts)).toBe(pt);
  });

  it("falls back to the first day when no day has more than 5 sessions", () => {
    const sparse = new Map<string, number>([
      ["czw", 1],
      ["pt", 5],
      ["sob", 2],
    ]);
    expect(defaultDay(days, new Date(2026, 8, 4, 10, 30), sparse)).toBe(czw);
    expect(defaultDay(days, new Date(2026, 8, 4, 10, 30), new Map())).toBe(czw);
  });

  it("throws on an empty day list", () => {
    expect(() => defaultDay([], new Date(2026, 8, 4, 10, 30), counts)).toThrow();
  });
});

describe("minutesUntil", () => {
  it("is the signed difference start - now", () => {
    expect(minutesUntil(655, 630)).toBe(25);
    expect(minutesUntil(630, 630)).toBe(0);
    expect(minutesUntil(600, 630)).toBe(-30);
  });
});
