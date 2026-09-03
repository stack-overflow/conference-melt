import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_FILTERS } from "../domain/filters";
import { defaultSettings, useStore } from "../state/store";
import { makeData, makeSession } from "./fixtures/build";
import { nestingWarnings, renderGrid } from "./gridHarness";

const ZOOM = 2;
const LANE_MIN = 180;
const RANGE_START = 585; // roundDown(600, 30) - 15

const hour = makeSession({ id: "1:pt", eventId: 1, title: "Jedna godzina", start: 600, end: 660 });
const eight = Array.from({ length: 8 }, (_, i) =>
  makeSession({ id: `${10 + i}:pt`, eventId: 10 + i, title: `Równolegle ${i + 1}`, start: 660, end: 720 }),
);
const pair = [21, 22].map((id) => makeSession({ id: `${id}:pt`, eventId: id, title: `Para ${id}`, start: 840, end: 900 }));
const zone = makeSession({
  id: "30:pt",
  eventId: 30,
  title: "Rejestracja",
  start: 540,
  end: 1080,
  allDay: true,
  typeIds: [242],
  locationIds: [318],
});
const data = makeData([hour, ...eight, ...pair, zone]);

function card(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`article[data-session-id="${id}"]`);
  if (!el) throw new Error(`missing card ${id}`);
  return el;
}

function rail(): HTMLElement {
  const el = document.querySelector<HTMLElement>("[data-time-rail]");
  if (!el) throw new Error("missing time rail");
  return el;
}

/**
 * The CSSOM may canonicalise calc() on read-back (calc(100% / 8) can come back as calc(12.5%)),
 * so expectations go through the same round trip as the card's inline style.
 */
function cssValue(property: "width" | "left", value: string): string {
  const probe = document.createElement("div");
  probe.style[property] = value;
  if (probe.style[property] === "") throw new Error(`jsdom rejected ${property}: ${value}`);
  return probe.style[property];
}

function resetStore(): void {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    // the synthetic set is slot-distinguishable, so the timeline is forced here
    settings: { ...defaultSettings(1024), timeMode: "timeline", zoom: ZOOM },
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
}

function setAxis(axis: "location" | "none"): void {
  useStore.setState({ settings: { ...useStore.getState().settings, columnAxis: axis } });
}

const originalScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo");
let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetStore();
  scrollTo = vi.fn();
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, writable: true, value: scrollTo });
});

afterEach(() => {
  if (originalScrollTo) Object.defineProperty(Element.prototype, "scrollTo", originalScrollTo);
  else Reflect.deleteProperty(Element.prototype, "scrollTo");
});

describe("ScheduleGrid in timeline mode", () => {
  it("renders exactly one scroll container, in timeline mode", () => {
    renderGrid(data);
    expect(document.querySelectorAll("[data-scroll-container]")).toHaveLength(1);
    expect(document.querySelector('[data-scroll-container="timeline"]')).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gives a 60-minute card an inline height of 60 × zoom and a top measured from the range start", () => {
    renderGrid(data);
    expect(card("1:pt").style.height).toBe(`${60 * ZOOM}px`);
    expect(card("1:pt").style.top).toBe(`${(600 - RANGE_START) * ZOOM}px`);
    expect(card("1:pt").getAttribute("data-size")).toBe("md");
  });

  it("sizes an 8-lane column to 8 × laneMin and cards to a fraction of their own component", () => {
    setAxis("none");
    renderGrid(data);
    expect(document.querySelector<HTMLElement>('[data-column="all"]')?.style.minWidth).toBe(`${8 * LANE_MIN}px`);
    expect(document.querySelector<HTMLElement>('[data-column-header="all"]')?.style.minWidth).toBe(`${8 * LANE_MIN}px`);
    const eighth = cssValue("width", "calc(100% / 8)");
    for (const s of eight) expect(card(s.id).style.width).toBe(eighth);
    expect(new Set(eight.map((s) => card(s.id).style.left)).size).toBe(8);
    const half = cssValue("width", "calc(100% / 2)");
    for (const s of pair) expect(card(s.id).style.width).toBe(half);
    expect(card("1:pt").style.width).toBe(cssValue("width", "calc(100% / 1)"));
    expect(card("1:pt").style.left).toBe(cssValue("left", "calc(0 * 100% / 1)"));
  });

  it("never lets two cards in one column body share both a time span and a lane", () => {
    setAxis("none");
    renderGrid(data);
    const cards = [...document.querySelectorAll<HTMLElement>('[data-column="all"] > article')];
    expect(cards).toHaveLength(11);
    const boxes = cards.map((el) => {
      const top = Number.parseFloat(el.style.top);
      return { top, bottom: top + Number.parseFloat(el.style.height), left: el.style.left };
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a.bottom <= b.top || b.bottom <= a.top || a.left !== b.left).toBe(true);
      }
    }
  });

  it("keeps DOM order inside a column by start time", () => {
    setAxis("none");
    renderGrid(data);
    const ids = [...document.querySelectorAll('[data-column="all"] > article')].map((el) => el.getAttribute("data-session-id"));
    expect(ids[0]).toBe("1:pt");
    expect(ids.slice(-2)).toEqual(["21:pt", "22:pt"]);
  });

  it("logs no DOM nesting warning while rendering a column of many cards", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      setAxis("none");
      renderGrid(data);
      expect(document.querySelectorAll('[data-column="all"] > article')).toHaveLength(11);
      expect(nestingWarnings(spy)).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("labels every full hour on the rail and ticks the half hours", () => {
    renderGrid(data);
    for (const label of ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]) {
      expect(within(rail()).getByText(label)).not.toBeNull();
    }
    expect(within(rail()).queryByText("11:30")).toBeNull();
    expect(rail().style.height).toBe(`${(915 - RANGE_START) * ZOOM}px`);
  });

  it("draws the now line at the exact minute, exposes it to the live chip and scrolls to it once", () => {
    renderGrid(data);
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.id).toBe("now-line");
    expect(line?.style.top).toBe(`${(630 - RANGE_START) * ZOOM}px`);
    expect(within(rail()).getByText("10:30")).not.toBeNull();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: (630 - RANGE_START) * ZOOM, behavior: "auto" });
    act(() => useStore.getState().setNow(new Date(2026, 8, 4, 10, 31)));
    expect(document.querySelector<HTMLElement>("[data-now-line]")?.style.top).toBe(`${(631 - RANGE_START) * ZOOM}px`);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("renders no now line and does not scroll when the day is not today", () => {
    useStore.setState({ now: new Date(2026, 8, 5, 10, 30) });
    renderGrid(data);
    expect(document.querySelector("[data-now-line]")).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("shows the filter empty state with the active chips and clears them", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [5] } });
    renderGrid(data);
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.getByText("Warsztaty")).not.toBeNull();
    expect(document.querySelector("[data-scroll-container]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pokaż w siatce" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
    expect(document.querySelector('[data-scroll-container="timeline"]')).not.toBeNull();
  });

  it("shows the strip-only empty state and moves the zones into the grid on request", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [318] } });
    renderGrid(data);
    expect(
      screen.getByText("Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej"),
    ).not.toBeNull();
    expect(document.querySelector("[data-scroll-container]")).toBeNull();
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Pokaż w siatce" }));
    expect(useStore.getState().settings.allDayStrip).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelectorAll("[data-column-header]")).toHaveLength(1);
    expect(card("30:pt").style.height).toBe(`${(1080 - 540) * ZOOM}px`);
  });

  it("offers no buttons when nothing is filtered on an empty day", () => {
    useStore.setState({ day: "czw" });
    renderGrid(data);
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
