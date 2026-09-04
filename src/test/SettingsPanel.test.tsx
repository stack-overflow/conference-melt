import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RefObject } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { defaultSettings, useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { makeData, makeSession } from "./fixtures/build";

/** Two starts 90 minutes apart, two sessions per start: 2 slots, medianGap 90, sharedRatio 1 → distinguishable. */
const slotted = makeData([
  makeSession({ id: "1:pt", eventId: 1, title: "A", start: 570, end: 630, locationIds: [233] }),
  makeSession({ id: "2:pt", eventId: 2, title: "B", start: 570, end: 630, locationIds: [281] }),
  makeSession({ id: "3:pt", eventId: 3, title: "C", start: 660, end: 720, locationIds: [233] }),
  makeSession({ id: "4:pt", eventId: 4, title: "D", start: 660, end: 720, locationIds: [281] }),
]);
/** One slot only → not distinguishable → auto resolves to timeline. */
const single = makeData([makeSession({ id: "1:pt", eventId: 1, title: "A", start: 570, end: 630 })]);

function renderSheet(data = slotted) {
  return render(
    <DataProvider value={buildAppData(data)}>
      <SettingsPanel variant="sheet" open onClose={() => {}} />
    </DataProvider>,
  );
}

let anchor: HTMLButtonElement | null = null;

function renderPopover() {
  anchor = document.createElement("button");
  anchor.textContent = "Widok";
  document.body.appendChild(anchor);
  const anchorRef: RefObject<HTMLElement | null> = { current: anchor };
  return render(
    <DataProvider value={buildAppData(slotted)}>
      <SettingsPanel variant="popover" anchorRef={anchorRef} open onClose={() => {}} />
    </DataProvider>,
  );
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
    settings: { ...defaultSettings(1280), theme: "dark" },
  });
});

afterEach(() => {
  anchor?.remove();
  anchor = null;
});

describe("SettingsPanel", () => {
  it("renders every control with its Polish label in the sheet variant", () => {
    renderSheet();
    const axis = screen.getByLabelText("Kolumny");
    for (const label of ["Sale", "Typ", "Marka", "Poziom", "Bez grupowania"]) {
      expect(within(axis).getByText(label)).toBeTruthy();
    }
    const time = screen.getByLabelText("Tryb czasu");
    for (const label of ["Auto", "Sloty", "Oś czasu"]) expect(within(time).getByText(label)).toBeTruthy();
    expect(screen.getByLabelText("Tolerancja slotów")).toBeTruthy();
    expect(screen.getByLabelText("Powiększenie")).toBeTruthy();
    const density = screen.getByLabelText("Gęstość");
    for (const label of ["Zwarty", "Wygodny"]) expect(within(density).getByText(label)).toBeTruthy();
    const color = screen.getByLabelText("Kolor");
    for (const label of ["Typ", "Miejsce", "Marka"]) expect(within(color).getByText(label)).toBeTruthy();
    expect(screen.getByLabelText("Zdjęcia prelegentów")).toBeTruthy();
    expect(screen.getByLabelText("Strefy całodniowe w osobnym pasku")).toBeTruthy();
    const theme = screen.getByLabelText("Motyw");
    for (const label of ["System", "Ciemny", "Jasny"]) expect(within(theme).getByText(label)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Przywróć domyślne" })).toBeTruthy();
  });

  it("omits the theme control in the popover variant", () => {
    renderPopover();
    expect(screen.getByLabelText("Kolumny")).toBeTruthy();
    expect(screen.queryByLabelText("Motyw")).toBeNull();
  });

  it("shows the resolved auto mode as Auto (sloty) or Auto (oś czasu)", () => {
    const first = renderSheet(slotted);
    expect(screen.getByText("Auto (sloty)")).toBeTruthy();
    first.unmount();
    renderSheet(single);
    expect(screen.getByText("Auto (oś czasu)")).toBeTruthy();
  });

  it("keeps the auto readout meaningful while a mode is forced", () => {
    useStore.setState({ settings: { ...useStore.getState().settings, timeMode: "timeline" } });
    renderSheet(slotted);
    expect(screen.getByText("Auto (sloty)")).toBeTruthy();
  });

  it("writes the column axis, time mode, density and colour choices", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(within(screen.getByLabelText("Kolumny")).getByText("Marka"));
    expect(useStore.getState().settings.columnAxis).toBe("brand");
    await user.click(within(screen.getByLabelText("Kolumny")).getByText("Bez grupowania"));
    expect(useStore.getState().settings.columnAxis).toBe("none");
    await user.click(within(screen.getByLabelText("Tryb czasu")).getByText("Oś czasu"));
    expect(useStore.getState().settings.timeMode).toBe("timeline");
    await user.click(within(screen.getByLabelText("Gęstość")).getByText("Zwarty"));
    expect(useStore.getState().settings.density).toBe("compact");
    await user.click(within(screen.getByLabelText("Kolor")).getByText("Miejsce"));
    expect(useStore.getState().settings.colorBy).toBe("location");
  });

  it("writes slot tolerance and zoom from the sliders", () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText("Tolerancja slotów"), { target: { value: "30" } });
    expect(useStore.getState().settings.slotTolerance).toBe(30);
    fireEvent.change(screen.getByLabelText("Powiększenie"), { target: { value: "2.4" } });
    expect(useStore.getState().settings.zoom).toBe(2.4);
  });

  it("writes the two toggles", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByLabelText("Zdjęcia prelegentów"));
    expect(useStore.getState().settings.showAvatars).toBe(false);
    await user.click(screen.getByLabelText("Strefy całodniowe w osobnym pasku"));
    expect(useStore.getState().settings.allDayStrip).toBe(false);
  });

  it("writes the theme from the sheet control", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(within(screen.getByLabelText("Motyw")).getByText("Jasny"));
    expect(useStore.getState().settings.theme).toBe("light");
  });

  it("Przywróć domyślne resets the shown fields and leaves the theme alone", async () => {
    const user = userEvent.setup();
    useStore.setState({ settings: { ...useStore.getState().settings, columnAxis: "brand", zoom: 3.6, density: "compact", theme: "dark" } });
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Przywróć domyślne" }));
    const expected = defaultSettings(window.innerWidth);
    const actual = useStore.getState().settings;
    expect(actual.columnAxis).toBe(expected.columnAxis);
    expect(actual.zoom).toBe(expected.zoom);
    expect(actual.density).toBe(expected.density);
    expect(actual.theme).toBe("dark");
  });
});
