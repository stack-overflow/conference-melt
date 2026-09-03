import { describe, expect, it } from "vitest";
import { nameTokens, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("folds ł and Ł, which have no canonical decomposition", () => {
    expect(normalizeText("Paweł")).toBe("pawel");
    expect(normalizeText("ŁUKASZ")).toBe("lukasz");
  });

  it("strips every Polish diacritic and lowercases", () => {
    expect(normalizeText("Zażółć gęślą jaźń")).toBe("zazolc gesla jazn");
  });

  it("lets 'swiatlo' find 'Światło' as a substring of a real title", () => {
    const title = normalizeText("Światło, które widzisz. Oświetlenie LED w fotografii kreatywnej");
    expect(title).toBe("swiatlo, ktore widzisz. oswietlenie led w fotografii kreatywnej");
    expect(title.includes(normalizeText("swiatlo"))).toBe(true);
    expect(title.includes(normalizeText("Światło"))).toBe(true);
  });

  it("is idempotent", () => {
    const once = normalizeText("Radosław DŻODŻO Drozdowicz");
    expect(once).toBe("radoslaw dzodzo drozdowicz");
    expect(normalizeText(once)).toBe(once);
  });

  it("keeps punctuation and whitespace untouched", () => {
    expect(normalizeText("A - B  C")).toBe("a - b  c");
  });

  it("returns an empty string for an empty string", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("nameTokens", () => {
  it("returns the normalized word tokens as a set", () => {
    expect(nameTokens("Emil Biliński")).toEqual(new Set(["emil", "bilinski"]));
  });

  it("makes surname-first anchor text equal to the speaker name", () => {
    expect(nameTokens("Biliński Emil")).toEqual(nameTokens("Emil Biliński"));
  });

  it("splits on hyphens and keeps digit runs as tokens", () => {
    expect(nameTokens("Kutyła-Kupidura")).toEqual(new Set(["kutyla", "kupidura"]));
    expect(nameTokens("Sala wykładowa nr 1")).toEqual(new Set(["sala", "wykladowa", "nr", "1"]));
  });

  it("keeps every word of an anchor with a brand suffix", () => {
    expect(nameTokens("Wąs Mateusz MUSTACHE LENS")).toEqual(
      new Set(["was", "mateusz", "mustache", "lens"]),
    );
  });

  it("drops duplicate tokens because it is a set", () => {
    expect(nameTokens("Anna Anna")).toEqual(new Set(["anna"]));
  });

  it("returns an empty set for text without letters or digits", () => {
    expect(nameTokens(" - / ")).toEqual(new Set());
  });
});
