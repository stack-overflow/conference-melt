import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { makeData, makeSession } from "./fixtures/build";
import { DataProvider, buildAppData } from "../data/index";
import App from "../App";
import { PlanView } from "../components/plan/PlanView";
import { PrintPlan } from "../components/plan/PrintPlan";
import { useStore, defaultSettings, type State, type View } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { planSessions } from "../domain/plan";
import { planAsText, planLines } from "../domain/text";
import { buildShareUrl } from "../domain/share";

// Synthetic fixture, injected through DataProvider (the data module is never mocked).
// 2:pt (11:00–12:00) and 3:pt (11:15–12:15) overlap; 1:pt (10:00–11:00) touches 2:pt at 11:00 and does not overlap.
const fixture = makeData([
  makeSession({ id: "1:pt", eventId: 1, day: "pt", title: "Poranne światło", start: 600, end: 660, locationIds: [233] }),
  makeSession({ id: "2:pt", eventId: 2, day: "pt", title: "Światło, które widzisz", start: 660, end: 720, locationIds: [281] }),
  makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Świadomy reset", start: 675, end: 735, locationIds: [233] }),
  makeSession({ id: "4:sob", eventId: 4, day: "sob", title: "Sobotni warsztat", start: 660, end: 720, locationIds: [233] }),
  makeSession({ id: "5:pt", eventId: 5, day: "pt", title: "Spotkanie bez godziny", start: null, end: null, timeText: "" }),
]);
const appData = buildAppData(fixture);
const { data, index } = appData;

/** Every component under test reads the schedule through `useData()`, so the tree is always mounted inside the provider. */
function renderWithData(ui: ReactNode) {
  return render(<DataProvider value={appData}>{ui}</DataProvider>);
}

const FRI_10 = "1:pt";
const FRI_11 = "2:pt";
const FRI_11_15 = "3:pt";
const SAT_11 = "4:sob";
const NO_TIME = "5:pt";
const TITLE_FRI_11 = "Światło, które widzisz";
const TITLE_FRI_11_15 = "Świadomy reset";
const WARSZTATY = 5; // type id from makeData; none of the sessions above carries it
const SHARE_TOAST_FILE =
  "Skopiowano. Link zadziała tylko u osób z tym samym plikiem. Opublikuj aplikację w sieci, aby udostępniać plan";
const ICS_FILENAME = "swiatlosila-2026-plan.ics";

function labelLong(dayId: string): string {
  const day = data.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`Brak dnia ${dayId} w fixture`);
  return day.labelLong;
}

function reset(patch: Partial<State> = {}): void {
  localStorage.clear();
  useStore.setState({
    day: "pt",
    view: "plan",
    filters: EMPTY_FILTERS,
    settings: defaultSettings(1440),
    favourites: [],
    previewPlan: null,
    sharedPlan: null,
    selectedSessionId: null,
    openSheet: null,
    copyText: null,
    toasts: [],
    now: new Date(2026, 8, 4, 10, 30),
    ...patch,
  });
}

function stubClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
}

function lastToast() {
  const toasts = useStore.getState().toasts;
  return toasts[toasts.length - 1];
}

beforeEach(() => reset());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("PlanView empty states", () => {
  it("shows the empty-plan copy and switches to the grid from its button", async () => {
    const user = userEvent.setup();
    renderWithData(<PlanView />);
    expect(screen.getByText("Twój plan jest pusty")).not.toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Układ planu" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Przeglądaj harmonogram" }));
    expect(useStore.getState().view).toBe("grid");
  });

  it("uses the section 9 empty state with no chips and no clear button when the plan lives on another day", () => {
    reset({ favourites: [SAT_11] });
    renderWithData(<PlanView />);
    // No filter is active, so FilteredEmpty renders the title alone: no filter chips and no clear button.
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Wyczyść filtry" })).toBeNull();
    expect(screen.queryByText("Twój plan jest pusty")).toBeNull();
    expect(screen.getByText("Sob 1")).not.toBeNull();
  });

  it("offers Wyczyść filtry when a facet hides every plan session of the day", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_11], filters: { ...EMPTY_FILTERS, types: [WARSZTATY] } });
    renderWithData(<PlanView />);
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(useStore.getState().filters.types).toEqual([]);
    expect(screen.getAllByText(TITLE_FRI_11).length).toBeGreaterThan(0);
  });
});

