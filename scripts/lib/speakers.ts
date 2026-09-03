import type { Speaker } from "../../src/data/types";
import { nameTokens } from "../../src/domain/normalize";
import type { Anchor } from "./parse";
import { decodeEntities } from "./sanitize";

export interface SpeakerLookup {
  bySlug: Map<string, Speaker>;
  byId: Map<number, Speaker>;
  byTokens: { tokens: Set<string>; speaker: Speaker }[];
}

export type ResolveTier = "slug" | "name" | "data-id";

/** Spec §4.2 tier 1: the trailing path segment of a speaker page URL. */
const SLUG_RE = /cyfrowe-prelegent\/([^/]+)\/?$/;
const NUMERIC_RE = /^\d+$/;
const SPEAKER_DATA_TYPE = "cyfrowe-prelegent";

export function buildSpeakerLookup(speakers: Speaker[]): SpeakerLookup {
  const bySlug = new Map<string, Speaker>();
  const byId = new Map<number, Speaker>();
  const byTokens: SpeakerLookup["byTokens"] = [];
  for (const speaker of speakers) {
    bySlug.set(speaker.slug, speaker);
    byId.set(speaker.id, speaker);
    byTokens.push({ tokens: nameTokens(speaker.name), speaker });
  }
  return { bySlug, byId, byTokens };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const token of a) if (!b.has(token)) return false;
  return true;
}

function containsAll(superset: Set<string>, subset: Set<string>): boolean {
  for (const token of subset) if (!superset.has(token)) return false;
  return true;
}

function slugTier(anchor: Anchor, lookup: SpeakerLookup): Speaker | null {
  const slug = SLUG_RE.exec(anchor.href)?.[1];
  if (slug === undefined) return null;
  return lookup.bySlug.get(slug) ?? null;
}

function nameTier(anchor: Anchor, lookup: SpeakerLookup): Speaker | null {
  const tokens = nameTokens(decodeEntities(anchor.text));
  if (tokens.size === 0) return null;
  const exact = lookup.byTokens.filter((entry) => sameSet(entry.tokens, tokens));
  if (exact.length === 1) return exact[0]?.speaker ?? null;
  if (exact.length > 1 || tokens.size < 2) return null;
  const containing = lookup.byTokens.filter((entry) => containsAll(entry.tokens, tokens));
  if (containing.length === 1) return containing[0]?.speaker ?? null;
  return null;
}

function dataIdTier(anchor: Anchor, lookup: SpeakerLookup): Speaker | null {
  if (anchor.dataType !== SPEAKER_DATA_TYPE) return null;
  if (anchor.dataId === null || !NUMERIC_RE.test(anchor.dataId)) return null;
  return lookup.byId.get(Number(anchor.dataId)) ?? null;
}

export function resolveSpeaker(
  anchor: Anchor,
  lookup: SpeakerLookup,
): { speaker: Speaker; tier: ResolveTier } | null {
  const bySlug = slugTier(anchor, lookup);
  if (bySlug !== null) return { speaker: bySlug, tier: "slug" };
  const byName = nameTier(anchor, lookup);
  if (byName !== null) return { speaker: byName, tier: "name" };
  const byDataId = dataIdTier(anchor, lookup);
  if (byDataId !== null) return { speaker: byDataId, tier: "data-id" };
  return null;
}
