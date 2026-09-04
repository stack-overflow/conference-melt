import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { makeData, makeSession } from "./fixtures/build";
import { DataProvider, buildAppData } from "../data/index";
import { useStore, defaultSettings } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { DayTabs } from "../components/shell/DayTabs";
import { ViewSwitcher } from "../components/shell/ViewSwitcher";
import { BottomBar } from "../components/shell/BottomBar";
import { LiveChip } from "../components/shell/LiveChip";
import { ShareBanner } from "../components/shell/ShareBanner";
import { FilterChips } from "../components/shell/FilterChips";
import { Toasts } from "../components/shell/Toasts";
import App from "../App";

const fixture = makeData([
  makeSession({ id: "1:pt", eventId: 1, day: "pt", title: "Światło w studiu", start: 600, end: 660 }),
  makeSession({ id: "2:pt", eventId: 2, day: "pt", title: "Krótka sesja", start: 630, end: 640 }),
  makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Otwarcie strefy", start: 650, end: null }),
  makeSession({ id: "4:pt", eventId: 4, day: "pt", title: "Później", start: 660, end: 720 }),
  makeSession({ id: "5:sob", eventId: 5, day: "sob", title: "Sobota rano", start: 540, end: 600 }),
  makeSession({ id: "6:sob", eventId: 6, day: "sob", title: "Sobota później", start: 600, end: 660 }),
  makeSession({ id: "7:czw", eventId: 7, day: "czw", title: "Czwartek", start: 1080, end: 1140 }),
]);
const appData = buildAppData(fixture);

/** Every component under test reads the schedule through `useData()`, so the tree is always mounted inside the provider. */
function renderWithData(ui: ReactNode) {
  return render(<DataProvider value={appData}>{ui}</DataProvider>);
}

function resetStore(day = "pt"): void {
  localStorage.clear();
  useStore.setState({
    day,
    view: "grid",
    filters: EMPTY_FILTERS,
    settings: defaultSettings(1280),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    toasts: [],
    copyText: null,
    now: new Date(2026, 8, 4, 10, 42),
  });
}

function dayLabel(id: string): string {
  const day = fixture.days.find((d) => d.id === id);
  if (!day) throw new Error(`Brak dnia ${id} w fixture`);
  return day.label;
}

beforeEach(() => {
  resetStore();
});

