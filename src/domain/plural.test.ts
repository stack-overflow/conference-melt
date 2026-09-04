import { describe, expect, it } from "vitest";
import { events, plural } from "./plural";

const forms = (n: number): string => plural(n, "one", "few", "many");

describe("plural", () => {
  it("picks the singular only for 1", () => {
    expect(forms(1)).toBe("one");
    expect(forms(21)).toBe("many");
    expect(forms(101)).toBe("many");
  });

  it("picks the few form for 2–4 outside the teens", () => {
    expect([forms(2), forms(3), forms(4)]).toEqual(["few", "few", "few"]);
    expect([forms(22), forms(23), forms(24)]).toEqual(["few", "few", "few"]);
    expect([forms(102), forms(1004)]).toEqual(["few", "few"]);
  });

  it("picks the many form for 0, 5–21 and the 12–14 teens", () => {
    expect(forms(0)).toBe("many");
    expect([forms(5), forms(9), forms(11)]).toEqual(["many", "many", "many"]);
    expect([forms(12), forms(13), forms(14)]).toEqual(["many", "many", "many"]);
    expect([forms(112), forms(114)]).toEqual(["many", "many"]);
  });

  it("declines the event noun with the count", () => {
    expect([events(0), events(1), events(2), events(5), events(22)]).toEqual([
      "0 wydarzeń",
      "1 wydarzenie",
      "2 wydarzenia",
      "5 wydarzeń",
      "22 wydarzenia",
    ]);
  });
});
