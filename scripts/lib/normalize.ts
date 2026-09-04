import type {
  Day,
  Location,
  ScheduleData,
  ScheduleMeta,
  Session,
  Speaker,
  Term,
} from "../../src/data/types";
import type { RawData, WpEvent, WpSpeaker, WpTerm } from "./api";
import { compareLocations, parseLocation, shortLabel } from "./locations";
import {
  extractAnchors,
  isAllDayEvent,
  isSiteHost,
  paragraphs,
  parseByline,
  parseDay,
  parseTime,
  signupStatusFromTerm,
} from "./parse";
import { bioHtml, decodeEntities, isBlankHtml, sanitizeHtml, stripTags } from "./sanitize";
import { buildSpeakerLookup, resolveSpeaker } from "./speakers";
import type { SpeakerLookup } from "./speakers";

export interface NormalizeResult {
  data: ScheduleData;
  warnings: string[];
}

const collator = new Intl.Collator("pl");

/** Location names that are expected to reach parsing rule 6 (spec §4.2); any other rule-6 term is reported. */
const EXPECTED_RULE6_NAMES = new Set(["Rejestracja", "W4", "Wkrótce", "ZERO ZERO (przed wejściem)"]);

const NO_SIGNUP_LABEL = "Brak informacji";
const PRELEGENT_BRAND = "Prelegent";

function compareByName(a: Term, b: Term): number {
  return collator.compare(a.name, b.name) || a.id - b.id;
}

function toTerm(term: WpTerm): Term {
  return { id: term.id, slug: term.slug, name: decodeEntities(term.name), count: term.count };
}

function termsInUse(terms: WpTerm[]): Term[] {
  return terms
    .filter((term) => term.count > 0)
    .map(toTerm)
    .sort(compareByName);
}

