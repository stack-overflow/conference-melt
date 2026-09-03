import { describe, expect, it } from "vitest";
import { DAY_CODES, SHARE_VERSION, buildShareUrl, decodePlan, encodePlan } from "./share";

const KNOWN: ReadonlySet<string> = new Set(["39619:sob", "39587:sob", "39556:pt", "41151:pt", "39549:czw"]);

describe("DAY_CODES", () => {
  it("maps every day id the normalizer can emit to a distinct letter", () => {
    expect(DAY_CODES).toEqual({ czw: "c", pt: "p", sob: "s", nd: "n", pon: "m", wt: "t", sr: "r" });
    expect(new Set(Object.values(DAY_CODES)).size).toBe(7);
  });
});

describe("encodePlan", () => {
  it("writes the version prefix, base-36 event ids and day codes joined by dots", () => {
    expect(SHARE_VERSION).toBe("1~");
    expect(encodePlan(["39619:sob", "39587:sob", "39556:pt", "41151:pt", "39549:czw"])).toBe("1~ukjs.ujns.uisp.vr3p.uilc");
  });

  it("encodes an empty plan as the bare prefix", () => {
    expect(encodePlan([])).toBe("1~");
  });

  it("skips ids with an unknown day or a non-numeric event id", () => {
    expect(encodePlan(["1:pt", "2:xyz", "abc:pt", "3:sob", "nocolon"])).toBe("1~1p.3s");
  });
});

describe("decodePlan", () => {
  it("round-trips a plan", () => {
    const ids = ["39619:sob", "39587:sob", "39556:pt", "41151:pt", "39549:czw"];
    expect(decodePlan(encodePlan(ids), KNOWN)).toEqual({ ids, unknown: 0 });
  });

  it("counts ids that are not in the data as unknown", () => {
    expect(decodePlan("1~ukjs.zzzp.ujns", KNOWN)).toEqual({ ids: ["39619:sob", "39587:sob"], unknown: 1 });
  });

  it("counts tokens with an unmapped day code as unknown", () => {
    expect(decodePlan("1~ukjx", KNOWN)).toEqual({ ids: [], unknown: 1 });
    expect(decodePlan("1~ukjz", KNOWN)).toEqual({ ids: [], unknown: 1 });
  });

  it("counts tokens that do not match the token grammar as unknown", () => {
    expect(decodePlan("1~ukjS", KNOWN)).toEqual({ ids: [], unknown: 1 });
    expect(decodePlan("1~ukj-s", KNOWN)).toEqual({ ids: [], unknown: 1 });
    expect(decodePlan("1~s", KNOWN)).toEqual({ ids: [], unknown: 1 });
  });

  it("ignores empty tokens so the bare prefix and stray dots give no unknowns", () => {
    expect(decodePlan("1~", KNOWN)).toEqual({ ids: [], unknown: 0 });
    expect(decodePlan("1~ukjs..ujns.", KNOWN)).toEqual({ ids: ["39619:sob", "39587:sob"], unknown: 0 });
  });

  it("collapses duplicate tokens", () => {
    expect(decodePlan("1~ukjs.ukjs", KNOWN)).toEqual({ ids: ["39619:sob"], unknown: 0 });
  });

  it("returns an empty result for an unknown version prefix", () => {
    expect(decodePlan("2~ukjs", KNOWN)).toEqual({ ids: [], unknown: 0 });
    expect(decodePlan("ukjs", KNOWN)).toEqual({ ids: [], unknown: 0 });
    expect(decodePlan("", KNOWN)).toEqual({ ids: [], unknown: 0 });
  });
});

describe("buildShareUrl", () => {
  it("drops the query, replaces the hash and keeps the file path", () => {
    expect(buildShareUrl("file:///Users/tom/dist/index.html?now=2026-09-04T10:30#d=sob&v=grid", "pt", ["1:pt", "2:sob"])).toBe(
      "file:///Users/tom/dist/index.html#d=pt&v=plan&plan=1~1p.2s",
    );
  });

  it("works for http origins and an empty plan", () => {
    expect(buildShareUrl("https://example.com/plan/?x=1#d=pt", "sob", [])).toBe("https://example.com/plan/#d=sob&v=plan&plan=1~");
  });
});
