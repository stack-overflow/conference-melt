import type { ScheduleData, Session, SignupStatus, Term } from "../data/types";
import type { DataIndex } from "./lookup";
import { locationsOf, speakersOf } from "./lookup";
import { normalizeText } from "./normalize";

export interface Filters {
  types: number[];
  themes: number[];
  brands: number[];
  locations: number[];
  signup: SignupStatus[];
  query: string;
  onlyFavourites: boolean;
  hideAllDay: boolean;
}

export const EMPTY_FILTERS: Filters = {
  types: [],
  themes: [],
  brands: [],
  locations: [],
  signup: [],
  query: "",
  onlyFavourites: false,
  hideAllDay: false,
};

export type Facet = "types" | "themes" | "brands" | "locations" | "signup";

export const FACETS: Facet[] = ["types", "themes", "brands", "locations", "signup"];

export const SIGNUP_ORDER: SignupStatus[] = ["open", "full", "included", "free", "soon", "unknown"];

export type SearchIndex = Map<string, string>;

type TermFacet = Exclude<Facet, "signup">;

const TERM_FACETS: TermFacet[] = ["types", "themes", "brands", "locations"];

const SESSION_KEY: Record<TermFacet, "typeIds" | "themeIds" | "brandIds" | "locationIds"> = {
  types: "typeIds",
  themes: "themeIds",
  brands: "brandIds",
  locations: "locationIds",
};

function termNames(ids: number[], byId: Map<number, Term>): string[] {
  return ids.flatMap((id) => {
    const t = byId.get(id);
    return t === undefined ? [] : [t.name];
  });
}

/** Spec §5.4: title, speaker names, byline, theme, brand, location and type names, normalized once per session. */
export function buildSearchIndex(data: ScheduleData, index: DataIndex): SearchIndex {
  const result: SearchIndex = new Map();
  for (const s of data.sessions) {
    const parts = [
      s.title,
      ...speakersOf(s, index).map((sp) => sp.name),
      s.byline ?? "",
      ...termNames(s.themeIds, index.themeById),
      ...termNames(s.brandIds, index.brandById),
      ...locationsOf(s, index).map((l) => l.name),
      ...termNames(s.typeIds, index.typeById),
    ];
    result.set(s.id, normalizeText(parts.join(" ")));
  }
  return result;
}

export interface FilterOptions {
  ignoreQuery?: boolean;
  ignoreFavourites?: boolean;
}

function matchesFacets(s: Session, filters: Filters): boolean {
  for (const facet of TERM_FACETS) {
    const wanted = filters[facet];
    if (wanted.length > 0 && !s[SESSION_KEY[facet]].some((id) => wanted.includes(id))) return false;
  }
  if (filters.signup.length > 0 && !filters.signup.includes(s.signup.status)) return false;
  return true;
}

export function applyFilters(
  sessions: Session[],
  filters: Filters,
  planSet: ReadonlySet<string>,
  search: SearchIndex,
  opts: FilterOptions = {},
): Session[] {
  const query = opts.ignoreQuery === true ? "" : normalizeText(filters.query).trim();
  const favouritesOnly = filters.onlyFavourites && opts.ignoreFavourites !== true;
  return sessions.filter((s) => {
    if (!matchesFacets(s, filters)) return false;
    if (filters.hideAllDay && s.allDay) return false;
    if (favouritesOnly && !planSet.has(s.id)) return false;
    if (query !== "" && !(search.get(s.id) ?? "").includes(query)) return false;
    return true;
  });
}

/** Counts per option of `facet` over the sessions left when that facet is cleared and everything else still applies. */
export function facetCounts(
  sessions: Session[],
  filters: Filters,
  facet: Facet,
  planSet: ReadonlySet<string>,
  search: SearchIndex,
): Map<number | SignupStatus, number> {
  const relaxed: Filters = { ...filters };
  relaxed[facet] = [];
  const remaining = applyFilters(sessions, relaxed, planSet, search);
  const counts = new Map<number | SignupStatus, number>();
  const bump = (key: number | SignupStatus): void => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const s of remaining) {
    if (facet === "signup") {
      bump(s.signup.status);
    } else {
      for (const id of s[SESSION_KEY[facet]]) bump(id);
    }
  }
  return counts;
}

export function activeFilterCount(f: Filters): number {
  const facetValues = FACETS.reduce((n, facet) => n + f[facet].length, 0);
  const query = f.query.trim() === "" ? 0 : 1;
  const toggles = (f.onlyFavourites ? 1 : 0) + (f.hideAllDay ? 1 : 0);
  return facetValues + query + toggles;
}

/** Canonical cyfrowe-event-zapisy term names (spec §4.2), used when the data lacks the term. */
const SIGNUP_TERM_NAMES: Record<Exclude<SignupStatus, "unknown">, string> = {
  open: "Zapisy",
  full: "Brak miejsc",
  included: "W ramach festiwalu",
  free: "WSTĘP WOLNY",
  soon: "Zapisy wkrótce",
};

const UNKNOWN_SIGNUP_LABEL = "Brak informacji";

export function signupLabel(status: SignupStatus, data: ScheduleData): string {
  if (status === "unknown") return UNKNOWN_SIGNUP_LABEL;
  const canonical = SIGNUP_TERM_NAMES[status];
  const term = data.signupStatuses.find((t) => t.name === canonical);
  return term?.name ?? canonical;
}
