// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildFriLecturesFixture, buildSlotSetsFixture } from "../lib/fixtures";
import { dataOf, sessionOf } from "./data.fixture";

const SESSIONS = [
  sessionOf("10:pt", { typeIds: [184], locationIds: [233], start: 570, end: 645 }),
  sessionOf("11:pt", { typeIds: [278], locationIds: [281], start: 660, end: 735 }),
  sessionOf("12:pt", { typeIds: [5], locationIds: [233], start: 570, end: 960 }),
  sessionOf("13:sob", { typeIds: [184], locationIds: [233], start: 600, end: 675 }),
  sessionOf("14:pt", { typeIds: [242], locationIds: [318], start: 540, end: 1080, allDay: true }),
  sessionOf("15:pt", { typeIds: [184], locationIds: [233], start: null, end: null, timeText: "" }),
  sessionOf("16:pt", { typeIds: [184], locationIds: [233], start: 810, end: null, timeText: "13:30" }),
];
const DATA = dataOf(SESSIONS);

describe("buildSlotSetsFixture", () => {
  const fixture = buildSlotSetsFixture(DATA);

  it("has one entry per calibration set, in SLOT_SETS order", () => {
    expect(Object.keys(fixture)).toEqual([
      "sat-lectures",
      "sat-prelekcja-only",
      "fri-lectures",
      "fri-prelekcja-only",
      "fri-lecture-rooms",
      "fri-all",
      "sat-all",
      "fri-equipment",
    ]);
  });

  it("stores only id, start and end of each member, in sessions order", () => {
    expect(fixture["fri-lectures"]).toEqual([
      { id: "10:pt", start: 570, end: 645 },
      { id: "11:pt", start: 660, end: 735 },
      { id: "16:pt", start: 810, end: null },
    ]);
    expect(fixture["sat-lectures"]).toEqual([{ id: "13:sob", start: 600, end: 675 }]);
    expect(fixture["fri-all"]?.map((m) => m.id)).toEqual(["10:pt", "11:pt", "12:pt", "16:pt"]);
    expect(fixture["fri-equipment"]).toEqual([]);
  });
});

describe("buildFriLecturesFixture", () => {
  const fixture = buildFriLecturesFixture(DATA);

  it("keeps the complete Session records of the fri-lectures set", () => {
    expect(fixture.sessions).toEqual([SESSIONS[0], SESSIONS[1], SESSIONS[6]]);
  });

  it("keeps only the days, types and locations those sessions reference, in data order", () => {
    expect(fixture.days.map((d) => d.id)).toEqual(["pt"]);
    expect(fixture.types.map((t) => t.id)).toEqual([184, 278]);
    expect(fixture.locations.map((l) => l.id)).toEqual([233, 281]);
  });

  it("empties themes, brands, speakers and signupStatuses and recounts meta", () => {
    expect(fixture.themes).toEqual([]);
    expect(fixture.brands).toEqual([]);
    expect(fixture.speakers).toEqual([]);
    expect(fixture.signupStatuses).toEqual([]);
    expect(fixture.meta).toEqual({ ...DATA.meta, eventCount: 3, sessionCount: 3, speakerCount: 0 });
  });
});
