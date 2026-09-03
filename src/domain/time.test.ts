import { describe, expect, it } from "vitest";
import { hasStart, type Session, type TimedSession } from "../data/types";
import { makeSession } from "../test/fixtures/build";
import {
  POINT_MINUTES,
  durationLabel,
  formatRange,
  formatTime,
  isAllDay,
  isPoint,
  roundDown,
  roundUp,
  visualEnd,
} from "./time";

function timed(overrides: Partial<Session> = {}): TimedSession {
  const s = makeSession(overrides);
  if (!hasStart(s)) throw new Error("test session needs a start");
  return s;
}

describe("formatTime", () => {
  it("zero-pads hours and minutes", () => {
    expect(formatTime(545)).toBe("09:05");
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats an evening time", () => {
    expect(formatTime(1170)).toBe("19:30");
  });
});

describe("formatRange", () => {
  it("joins start and end with an en dash", () => {
    expect(formatRange(545, 615)).toBe("09:05–10:15");
    expect(formatRange(545, 615)).toContain("–");
  });

  it("shows only the start when end is null", () => {
    expect(formatRange(570, null)).toBe("09:30");
  });
});

describe("durationLabel", () => {
  it("shows hours and minutes", () => {
    expect(durationLabel(545, 615)).toBe("1 h 10 min");
  });

  it("omits the minutes part for whole hours", () => {
    expect(durationLabel(540, 660)).toBe("2 h");
    expect(durationLabel(570, 930)).toBe("6 h");
  });

  it("shows only minutes under an hour", () => {
    expect(durationLabel(600, 645)).toBe("45 min");
  });

  it("is null when end is null", () => {
    expect(durationLabel(570, null)).toBeNull();
  });
});

describe("isAllDay", () => {
  it("reads the allDay flag, not the duration", () => {
    expect(isAllDay(makeSession({ allDay: true, start: 540, end: 1080, typeIds: [242] }))).toBe(true);
    expect(isAllDay(makeSession({ allDay: false, start: 540, end: 1080, typeIds: [5] }))).toBe(false);
  });
});

describe("isPoint", () => {
  it("is true for a start without an end", () => {
    expect(isPoint(makeSession({ start: 570, end: null }))).toBe(true);
  });

  it("is false for a range", () => {
    expect(isPoint(makeSession())).toBe(false);
  });

  it("is false without a start", () => {
    expect(isPoint(makeSession({ start: null, end: null }))).toBe(false);
  });
});

describe("visualEnd", () => {
  it("returns the end when present", () => {
    expect(visualEnd(timed({ start: 570, end: 645 }))).toBe(645);
  });

  it("extends a point session by POINT_MINUTES", () => {
    expect(POINT_MINUTES).toBe(20);
    expect(visualEnd(timed({ start: 570, end: null }))).toBe(590);
  });
});

describe("roundDown / roundUp", () => {
  it("rounds down to the step and leaves multiples alone", () => {
    expect(roundDown(575, 30)).toBe(570);
    expect(roundDown(570, 30)).toBe(570);
  });

  it("rounds up to the step and leaves multiples alone", () => {
    expect(roundUp(575, 30)).toBe(600);
    expect(roundUp(600, 30)).toBe(600);
  });

  it("works with a 15-minute step", () => {
    expect(roundDown(1174, 15)).toBe(1170);
    expect(roundUp(1171, 15)).toBe(1185);
  });
});