function buildDays(terms: WpTerm[], year: number): Day[] {
  const days: Day[] = [];
  for (const term of terms) {
    if (term.count <= 0) continue;
    const parsed = parseDay(term.name, year);
    if (parsed === null) continue; // validate() turns this into an error
    days.push({
      id: parsed.id,
      termId: term.id,
      date: parsed.date,
      label: parsed.label,
      short: parsed.short,
      labelLong: parsed.labelLong,
    });
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function buildLocations(terms: WpTerm[], warnings: string[]): Location[] {
  // Every fetched term is parsed and checked, even those with count 0 (spec §4.2).
  const parsedTerms = terms.map((term) => {
    const name = decodeEntities(term.name);
    const parsed = parseLocation(name);
    const { short, fromMap } = shortLabel(term.id, parsed);
    if (parsed.rule === 6 && !EXPECTED_RULE6_NAMES.has(name)) {
      warnings.push(`Location ${term.id} "${name}" matched no parsing rule (fell through to rule 6)`);
    }
    if (!fromMap) {
      warnings.push(`Location ${term.id} "${name}" is missing from SHORT_LABELS (using "${short}")`);
    }
    return { term, name, parsed, short };
  });
  return parsedTerms
    .filter((entry) => entry.term.count > 0)
    .sort((a, b) =>
      compareLocations({ level: a.parsed.level, name: a.name }, { level: b.parsed.level, name: b.name }),
    )
    .map(
      (entry, order): Location => ({
        id: entry.term.id,
        slug: entry.term.slug,
        name: entry.name,
        count: entry.term.count,
        venue: entry.parsed.venue,
        level: entry.parsed.level,
        room: entry.parsed.room,
        short: entry.short,
        order,
      }),
    );
}

function photoUrls(speaker: WpSpeaker): { photo: string | null; photoThumb: string | null } {
  const media = speaker._embedded?.["wp:featuredmedia"]?.[0];
  if (speaker.featured_media === 0 || media === undefined || typeof media.source_url !== "string") {
    return { photo: null, photoThumb: null };
  }
  const sizes = media.media_details?.sizes ?? {};
  const photo = sizes["large"]?.source_url ?? sizes["full"]?.source_url ?? media.source_url;
  const photoThumb = sizes["medium"]?.source_url ?? sizes["thumbnail"]?.source_url ?? photo;
  return { photo, photoThumb };
}

function buildSpeakers(raw: RawData): Speaker[] {
  const brandNames = new Map(
    raw.terms["cyfrowe-prelegent-type"].map((term) => [term.id, decodeEntities(term.name)] as const),
  );
  return raw.speakers
    .map((speaker): Speaker => {
      const { photo, photoThumb } = photoUrls(speaker);
      const brands = speaker["cyfrowe-prelegent-type"]
        .map((id) => brandNames.get(id))
        .filter((name): name is string => name !== undefined && name !== PRELEGENT_BRAND);
      return {
        id: speaker.id,
        slug: speaker.slug,
        name: decodeEntities(speaker.title.rendered),
        photo,
        photoThumb,
        bioHtml: bioHtml(speaker.content.rendered),
        url: speaker.link,
        brands,
      };
    })
    .sort((a, b) => a.id - b.id);
}

interface SessionContext {
  lookup: SpeakerLookup;
  typeOrder: number[];
  themeOrder: number[];
  brandOrder: number[];
  locationOrder: number[];
  typeSlugById: Map<number, string>;
  signupNameById: Map<number, string>;
}

type EventFields = Omit<Session, "id" | "eventId" | "day">;

/** Ids in term-array order first, then any id the term arrays do not know (validate() reports those). */
function orderIds(ids: number[], order: number[]): number[] {
  const wanted = new Set(ids);
  const known = order.filter((id) => wanted.has(id));
  const knownSet = new Set(known);
  return [...known, ...ids.filter((id) => !knownSet.has(id))];
}

function parseEvent(event: WpEvent, ctx: SessionContext, warnings: string[]): EventFields {
  const title = decodeEntities(event.title.rendered);
  const label = `Event ${event.id} "${title}"`;

  const allParagraphs = paragraphs(event.content.rendered);
  const firstIndex = allParagraphs.findIndex((p) => !isBlankHtml(p));
  const firstHtml = firstIndex === -1 ? "" : (allParagraphs[firstIndex] ?? "");
  const rest = firstIndex === -1 ? [] : allParagraphs.slice(firstIndex + 1);
  const text = stripTags(firstHtml);

  const time = parseTime(text);
  if (time.endDiscarded) {
    warnings.push(`${label}: end is not after start in "${time.timeText}", end discarded`);
  }

  const anchors = extractAnchors(firstHtml);
  // A relative or malformed href has no host: it is not the external signup link.
  const signupAnchor = anchors.find((anchor) => anchor.host !== "" && !isSiteHost(anchor.host)) ?? null;
  const removeTexts: string[] = signupAnchor === null ? [] : [stripTags(signupAnchor.text)];
  const speakerIds: number[] = [];
  for (const anchor of anchors) {
    if (!isSiteHost(anchor.host)) continue;
    const resolved = resolveSpeaker(anchor, ctx.lookup);
    if (resolved === null) {
      warnings.push(
        `${label}: speaker anchor "${anchor.text}" (${anchor.href}) did not resolve; its text stays in the byline`,
      );
      continue;
    }
    if (resolved.tier !== "slug") {
      warnings.push(
        `${label}: speaker anchor "${anchor.text}" (${anchor.href}) resolved by ${resolved.tier} to ${resolved.speaker.id} ${resolved.speaker.name}`,
      );
    }
    if (!speakerIds.includes(resolved.speaker.id)) speakerIds.push(resolved.speaker.id);
    removeTexts.push(stripTags(anchor.text));
  }

  const signupName = event["cyfrowe-event-zapisy"]
    .map((id) => ctx.signupNameById.get(id))
    .find((name) => name !== undefined);
  const typeSlugs = event["cyfrowe-event-type"].flatMap((id) => {
    const slug = ctx.typeSlugById.get(id);
    return slug === undefined ? [] : [slug];
  });

  return {
    title,
    start: time.start,
    end: time.end,
    allDay: isAllDayEvent(time.start, time.end, typeSlugs),
    timeText: time.timeText,
    speakerIds,
    byline: parseByline(text, time.timeText, removeTexts),
    typeIds: orderIds(event["cyfrowe-event-type"], ctx.typeOrder),
    themeIds: orderIds(event["cyfrowe-event-theme"], ctx.themeOrder),
    brandIds: orderIds(event["cyfrowe-event-brand"], ctx.brandOrder),
    locationIds: orderIds(event["cyfrowe-event-location"], ctx.locationOrder),
    signup: {
      status: signupStatusFromTerm(signupName),
      url: signupAnchor?.href ?? null,
      label: signupName ?? NO_SIGNUP_LABEL,
    },
    descriptionHtml: sanitizeHtml(rest.map((p) => `<p>${p}</p>`).join("")),
    url: event.link,
  };
}

function buildSessions(raw: RawData, days: Day[], ctx: SessionContext, warnings: string[]): Session[] {
  const dayByTermId = new Map(days.map((day) => [day.termId, day] as const));
  const dayPosition = new Map(days.map((day, index) => [day.id, index] as const));
  const sessions: Session[] = [];
  for (const event of raw.events) {
    const fields = parseEvent(event, ctx, warnings);
    for (const termId of event["cyfrowe-event-day"]) {
      const day = dayByTermId.get(termId);
      if (day === undefined) continue; // validate() reports unknown and unparseable day terms
      // Key order here is the on-disk key order (spec §4.5); JSON.stringify keeps insertion order.
      sessions.push({ id: `${event.id}:${day.id}`, eventId: event.id, day: day.id, ...fields });
    }
  }
  return sessions.sort(
    (a, b) => a.eventId - b.eventId || (dayPosition.get(a.day) ?? 0) - (dayPosition.get(b.day) ?? 0),
  );
}

export function normalizeAll(
  raw: RawData,
  opts: { year: number; fetchedAt: string; source: string },
): NormalizeResult {
  const warnings: string[] = [];
  const days = buildDays(raw.terms["cyfrowe-event-day"], opts.year);
  const locations = buildLocations(raw.terms["cyfrowe-event-location"], warnings);
  const types = termsInUse(raw.terms["cyfrowe-event-type"]);
  const themes = termsInUse(raw.terms["cyfrowe-event-theme"]);
  const brands = termsInUse(raw.terms["cyfrowe-event-brand"]);
  const signupStatuses = termsInUse(raw.terms["cyfrowe-event-zapisy"]);
  const speakers = buildSpeakers(raw);
  const ctx: SessionContext = {
    lookup: buildSpeakerLookup(speakers),
    typeOrder: types.map((term) => term.id),
    themeOrder: themes.map((term) => term.id),
    brandOrder: brands.map((term) => term.id),
    locationOrder: locations.map((location) => location.id),
    typeSlugById: new Map(raw.terms["cyfrowe-event-type"].map((term) => [term.id, term.slug] as const)),
    signupNameById: new Map(
      raw.terms["cyfrowe-event-zapisy"].map((term) => [term.id, decodeEntities(term.name)] as const),
    ),
  };
  const sessions = buildSessions(raw, days, ctx, warnings);
  const meta: ScheduleMeta = {
    source: opts.source,
    fetchedAt: opts.fetchedAt,
    year: opts.year,
    version: 1,
    eventCount: raw.events.length,
    sessionCount: sessions.length,
    speakerCount: speakers.length,
  };
  // Top-level key order is the on-disk key order (spec §4.1 step 5).
  return {
    data: { meta, days, locations, types, themes, brands, signupStatuses, speakers, sessions },
    warnings,
  };
}