describe("PlanSummary", () => {
  it("summarises counts per day, the conflict pill and the next session", () => {
    reset({ favourites: [FRI_10, FRI_11, FRI_11_15, SAT_11] });
    renderWithData(<PlanView />);
    expect(screen.getByText("Pt 3 · Sob 1")).not.toBeNull();
    expect(screen.getByText("1 konflikt")).not.toBeNull();
    expect(screen.getByText(`Następne: ${TITLE_FRI_11} za 30 min`)).not.toBeNull();
  });

  it("hides the conflict pill and the next-up text when they do not apply", () => {
    // Saturday 10:30: the only plan session is on Friday, so nothing is "next" today.
    reset({ favourites: [FRI_10], now: new Date(2026, 8, 5, 10, 30) });
    renderWithData(<PlanView />);
    expect(screen.getByText("Pt 1")).not.toBeNull();
    expect(screen.queryByText(/konflikt/)).toBeNull();
    expect(screen.queryByText(/^Następne:/)).toBeNull();
  });
});

describe("ConflictsPanel", () => {
  it("lists conflict pairs by day, removes a side with a toast and restores it with Cofnij", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_11, FRI_11_15] });
    renderWithData(<PlanView />);
    const panel = screen.getByRole("region", { name: "Konflikty w planie" });
    expect(within(panel).getByText(labelLong("pt"))).not.toBeNull();
    expect(within(panel).getByText(TITLE_FRI_11)).not.toBeNull();
    expect(within(panel).getByText(TITLE_FRI_11_15)).not.toBeNull();
    expect(within(panel).getByText("11:00–12:00")).not.toBeNull();
    expect(within(panel).getByText("11:15–12:15")).not.toBeNull();
    expect(within(panel).getByText("Sala wykł. 2")).not.toBeNull();
    expect(within(panel).getByText("Sala wykł. 1")).not.toBeNull();

    await user.click(within(panel).getByRole("button", { name: `Usuń z planu: ${TITLE_FRI_11_15}` }));
    expect(useStore.getState().favourites).toEqual([FRI_11]);
    expect(screen.queryByRole("region", { name: "Konflikty w planie" })).toBeNull();

    const toast = lastToast();
    expect(toast?.text).toBe(`Usunięto z planu: ${TITLE_FRI_11_15}`);
    expect(toast?.action?.label).toBe("Cofnij");
    act(() => {
      toast?.action?.run();
    });
    expect(new Set(useStore.getState().favourites)).toEqual(new Set([FRI_11, FRI_11_15]));
    expect(screen.getByRole("region", { name: "Konflikty w planie" })).not.toBeNull();
  });

  it("renders no panel when the plan has no overlapping pair", () => {
    reset({ favourites: [FRI_10, FRI_11] });
    renderWithData(<PlanView />);
    expect(screen.queryByRole("region", { name: "Konflikty w planie" })).toBeNull();
  });
});

describe("preview mode", () => {
  it("shows the preview header and hides membership controls while previewing", async () => {
    const user = userEvent.setup();
    reset({ favourites: [], previewPlan: [FRI_11, FRI_11_15] });
    renderWithData(<PlanView />);
    expect(screen.getByText("Podgląd udostępnionego planu · nie zapisano")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Konflikty w planie" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^Usuń z planu/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Udostępnij" })).toBeNull();
    expect(screen.getByRole("button", { name: "Kopiuj jako tekst" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Zamknij podgląd" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Zapisz jako mój plan" }));
    expect(useStore.getState().previewPlan).toBeNull();
    expect(new Set(useStore.getState().favourites)).toEqual(new Set([FRI_11, FRI_11_15]));
  });

  it("closes the preview without touching favourites", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_10], previewPlan: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Zamknij podgląd" }));
    expect(useStore.getState().previewPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual([FRI_10]);
  });
});

describe("plan layout", () => {
  it("switches between list and grid with the segmented toggle and keeps the card in both", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    expect(useStore.getState().settings.planLayout).toBe("list");
    expect(screen.getAllByText(TITLE_FRI_11).length).toBeGreaterThan(0);
    const group = screen.getByRole("radiogroup", { name: "Układ planu" });
    await user.click(within(group).getByRole("radio", { name: "Siatka" }));
    expect(useStore.getState().settings.planLayout).toBe("grid");
    expect(screen.getAllByText(TITLE_FRI_11).length).toBeGreaterThan(0);
    await user.click(within(group).getByRole("radio", { name: "Lista" }));
    expect(useStore.getState().settings.planLayout).toBe("list");
  });
});

