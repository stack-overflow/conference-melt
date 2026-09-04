import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { EMPTY_FILTERS } from "../domain/filters";
import { defaultSettings, useStore } from "../state/store";
import { FilterChips } from "../components/shell/FilterChips";
import { makeData, makeSession } from "./fixtures/build";
import { GridHarness, renderGrid } from "./gridHarness";

const STRIP_ONLY_EMPTY = "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej";

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
const talk = makeSession({ id: "1:pt", eventId: 1, title: "Wykład", start: 600, end: 660 });
const noTime = makeSession({ id: "4:pt", eventId: 4, title: "Bez godziny sesja", start: null, end: null });
const data = makeData([zone, talk, noTime]);

// Two lectures (type 184, Prelekcja) and one workshop (type 5, Warsztaty) for the filter-chip round trip.
const second = makeSession({ id: "3:pt", eventId: 3, title: "Drugi wykład", start: 720, end: 780 });
const workshop = makeSession({ id: "2:pt", eventId: 2, title: "Warsztat", start: 660, end: 720, typeIds: [5] });
const chipData = makeData([talk, second, workshop, noTime]);

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(1024),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
});

describe("Strips", () => {
  it("with the location facet on Rejestracja renders one chip, the strip-only empty state and no scroll container", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [318] } });
    renderGrid(data);
    const strip = screen.getByRole("group", { name: "Całodniowe (1)" });
    expect(within(strip).getAllByRole("article")).toHaveLength(1);
    expect(within(strip).getByRole("button", { name: "Rejestracja, 09:00–18:00, Rejestracja" })).not.toBeNull();
    expect(within(strip).getByRole("button", { name: "Do planu" })).not.toBeNull();
    expect(screen.queryByRole("group", { name: /Bez godziny/ })).toBeNull();
    expect(screen.getByText(STRIP_ONLY_EMPTY)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Pokaż w siatce" })).not.toBeNull();
    expect(document.querySelector("[data-scroll-container]")).toBeNull();
  });

  it("with the all-day strip off renders one column holding that card and no strip", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [318] } });
    renderGrid(data);
    act(() => useStore.getState().setSettings({ allDayStrip: false }));
    expect(screen.queryByRole("group", { name: /Całodniowe/ })).toBeNull();
    expect(screen.queryByText(STRIP_ONLY_EMPTY)).toBeNull();
    const headers = document.querySelectorAll("[data-column-header]");
    expect(headers).toHaveLength(1);
    expect(headers[0]?.textContent).toContain("Rejestracja");
    expect(document.querySelector('[data-scroll-container] article[data-session-id="30:pt"]')).not.toBeNull();
  });

  it("renders the Bez godziny strip after the all-day strip, both outside the scroll container", () => {
    renderGrid(data);
    const allDay = screen.getByRole("group", { name: "Całodniowe (1)" });
    const none = screen.getByRole("group", { name: "Bez godziny (1)" });
    expect(within(none).getByRole("button", { name: "Bez godziny sesja, Sala wykł. 1" })).not.toBeNull();
    expect(allDay.compareDocumentPosition(none) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const scroller = document.querySelector('[data-scroll-container="timeline"]');
    const strips = document.querySelector("[data-strips]");
    expect(scroller).not.toBeNull();
    expect(strips).not.toBeNull();
    expect((scroller as Element).querySelector("[data-strips]")).toBeNull();
    expect((strips as Element).compareDocumentPosition(scroller as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((scroller as Element).querySelectorAll("article")).toHaveLength(1);
  });

  it("renders no strips when nothing sits in them", () => {
    // noTime shares talk's default location (233) in the shared fixture, so filtering the
    // shared `data` by that location would still pull it into the Bez godziny strip. Give
    // this test its own copy at a different location so only talk is left visible.
    const elsewhere = makeSession({ id: "4:pt", eventId: 4, title: "Bez godziny sesja", start: null, end: null, locationIds: [281] });
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [233] } });
    renderGrid(makeData([zone, talk, elsewhere]));
    expect(document.querySelector("[data-strips]")).toBeNull();
    expect(document.querySelector('[data-scroll-container="timeline"]')).not.toBeNull();
  });

  it("chip stars toggle favourites", async () => {
    const user = userEvent.setup();
    renderGrid(data);
    const none = screen.getByRole("group", { name: "Bez godziny (1)" });
    await user.click(within(none).getByRole("button", { name: "Do planu" }));
    expect(useStore.getState().favourites).toEqual(["4:pt"]);
    expect(within(none).getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("hides chip stars during a shared-plan preview", () => {
    useStore.setState({ previewPlan: ["4:pt"] });
    renderGrid(data);
    expect(within(document.querySelector("[data-strips]") as HTMLElement).queryByRole("button", { name: "Do planu" })).toBeNull();
  });

  it("keeps the now line reachable for the live chip", () => {
    renderGrid(data);
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.id).toBe("now-line");
    expect(line?.closest("[data-scroll-container]")).not.toBeNull();
  });

  it("removing a filter chip restores the sessions", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [5] } });
    render(
      <DataProvider value={buildAppData(chipData)}>
        <FilterChips />
        <GridHarness />
      </DataProvider>,
    );
    const cardIds = () =>
      [...document.querySelectorAll("[data-scroll-container] article[data-session-id]")]
        .map((el) => el.getAttribute("data-session-id"))
        .sort();
    expect(cardIds()).toEqual(["2:pt"]);
    await user.click(screen.getByRole("button", { name: "Usuń filtr: Warsztaty" }));
    expect(useStore.getState().filters.types).toEqual([]);
    expect(screen.queryByRole("button", { name: "Usuń filtr: Warsztaty" })).toBeNull();
    expect(cardIds()).toEqual(["1:pt", "2:pt", "3:pt"]);
  });
});
