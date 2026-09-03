// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../domain/filters";
import {
  STORAGE_KEY,
  defaultSettings,
  defaultView,
  planSetOf,
  usePlanSet,
  useStore,
  type Settings,
} from "./store";

function resetStore() {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(window.innerWidth),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    toasts: [],
    copyText: null,
    storageFailed: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("defaults", () => {
  it("defaultSettings below 700 px uses a single column and zoom 1.6", () => {
    expect(defaultSettings(699)).toEqual({
      columnAxis: "none",
      timeMode: "auto",
      slotTolerance: 15,
      zoom: 1.6,
      density: "comfortable",
      colorBy: "type",
      showAvatars: true,
      allDayStrip: true,
      planLayout: "list",
      theme: "system",
    });
  });

  it("defaultSettings at 700 px and up uses the location axis and zoom 2", () => {
    expect(defaultSettings(700)).toEqual({
      columnAxis: "location",
      timeMode: "auto",
      slotTolerance: 15,
      zoom: 2,
      density: "comfortable",
      colorBy: "type",
      showAvatars: true,
      allDayStrip: true,
      planLayout: "list",
      theme: "system",
    });
  });

  it("defaultView is list below 700 px and grid otherwise", () => {
    expect(defaultView(699)).toBe("list");
    expect(defaultView(700)).toBe("grid");
    expect(defaultView(1440)).toBe("grid");
  });
});

describe("favourites", () => {
  it("toggleFavourite adds and removes an id without pushing a toast", () => {
    useStore.getState().toggleFavourite("1:pt");
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    useStore.getState().toggleFavourite("2:pt");
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
    useStore.getState().toggleFavourite("1:pt");
    expect(useStore.getState().favourites).toEqual(["2:pt"]);
    expect(useStore.getState().toasts).toEqual([]);
  });

  it("addFavourites unions in order and skips duplicates", () => {
    useStore.getState().addFavourites(["1:pt", "2:pt"]);
    useStore.getState().addFavourites(["2:pt", "3:sob", "1:pt"]);
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt", "3:sob"]);
  });

  it("removeFavourite drops one id and tolerates unknown ids", () => {
    useStore.getState().addFavourites(["1:pt", "2:pt"]);
    useStore.getState().removeFavourite("1:pt");
    useStore.getState().removeFavourite("nope");
    expect(useStore.getState().favourites).toEqual(["2:pt"]);
  });
});

describe("persistence", () => {
  it("persists favourites, settings and view under STORAGE_KEY with version 1 and nothing else", () => {
    useStore.getState().toggleFavourite("1:pt");
    useStore.getState().setSettings({ zoom: 2.4 });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "{}") as { state: Record<string, unknown>; version: number };
    expect(stored.version).toBe(1);
    expect(stored.state.favourites).toEqual(["1:pt"]);
    expect(stored.state.view).toBe("grid");
    expect((stored.state.settings as Settings).zoom).toBe(2.4);
    expect(Object.keys(stored.state).sort()).toEqual(["favourites", "settings", "view"]);
  });

  it("round-trips favourites through localStorage", async () => {
    useStore.getState().toggleFavourite("1:pt");
    useStore.getState().toggleFavourite("2:pt");
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    resetStore();
    expect(useStore.getState().favourites).toEqual([]);
    localStorage.setItem(STORAGE_KEY, raw);
    await useStore.persist.rehydrate();
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
  });

  it("merge fills settings missing from storage with the viewport defaults and never touches day", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { favourites: ["2:sob"], settings: { zoom: 3, theme: "dark" }, view: "list" },
        version: 1,
      }),
    );
    await useStore.persist.rehydrate();
    const s = useStore.getState();
    expect(s.favourites).toEqual(["2:sob"]);
    expect(s.view).toBe("list");
    expect(s.settings).toEqual({ ...defaultSettings(window.innerWidth), zoom: 3, theme: "dark" });
    expect(s.day).toBe("pt");
  });

  it("keeps working in memory and sets storageFailed when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => useStore.getState().toggleFavourite("1:pt")).not.toThrow();
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    expect(useStore.getState().storageFailed).toBe(true);
    expect(useStore.getState().toasts).toEqual([]);
  });
});

