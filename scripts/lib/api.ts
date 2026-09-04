export interface WpRendered {
  rendered: string;
}

export interface WpEvent {
  id: number;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  "cyfrowe-event-type": number[];
  "cyfrowe-event-theme": number[];
  "cyfrowe-event-brand": number[];
  "cyfrowe-event-location": number[];
  "cyfrowe-event-day": number[];
  "cyfrowe-event-zapisy": number[];
}

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  count: number;
  taxonomy: string;
}

export interface WpMedia {
  source_url: string;
  media_details?: {
    sizes?: Record<string, { source_url: string; width: number; height: number }>;
  };
}

export interface WpSpeaker {
  id: number;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  featured_media: number;
  "cyfrowe-prelegent-type": number[];
  _embedded?: { "wp:featuredmedia"?: WpMedia[] };
}

export type TaxonomyName =
  | "cyfrowe-event-type"
  | "cyfrowe-event-theme"
  | "cyfrowe-event-brand"
  | "cyfrowe-event-location"
  | "cyfrowe-event-day"
  | "cyfrowe-event-zapisy"
  | "cyfrowe-prelegent-type";

export interface RawData {
  events: WpEvent[];
  speakers: WpSpeaker[];
  terms: Record<TaxonomyName, WpTerm[]>;
}

export const BASE = "https://swiatlosila.pl/wp-json/wp/v2";

const TAXONOMIES: readonly TaxonomyName[] = [
  "cyfrowe-event-type",
  "cyfrowe-event-theme",
  "cyfrowe-event-brand",
  "cyfrowe-event-location",
  "cyfrowe-event-day",
  "cyfrowe-event-zapisy",
  "cyfrowe-prelegent-type",
];

const PER_PAGE = 100;
/** Internal: a stalled WP request aborts rather than hanging the fetch script forever. */
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_OVERFLOW_CODE = "rest_post_invalid_page_number";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Internal, used only here: a non-2xx response, carrying the WP error code when the body had one. */
class HttpError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(url: string, status: number, code: string | null) {
    super(`HTTP ${status}${code === null ? "" : ` (${code})`} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

async function wpErrorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && "code" in body && typeof body.code === "string") {
      return body.code;
    }
  } catch {
    // The body was not JSON; the status alone is reported.
  }
  return null;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(url, res.status, await wpErrorCode(res));
  return (await res.json()) as T;
}

export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${BASE}${path}${separator}per_page=${PER_PAGE}&page=${page}`;
    let batch: T[];
    try {
      batch = await fetchJson<T[]>(url);
    } catch (err) {
      if (err instanceof HttpError && err.code === PAGE_OVERFLOW_CODE) break;
      throw err;
    }
    items.push(...batch);
    if (batch.length === 0) break;
  }
  return items;
}

export async function fetchRaw(): Promise<RawData> {
  const events = await fetchAllPages<WpEvent>("/cyfrowe-event");
  const terms: Record<TaxonomyName, WpTerm[]> = {
    "cyfrowe-event-type": [],
    "cyfrowe-event-theme": [],
    "cyfrowe-event-brand": [],
    "cyfrowe-event-location": [],
    "cyfrowe-event-day": [],
    "cyfrowe-event-zapisy": [],
    "cyfrowe-prelegent-type": [],
  };
  for (const taxonomy of TAXONOMIES) {
    terms[taxonomy] = await fetchJson<WpTerm[]>(`${BASE}/${taxonomy}?per_page=${PER_PAGE}`);
  }
  const speakers = await fetchAllPages<WpSpeaker>("/cyfrowe-prelegent?_embed=1");
  return { events, speakers, terms };
}
