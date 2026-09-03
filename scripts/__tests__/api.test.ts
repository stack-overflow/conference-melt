// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE, fetchAllPages, fetchJson, fetchRaw } from "../lib/api";

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

// Exact body the WordPress REST API returns for a page past the last one (observed on 2026-09-03).
const PAGE_OVERFLOW = {
  code: "rest_post_invalid_page_number",
  message: "Liczba żądanych stron jest większa niż liczba dostępnych stron.",
  data: { status: 400 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pageOf(url: string): number {
  return Number(new URL(url).searchParams.get("page") ?? "0");
}

function stubFetch(handler: (url: string) => Response) {
  const mock = vi.fn((...args: FetchArgs) => Promise.resolve(handler(String(args[0]))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("returns the parsed body and sends a browser-like User-Agent", async () => {
    const mock = stubFetch(() => json({ ok: true }));
    await expect(fetchJson<{ ok: boolean }>(`${BASE}/cyfrowe-event-day?per_page=100`)).resolves.toEqual({
      ok: true,
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      `${BASE}/cyfrowe-event-day?per_page=100`,
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("Mozilla/5.0") }),
      }),
    );
  });

  it("rejects on a non-2xx response", async () => {
    stubFetch(() => new Response("Service Unavailable", { status: 503 }));
    await expect(fetchJson(`${BASE}/cyfrowe-event`)).rejects.toThrow(/HTTP 503/);
  });
});

describe("fetchAllPages", () => {
  it("concatenates pages until the API reports rest_post_invalid_page_number", async () => {
    const mock = stubFetch((url) => {
      switch (pageOf(url)) {
        case 1:
          return json([{ id: 1 }, { id: 2 }]);
        case 2:
          return json([{ id: 3 }]);
        default:
          return json(PAGE_OVERFLOW, 400);
      }
    });
    const items = await fetchAllPages<{ id: number }>("/cyfrowe-event");
    expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(mock.mock.calls.map((call) => String(call[0]))).toEqual([
      `${BASE}/cyfrowe-event?per_page=100&page=1`,
      `${BASE}/cyfrowe-event?per_page=100&page=2`,
      `${BASE}/cyfrowe-event?per_page=100&page=3`,
    ]);
  });

  it("appends the paging parameters to an existing query string", async () => {
    const mock = stubFetch((url) => (pageOf(url) === 1 ? json([{ id: 7 }]) : json(PAGE_OVERFLOW, 400)));
    await fetchAllPages("/cyfrowe-prelegent?_embed=1");
    expect(String(mock.mock.calls[0]?.[0])).toBe(`${BASE}/cyfrowe-prelegent?_embed=1&per_page=100&page=1`);
  });

  it("stops on an empty page", async () => {
    const mock = stubFetch(() => json([]));
    await expect(fetchAllPages("/cyfrowe-event")).resolves.toEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("rethrows failures other than the page overflow", async () => {
    stubFetch((url) => (pageOf(url) === 1 ? json([{ id: 1 }]) : new Response("boom", { status: 500 })));
    await expect(fetchAllPages("/cyfrowe-event")).rejects.toThrow(/HTTP 500/);
  });
});

describe("fetchRaw", () => {
  it("fetches events, the seven taxonomies and embedded speakers", async () => {
    const mock = stubFetch((url) => {
      const { pathname } = new URL(url);
      if (pathname.endsWith("/cyfrowe-event")) {
        return pageOf(url) === 1 ? json([{ id: 100 }]) : json(PAGE_OVERFLOW, 400);
      }
      if (pathname.endsWith("/cyfrowe-prelegent")) {
        return pageOf(url) === 1 ? json([{ id: 200 }]) : json(PAGE_OVERFLOW, 400);
      }
      return json([{ id: 1, taxonomy: pathname.split("/").pop() }]);
    });
    const raw = await fetchRaw();
    expect(raw.events.map((event) => event.id)).toEqual([100]);
    expect(raw.speakers.map((speaker) => speaker.id)).toEqual([200]);
    expect(Object.keys(raw.terms).sort()).toEqual([
      "cyfrowe-event-brand",
      "cyfrowe-event-day",
      "cyfrowe-event-location",
      "cyfrowe-event-theme",
      "cyfrowe-event-type",
      "cyfrowe-event-zapisy",
      "cyfrowe-prelegent-type",
    ]);
    expect(raw.terms["cyfrowe-event-day"][0]?.taxonomy).toBe("cyfrowe-event-day");
    const urls = mock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain(`${BASE}/cyfrowe-prelegent-type?per_page=100`);
    expect(urls).toContain(`${BASE}/cyfrowe-prelegent?_embed=1&per_page=100&page=1`);
  });
});