describe("filters", () => {
  it("setFilters patches, clearFacet empties one facet and clearFilters resets everything", () => {
    useStore.getState().setFilters({ types: [184], query: "foto", onlyFavourites: true });
    expect(useStore.getState().filters).toEqual({ ...EMPTY_FILTERS, types: [184], query: "foto", onlyFavourites: true });
    useStore.getState().clearFacet("types");
    expect(useStore.getState().filters.types).toEqual([]);
    expect(useStore.getState().filters.query).toBe("foto");
    useStore.getState().clearFilters();
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
  });

  it("toggleFacetValue adds and removes numeric ids and signup statuses", () => {
    useStore.getState().toggleFacetValue("locations", 233);
    useStore.getState().toggleFacetValue("locations", 281);
    expect(useStore.getState().filters.locations).toEqual([233, 281]);
    useStore.getState().toggleFacetValue("locations", 233);
    expect(useStore.getState().filters.locations).toEqual([281]);
    useStore.getState().toggleFacetValue("signup", "open");
    expect(useStore.getState().filters.signup).toEqual(["open"]);
    useStore.getState().toggleFacetValue("signup", "open");
    expect(useStore.getState().filters.signup).toEqual([]);
  });
});

describe("settings", () => {
  it("setSettings patches one field at a time", () => {
    useStore.getState().setSettings({ density: "compact" });
    expect(useStore.getState().settings.density).toBe("compact");
    expect(useStore.getState().settings.zoom).toBe(2);
  });

  it("resetSettings restores the viewport defaults but keeps theme and planLayout", () => {
    useStore.getState().setSettings({ zoom: 3.2, density: "compact", theme: "light", planLayout: "grid", columnAxis: "brand" });
    useStore.getState().resetSettings();
    expect(useStore.getState().settings).toEqual({ ...defaultSettings(window.innerWidth), theme: "light", planLayout: "grid" });
  });
});

describe("day, view and the hash", () => {
  it("setDay writes #d=<day>&v=<view>", () => {
    useStore.getState().setDay("sob");
    expect(useStore.getState().day).toBe("sob");
    expect(window.location.hash).toBe("#d=sob&v=grid");
  });

  it("setView writes the hash and clears previewPlan when leaving the plan view", () => {
    useStore.setState({ previewPlan: ["1:pt"], view: "plan" });
    useStore.getState().setView("plan");
    expect(useStore.getState().previewPlan).toEqual(["1:pt"]);
    useStore.getState().setView("list");
    expect(useStore.getState().previewPlan).toBeNull();
    expect(window.location.hash).toBe("#d=pt&v=list");
  });

  it("keeps the plan parameter verbatim while a shared plan is pending", () => {
    history.replaceState(null, "", "#d=pt&v=grid&plan=1~1p.2p");
    useStore.getState().setSharedPlan({ ids: ["1:pt", "2:pt"], unknown: 0 });
    useStore.getState().setDay("sob");
    expect(window.location.hash).toBe("#d=sob&v=grid&plan=1~1p.2p");
  });
});

