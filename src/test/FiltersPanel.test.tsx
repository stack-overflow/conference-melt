import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { FiltersPanel } from "../components/filters/FiltersPanel";
import { makeData, makeLocation, makeSession } from "./fixtures/build";

const locations = [
  makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 0 }),
  makeLocation({ id: 233, slug: "so-salsa-poziom-ii-sala-wykladowa-nr-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 2, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 1 }),
  makeLocation({ id: 281, slug: "sosalsa-poziom-ii-sala-wykladowa-nr-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 1, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 2 }),
  makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 3 }),
];
const types = [
  { id: 242, slug: "ogolne", name: "Ogólne", count: 1 },
  { id: 184, slug: "prelekcja", name: "Prelekcja", count: 2 },
  { id: 5, slug: "warsztaty", name: "Warsztaty", count: 1 },
];
const themes = [
  { id: 260, slug: "krajobraz", name: "Krajobraz", count: 1 },
  { id: 267, slug: "portret", name: "Portret", count: 2 },
];
const brands = [
  { id: 10, slug: "canon", name: "Canon", count: 1 },
  { id: 11, slug: "sony", name: "Sony", count: 1 },
];
const signupStatuses = [
  { id: 327, slug: "brak-miejsc", name: "Brak miejsc", count: 1 },
  { id: 194, slug: "w-ramach-festiwalu", name: "W ramach festiwalu", count: 3 },
  { id: 56, slug: "zapisy", name: "Zapisy", count: 0 },
];

const included = { status: "included" as const, url: null, label: "W ramach festiwalu" };
const s1 = makeSession({ id: "1:pt", eventId: 1, title: "Światło w portrecie", start: 570, end: 645, typeIds: [184], locationIds: [233], themeIds: [267], brandIds: [10], signup: included });
const s2 = makeSession({ id: "2:pt", eventId: 2, title: "Krajobraz nocą", start: 570, end: 645, typeIds: [184], locationIds: [281], themeIds: [260], brandIds: [11], signup: included });
const s3 = makeSession({
  id: "3:pt", eventId: 3, title: "Warsztaty Masterclass – Moda na błysk", start: 570, end: 960, typeIds: [5], locationIds: [233], themeIds: [267], brandIds: [],
  signup: { status: "full", url: "https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-moda-na-blysk-katarzyna-budziszyna-danaj-p.html", label: "Brak miejsc" },
});
const zone = makeSession({ id: "4:pt", eventId: 4, title: "Rejestracja", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318], themeIds: [], brandIds: [], signup: included });
const data = makeData([s1, s2, s3, zone], { locations, types, themes, brands, signupStatuses });

function renderPanel(variant: "sidebar" | "sheet" = "sidebar") {
  return render(
    <DataProvider value={buildAppData(data)}>
      <FiltersPanel variant={variant} />
    </DataProvider>,
  );
}

function countOf(checkbox: HTMLElement): string {
  const label = checkbox.closest("label") as HTMLElement;
  return (within(label).getByText(/^\d+$/) as HTMLElement).textContent ?? "";
}

function isDimmed(checkbox: HTMLElement): boolean {
  return (checkbox.closest("label") as HTMLElement).dataset.dimmed === "true";
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
  });
});

