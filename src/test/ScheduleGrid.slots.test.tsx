import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, within } from "@testing-library/react";
import type { ScheduleData } from "../data/types";
import { EMPTY_FILTERS } from "../domain/filters";
import { defaultSettings, useStore, type Settings } from "../state/store";
import friLecturesJson from "./fixtures/fri-lectures.json";
import { makeData, makeSession } from "./fixtures/build";
import { nestingWarnings, renderGrid } from "./gridHarness";

const friLectures = friLecturesJson as unknown as ScheduleData;

// The spec §10 synthetic case lives on Saturday; the real Friday lectures share the data set.
const synthetic = [
  makeSession({ id: "1:sob", eventId: 1, day: "sob", title: "A", start: 570, end: 645, locationIds: [] }),
  makeSession({ id: "2:sob", eventId: 2, day: "sob", title: "B", start: 615, end: 690, locationIds: [] }),
  makeSession({ id: "3:sob", eventId: 3, day: "sob", title: "C", start: 660, end: 735, locationIds: [] }),
];
const data = makeData([...synthetic, ...friLectures.sessions], {
  types: friLectures.types,
  locations: friLectures.locations,
});

function slotSettings(patch: Partial<Settings>): Settings {
  return { ...defaultSettings(1024), timeMode: "slots", slotTolerance: 15, columnAxis: "none", ...patch };
}

