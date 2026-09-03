import type { Session } from "../data/types";
import type { DataIndex } from "./lookup";
import { primaryType } from "./lookup";

export type ColorBy = "type" | "location" | "brand";

export interface Hue {
  hue: number;
  /** 0 means neutral (grey); chromatic hues use the spec §8 chroma. */
  chroma: number;
}

/** Spec §8 type hues by type name. Ogólne is neutral and deliberately absent. */
export const TYPE_HUES: Record<string, number> = {
  Prelekcja: 45,
  "Prelekcja z sesją": 25,
  Warsztaty: 340,
  Fotospacer: 95,
  Fotogra: 95,
  PLAYGROUND: 175,
  "DZIAŁANIA W STREFIE SPRZĘTU": 240,
  "STREFA TELEOBIEKTYWÓW": 260,
};

const FALLBACK_TYPE_HUE = 300;
const NEUTRAL_TYPE_NAME = "Ogólne";
const CHROMA = 0.16;
const HUE_COUNT = 12;
const NEUTRAL: Hue = { hue: 0, chroma: 0 };

/** 32-bit integer mix (xorshift-multiply) folded into 12 evenly spaced hues. */
export function hashHue(id: number): number {
  let h = id >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return ((h >>> 0) % HUE_COUNT) * (360 / HUE_COUNT);
}

function chromatic(hue: number): Hue {
  return { hue, chroma: CHROMA };
}

function hashedOrNeutral(id: number | undefined): Hue {
  return id === undefined ? NEUTRAL : chromatic(hashHue(id));
}

export function hueFor(s: Session, colorBy: ColorBy, index: DataIndex): Hue {
  if (colorBy === "location") return hashedOrNeutral(s.locationIds[0]);
  if (colorBy === "brand") return hashedOrNeutral(s.brandIds[0]);
  const type = primaryType(s, index);
  if (type === null || type.name === NEUTRAL_TYPE_NAME) return NEUTRAL;
  return chromatic(TYPE_HUES[type.name] ?? FALLBACK_TYPE_HUE);
}