describe("FiltersPanel", () => {
  it("shows the facets in order with counts from facetCounts", () => {
    renderPanel();
    // Scoped to the <summary> title spans: the signup option label "Zapisy" would otherwise match as a sixth element.
    const titles = screen.getAllByText(/^(Typ|Miejsce|Tematyka|Marka|Zapisy)$/, { selector: "summary span" }).map((el) => el.textContent);
    expect(titles).toEqual(["Typ", "Miejsce", "Tematyka", "Marka", "Zapisy"]);
    expect(countOf(screen.getByLabelText("Prelekcja"))).toBe("2");
    expect(countOf(screen.getByLabelText("Warsztaty"))).toBe("1");
    expect(countOf(screen.getByLabelText("Ogólne"))).toBe("1");
    expect(countOf(screen.getByLabelText("Portret"))).toBe("2");
    expect(countOf(screen.getByLabelText("Sony"))).toBe("1");
  });

  it("dims zero-count options without hiding them once another facet narrows the results", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [233] } });
    renderPanel();
    const ogolne = screen.getByLabelText("Ogólne");
    expect(countOf(ogolne)).toBe("0");
    expect(isDimmed(ogolne)).toBe(true);
    expect((ogolne as HTMLInputElement).disabled).toBe(false);
    const prelekcja = screen.getByLabelText("Prelekcja");
    expect(countOf(prelekcja)).toBe("1");
    expect(isDimmed(prelekcja)).toBe(false);
  });

  it("counts a facet without applying that facet's own selection", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [5] } });
    renderPanel();
    expect(countOf(screen.getByLabelText("Prelekcja"))).toBe("2");
    expect(countOf(screen.getByLabelText("Warsztaty"))).toBe("1");
    expect(countOf(screen.getByLabelText("Sala wykładowa nr 1", { exact: false }))).toBe("1");
  });

  it("toggles a facet value in the store when its checkbox is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText("Prelekcja"));
    expect(useStore.getState().filters.types).toEqual([184]);
    expect((screen.getByLabelText("Prelekcja") as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByLabelText("Prelekcja"));
    expect(useStore.getState().filters.types).toEqual([]);
  });

  it("groups Miejsce by level with the level labels as sub-headers", () => {
    renderPanel();
    const headers = screen.getAllByText(/^(Poziom 0|Poziom I|Poziom I i II|Poziom II|Poziom III|Inne)$/).map((el) => el.textContent);
    expect(headers).toEqual(["Poziom I", "Poziom II", "Inne"]);
    expect(screen.getByLabelText("Stoiska wystawców · PLENUM")).toBeTruthy();
    expect(screen.getByLabelText("So Salsa · Sala wykładowa nr 1")).toBeTruthy();
    expect(screen.getByLabelText("SoSalsa · Sala wykładowa nr 2")).toBeTruthy();
    expect(screen.getByLabelText("Rejestracja")).toBeTruthy();
  });

  it("lists signup statuses by status value with the term labels and counts", () => {
    renderPanel();
    expect(countOf(screen.getByLabelText("Brak miejsc"))).toBe("1");
    expect(countOf(screen.getByLabelText("W ramach festiwalu"))).toBe("3");
    expect(countOf(screen.getByLabelText("Zapisy"))).toBe("0");
    expect(countOf(screen.getByLabelText("Brak informacji"))).toBe("0");
  });

  it("filters Tematyka options with the inline search, ignoring diacritics", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText("Szukaj: Tematyka"), "kraj");
    expect(screen.getByLabelText("Krajobraz")).toBeTruthy();
    expect(screen.queryByLabelText("Portret")).toBeNull();
  });

  it("clears one facet with its own button and everything with the global one", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [184], locations: [233], query: "abc" } });
    renderPanel();
    await user.click(screen.getByLabelText("Wyczyść: Typ"));
    expect(useStore.getState().filters.types).toEqual([]);
    expect(useStore.getState().filters.locations).toEqual([233]);
    expect(useStore.getState().filters.query).toBe("abc");
    await user.click(screen.getByLabelText("Wyczyść wszystkie filtry"));
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
  });

  it("writes the two toggles to the store", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText("Ukryj strefy całodniowe"));
    expect(useStore.getState().filters.hideAllDay).toBe(true);
    await user.click(screen.getByLabelText("Tylko ulubione"));
    expect(useStore.getState().filters.onlyFavourites).toBe(true);
  });

  it("restricts counts to the plan set in the plan view", () => {
    useStore.setState({ view: "plan", favourites: ["2:pt"] });
    renderPanel();
    expect(countOf(screen.getByLabelText("Prelekcja"))).toBe("1");
    expect(countOf(screen.getByLabelText("Warsztaty"))).toBe("0");
  });

  it("renders the sidebar as a labelled aside and the sheet variant without its own heading", () => {
    const sidebar = renderPanel("sidebar");
    expect(screen.getByRole("complementary", { name: "Filtry" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Filtry" })).toBeTruthy();
    sidebar.unmount();
    renderPanel("sheet");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Filtry" })).toBeNull();
    expect(screen.getByLabelText("Prelekcja")).toBeTruthy();
  });
});