describe("share flow", () => {
  it("previewSharedPlan sets previewPlan, switches to the plan view and clears sharedPlan without touching favourites", () => {
    useStore.setState({ favourites: ["1:pt"] });
    useStore.getState().setSharedPlan({ ids: ["2:pt", "1:pt"], unknown: 1 });
    useStore.getState().previewSharedPlan();
    const s = useStore.getState();
    expect(s.previewPlan).toEqual(["2:pt", "1:pt"]);
    expect(s.view).toBe("plan");
    expect(s.sharedPlan).toBeNull();
    expect(s.favourites).toEqual(["1:pt"]);
    expect(planSetOf(s)).toEqual(new Set(["2:pt", "1:pt"]));
    expect(window.location.hash).toBe("#d=pt&v=plan");
  });

  it("savePreview unions the preview into favourites and clears it", () => {
    useStore.setState({ favourites: ["1:pt"], previewPlan: ["2:pt", "1:pt"], view: "plan" });
    useStore.getState().savePreview();
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
    expect(useStore.getState().previewPlan).toBeNull();
  });

  it("closePreview clears the preview and leaves favourites alone", () => {
    useStore.setState({ favourites: ["1:pt"], previewPlan: ["2:pt"], view: "plan" });
    useStore.getState().closePreview();
    expect(useStore.getState().previewPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
  });

  it("loadSharedPlan unions the ids into favourites, clears sharedPlan and drops plan from the hash", () => {
    history.replaceState(null, "", "#d=pt&v=grid&plan=1~1p.2p");
    useStore.setState({ favourites: ["1:pt"] });
    useStore.getState().setSharedPlan({ ids: ["1:pt", "2:pt"], unknown: 0 });
    useStore.getState().loadSharedPlan();
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
    expect(useStore.getState().sharedPlan).toBeNull();
    expect(window.location.hash).toBe("#d=pt&v=grid");
  });

  it("dismissSharedPlan only clears sharedPlan and the plan parameter", () => {
    history.replaceState(null, "", "#d=pt&v=grid&plan=1~1p");
    useStore.getState().setSharedPlan({ ids: ["1:pt"], unknown: 0 });
    useStore.getState().dismissSharedPlan();
    expect(useStore.getState().sharedPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual([]);
    expect(useStore.getState().previewPlan).toBeNull();
    expect(window.location.hash).toBe("#d=pt&v=grid");
  });

  it("previewSharedPlan and loadSharedPlan are no-ops without a shared plan", () => {
    useStore.getState().previewSharedPlan();
    useStore.getState().loadSharedPlan();
    expect(useStore.getState().view).toBe("grid");
    expect(useStore.getState().previewPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual([]);
  });
});

describe("toasts", () => {
  it("pushToast appends toasts in order with increasing ids and no action by default", () => {
    useStore.getState().pushToast("Skopiowano link do planu");
    useStore.getState().pushToast("Usunięto z planu: Sesja");
    const [a, b] = useStore.getState().toasts;
    expect(useStore.getState().toasts.map((t) => t.text)).toEqual(["Skopiowano link do planu", "Usunięto z planu: Sesja"]);
    expect(a !== undefined && b !== undefined && b.id > a.id).toBe(true);
    expect(a).toEqual({ id: a?.id, text: "Skopiowano link do planu" });
  });

  it("keeps a toast with an action until dismissToast; the store starts no timer", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    useStore.getState().pushToast("Usunięto z planu: Sesja", { label: "Cofnij", run });
    const toast = useStore.getState().toasts[0];
    expect(toast?.action?.label).toBe("Cofnij");
    toast?.action?.run();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(useStore.getState().toasts).toHaveLength(1);
    useStore.getState().dismissToast(toast?.id ?? -1);
    expect(useStore.getState().toasts).toHaveLength(0);
  });

  it("dismissToast removes only the given toast and ignores unknown ids", () => {
    useStore.getState().pushToast("a");
    useStore.getState().pushToast("b");
    const [a] = useStore.getState().toasts;
    useStore.getState().dismissToast(a?.id ?? -1);
    expect(useStore.getState().toasts.map((t) => t.text)).toEqual(["b"]);
    useStore.getState().dismissToast(-1);
    expect(useStore.getState().toasts.map((t) => t.text)).toEqual(["b"]);
  });
});

describe("selection, sheets and misc", () => {
  it("selectSession opens the detail sheet and selecting null closes it", () => {
    useStore.getState().selectSession("1:pt");
    expect(useStore.getState()).toMatchObject({ selectedSessionId: "1:pt", openSheet: "detail" });
    useStore.getState().selectSession(null);
    expect(useStore.getState()).toMatchObject({ selectedSessionId: null, openSheet: null });
  });

  it("selectSession(null) leaves another open sheet alone", () => {
    useStore.getState().setSheet("filters");
    useStore.getState().selectSession(null);
    expect(useStore.getState().openSheet).toBe("filters");
  });

  it("setSheet, setCopyText and setNow write their fields", () => {
    useStore.getState().setSheet("copy");
    useStore.getState().setCopyText("tekst");
    const now = new Date(2026, 8, 4, 10, 30);
    useStore.getState().setNow(now);
    expect(useStore.getState()).toMatchObject({ openSheet: "copy", copyText: "tekst", now });
  });
});

describe("plan set", () => {
  it("planSetOf prefers previewPlan and is memoized on array identity", () => {
    useStore.setState({ favourites: ["1:pt"] });
    const first = planSetOf(useStore.getState());
    expect([...first]).toEqual(["1:pt"]);
    useStore.getState().setDay("sob");
    expect(planSetOf(useStore.getState())).toBe(first);
    useStore.setState({ previewPlan: ["9:sob"] });
    expect([...planSetOf(useStore.getState())]).toEqual(["9:sob"]);
  });

  it("usePlanSet follows favourites and previewPlan and keeps its identity across unrelated changes", () => {
    const { result } = renderHook(() => usePlanSet());
    expect(result.current.size).toBe(0);
    act(() => {
      useStore.getState().toggleFavourite("1:pt");
    });
    expect(result.current.has("1:pt")).toBe(true);
    const before = result.current;
    act(() => {
      useStore.getState().setDay("sob");
    });
    expect(result.current).toBe(before);
    act(() => {
      useStore.setState({ previewPlan: ["9:sob"] });
    });
    expect([...result.current]).toEqual(["9:sob"]);
  });
});

describe("storage failure at creation", () => {
  it("sets storageFailed when reading storage throws while the store is created", async () => {
    vi.resetModules();
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    try {
      const fresh = await import("./store");
      expect(fresh.useStore.getState().storageFailed).toBe(true);
      expect(fresh.useStore.getState().favourites).toEqual([]);
    } finally {
      spy.mockRestore();
      vi.resetModules();
    }
  });
});
