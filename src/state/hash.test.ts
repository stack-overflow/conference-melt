// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHash, parseHash, writeHash } from "./hash";

describe("parseHash", () => {
  it("reads d, v and plan from a full hash", () => {
    expect(parseHash("#d=pt&v=grid&plan=1~abc.p")).toEqual({ d: "pt", v: "grid", plan: "1~abc.p" });
  });

  it("accepts a hash without the leading #", () => {
    expect(parseHash("d=sob")).toEqual({ d: "sob" });
  });

  it("returns an empty object for an empty or bare hash", () => {
    expect(parseHash("")).toEqual({});
    expect(parseHash("#")).toEqual({});
  });

  it("drops keys with empty values", () => {
    expect(parseHash("#d=&v=list")).toEqual({ v: "list" });
  });

  it("percent-decodes values", () => {
    expect(parseHash("#plan=1%7Eabc.p")).toEqual({ plan: "1~abc.p" });
  });

  it("ignores unknown keys", () => {
    expect(parseHash("#d=pt&x=1")).toEqual({ d: "pt" });
  });
});

describe("buildHash", () => {
  it("writes d, v then plan regardless of the input order", () => {
    expect(buildHash({ plan: "1~x.p", v: "plan", d: "sob" })).toBe("#d=sob&v=plan&plan=1~x.p");
  });

  it("omits plan when it is absent", () => {
    expect(buildHash({ d: "pt", v: "grid" })).toBe("#d=pt&v=grid");
  });

  it("omits empty strings", () => {
    expect(buildHash({ d: "pt", v: "grid", plan: "" })).toBe("#d=pt&v=grid");
  });

  it("round-trips through parseHash", () => {
    const h = { d: "pt", v: "list", plan: "1~1p.2s" };
    expect(parseHash(buildHash(h))).toEqual(h);
  });
});

describe("writeHash", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    history.replaceState(null, "", "/");
  });

  it("calls history.replaceState with a fragment-only URL", () => {
    const spy = vi.spyOn(history, "replaceState");
    writeHash({ d: "pt", v: "grid" });
    expect(spy).toHaveBeenCalledWith(null, "", "#d=pt&v=grid");
    expect(window.location.hash).toBe("#d=pt&v=grid");
  });

  it("preserves the path and the ?now= query", () => {
    history.replaceState(null, "", "/index.html?now=2026-09-04T10:30");
    writeHash({ d: "sob", v: "plan", plan: "1~1p" });
    expect(window.location.pathname).toBe("/index.html");
    expect(window.location.search).toBe("?now=2026-09-04T10:30");
    expect(window.location.hash).toBe("#d=sob&v=plan&plan=1~1p");
  });
});