describe("PlanActions", () => {
  const plan = () => planSessions(new Set(useStore.getState().favourites), data.sessions);

  it("renders the four actions in spec order", () => {
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    const group = screen.getByRole("group", { name: "Akcje planu" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Kopiuj jako tekst",
      "Udostępnij",
      "Pobierz .ics",
      "Drukuj",
    ]);
  });

  it("copies the plan as text and confirms with a toast", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Kopiuj jako tekst" }));
    await waitFor(() => expect(useStore.getState().toasts.map((t) => t.text)).toContain("Skopiowano plan jako tekst"));
    expect(writeText).toHaveBeenCalledWith(planAsText(plan(), data, index));
    expect(useStore.getState().openSheet).toBeNull();
  });

  it("falls back to the manual copy sheet when the clipboard is unavailable", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs a working clipboard stub; drop it so copyText() resolves false.
    // afterEach deletes the property again, which removes this override as well.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Kopiuj jako tekst" }));
    await waitFor(() => expect(useStore.getState().openSheet).toBe("copy"));
    expect(useStore.getState().copyText).toBe(planAsText(plan(), data, index));
    expect(useStore.getState().toasts).toEqual([]);
  });

  it("copies the share link and pushes the file: warning when the app runs from disk", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    vi.stubGlobal("location", { href: "file:///Users/tom/dist/index.html", protocol: "file:" });
    reset({ favourites: [FRI_11, SAT_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Udostępnij" }));
    await waitFor(() => expect(useStore.getState().toasts.map((t) => t.text)).toContain(SHARE_TOAST_FILE));
    expect(writeText).toHaveBeenCalledWith(buildShareUrl("file:///Users/tom/dist/index.html", "pt", [FRI_11, SAT_11]));
  });

  it("copies a plain share link under https, dropping the query and keeping every day of the plan", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    vi.stubGlobal("location", { href: "https://example.org/plan/?now=2026-09-04T10:30#d=pt&v=grid", protocol: "https:" });
    reset({ favourites: [FRI_11, SAT_11], day: "sob" });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Udostępnij" }));
    await waitFor(() => expect(useStore.getState().toasts.map((t) => t.text)).toContain("Skopiowano link do planu"));
    const url = writeText.mock.calls[0]?.[0] ?? "";
    expect(url.startsWith("https://example.org/plan/#d=sob&v=plan&plan=1~")).toBe(true);
    expect(url).not.toContain("now=");
    expect(url).toBe(buildShareUrl("https://example.org/plan/?now=2026-09-04T10:30#d=pt&v=grid", "sob", [FRI_11, SAT_11]));
  });

  it("downloads the .ics through a temporary anchor named swiatlosila-2026-plan.ics", async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:plan";
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download}|${this.getAttribute("href")}`);
    });

    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Pobierz .ics" }));

    expect(created).toHaveLength(1);
    expect(created[0]?.type).toBe("text/calendar;charset=utf-8");
    expect(created[0]?.size).toBeGreaterThan(0);
    expect(downloads).toEqual([`${ICS_FILENAME}|blob:plan`]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:plan");
    expect(document.body.querySelector(`a[download="${ICS_FILENAME}"]`)).toBeNull();
  });

  it("calls window.print for Drukuj", async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    Object.defineProperty(window, "print", { value: print, configurable: true, writable: true });
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Drukuj" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe("PrintPlan", () => {
  const printSection = (): HTMLElement | null => document.body.querySelector("section.print-plan");

  it("is rendered by App in the grid view, the list view and both plan layouts", () => {
    const cases: { view: View; planLayout: "grid" | "list" }[] = [
      { view: "grid", planLayout: "list" },
      { view: "list", planLayout: "list" },
      { view: "plan", planLayout: "grid" },
      { view: "plan", planLayout: "list" },
    ];
    for (const c of cases) {
      reset({ view: c.view, favourites: [FRI_10], settings: { ...defaultSettings(1440), planLayout: c.planLayout } });
      const { unmount } = renderWithData(<App />);
      expect(printSection(), `${c.view}/${c.planLayout}`).not.toBeNull();
      expect(document.body.querySelectorAll("section.print-plan")).toHaveLength(1);
      unmount();
      expect(printSection()).toBeNull();
    }
  });

  it("prints one heading per planLines entry with the lines, Bez godziny last", () => {
    reset({ favourites: [FRI_10, SAT_11, NO_TIME] });
    renderWithData(<PrintPlan />);
    const section = printSection();
    expect(section).not.toBeNull();
    const headings = Array.from(section?.querySelectorAll("h2") ?? []).map((h) => h.textContent);
    expect(headings).toEqual([labelLong("pt"), labelLong("sob"), "Bez godziny"]);
    const expected = planLines(planSessions(new Set([FRI_10, SAT_11, NO_TIME]), data.sessions), data, index);
    const items = Array.from(section?.querySelectorAll("li") ?? []).map((li) => li.textContent);
    expect(items).toEqual(expected.flatMap((e) => e.lines));
    expect(items[0]).toContain("10:00–11:00 · Poranne światło");
    expect(items[items.length - 1]).toContain("Spotkanie bez godziny");
  });

  it("says the plan is empty when nothing is starred", () => {
    renderWithData(<PrintPlan />);
    expect(printSection()?.textContent).toContain("Twój plan jest pusty");
    expect(printSection()?.querySelectorAll("h2")).toHaveLength(0);
  });
});