function resetStore(day: string, settings: Settings): void {
  useStore.setState({
    day,
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings,
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

function cell(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-cell="${key}"]`);
  if (!el) throw new Error(`missing cell wrapper ${key}`);
  return el;
}

function parseRow(gridRow: string): { row: number; span: number } {
  const match = /^(\d+)(?:\s*\/\s*span\s+(\d+))?$/.exec(gridRow.trim());
  if (!match) throw new Error(`unexpected grid-row: ${gridRow}`);
  return { row: Number(match[1]), span: match[2] === undefined ? 1 : Number(match[2]) };
}

function items(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-cell], [data-span]")];
}

/** Every wrapper and spanning item expanded to its (column, row) cells; no cell may be covered twice. */
function expectDisjoint(): void {
  const covered: string[] = [];
  for (const item of items()) {
    const column = Number.parseInt(item.style.gridColumn, 10);
    const { row, span } = parseRow(item.style.gridRow);
    expect(Number.isFinite(column)).toBe(true);
    for (let r = row; r < row + span; r += 1) covered.push(`${column}:${r}`);
  }
  expect(covered.length).toBeGreaterThan(0);
  expect(new Set(covered).size).toBe(covered.length);
}

/** Every session id appears at most once per column as a card. */
function expectOneCardPerColumn(): void {
  const perColumn = new Map<string, string[]>();
  for (const item of items()) {
    const ids = [...item.querySelectorAll("article[data-session-id]")].map((el) => el.getAttribute("data-session-id") ?? "");
    perColumn.set(item.style.gridColumn, [...(perColumn.get(item.style.gridColumn) ?? []), ...ids]);
  }
  for (const ids of perColumn.values()) expect(new Set(ids).size).toBe(ids.length);
}

/** Spec §7.3: wrappers and spanning items sit in DOM order by (column, row), so Tab order follows start time. */
function expectDomOrderFollowsRows(): void {
  const order = items().map((item) => ({
    column: Number.parseInt(item.style.gridColumn, 10),
    row: parseRow(item.style.gridRow).row,
  }));
  const sorted = [...order].sort((a, b) => a.column - b.column || a.row - b.row);
  expect(order).toEqual(sorted);
}

describe("forced slot mode on the synthetic spec §10 set", () => {
  beforeEach(() => resetStore("sob", slotSettings({})));

  it("renders the slot grid with rail rows 09:30, 10:15 and 11:00", () => {
    renderGrid(data);
    expect(document.querySelectorAll("[data-scroll-container]")).toHaveLength(1);
    expect(document.querySelector('[data-scroll-container="slots"]')).not.toBeNull();
    const rows = [...document.querySelectorAll<HTMLElement>("[data-slot-row]")];
    expect(rows.map((r) => r.style.gridRow)).toEqual(["2", "3", "4"]);
    expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual(["09:30", "10:15", "11:00"]);
    expect(rows.map((r) => r.children.length)).toEqual([1, 1, 1]);
  });

  it("declares the header row and the minimum slot row height on the grid", () => {
    renderGrid(data);
    const grid = document.querySelector<HTMLElement>('[data-scroll-container="slots"]');
    expect(grid?.style.gridTemplateRows).toBe("auto");
    expect(grid?.style.gridAutoRows).toBe("minmax(88px, auto)");
  });

  it("confines the first two sessions with one stub each and gives the third a bare card", () => {
    renderGrid(data);
    expect(cell("0:0").querySelectorAll('article[data-session-id="1:sob"]')).toHaveLength(1);
    expect(cell("0:1").querySelectorAll('[data-stub][data-session-id="1:sob"][aria-hidden="true"]')).toHaveLength(1);
    expect(cell("0:1").querySelectorAll('article[data-session-id="2:sob"]')).toHaveLength(1);
    expect(cell("0:2").querySelectorAll('[data-stub][data-session-id="2:sob"][aria-hidden="true"]')).toHaveLength(1);
    expect(cell("0:2").querySelectorAll('article[data-session-id="3:sob"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-stub][data-session-id="3:sob"]')).toHaveLength(0);
    expect(document.querySelectorAll("[data-span]")).toHaveLength(0);
    expect(cell("0:1").style.gridColumn).toBe("2");
    expect(cell("0:1").style.gridRow).toBe("3");
  });

  it("lists stubs before cards, never repeats a session inside one wrapper and covers each cell once", () => {
    renderGrid(data);
    const wrappers = [...document.querySelectorAll<HTMLElement>("[data-cell]")];
    expect(wrappers).toHaveLength(3);
    for (const wrapper of wrappers) {
      const kinds = [...wrapper.children].map((el) =>
        el.hasAttribute("data-stub") ? "stub" : el.tagName === "ARTICLE" ? "card" : "other",
      );
      const firstCard = kinds.indexOf("card");
      const lastStub = kinds.lastIndexOf("stub");
      if (firstCard >= 0 && lastStub >= 0) expect(lastStub).toBeLessThan(firstCard);
      const ids = [...wrapper.querySelectorAll("[data-session-id]")].map((el) => el.getAttribute("data-session-id"));
      expect(new Set(ids).size).toBe(ids.length);
    }
    expectDomOrderFollowsRows();
    expectDisjoint();
    expectOneCardPerColumn();
  });

  it("marks the slot containing now with a column-spanning line and a chip in that rail cell", () => {
    useStore.setState({ now: new Date(2026, 8, 5, 10, 20) });
    renderGrid(data);
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.id).toBe("now-line");
    expect(line?.style.gridColumn.replace(/\s+/g, " ")).toBe("1 / -1");
    expect(line?.style.gridRow).toBe("3");
    const railCell = document.querySelector<HTMLElement>('[data-slot-row="1"]');
    expect(railCell).not.toBeNull();
    expect(within(railCell as HTMLElement).getByText("10:20")).not.toBeNull();
    act(() => useStore.getState().setNow(new Date(2026, 8, 5, 12, 30)));
    expect(document.querySelector("[data-now-line]")).toBeNull();
  });
});

describe("forced slot mode on the Friday lectures fixture", () => {
  beforeEach(() => resetStore("pt", slotSettings({ columnAxis: "type" })));

  it("has 13 rail rows with 13:20 at row 3 and a 13:40–13:50 range at row 4", () => {
    renderGrid(data);
    const rows = [...document.querySelectorAll<HTMLElement>("[data-slot-row]")];
    expect(rows).toHaveLength(13);
    expect(rows[3]?.firstElementChild?.textContent).toBe("13:20");
    expect(rows[3]?.children).toHaveLength(1);
    expect(rows[4]?.firstElementChild?.textContent).toBe("13:40");
    expect(rows[4]?.children[1]?.textContent).toBe("13:40–13:50");
  });

  it("confines the 13:20–14:20 lecture under the type axis with a stub in the 13:40 row", () => {
    renderGrid(data);
    const card = document.querySelector('[data-cell] article[data-session-id="39564:pt"]');
    expect(card?.closest("[data-cell]")?.getAttribute("data-cell")).toBe("0:3");
    expect(cell("0:4").querySelectorAll('[data-stub][data-session-id="39564:pt"]')).toHaveLength(1);
    expect(document.querySelector('[data-span="39564:pt"]')).toBeNull();
    expectDisjoint();
    expectOneCardPerColumn();
  });

  it("spans it over two rows under the location axis and renders no stubs at all", () => {
    useStore.setState({ settings: slotSettings({ columnAxis: "location" }) });
    renderGrid(data);
    const span = document.querySelector<HTMLElement>('[data-span="39564:pt"]');
    expect(span).not.toBeNull();
    const spanItem = span as HTMLElement;
    expect(spanItem.style.gridRow.replace(/\s+/g, " ")).toBe("5 / span 2");
    expect(spanItem.querySelectorAll('article[data-session-id="39564:pt"]')).toHaveLength(1);
    expect(document.querySelectorAll("[data-stub]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-span]")).toHaveLength(9);
    // Spec §7.3: in its column the spanning item precedes every wrapper of a later row and follows every earlier one.
    const sameColumn = items().filter((el) => el !== spanItem && el.style.gridColumn === spanItem.style.gridColumn);
    for (const el of sameColumn) {
      const follows = (spanItem.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      expect(follows).toBe(parseRow(el.style.gridRow).row > 5);
    }
    expectDomOrderFollowsRows();
    expectDisjoint();
    expectOneCardPerColumn();
  });

  it("keeps the confinement and the stub when a query leaves only that card", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, query: "sportowa" } });
    renderGrid(data);
    expect(document.querySelectorAll("[data-scroll-container] article")).toHaveLength(1);
    expect(document.querySelectorAll("[data-column-header]")).toHaveLength(1);
    expect(cell("0:3").querySelectorAll('article[data-session-id="39564:pt"]')).toHaveLength(1);
    expect(cell("0:4").querySelectorAll('[data-stub][data-session-id="39564:pt"]')).toHaveLength(1);
    expect(document.querySelector("[data-span]")).toBeNull();
    expect(document.querySelectorAll("[data-slot-row]")).toHaveLength(13);
  });

  it("renders every fixture session exactly once as a card under the none axis", () => {
    useStore.setState({ settings: slotSettings({ columnAxis: "none" }) });
    renderGrid(data);
    const ids = [...document.querySelectorAll("[data-scroll-container] article[data-session-id]")].map((el) =>
      el.getAttribute("data-session-id"),
    );
    expect(ids).toHaveLength(27);
    expect(new Set(ids).size).toBe(27);
    expectDomOrderFollowsRows();
    expectDisjoint();
  });

  it("logs no DOM nesting warning while rendering the location-axis grid", () => {
    useStore.setState({ settings: slotSettings({ columnAxis: "location" }) });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      renderGrid(data);
      expect(document.querySelectorAll("[data-scroll-container] article").length).toBeGreaterThanOrEqual(27);
      expect(nestingWarnings(spy)).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