describe("DayTabs", () => {
  it("selects the store day and moves selection with arrow keys, wrapping around", async () => {
    const user = userEvent.setup();
    renderWithData(<DayTabs />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(fixture.days.length);
    const friday = screen.getByRole("tab", { name: new RegExp(dayLabel("pt")) });
    const saturday = screen.getByRole("tab", { name: new RegExp(dayLabel("sob")) });
    const thursday = screen.getByRole("tab", { name: new RegExp(dayLabel("czw")) });
    expect(friday.getAttribute("aria-selected")).toBe("true");
    expect(friday.tabIndex).toBe(0);
    expect(saturday.tabIndex).toBe(-1);

    friday.focus();
    await user.keyboard("{ArrowRight}");
    expect(useStore.getState().day).toBe("sob");
    expect(document.activeElement).toBe(saturday);
    expect(saturday.getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{ArrowRight}");
    expect(useStore.getState().day).toBe("czw");
    expect(document.activeElement).toBe(thursday);

    await user.keyboard("{End}");
    expect(useStore.getState().day).toBe("sob");
    await user.keyboard("{Home}");
    expect(useStore.getState().day).toBe("czw");
  });

  it("switches the day on click", async () => {
    const user = userEvent.setup();
    renderWithData(<DayTabs />);
    await user.click(screen.getByRole("tab", { name: new RegExp(dayLabel("sob")) }));
    expect(useStore.getState().day).toBe("sob");
  });
});

describe("ViewSwitcher", () => {
  it("hides the plan badge at zero and shows the favourite count otherwise", () => {
    const { rerender } = renderWithData(<ViewSwitcher />);
    const plan = screen.getByRole("button", { name: /Mój plan/ });
    expect(within(plan).queryByText(/^\d+$/)).toBeNull();
    useStore.setState({ favourites: ["1:pt", "5:sob"] });
    rerender(
      <DataProvider value={appData}>
        <ViewSwitcher />
      </DataProvider>,
    );
    expect(within(screen.getByRole("button", { name: /Mój plan/ })).getByText("2")).not.toBeNull();
  });

  it("marks the current view and switches on click", async () => {
    const user = userEvent.setup();
    renderWithData(<ViewSwitcher />);
    expect(screen.getByRole("button", { name: "Siatka" }).getAttribute("aria-current")).toBe("page");
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(useStore.getState().view).toBe("list");
  });
});

describe("BottomBar", () => {
  it("shows the plan badge, the active filter count and opens the filters sheet", async () => {
    const user = userEvent.setup();
    useStore.setState({ favourites: ["1:pt", "2:pt", "5:sob"], filters: { ...EMPTY_FILTERS, query: "sob" } });
    renderWithData(<BottomBar />);
    expect(within(screen.getByRole("button", { name: /Mój plan/ })).getByText("3")).not.toBeNull();
    const filters = screen.getByRole("button", { name: /Filtry/ });
    expect(within(filters).getByText("1")).not.toBeNull();
    await user.click(filters);
    expect(useStore.getState().openSheet).toBe("filters");
  });
});

describe("LiveChip", () => {
  it("shows Teraz with the live count when the selected day is today", () => {
    renderWithData(<LiveChip />);
    expect(screen.getByRole("button", { name: "Teraz 10:42 · trwa 1" })).not.toBeNull();
  });

  it("shows Jutro od with the earliest start when the selected day is tomorrow", () => {
    resetStore("sob");
    renderWithData(<LiveChip />);
    expect(screen.getByText("Jutro od 09:00")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing for other days", () => {
    resetStore("czw");
    const { container } = renderWithData(<LiveChip />);
    expect(container.textContent).toBe("");
  });

  it("scrolls to the now line in grid view when clicked", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    renderWithData(
      <>
        <div
          data-now-line=""
          ref={(el) => {
            if (el) el.scrollIntoView = scrollIntoView;
          }}
        />
        <LiveChip />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Teraz 10:42 · trwa 1" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe("ShareBanner", () => {
  it("offers load and preview and reports unknown ids", async () => {
    const user = userEvent.setup();
    useStore.setState({ sharedPlan: { ids: ["1:pt", "5:sob"], unknown: 1 } });
    renderWithData(<ShareBanner />);
    expect(screen.getByText("Ktoś udostępnił Ci plan: 2 wydarzenia")).not.toBeNull();
    expect(screen.getByText(/1 nie pasuje do tej wersji harmonogramu/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Wczytaj" }));
    expect(new Set(useStore.getState().favourites)).toEqual(new Set(["1:pt", "5:sob"]));
    expect(useStore.getState().sharedPlan).toBeNull();
  });

  it("preview sets previewPlan, opens the plan view and leaves favourites alone", async () => {
    const user = userEvent.setup();
    useStore.setState({ sharedPlan: { ids: ["1:pt", "5:sob"], unknown: 0 } });
    renderWithData(<ShareBanner />);
    expect(screen.queryByText(/nie pasuje do tej wersji/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tylko podgląd" }));
    expect(useStore.getState().previewPlan).toEqual(["1:pt", "5:sob"]);
    expect(useStore.getState().view).toBe("plan");
    expect(useStore.getState().favourites).toEqual([]);
    expect(useStore.getState().sharedPlan).toBeNull();
  });

  it("with no usable ids explains the mismatch and only offers close", async () => {
    const user = userEvent.setup();
    useStore.setState({ sharedPlan: { ids: [], unknown: 3 } });
    renderWithData(<ShareBanner />);
    expect(screen.queryByRole("button", { name: "Wczytaj" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tylko podgląd" })).toBeNull();
    expect(screen.getByText(/nie pasuje/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(useStore.getState().sharedPlan).toBeNull();
  });

  it("renders nothing without a shared plan", () => {
    const { container } = renderWithData(<ShareBanner />);
    expect(container.textContent).toBe("");
  });
});

describe("FilterChips", () => {
  it("lists active filters as removable chips and clears everything", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [184], query: "abc", onlyFavourites: true } });
    renderWithData(<FilterChips />);
    expect(screen.getByText("Tylko ulubione")).not.toBeNull();
    expect(screen.getByText("Szukaj: „abc”")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Usuń filtr: Prelekcja" }));
    expect(useStore.getState().filters.types).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Wyczyść wszystko" }));
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
  });

  it("renders nothing when no filter is active", () => {
    const { container } = renderWithData(<FilterChips />);
    expect(container.textContent).toBe("");
  });
});

describe("Toasts", () => {
  it("shows one toast at a time and runs its action", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    renderWithData(<Toasts />);
    act(() => {
      useStore.getState().pushToast("Usunięto z planu: Sesja", { label: "Cofnij", run });
      useStore.getState().pushToast("Drugi komunikat");
    });
    expect(await screen.findByText("Usunięto z planu: Sesja")).not.toBeNull();
    expect(screen.queryByText("Drugi komunikat")).toBeNull();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Drugi komunikat")).not.toBeNull();
    expect(screen.queryByText("Usunięto z planu: Sesja")).toBeNull();
  });
});

describe("App", () => {
  it("renders the shell with the mark, the tabs, the main area and the print section", () => {
    renderWithData(<App />);
    expect(screen.getByText("ŚwiatłoSiła 2026")).not.toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(fixture.days.length);
    expect(screen.getByRole("main")).not.toBeNull();
    expect(document.querySelector(".print-plan")).not.toBeNull();
  });
});
